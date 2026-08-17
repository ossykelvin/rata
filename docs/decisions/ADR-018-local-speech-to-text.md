# ADR-018: Local speech to text via Handy

> Renumbered from ADR-013. RATA-009 and the session-continuity work both landed
> on 2026-08-17 and both claimed 013. Session continuity merged first and keeps
> the number; this one moved rather than leaving two ADR-013s in the sequence.

Status: Proposed — requires Claude security review before acceptance

## Context

Push-to-talk used the Windows desktop dictation engine driven by a PowerShell
child process. After four fixes (FIX-005 to FIX-008) the mechanism finally
worked end to end, and the remaining problem was accuracy, which no amount of
plumbing could solve. Measured on this hardware, the engine returned:

- "open notepad" → "eat one C"
- "what is the weather in preston" → "what are"
- an empty room → "Bolivia or rue band and I cannot believe this wrath"

Real speech scored 0.003 to 0.167 confidence while ambient noise scored 0.085
to 0.323. Those ranges overlap, so the engine could not distinguish a spoken
phrase from a quiet room. That is a limit of the recognizer, not of the code
around it.

Handy is an MIT-licensed, fully offline transcriber built on whisper.cpp-family
models. On the same audio it returned "Open notepad and check the weather in
Preston." exactly.

## Decision

**Use only Handy's headless batch mode.** `handy.exe --transcribe-file <WAV>
--model <id> --json`. Nothing launches its UI, its global shortcut, or its
clipboard paste. Rata records the audio and asks for text.

**Handy is optional.** When it is not installed the Windows recognizer remains
the fallback, so the feature degrades rather than disappearing. The absence is
reported once at startup as an ordinary activity entry.

**Recording moves to the renderer.** `getUserMedia` captures at the device rate
and `useAudioRecorder.ts` downsamples to 16 kHz mono and encodes PCM WAV, with
no dependencies. This reverses an earlier property that the renderer never
touched audio, and the reversal is deliberate: Electron has no dependency-free
way to capture a microphone in the main process, which is the reason the
PowerShell recognizer existed at all. Capture in the renderer is gated by
`decideRendererPermission()` in `electron/security.cjs`, the same boundary the
recognizer uses, not a second one. A compromised renderer could call
`getUserMedia` whatever this code contains, so the permission handler is what
protects the microphone; the absence of the call never was.

**The renderer is not a boundary, so audio is validated twice.** Size and
RIFF/WAVE shape are checked in `packages/contracts/ipc-validation.cjs` at the
IPC edge and again in `electron/handy-stt.cjs` before anything is written to
disk or a process is spawned.

**The executable and its arguments are fixed in the main process.** The path is
resolved from known install locations and never supplied by the renderer or a
model. Arguments are a literal list whose only variable is a temp path this
module created. `execFile` is used rather than a shell, so nothing is
word-split or expanded. The renderer cannot choose a model, a device, or any
other flag.

**The recording is treated as the user's voice.** It is written to a randomly
named temp file and removed in a `finally` block on every path, including
failure. The transcript is never written to an audit event; only length,
duration and backend are logged. Failure messages are fixed strings, because
Handy's stderr carries model paths and machine detail.

**The microphone gate is re-checked at transcription time.** Chromium already
refused capture when the setting is off, but a renderer could hold a recording
made while it was on and submit it afterwards. `isMicrophoneEnabled()` is the
single source of truth and is consulted again in the IPC handler.

**The model is warmed at startup.** The first transcription after installing
costs about 20 seconds while the GPU shader cache is built; later ones are
about 2 seconds. Without a warm-up the user's first attempt looks broken, which
is precisely the failure this feature has repeatedly suffered from. Warm-up
failure is never fatal.

## Consequences

Accuracy goes from unusable to correct. Measured cost per press is about 2.1
seconds wall clock, of which roughly 350 ms is inference, 450 ms is model load
and 1.3 s is Handy's own application start.

Speech still never leaves the machine. Handy is offline and `--transcribe-file`
performs no download, so this adds no network egress and needs no confirmation
setting, unlike the file and weather tools.

The user must install Handy and one model separately. Rata does not bundle
them; a bundled binary plus model would add hundreds of megabytes to the
installer.

## Alternatives rejected

**Bundling Handy inside Rata.** Hundreds of megabytes, and it makes Rata
responsible for shipping and updating someone else's application.

**Driving Handy's normal mode with `--toggle-transcription`.** It captures its
own audio and pastes into whichever window has focus, so Rata would neither
control the recording nor reliably receive the text.

**A Rust sidecar calling `transcribe-cpp` directly.** This would remove the
~1.3 s of application start and is the obvious next optimisation, but it needs
the Rust toolchain and a build step. Worth doing only if 2 seconds proves too
slow in use.

**Keeping the Windows recognizer as primary.** Its accuracy is the defect. Four
fixes went into the mechanism around it and none of them could change what it
hears.
