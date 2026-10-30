<#
  Rata text to speech. RATA-004.

  One warm process that speaks on demand. The protocol is deliberately tiny:

      SPEAK|<id>|<base64 utf-8 text>   ->  SPEAKING|<id> ... DONE|<id>
      QUIT                             ->  exits 0

  Why speech is synchronous here, and why there is no CANCEL command
  -----------------------------------------------------------------
  Cancelling is done by killing this process, not by asking it to stop.

  The obvious alternative is SpeakAsync plus a SpeakCompleted handler, so the
  loop stays free to read a CANCEL line. That handler would be a PowerShell
  ScriptBlock invoked as a .NET delegate on a thread-pool thread with no
  runspace attached, which is exactly what killed voice-listen.ps1 earlier in
  this project: the process died with no stderr and exit code 2, and the
  feature looked dead while the engine was fine. Measured cost of killing
  instead: synthesis in progress stops at 26% of a full run, so cancellation
  is immediate and absolute.

  Text arrives base64 encoded so an utterance may contain '|', quotes or
  newlines without a quoting rule, and so nothing in it is ever parsed as a
  command.
#>
param(
  [string]$Voice = '',
  [int]$Rate = 0,
  # Wave-file output exists for tests, which must stay silent. Production
  # passes nothing and speech goes to the default device.
  [string]$WaveOut = ''
)

$ErrorActionPreference = 'Stop'

try {
  Add-Type -AssemblyName System.Speech
  $synth = New-Object System.Speech.Synthesis.SpeechSynthesizer

  if ($Voice) {
    # A voice that is not installed must not be fatal: speaking in the default
    # voice is better than silence, and the caller cannot know what is
    # installed on this machine.
    try { $synth.SelectVoice($Voice) } catch { Write-Output ('WARN|voice-unavailable') }
  }
  if ($Rate -ge -10 -and $Rate -le 10) { $synth.Rate = $Rate }

  if ($WaveOut) { $synth.SetOutputToWaveFile($WaveOut) } else { $synth.SetOutputToDefaultAudioDevice() }

  Write-Output 'READY'
  [Console]::Out.Flush()

  while ($true) {
    $line = [Console]::In.ReadLine()
    # Null means stdin closed: the parent is gone, so stop rather than spin.
    if ($null -eq $line) { break }
    $line = $line.Trim()
    if (-not $line) { continue }
    if ($line -eq 'QUIT') { break }

    $parts = $line.Split('|', 3)
    if ($parts[0] -ne 'SPEAK' -or $parts.Count -lt 3) {
      Write-Output 'ERR|bad-command'
      [Console]::Out.Flush()
      continue
    }

    $id = $parts[1]
    try {
      $text = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String($parts[2]))
    } catch {
      Write-Output ('ERR|bad-encoding|' + $id)
      [Console]::Out.Flush()
      continue
    }

    Write-Output ('SPEAKING|' + $id)
    [Console]::Out.Flush()
    $synth.Speak($text)
    Write-Output ('DONE|' + $id)
    [Console]::Out.Flush()
  }

  $synth.Dispose()
  exit 0
} catch {
  # A fixed message. The exception text can carry machine and device detail.
  Write-Output ('ERR|synthesizer-failed')
  [Console]::Out.Flush()
  exit 2
}
