# Fixed helper for Rata push-to-talk. Main starts this file with no user/model
# arguments. It writes recognized phrases to stdout and exits when stdin closes.
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Speech
Add-Type -ReferencedAssemblies System.Speech -TypeDefinition @'
using System;
using System.Speech.Recognition;
using System.Threading;

public static class RataListen {
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
        if (result != null && !string.IsNullOrWhiteSpace(result.Text)) {
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

$thread = [System.Threading.Thread]::new([System.Threading.ThreadStart]{ [void][RataListen]::Run() })
$thread.SetApartmentState([System.Threading.ApartmentState]::STA)
$thread.Start()
$thread.Join()
