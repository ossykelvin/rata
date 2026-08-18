# Lists running process ids and executable paths only.
# No window titles, no command lines, no caller-supplied values.
$ErrorActionPreference = 'Stop'
Get-CimInstance -ClassName Win32_Process |
  Where-Object { $_.ExecutablePath } |
  Select-Object -Property ProcessId, ExecutablePath |
  ConvertTo-Json -Compress
