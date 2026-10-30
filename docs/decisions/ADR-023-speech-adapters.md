# ADR-023 — Speech adapters, and why speaking is not a tool

**Status:** Accepted
**Date:** 2026-10-30
**Ticket:** RATA-004 (Lane C)
**Relates to:** ADR-002 (permission/tool boundary), ADR-022 (tool reachability)

## Context

RATA-004 asks for a configurable STT/TTS provider, interruptible speech, and no
retained audio. Two of those were partly present and one was absent.

**Provider choice was in the renderer.** `useVoice` called the local recorder
and, if `getUserMedia` threw, fell back to the Windows recognizer. So the
decision about which speech provider to use was made in the renderer, by
exception handling. The renderer is not a boundary — it is why
`microphoneEnabled` is re-checked in the main process rather than trusted from
the UI — and the choice could not be configured at all. Handy's availability
was discovered by throwing.

**Text to speech did not exist.** The Permissions page carried a "Spoken
replies" switch bound to a `voiceEnabled` setting that was declared, validated,
typed, rendered — and read by nothing. The row's own help text said "not wired
yet". That is the settings-level form of the defect ADR-022 describes: a
capability that is present everywhere except where it would do something.

## Decision

**1. Provider selection moves to the main process.** `electron/speech/index.cjs`
resolves the STT mode from the stored `sttProvider` setting plus what is
installed, and the renderer is told which mode to execute. The renderer still
performs the recording, because only it has `getUserMedia`, but it no longer
decides.

**2. An explicit choice is never silently substituted.** Asking for the local
transcriber on a machine without it yields `mode: 'none'` and a reason, not a
quiet downgrade to the Windows recognizer. A user who selected Handy and is
served something else has no way to understand why accuracy changed. `auto`
exists for people who want the fallback behaviour, and prefers the local path
because it keeps audio on the machine.

**3. Two switches, not one.** `ttsProvider` says *how* Rata could speak;
`speakReplies` says whether it should. Turning speech off must not discard a
configured voice. Both are re-checked in the main process on every request,
because a renderer may hold a capability snapshot from before the user changed
them.

**4. Cancelling kills the synthesizer process rather than asking it to stop.**
The obvious alternative is `SpeakAsync` plus a `SpeakCompleted` handler, so the
script's loop stays free to read a `CANCEL` line. That handler would be a
PowerShell `ScriptBlock` invoked as a .NET delegate on a thread-pool thread with
no runspace attached — which is exactly what killed `voice-listen.ps1` earlier
in this project: the process died with no stderr and exit code 2, and the
feature looked dead while the engine was fine. So speech is synchronous inside
the child and cancellation is a kill, followed immediately by re-warming.

Measured on this machine: cold spawn to first audio 322ms, warm 27ms, and a
kill stops synthesis in progress at 26% of a full run. The warm child is why
latency is acceptable; the kill is why cancellation is absolute.

**5. Speaking is IPC, not a registered tool.** ADR-002 puts authority in tools,
so a new capability normally arrives as a tool with a risk level and a
confirmation policy. A tool is something the model can decide to invoke. Here
the model decides nothing: the renderer speaks a reply the user is already
reading, after it has been produced. There is no new authority — no egress, no
filesystem, no process launch — and nothing a prompt-injected model could reach
that it has not already reached by producing the text. Registering it as a tool
would imply the model may choose to speak, which inverts the design.

**6. Approval cards are never spoken.** The text on a card is what the user is
being asked to authorize. Hearing a summary while reading the real thing invites
approving the wrong action, which is the same failure FIX-012 fixed by putting
the content preview on the card itself.

## Consequences

- No audio is retained. Synthesis goes straight to the audio device; the
  wave-file output path exists only so tests stay silent, and production never
  passes it. The utterance crosses to the child on stdin, base64 encoded, never
  on the command line — an argument vector is visible to any process listing,
  and spoken replies quote the user's own documents back to them.
- Utterance text is stripped of control characters by the contract, because it
  crosses a line-based stdin protocol and a newline inside one would be read as
  the end of the command.
- Changing a speech setting replaces the speaker, since a warm child is
  configured with a voice and rate at spawn time. The old one is disposed so no
  orphan process holds the audio device.
- Starting dictation cancels speech **before** the microphone opens, so a
  recording can never contain the synthesizer.
- `voiceEnabled` is retired. Unknown stored settings are dropped individually
  with a log line rather than triggering a wholesale reset, so an existing
  install upgrades without losing its other settings.
- Cloud STT/TTS adapters remain unimplemented. The adapter seam now exists and
  a cloud provider can be added as one more entry, but none is wired, so no
  audio leaves the machine. Adding one is an egress decision and needs its own
  review.
