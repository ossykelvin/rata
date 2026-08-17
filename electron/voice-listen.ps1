# Fixed helper for Rata push-to-talk. Main starts this file with no user/model
# arguments. It reads one-word commands on stdin, writes "confidence|text" to
# stdout, and exits when stdin closes.
#
# Commands: LISTEN acquires the microphone and recognises until STOP.
#           STOP releases the microphone and waits.
#           QUIT exits.
#
# The process stays alive between presses on purpose. Measured on this
# hardware: PowerShell start, assembly load and Add-Type compilation cost about
# 1.2s and happen once per process, while acquiring the microphone costs 25ms
# and releasing it 9ms. Spawning a fresh process per press therefore put a
# ~1.4s dead window at the front of every push-to-talk, which is exactly when
# people start speaking. Keeping the process warm and only moving the audio
# input makes a press live in about 25ms.
#
# The microphone is still genuinely released on STOP via SetInputToNull(), so
# a warm process does not mean an open microphone.
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Speech
Add-Type -ReferencedAssemblies System.Speech -TypeDefinition @'
using System;
using System.Globalization;
using System.Speech.Recognition;
using System.Threading;

public static class RataListen {
  static volatile bool listening = false;
  static volatile bool quit = false;

  public static int Run() {
    var info = PickRecognizer();
    if (info == null) {
      Console.Error.WriteLine("NO_ENGINE");
      return 3;
    }

    var reader = new Thread(() => {
      try {
        string line;
        while ((line = Console.ReadLine()) != null) {
          var command = line.Trim().ToUpperInvariant();
          if (command == "LISTEN") listening = true;
          else if (command == "STOP") listening = false;
          else if (command == "QUIT") { quit = true; break; }
        }
      } catch { }
      quit = true;
    });
    reader.IsBackground = true;
    reader.Start();

    using (var engine = new SpeechRecognitionEngine(info)) {
      engine.LoadGrammar(new DictationGrammar());
      engine.InitialSilenceTimeout = TimeSpan.FromSeconds(15);
      engine.BabbleTimeout = TimeSpan.FromSeconds(4);
      engine.EndSilenceTimeout = TimeSpan.FromMilliseconds(500);

      bool micOpen = false;
      Console.Error.WriteLine("READY");
      Console.Error.Flush();

      while (!quit) {
        if (!listening) {
          if (micOpen) {
            try { engine.SetInputToNull(); } catch { }
            micOpen = false;
          }
          Thread.Sleep(25);
          continue;
        }

        if (!micOpen) {
          try {
            engine.SetInputToDefaultAudioDevice();
            micOpen = true;
          } catch {
            Console.Error.WriteLine("NO_MIC");
            Console.Error.Flush();
            listening = false;
            Thread.Sleep(200);
            continue;
          }
        }

        RecognitionResult result = null;
        try {
          result = engine.Recognize(TimeSpan.FromSeconds(2));
        } catch {
          continue;
        }

        // Every result is emitted as "confidence|text". The decision to keep
        // or discard belongs in voice-win.cjs, not here, so that a discarded
        // result can still be audited. A gate applied inside this script is
        // invisible: the app cannot tell "heard nothing" from "heard something
        // and threw it away".
        if (result != null && !string.IsNullOrWhiteSpace(result.Text)) {
          Console.WriteLine(result.Confidence.ToString("0.000", CultureInfo.InvariantCulture) + "|" + result.Text.Trim());
          Console.Out.Flush();
        }
      }

      if (micOpen) { try { engine.SetInputToNull(); } catch { } }
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
# powershell.exe exits with code 2 before Run() is ever entered.
#
# The thread was also unnecessary: powershell.exe 5.1 already runs its main
# thread in STA, which is what System.Speech wants.
exit [RataListen]::Run()
