# Focus the main window of a process. The only input is -ProcessId, a
# ValidateRange integer passed as a separate argument — never interpolated
# into this script body.
param(
  [Parameter(Mandatory = $true)]
  [ValidateRange(1, 2147483647)]
  [int]$ProcessId
)
$ErrorActionPreference = 'Stop'
Add-Type @"
using System;
using System.Runtime.InteropServices;
public static class RataNativeFocus {
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern bool ShowWindowAsync(IntPtr hWnd, int nCmdShow);
  [DllImport("user32.dll")] public static extern bool IsIconic(IntPtr hWnd);
}
"@
$process = Get-Process -Id $ProcessId -ErrorAction Stop
if ($process.MainWindowHandle -eq [IntPtr]::Zero) { exit 2 }
if ([RataNativeFocus]::IsIconic($process.MainWindowHandle)) {
  [void][RataNativeFocus]::ShowWindowAsync($process.MainWindowHandle, 9)
}
if (-not [RataNativeFocus]::SetForegroundWindow($process.MainWindowHandle)) { exit 3 }
