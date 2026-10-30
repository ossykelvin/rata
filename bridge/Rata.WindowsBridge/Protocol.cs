using System.Text.Json;
using System.Text.Json.Serialization;

namespace Rata.WindowsBridge;

/// <summary>
/// One request from Rata. Newline-delimited JSON over a named pipe.
/// </summary>
/// <remarks>
/// <para>
/// Every request carries an <see cref="Id"/>. It is echoed on the response and
/// written to stderr with any diagnostic, so one line in Rata's activity log
/// can be matched to one call into this process. RATA-005 requires a per-call
/// audit correlation ID, and a bridge that holds UI Automation and input
/// synthesis is exactly where an unattributable action would matter most.
/// </para>
/// </remarks>
internal sealed record BridgeRequest
{
    [JsonPropertyName("id")]
    public string Id { get; init; } = string.Empty;

    [JsonPropertyName("op")]
    public string Op { get; init; } = string.Empty;

    /// <summary>Window handle the operation targets, where one applies.</summary>
    [JsonPropertyName("handle")]
    public long Handle { get; init; }

    /// <summary>UI Automation element id, for inspect/invoke/set-value.</summary>
    [JsonPropertyName("elementId")]
    public string? ElementId { get; init; }

    [JsonPropertyName("value")]
    public string? Value { get; init; }

    /// <summary>Virtual-key names for a key operation, e.g. ["ctrl","s"].</summary>
    [JsonPropertyName("keys")]
    public string[]? Keys { get; init; }

    /// <summary>Token presented by the client on the hello frame only.</summary>
    [JsonPropertyName("token")]
    public string? Token { get; init; }

    /// <summary>
    /// Process names Rata is willing to act on. Intersected with this process's
    /// own compiled-in list; see <see cref="ProcessAllowList"/>.
    /// </summary>
    [JsonPropertyName("allow")]
    public string[]? Allow { get; init; }
}

internal sealed record BridgeResponse
{
    [JsonPropertyName("id")]
    public string Id { get; init; } = string.Empty;

    [JsonPropertyName("ok")]
    public bool Ok { get; init; }

    /// <summary>
    /// A fixed, caller-safe reason. Never an exception message: UI Automation
    /// and Win32 errors carry window titles, file paths and user names, and
    /// this string crosses back into Rata's audit log.
    /// </summary>
    [JsonPropertyName("error")]
    public string? Error { get; init; }

    [JsonPropertyName("windows")]
    public IReadOnlyList<WindowInfo>? Windows { get; init; }

    [JsonPropertyName("element")]
    public ElementInfo? Element { get; init; }

    [JsonPropertyName("elements")]
    public IReadOnlyList<ElementInfo>? Elements { get; init; }

    public static BridgeResponse Failure(string id, string error) => new() { Id = id, Ok = false, Error = error };

    public static BridgeResponse Success(string id) => new() { Id = id, Ok = true };
}

internal sealed record WindowInfo
{
    [JsonPropertyName("handle")]
    public long Handle { get; init; }

    [JsonPropertyName("title")]
    public string Title { get; init; } = string.Empty;

    [JsonPropertyName("process")]
    public string Process { get; init; } = string.Empty;

    [JsonPropertyName("pid")]
    public int Pid { get; init; }

    [JsonPropertyName("foreground")]
    public bool Foreground { get; init; }
}

internal sealed record ElementInfo
{
    [JsonPropertyName("elementId")]
    public string ElementId { get; init; } = string.Empty;

    [JsonPropertyName("name")]
    public string Name { get; init; } = string.Empty;

    [JsonPropertyName("controlType")]
    public string ControlType { get; init; } = string.Empty;

    [JsonPropertyName("automationId")]
    public string AutomationId { get; init; } = string.Empty;

    [JsonPropertyName("enabled")]
    public bool Enabled { get; init; }

    /// <summary>Which patterns this element actually supports.</summary>
    [JsonPropertyName("canInvoke")]
    public bool CanInvoke { get; init; }

    [JsonPropertyName("canSetValue")]
    public bool CanSetValue { get; init; }
}

internal static class Protocol
{
    internal static readonly JsonSerializerOptions Options = new()
    {
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
        // No indentation: one response per line is the framing.
        WriteIndented = false
    };

    /// <summary>
    /// Longest line this process will read, in characters.
    /// </summary>
    /// <remarks>
    /// An unbounded ReadLine on a pipe is a memory-exhaustion primitive for any
    /// caller that can connect. The limit is generous for a legitimate request
    /// and refuses anything that is not one.
    /// </remarks>
    internal const int MaxLineLength = 64 * 1024;

    internal static BridgeRequest? TryParse(string line)
    {
        try
        {
            return JsonSerializer.Deserialize<BridgeRequest>(line, Options);
        }
        catch (JsonException)
        {
            return null;
        }
    }

    internal static string Serialize(BridgeResponse response) => JsonSerializer.Serialize(response, Options);
}
