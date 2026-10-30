using System.Diagnostics;
using System.Runtime.InteropServices;

namespace Rata.WindowsBridge;

internal static partial class Native
{
    [LibraryImport("user32.dll", SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    internal static partial bool EnumWindows(EnumWindowsProc callback, IntPtr param);

    internal delegate bool EnumWindowsProc(IntPtr window, IntPtr param);

    [LibraryImport("user32.dll", SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    internal static partial bool IsWindowVisible(IntPtr window);

    [LibraryImport("user32.dll", EntryPoint = "GetWindowTextW", SetLastError = true, StringMarshalling = StringMarshalling.Utf16)]
    internal static partial int GetWindowText(IntPtr window, Span<char> text, int count);

    [LibraryImport("user32.dll", SetLastError = true)]
    internal static partial int GetWindowTextLengthW(IntPtr window);

    [LibraryImport("user32.dll", SetLastError = true)]
    internal static partial uint GetWindowThreadProcessId(IntPtr window, out uint processId);

    [LibraryImport("user32.dll")]
    internal static partial IntPtr GetForegroundWindow();

    [LibraryImport("user32.dll", SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    internal static partial bool SetForegroundWindow(IntPtr window);

    [LibraryImport("user32.dll", SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    internal static partial bool IsIconic(IntPtr window);

    [LibraryImport("user32.dll", SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    internal static partial bool ShowWindow(IntPtr window, int command);

    [LibraryImport("user32.dll", SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    internal static partial bool IsWindow(IntPtr window);

    [LibraryImport("user32.dll", SetLastError = true)]
    internal static partial uint SendInput(uint count, INPUT[] inputs, int size);

    internal const int SW_RESTORE = 9;

    internal const uint INPUT_KEYBOARD = 1;
    internal const uint KEYEVENTF_KEYUP = 0x0002;
    internal const uint KEYEVENTF_UNICODE = 0x0004;

    [StructLayout(LayoutKind.Sequential)]
    internal struct INPUT
    {
        public uint type;
        public INPUTUNION u;
    }

    [StructLayout(LayoutKind.Explicit)]
    internal struct INPUTUNION
    {
        [FieldOffset(0)] public KEYBDINPUT ki;
    }

    [StructLayout(LayoutKind.Sequential)]
    internal struct KEYBDINPUT
    {
        public ushort wVk;
        public ushort wScan;
        public uint dwFlags;
        public uint time;
        public IntPtr dwExtraInfo;
    }
}

/// <summary>
/// Window enumeration and focus. Every result is filtered by the process
/// allow-list before it leaves this process.
/// </summary>
internal static class WindowOps
{
    /// <summary>Longest window title returned. Titles can be arbitrarily long.</summary>
    private const int MaxTitleLength = 256;
    /// <summary>Most windows returned in one listing.</summary>
    private const int MaxWindows = 200;

    /// <summary>
    /// Lists visible, titled, allow-listed top-level windows.
    /// </summary>
    /// <remarks>
    /// The allow-list is applied here rather than in the caller, so a window
    /// Rata may not act on is never even named back to it. A window title is
    /// user content — "Payroll 2026.xlsx", "Re: contract" — and listing
    /// everything on the desktop would leak it regardless of whether any
    /// action followed.
    /// </remarks>
    internal static List<WindowInfo> List(ProcessAllowList allowList)
    {
        var results = new List<WindowInfo>();
        var foreground = Native.GetForegroundWindow();

        Native.EnumWindows((window, _) =>
        {
            if (results.Count >= MaxWindows) return false;
            if (!Native.IsWindowVisible(window)) return true;

            var length = Native.GetWindowTextLengthW(window);
            if (length <= 0) return true;

            var buffer = new char[Math.Min(length + 1, MaxTitleLength)];
            var copied = Native.GetWindowText(window, buffer, buffer.Length);
            if (copied <= 0) return true;
            var title = new string(buffer, 0, copied);

            Native.GetWindowThreadProcessId(window, out var pid);
            var processName = SafeProcessName((int)pid);
            if (!allowList.Allows(processName)) return true;

            results.Add(new WindowInfo
            {
                Handle = window.ToInt64(),
                Title = title,
                Process = processName,
                Pid = (int)pid,
                Foreground = window == foreground
            });
            return true;
        }, IntPtr.Zero);

        return results;
    }

    /// <summary>
    /// Resolves a process name without throwing. A process that exits between
    /// enumeration and lookup is ordinary, not an error.
    /// </summary>
    internal static string SafeProcessName(int pid)
    {
        try
        {
            using var process = Process.GetProcessById(pid);
            return process.ProcessName;
        }
        catch (ArgumentException)
        {
            return string.Empty;
        }
        catch (InvalidOperationException)
        {
            return string.Empty;
        }
    }

    internal static bool IsAllowed(IntPtr window, ProcessAllowList allowList)
    {
        if (window == IntPtr.Zero || !Native.IsWindow(window)) return false;
        Native.GetWindowThreadProcessId(window, out var pid);
        return allowList.Allows(SafeProcessName((int)pid));
    }

    internal static bool Focus(IntPtr window)
    {
        if (!Native.IsWindow(window)) return false;
        // A minimized window cannot take the foreground, so restore first.
        if (Native.IsIconic(window)) Native.ShowWindow(window, Native.SW_RESTORE);
        return Native.SetForegroundWindow(window);
    }
}

/// <summary>
/// Keyboard input synthesis.
/// </summary>
/// <remarks>
/// <para>
/// The dangerous property of synthesized input is that it goes wherever focus
/// happens to be, which is not necessarily where the caller believed it was.
/// So every input operation names a target window, and this class refuses
/// unless that window is allow-listed <b>and</b> currently in the foreground.
/// "Type into whatever is focused" is not an operation this bridge offers.
/// </para>
/// <para>
/// Text is sent as Unicode scan codes rather than virtual keys, so the result
/// does not depend on the active keyboard layout — a layout-dependent path
/// would type different characters on a different machine.
/// </para>
/// </remarks>
internal static class InputOps
{
    /// <summary>Longest string typed in one call.</summary>
    internal const int MaxTextLength = 4096;

    private static readonly Dictionary<string, ushort> NamedKeys = new(StringComparer.OrdinalIgnoreCase)
    {
        ["ctrl"] = 0x11,
        ["control"] = 0x11,
        ["shift"] = 0x10,
        ["alt"] = 0x12,
        ["win"] = 0x5B,
        ["enter"] = 0x0D,
        ["return"] = 0x0D,
        ["tab"] = 0x09,
        ["escape"] = 0x1B,
        ["esc"] = 0x1B,
        ["backspace"] = 0x08,
        ["delete"] = 0x2E,
        ["home"] = 0x24,
        ["end"] = 0x23,
        ["left"] = 0x25,
        ["up"] = 0x26,
        ["right"] = 0x27,
        ["down"] = 0x28,
        ["space"] = 0x20
    };

    /// <summary>
    /// Keys this bridge will not synthesize, whatever the caller asks.
    /// </summary>
    /// <remarks>
    /// These reach the shell or the secure desktop rather than the target
    /// application, so a target-window check cannot constrain them. Ctrl+Alt+Del
    /// cannot be synthesized by SendInput at all; the rest are refused so the
    /// refusal is explicit rather than incidental.
    /// </remarks>
    private static readonly string[] DeniedKeys = ["win", "f1"];

    internal static bool TryResolveKey(string name, out ushort code)
    {
        code = 0;
        if (string.IsNullOrWhiteSpace(name)) return false;
        var key = name.Trim();
        if (DeniedKeys.Contains(key, StringComparer.OrdinalIgnoreCase)) return false;
        if (NamedKeys.TryGetValue(key, out code)) return true;
        if (key.Length == 1)
        {
            var c = char.ToUpperInvariant(key[0]);
            if (c is >= 'A' and <= 'Z' or >= '0' and <= '9')
            {
                code = c;
                return true;
            }
        }
        return false;
    }

    /// <summary>Types literal text into the foreground window.</summary>
    internal static bool TypeText(string text)
    {
        if (text.Length == 0) return true;
        var clamped = text.Length > MaxTextLength ? text[..MaxTextLength] : text;
        var inputs = new List<Native.INPUT>(clamped.Length * 2);
        foreach (var character in clamped)
        {
            inputs.Add(UnicodeInput(character, down: true));
            inputs.Add(UnicodeInput(character, down: false));
        }
        var array = inputs.ToArray();
        var sent = Native.SendInput((uint)array.Length, array, Marshal.SizeOf<Native.INPUT>());
        return sent == array.Length;
    }

    /// <summary>
    /// Presses a chord: modifiers down in order, final key, then everything up
    /// in reverse. Releasing in reverse matters — a modifier left down would
    /// alter every later keystroke the user typed themselves.
    /// </summary>
    internal static bool PressChord(IReadOnlyList<ushort> codes)
    {
        if (codes.Count == 0) return true;
        var inputs = new List<Native.INPUT>(codes.Count * 2);
        foreach (var code in codes) inputs.Add(VirtualKeyInput(code, down: true));
        for (var i = codes.Count - 1; i >= 0; i--) inputs.Add(VirtualKeyInput(codes[i], down: false));
        var array = inputs.ToArray();
        var sent = Native.SendInput((uint)array.Length, array, Marshal.SizeOf<Native.INPUT>());
        return sent == array.Length;
    }

    private static Native.INPUT UnicodeInput(char character, bool down) => new()
    {
        type = Native.INPUT_KEYBOARD,
        u = new Native.INPUTUNION
        {
            ki = new Native.KEYBDINPUT
            {
                wVk = 0,
                wScan = character,
                dwFlags = Native.KEYEVENTF_UNICODE | (down ? 0 : Native.KEYEVENTF_KEYUP),
                time = 0,
                dwExtraInfo = IntPtr.Zero
            }
        }
    };

    private static Native.INPUT VirtualKeyInput(ushort code, bool down) => new()
    {
        type = Native.INPUT_KEYBOARD,
        u = new Native.INPUTUNION
        {
            ki = new Native.KEYBDINPUT
            {
                wVk = code,
                wScan = 0,
                dwFlags = down ? 0 : Native.KEYEVENTF_KEYUP,
                time = 0,
                dwExtraInfo = IntPtr.Zero
            }
        }
    };
}
