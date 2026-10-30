using System.IO;
using System.IO.Pipes;
using System.Security.AccessControl;
using System.Security.Principal;
using System.Text;

namespace Rata.WindowsBridge;

/// <summary>
/// Rata's native Windows bridge. RATA-005 / ADR-024.
/// </summary>
/// <remarks>
/// <para>
/// A single-client named-pipe server. Rata spawns it, hands it a pipe name on
/// the command line and a token in the environment, and speaks
/// newline-delimited JSON to it.
/// </para>
/// <para>
/// One client at a time, by construction. A server that accepted concurrent
/// clients would have to arbitrate input synthesis between them, and there is
/// no sensible answer to "two callers are typing into the same window".
/// </para>
/// </remarks>
internal static class Program
{
    /// <summary>Exit codes, so a spawn failure is diagnosable from Rata.</summary>
    private const int ExitOk = 0;
    private const int ExitUsage = 64;
    private const int ExitNoToken = 65;

    private static int Main(string[] args)
    {
        var pipeName = args.Length > 0 ? args[0] : string.Empty;
        if (string.IsNullOrWhiteSpace(pipeName) || pipeName.Length > 128)
        {
            Console.Error.WriteLine("bridge|fatal|missing-pipe-name");
            return ExitUsage;
        }

        var expectedToken = Authentication.ReadExpectedToken(Environment.GetEnvironmentVariable);
        if (expectedToken is null)
        {
            // Fail closed. "No credential configured" cannot mean "accept
            // everyone" in a process that can drive another application's UI.
            Console.Error.WriteLine("bridge|fatal|missing-token");
            return ExitNoToken;
        }

        using var server = CreateServer(pipeName);
        // Announced on stderr so Rata knows the pipe exists before it connects,
        // rather than racing the server with a retry loop.
        Console.Error.WriteLine("bridge|ready");

        server.WaitForConnection();
        try
        {
            Serve(server, expectedToken);
        }
        finally
        {
            if (server.IsConnected) server.Disconnect();
        }
        return ExitOk;
    }

    /// <summary>
    /// Creates the pipe with an ACL that allows only the account that created
    /// it.
    /// </summary>
    /// <remarks>
    /// Without an explicit ACL the default DACL would be inherited, which on
    /// some configurations is wider than the current user. The pipe carries UI
    /// Automation and input synthesis, so the access check belongs on the
    /// object rather than only in the handshake.
    /// </remarks>
    private static NamedPipeServerStream CreateServer(string pipeName)
    {
        var identity = WindowsIdentity.GetCurrent();
        var owner = identity.User ?? throw new InvalidOperationException("No user SID.");
        var security = new PipeSecurity();
        security.AddAccessRule(new PipeAccessRule(owner, PipeAccessRights.FullControl, AccessControlType.Allow));

        return NamedPipeServerStreamAcl.Create(
            pipeName,
            PipeDirection.InOut,
            maxNumberOfServerInstances: 1,
            PipeTransmissionMode.Byte,
            PipeOptions.Asynchronous,
            inBufferSize: 0,
            outBufferSize: 0,
            security);
    }

    private static void Serve(NamedPipeServerStream server, string expectedToken)
    {
        using var reader = new StreamReader(server, new UTF8Encoding(false), detectEncodingFromByteOrderMarks: false, bufferSize: 4096, leaveOpen: true);
        using var writer = new StreamWriter(server, new UTF8Encoding(false), bufferSize: 4096, leaveOpen: true) { AutoFlush = true };

        var authenticated = false;
        ProcessAllowList allowList = ProcessAllowList.Create(null);
        var automation = new AutomationSession();

        while (true)
        {
            var line = ReadLine(reader);
            if (line is null) break;
            if (line.Length == 0) continue;

            if (line.Length > Protocol.MaxLineLength)
            {
                Respond(writer, BridgeResponse.Failure("unknown", "Request was too large."));
                break;
            }

            var request = Protocol.TryParse(line);
            if (request is null || string.IsNullOrWhiteSpace(request.Id) || string.IsNullOrWhiteSpace(request.Op))
            {
                Respond(writer, BridgeResponse.Failure("unknown", "Request was not understood."));
                continue;
            }

            if (!authenticated)
            {
                // Exactly one operation is available before authentication, and
                // a failed attempt ends the session rather than allowing
                // retries down the same pipe.
                if (request.Op != "hello" || !Authentication.TokenMatches(expectedToken, request.Token))
                {
                    Console.Error.WriteLine($"bridge|{request.Id}|refused-unauthenticated");
                    Respond(writer, BridgeResponse.Failure(request.Id, "Not authenticated."));
                    break;
                }
                authenticated = true;
                allowList = ProcessAllowList.Create(request.Allow);
                Console.Error.WriteLine($"bridge|{request.Id}|authenticated|allow={allowList.Count}");
                Respond(writer, BridgeResponse.Success(request.Id));
                continue;
            }

            Respond(writer, Dispatch(request, allowList, automation));
        }

        automation.Clear();
    }

    /// <summary>
    /// Reads one line, refusing a line longer than the protocol allows.
    /// </summary>
    /// <remarks>
    /// StreamReader.ReadLine would buffer without limit, which is a
    /// memory-exhaustion primitive for anything that can connect to the pipe.
    /// </remarks>
    private static string? ReadLine(StreamReader reader)
    {
        var builder = new StringBuilder();
        while (true)
        {
            var next = reader.Read();
            if (next < 0) return builder.Length > 0 ? builder.ToString() : null;
            var character = (char)next;
            if (character == '\n') return builder.ToString();
            if (character == '\r') continue;
            if (builder.Length >= Protocol.MaxLineLength) return builder.ToString();
            builder.Append(character);
        }
    }

    private static BridgeResponse Dispatch(BridgeRequest request, ProcessAllowList allowList, AutomationSession automation)
    {
        var window = new IntPtr(request.Handle);

        switch (request.Op)
        {
            case "window.list":
                return new BridgeResponse { Id = request.Id, Ok = true, Windows = WindowOps.List(allowList) };

            case "window.focus":
                if (!WindowOps.IsAllowed(window, allowList)) return Refuse(request, "That window is not one Rata may control.");
                return WindowOps.Focus(window)
                    ? BridgeResponse.Success(request.Id)
                    : BridgeResponse.Failure(request.Id, "That window could not be focused.");

            case "ua.inspect":
                if (!WindowOps.IsAllowed(window, allowList)) return Refuse(request, "That window is not one Rata may inspect.");
                return new BridgeResponse { Id = request.Id, Ok = true, Elements = automation.Inspect(window) };

            case "ua.invoke":
                if (!WindowOps.IsAllowed(window, allowList)) return Refuse(request, "That window is not one Rata may control.");
                if (string.IsNullOrWhiteSpace(request.ElementId)) return BridgeResponse.Failure(request.Id, "No element was named.");
                return automation.Invoke(request.ElementId, out var invokeError)
                    ? BridgeResponse.Success(request.Id)
                    : BridgeResponse.Failure(request.Id, invokeError);

            case "ua.setValue":
                if (!WindowOps.IsAllowed(window, allowList)) return Refuse(request, "That window is not one Rata may control.");
                if (string.IsNullOrWhiteSpace(request.ElementId)) return BridgeResponse.Failure(request.Id, "No element was named.");
                if (request.Value is null) return BridgeResponse.Failure(request.Id, "No value was supplied.");
                return automation.SetValue(request.ElementId, request.Value, out var valueError)
                    ? BridgeResponse.Success(request.Id)
                    : BridgeResponse.Failure(request.Id, valueError);

            case "input.type":
                {
                    var guard = GuardInput(request, window, allowList);
                    if (guard is not null) return guard;
                    if (string.IsNullOrEmpty(request.Value)) return BridgeResponse.Failure(request.Id, "No text was supplied.");
                    return InputOps.TypeText(request.Value)
                        ? BridgeResponse.Success(request.Id)
                        : BridgeResponse.Failure(request.Id, "Input could not be delivered.");
                }

            case "input.key":
                {
                    var guard = GuardInput(request, window, allowList);
                    if (guard is not null) return guard;
                    if (request.Keys is null || request.Keys.Length == 0) return BridgeResponse.Failure(request.Id, "No keys were supplied.");
                    if (request.Keys.Length > 4) return BridgeResponse.Failure(request.Id, "That key combination is too long.");
                    var codes = new List<ushort>(request.Keys.Length);
                    foreach (var name in request.Keys)
                    {
                        if (!InputOps.TryResolveKey(name, out var code)) return BridgeResponse.Failure(request.Id, "That key is not available.");
                        codes.Add(code);
                    }
                    return InputOps.PressChord(codes)
                        ? BridgeResponse.Success(request.Id)
                        : BridgeResponse.Failure(request.Id, "Input could not be delivered.");
                }

            default:
                return BridgeResponse.Failure(request.Id, "That operation is not supported.");
        }
    }

    /// <summary>
    /// The guard that makes input synthesis safe enough to offer at all.
    /// </summary>
    /// <remarks>
    /// Synthesized input goes wherever focus is, not where the caller believed
    /// it was. So the target window must be allow-listed <b>and</b> currently in
    /// the foreground. Without the foreground check, a keystroke intended for
    /// Notepad could land in a password prompt that stole focus between the
    /// approval and the call.
    /// </remarks>
    private static BridgeResponse? GuardInput(BridgeRequest request, IntPtr window, ProcessAllowList allowList)
    {
        if (!WindowOps.IsAllowed(window, allowList)) return Refuse(request, "That window is not one Rata may type into.");
        if (Native.GetForegroundWindow() != window)
        {
            Console.Error.WriteLine($"bridge|{request.Id}|refused-not-foreground");
            return BridgeResponse.Failure(request.Id, "That window is not in the foreground.");
        }
        return null;
    }

    private static BridgeResponse Refuse(BridgeRequest request, string reason)
    {
        // Audited with the correlation id, without the window title or process
        // name: a refusal should not become a way to enumerate the desktop.
        Console.Error.WriteLine($"bridge|{request.Id}|refused-not-allowed|{request.Op}");
        return BridgeResponse.Failure(request.Id, reason);
    }

    private static void Respond(StreamWriter writer, BridgeResponse response)
    {
        try
        {
            writer.Write(Protocol.Serialize(response));
            writer.Write('\n');
        }
        catch (IOException)
        {
            // The client went away mid-response. Nothing to report it to.
        }
    }
}
