using System.Security.Cryptography;
using System.Text;

namespace Rata.WindowsBridge;

/// <summary>
/// Authentication for the local pipe. RATA-005.
/// </summary>
/// <remarks>
/// <para>
/// Two independent controls, because they stop different things:
/// </para>
/// <list type="bullet">
/// <item>
/// The pipe's ACL allows only the account that created it, so no other user on
/// the machine can connect at all.
/// </item>
/// <item>
/// A per-launch token, which the client must present on its first frame, so an
/// arbitrary process belonging to the *same* user cannot drive the bridge
/// simply by knowing the pipe name. The pipe name is not a secret; the token
/// is.
/// </item>
/// </list>
/// <para>
/// What this does not defend against, stated plainly rather than implied away:
/// a process already running as this user with debug rights can read another
/// process's environment and recover the token. That is not a boundary this
/// bridge can hold — at that point the attacker can also inject into Rata
/// itself. The token's job is to make driving the bridge require deliberate
/// theft rather than a pipe name, and to make an unauthenticated caller a
/// refusal rather than a capability.
/// </para>
/// <para>
/// The token arrives in an environment variable, never on the command line: an
/// argument vector is readable from any process listing on the machine, which
/// would make the secret public to every user.
/// </para>
/// </remarks>
internal static class Authentication
{
    internal const string TokenVariable = "RATA_BRIDGE_TOKEN";
    /// <summary>Shortest token accepted. Rata generates 32 random bytes.</summary>
    internal const int MinimumTokenLength = 32;

    /// <summary>
    /// Reads the expected token, or null when the host did not supply a usable
    /// one. A missing or short token means this process refuses every caller:
    /// failing closed is the only safe reading of "no credential configured".
    /// </summary>
    internal static string? ReadExpectedToken(Func<string, string?> readEnvironment)
    {
        var token = readEnvironment(TokenVariable);
        if (string.IsNullOrWhiteSpace(token)) return null;
        return token.Length < MinimumTokenLength ? null : token;
    }

    /// <summary>
    /// Compares tokens in constant time.
    /// </summary>
    /// <remarks>
    /// String equality short-circuits on the first differing byte, which leaks
    /// a prefix oracle to a caller who can retry. A local attacker can retry
    /// quickly, so the comparison is fixed-time even though the pipe is local.
    /// </remarks>
    internal static bool TokenMatches(string? expected, string? presented)
    {
        if (expected is null || presented is null) return false;
        var a = Encoding.UTF8.GetBytes(expected);
        var b = Encoding.UTF8.GetBytes(presented);
        return CryptographicOperations.FixedTimeEquals(a, b);
    }
}

/// <summary>
/// Which processes this bridge will act on. RATA-005 "process allow-list
/// foundations".
/// </summary>
/// <remarks>
/// <para>
/// The effective list is the <b>intersection</b> of this compiled-in list and
/// whatever Rata asks for on the hello frame. Rata may narrow the list; it can
/// never widen it.
/// </para>
/// <para>
/// That ordering is the point. Rata's main process is already fully privileged,
/// so this is not a defence against Rata — it is a defence against a mistake
/// in Rata, or a tool input that reaches further than intended. The bridge can
/// drive another application's UI and synthesize keystrokes into it, so the
/// set of applications it will ever touch belongs in the component that does
/// the touching, not only in the component that asks.
/// </para>
/// <para>
/// Deliberately excluded, and not negotiable from the host: credential and
/// security surfaces. Typing into a password manager, a UAC prompt or the
/// Windows security dialog is the confused-deputy case this list exists to
/// prevent.
/// </para>
/// </remarks>
internal sealed class ProcessAllowList
{
    /// <summary>
    /// The widest set this build will ever act on. Ordinary user-facing
    /// applications only.
    /// </summary>
    private static readonly string[] Compiled =
    [
        "notepad",
        "calc",
        "calculator",
        "wordpad",
        "explorer",
        "msedge",
        "chrome",
        "firefox",
        "winword",
        "excel",
        "powerpnt",
        "outlook",
        "onenote",
        "code",
        "notepad++"
    ];

    /// <summary>
    /// Never acted on, whatever the host requests. These are the surfaces where
    /// a synthesized keystroke or an invoked button is a privilege decision
    /// rather than a convenience.
    /// </summary>
    private static readonly string[] Denied =
    [
        "consent",          // UAC
        "credentialuibroker",
        "lsass",
        "winlogon",
        "logonui",
        "cmd",
        "powershell",
        "pwsh",
        "wt",
        "regedit",
        "mmc",
        "taskmgr",
        "keepass",
        "keepassxc",
        "1password",
        "bitwarden",
        "lastpass",
        "dashlane"
    ];

    private readonly HashSet<string> _effective;

    private ProcessAllowList(HashSet<string> effective) => _effective = effective;

    /// <summary>
    /// Builds the effective list. A host that sends no list gets the compiled
    /// one; a host that sends a list gets the intersection.
    /// </summary>
    internal static ProcessAllowList Create(IEnumerable<string>? requested)
    {
        var compiled = new HashSet<string>(Compiled, StringComparer.OrdinalIgnoreCase);
        if (requested is null)
        {
            return new ProcessAllowList(compiled);
        }

        var narrowed = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        foreach (var name in requested)
        {
            var normalized = Normalize(name);
            // Intersection, not union: an unknown name from the host is
            // dropped rather than trusted.
            if (normalized.Length > 0 && compiled.Contains(normalized)) narrowed.Add(normalized);
        }

        // An empty intersection means the host asked for nothing this build
        // allows. Returning the compiled list there would silently widen the
        // request, so the empty set stands and every call is refused.
        return new ProcessAllowList(narrowed);
    }

    /// <summary>
    /// Strips any path and extension, so "C:\\Windows\\notepad.exe", "Notepad.exe"
    /// and "notepad" compare equal and a caller cannot evade the list by
    /// spelling the same program differently.
    /// </summary>
    internal static string Normalize(string? processName)
    {
        if (string.IsNullOrWhiteSpace(processName)) return string.Empty;
        var name = processName.Trim();
        var slash = name.LastIndexOfAny(['\\', '/']);
        if (slash >= 0 && slash + 1 < name.Length) name = name[(slash + 1)..];
        if (name.EndsWith(".exe", StringComparison.OrdinalIgnoreCase)) name = name[..^4];
        return name;
    }

    internal bool Allows(string? processName)
    {
        var normalized = Normalize(processName);
        if (normalized.Length == 0) return false;
        // Denied wins, always, and is not affected by what the host requested.
        if (Denied.Contains(normalized, StringComparer.OrdinalIgnoreCase)) return false;
        return _effective.Contains(normalized);
    }

    internal int Count => _effective.Count;
}
