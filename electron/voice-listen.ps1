# Fixed helper for Rata push-to-talk. Main starts this file with no user/model
# arguments. It writes recognized phrases to stdout and exits when stdin closes.
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Speech
Add-Type -ReferencedAssemblies System.Speech -TypeDefinition @'
using System;
using System.Speech.Recognition;
using System.Threading;

public static class RataListen {
  const float MinConfidence = 0.4f;

  public static int Run() {
    var info = PickRecognizer();
    if (info == null) {
      Console.Error.WriteLine("NO_ENGINE");
      return 3;
    }

    var stop = new ManualResetEvent(false);
    var reader = new Thread(() => {
      try { Console.ReadLine(); } catch { }
      stop.Set();
    });
    reader.IsBackground = true;
    reader.Start();

    using (var engine = new SpeechRecognitionEngine(info)) {
      try {
        engine.SetInputToDefaultAudioDevice();
      } catch {
        Console.Error.WriteLine("NO_MIC");
        return 2;
      }

      engine.LoadGrammar(new DictationGrammar());
      engine.InitialSilenceTimeout = TimeSpan.FromSeconds(15);
      engine.BabbleTimeout = TimeSpan.FromSeconds(4);
      engine.EndSilenceTimeout = TimeSpan.FromMilliseconds(500);

      while (!stop.WaitOne(0)) {
        RecognitionResult result = null;
        try {
          result = engine.Recognize(TimeSpan.FromSeconds(2));
        } catch {
          continue;
        }
        // Dictation returns a best guess for almost any audio, including an
        // empty room. Measured on this hardware: ambient noise produced
        // "And if we're" at 0.225 and "Three" at 0.323, while a clean spoken
        // phrase scored 0.681. Anything below the gate is discarded, and the
        // renderer already tells the user "I didn't catch that" when a session
        // produces no transcript, so a dropped guess degrades to a retry
        // prompt rather than nonsense in the input box.
        if (result != null && result.Confidence >= MinConfidence && !string.IsNullOrWhiteSpace(result.Text)) {
          Console.WriteLine(result.Text.Trim());
          Console.Out.Flush();
        }
      }
    }

    return 0;
  }

  static RecognizerInfo PickRecognizer() {
    RecognizerInfo fallback = null;
    RecognizerInfo british = null;
    foreach (RecognizerInfo info in SpeechRecognitionEngine.InstalledRecognizers()) {
      if (fallback == null) fallback = info;
      var name = info.Culture.Name;
      if (string.Equals(name, "en-US", StringComparison.OrdinalIgnoreCase)) return info;
      if (string.Equals(name, "en-GB", StringComparison.OrdinalIgnoreCase)) british = info;
    }
    return british ?? fallback;
  }
}
'@

# Call Run() directly on the host's own thread.
#
# This used to marshal the call onto a new [System.Threading.Thread] built from
# a PowerShell ScriptBlock, to force an STA apartment. That silently killed the
# process: a ScriptBlock delegate has no runspace on a raw .NET thread, the
# failure is not catchable from the script, nothing reaches stderr, and
# powershell.exe exits with code 2 before Run() is ever entered. Voice
# recognition therefore never started, and no NO_MIC/NO_ENGINE diagnostic could
# ever be produced.
#
# The thread was also unnecessary: powershell.exe 5.1 already runs its main
# thread in STA, which is what System.Speech wants.
exit [RataListen]::Run()
