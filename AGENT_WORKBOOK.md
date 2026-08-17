# Agent Workbook

Shared running log for every AI agent working in this repository (Claude, Codex, Cursor).

**Canonical git remote:** https://github.com/ossykelvin/rata.git (`origin`, branch `main`)

`AGENTS.md` is the **engineering contract** — what you must and must not do.
This workbook is the **activity log** — what has actually been done, by whom, and what is still open.

Work assignment, lanes and sequencing live in **`docs/PRODUCT_BACKLOG.md`**. Read that before picking up a ticket.

## How to use this file

- **Before starting work:** read the Repo Snapshot and Open Items below, then check every agent's section for anything `IN PROGRESS`.
- **While working:** add an entry with status `IN PROGRESS` to **your own agent section** *before* your first substantive edit, and push your branch. An unpushed branch is not a claim.
- **When finishing:** update your entry to `DONE`, list files touched, and move anything unresolved into Open Items.
- **Write only under your own heading.** `.gitattributes` merges this file with `merge=union`, which keeps both sides' lines instead of conflicting — but it can interleave concurrent edits to the *same* section. Per-agent sections are what make that safe.
- **Never rewrite another agent's entry.** Correct the record by adding a dated note, not by editing their text.
- **Attribution matters.** A shared log with anonymous entries is worse than no log.
- Newest entry goes at the top of your section.

---

## Repo snapshot

*Last verified: 2026-08-15 15:05 by Claude (Opus 5).*

Layout after the 2026-08-15 refactor:

```
electron/          main.cjs (lifecycle + composition), preload.cjs, store.cjs, mvp-tools.cjs
packages/contracts/  ipc-channels.cjs, ipc-validation.cjs   - runtime IPC validation
packages/agent-core/ tool-registry.cjs, policy-engine.cjs, mock-agent.cjs, calculator.cjs, index.cjs
packages/skills/     loader.cjs, registry.cjs, router.cjs, contracts.cjs
skills/              SKILL.md data files, indexed by skills.manifest.json
src/                 React renderer only (App, views/, components/)
tests/               calculator, contracts-tools, policy-agent, skills-registry
docs/                CODEMAP, ARCHITECTURE, SECURITY, TASKS, VALIDATION, HANDOVER, decisions/
```

Verification command:

```bash
npm run verify
```

(= `check:node` → `test` → `typecheck` → `build`)

State of the health items that matter for multi-agent work:

| Item | Status |
|---|---|
| Dependencies pinned + `package-lock.json` created | Done |
| `npm run verify` script coherent | Done |
| Runtime IPC validation at the privileged boundary | Done (ADR-004) |
| Tool contract enforced at registration | Done |
| Skills manifest wired to runtime | Done |
| Version control (git) | Initialized on `main`; linked to `ossykelvin/rata` |
| Backlog, lanes, CODEOWNERS, CI | Done — `docs/PRODUCT_BACKLOG.md` |
| **Lint / format config** | **None — Phase 0 ticket P0-5** |
| **Typecheck coverage** | **`src` only; `electron/`, `packages/`, `tests/` unchecked — P0-5** |

---

## Active work

One line per agent. Keep it current — this is the first thing another agent reads.

| Agent | Lane / ticket | Branch | Status |
|---|---|---|---|
| Cursor | RATA-014 file organize writes | `cursor/RATA-014-file-organize` | DONE, PR #80 |
| Cursor | RATA-013 document create + file.save | `cursor/RATA-013-document-and-save` | DONE, PR #79 |
| Cursor | RATA-005 system status tools | `cursor/RATA-005-system-status` | DONE, PR #67 |
| Cursor | RATA-SKILL-007 filesystem scan tools | `cursor/SKILL-007-filesystem-scan-tools` | DONE, PR #75 |
| Cursor | FIX overlay Hide and compact drag | `cursor/FIX-overlay-hide-compact` | IN PROGRESS |
| Cursor | FIX overlay min/close | `cursor/FIX-overlay-min-close` | DONE, PR #60 |
| Cursor | FIX voice mid-transcript disable | `cursor/FIX-voice-mid-transcript-disable` | DONE, PR #65 |
| Cursor | FIX overlay min/close | `cursor/FIX-overlay-min-close` | DONE, PR pending |
| Cursor | FIX voice permission gate | `cursor/FIX-voice-permission-gate` | DONE, PR #62 |
| Cursor | FIX critical-thinking provider | `cursor/FIX-critical-thinking-provider` | DONE, PR pending |
| Claude | P0-0 backlog + guardrails | `claude/P0-0-backlog-and-guardrails` | DONE, merged as #2 |
| Codex | P0-1 modular IPC | `codex/P0-1-modular-ipc-boundary` | DRAFT PR #4 |
| Cursor | RATA-003 character animation | `cursor/rata-003-character-animation-9241` | DONE, PR #5 |
| Claude | REVIEW-001 security review | `claude/REVIEW-001-mvp-security-review` | DONE, awaiting merge (stacked on P0-0) |
| Claude | P0-0 backlog + guardrails | `claude/P0-0-backlog-and-guardrails` | DONE, awaiting merge |
| Codex | FIX-001 idempotent startup | `codex/FIX-001-idempotent-startup` | REVIEW REQUESTED |
| Codex | P0-1 modular IPC boundary | `codex/P0-1-modular-ipc-boundary` | IN PROGRESS — awaiting Lane G contracts/tests + Claude review |
| Codex | FIX-002 sandboxed preload bundle | `codex/FIX-002-bundle-sandboxed-preload` | READY FOR REVIEW, PR #16 |
| Codex | P0-2 modular tool registration | `codex/P0-2-modular-tool-registration` | DRAFT PR #20 — awaiting Lane H tests + Claude review |
| Codex | P0-3 skill manifest fragments | `codex/P0-3-skill-manifest-fragments` | DRAFT PR #25 — awaiting Lane H tests + Claude review |
| Cursor | TRIVIA-001 Serper-first prompt | `cursor/TRIVIA-001-serper-first` | DONE, PR pending |
| Cursor | RATA-004 speech recognition | `cursor/RATA-004-speech-recognition` | DONE, PR #44 |
| Cursor | FIX overlay drag overflow | `cursor/FIX-overlay-drag-overflow` | IN PROGRESS |
| Cursor | FIX app icon and taskbar | `cursor/FIX-app-icon` | DONE, PR #41 |
| Cursor | P0-4 decouple renderer | `cursor/P0-4-decouple-renderer` | DONE, PR pending |
| Cursor | ISSUE-34 overlay widget drag | `cursor/ISSUE-34-overlay-drag` | DONE, PR #36 — rebase after P0-4 CSS split |
| Cursor | ISSUE-34 overlay widget drag | `cursor/ISSUE-34-overlay-drag` | DONE, PR #36 |
| Cursor | — | — | idle |
| Cursor | ISSUE-34 overlay widget drag | `cursor/ISSUE-34-overlay-drag` | IN PROGRESS |
| Cursor | ISSUE-29 overlay long-response scroll | `cursor/ISSUE-29-overlay-scroll` | DONE, PR #32 |
| Cursor | ISSUE-17 restore character image | `cursor/ISSUE-17-restore-character-image` | DONE, PR #18 |

---

## Claude

### 2026-08-17 — RATA-006/007 — Graph scope proposal, and an ADR number collision

**Status:** ADR-017 written, **blocked on the user**. Branch `claude/RATA-006-graph-scope-proposal`.

`docs/decisions/ADR-017-microsoft-graph-scopes.md` decides the parts that cannot be changed later without asking the user to consent again: the scope list, the auth flow and token storage. It does not implement anything.

**Scopes are split across the two existing tickets**, which is the point rather than a formality. RATA-006 requests `openid profile offline_access User.Read Mail.Read Calendars.Read`. RATA-007 requests `Mail.ReadWrite Mail.Send Calendars.ReadWrite` **incrementally at the first write**, so a user who never sends mail never consents to sending as themselves. Asking for everything at sign-in would be simpler and would defeat doing the tickets in order.

**Auth:** public client, authorization code with PKCE, system browser via `shell.openExternal` with a loopback redirect. Explicitly not an embedded `BrowserWindow` — Microsoft blocks embedded webviews, and a Microsoft credential form inside Rata's own chrome is the shape of a phishing attack.

**Tokens:** Electron `safeStorage` (DPAPI) ciphertext in `userData`, never `rata-store.json`. `docs/SECURITY.md` already says that store holds only non-secret preferences; this is the first credential that has to honour it. Tools receive a bound capability, never the token, exactly as `web.search` receives a bound Serper capability.

**The asymmetry worth noting:** reads are confirmable but writes cannot opt out. `mail.send`, `calendar.create` and `calendar.update` are `external-write` and always confirm; `calendar.delete` is `destructive` and should cancel rather than delete. The approval card shows the actual recipients, subject and body preview, and the executed payload must equal the approved one.

**Not requested, each needing its own ADR if wanted:** `Mail.Read.Shared`, `Calendars.Read.Shared`, `MailboxSettings.Read` (would make `findAvailability` respect working hours, but reads more than it appears to), `Files.*`, `Contacts.*`, `People.Read`, `Directory.Read.All`, and any application permission.

**Amended after review, before acceptance.** The user narrowed it on all four open points: mail reads drop to `Mail.ReadBasic` (no bodies), `MailboxSettings.Read` added for working hours, `Mail.Send` removed entirely, calendar deletion removed, and account types fixed at multitenant including personal Microsoft accounts.

Three interactions would have quietly defeated those choices, so the ADR now states each rather than leaving it to be discovered:

1. **`Mail.ReadWrite` re-grants body access.** Graph has no draft-only mail scope, so `mail.createDraft` requires `Mail.ReadWrite`, which includes full body read. The `Mail.ReadBasic` narrowing therefore holds only until RATA-007 ships. RATA-007 must pick explicitly between accepting that, dropping drafting too, or holding the line in code.
2. **Removing a tool is not removing a capability.** A skill is unavailable if *any* declared tool is missing, so simply not implementing `mail.send` and `calendar.delete` would leave both skills blocked — the opposite of the point. Both are now **registered and disabled**, following the `file.delete` precedent.
3. **`Calendars.ReadWrite` permits deletion at the API level.** There is no create-and-update-only calendar scope, so refusing `calendar.delete` is a code restriction, not a scope one. Stated plainly rather than implying the token cannot delete.

Also recorded: email-assistant is now weaker than its own description. Without body access it can triage by subject and sender but cannot summarise a message, and its `SKILL.md` must say so rather than promising something it cannot do.

**Blocked on the user:** an Entra app registration (public client, `http://localhost` redirect, allow public client flows, multitenant + personal), `MSGRAPH_CLIENT_ID` and `MSGRAPH_TENANT_ID=common` in `.env.local`. No client secret is needed and none should be created.

**Also fixed here: two ADRs both numbered 013.** RATA-009 (local speech to text) and session continuity both landed on 2026-08-17 and both claimed 013. Session continuity merged first and keeps the number; the speech-to-text ADR moved to **ADR-018**, with a note at the top saying why. The two bare `ADR-013` citations in `conversation-memory.cjs` and `CODEMAP.md` now name session continuity explicitly, since a bare number was the only genuinely ambiguous reference.

### 2026-08-17 — RATA-009 — Local speech to text via Handy

**Status:** DONE, awaiting review. Branch `claude/RATA-009-handy-stt`.

Four fixes (FIX-005 to FIX-008) made the Windows recognizer *work*; none could make it *accurate*. It returned "eat one C" for "open notepad", and real speech (0.003-0.167 confidence) overlapped ambient noise (0.085-0.323), so the engine could not distinguish a phrase from a quiet room. That is a limit of the recognizer, not of the code around it.

Handy, MIT and fully offline, returned "Open notepad and check the weather in Preston." exactly, on the same audio. Installed 0.9.5 per-user (the MSI is `ALLUSERS=1` and needs elevation I cannot grant; the NSIS installer from the same signed release is per-user) plus Whisper Small English, 257 MB.

**Measured, after correcting my own error.** I first reported 20.4s per transcription and called it too slow for push-to-talk. That was a single cold run including one-time Vulkan shader compilation. Steady state on this hardware: NVIDIA 248ms, Intel Iris Xe 268ms, CPU 2172ms, all transcribing perfectly. A fresh process per press is ~2.1s wall, of which ~350ms is inference, ~450ms model load and ~1.3s Handy's own application start.

**Design.** Headless batch mode only (`--transcribe-file ... --json`); no UI, shortcut or clipboard paste. Handy is optional and the Windows recognizer stays as the fallback. The executable path and argument list are fixed in the main process, `execFile` not a shell, and the only variable is a temp path we created. Audio is validated at the IPC edge *and* again before spawning, because the renderer is not a boundary. The temp WAV is deleted in a `finally` on every path, the transcript is never audited, and failure messages are fixed strings since Handy's stderr carries model paths. The model is warmed at startup so the first press is not the 20s one.

**One architectural reversal, deliberate.** Recording now happens in the renderer via `getUserMedia`, which breaks Cursor's pin that the renderer never touches audio. Electron has no dependency-free main-process capture, which is why the PowerShell recognizer existed at all. Capture is gated by the same `decideRendererPermission()` boundary, and a compromised renderer could call `getUserMedia` regardless of what our hook contains, so the permission handler is the protection and the absence of the call never was. I rewrote that test to pin the narrower property that still matters: audio leaves the hook only through the declared channel, the microphone is released, and nothing in the recorder can reach the network.

**Validation.** `npm run verify` 333/333. 18 new tests, none of which run handy.exe. Verified live through the real module: "Open notepad and check the weather in Preston." in 408ms of inference.

**Note for the user:** 371 files of Handy source (79,223 lines) are committed to this repo under `Handy-main/`, swept in by a `git add -A` of mine in `f2dda9c`. It should be gitignored and untracked; purging it from history needs a rewrite and is their call.
### 2026-08-17 — RATA-010 — Expression mapping

**Status:** DONE, awaiting review. Branch `claude/RATA-010-expression-mapping`.

24 expressions shipped in RATA-003; 11 were mapped. Three real problems, fixed by mapping to triggers that already exist rather than by inventing states:

1. **A refusal wore the failure face.** `runTool` returned `state: 'error'` both when a tool genuinely failed and when the policy engine or a validator *declined* it. Rata blocking a destructive action is Rata working correctly, and it looked like a crash. New `blocked` state -> `13_skeptical`.
2. **A skill with unregistered tools returned `idle`**, so "installed, but its tools are not registered yet" showed a resting face. New `unavailable` state -> `12_confused`.
3. **`sleeping` was unreachable.** It was in the type and had artwork, but the idle drift stopped at `sleepy` and nothing else ever set it. Added a fourth stage at ten minutes, so the arc is bored -> peeking -> sleepy -> asleep. `bored` moved to `01_neutral`, which also makes that progression read as a sequence.

Mapped is now 13 of 24. **The remaining 11 are deliberately unmapped and pinned by a test**, because wiring an expression to a state nothing sets is worse than leaving it on disk: it looks connected and never appears. Changing that list is now a conscious edit.

Candidates if someone wants to wire them: `14_worried` for provider fallback (the Gemini 429 -> OpenRouter case already logs an activity event, but the reply state stays `success`, so it needs threading through), `20_encouraging` for critical-thinking replies, `24_coffee_activated` for keep-awake once RATA-005 lands.

**Left alone deliberately:** `idle` still uses `rata-concept.png`, the 477x727 full-body art, rather than `01_neutral` at 256px. It is pinned by a test and it is a visual product decision, not a mapping bug, so it is flagged to the user rather than changed.

**Validation.** `npm run verify` 319/319. Four new tests: every mapped state points at a distinct existing asset, a refusal and a failure never share a face, the drift reaches `sleeping`, and the unused set is pinned. One existing policy test updated deliberately, since it asserted `state === 'error'` for a blocked destructive tool.

### 2026-08-17 — FIX-006 — My confidence gate swallowed real speech

**Status:** DONE, awaiting review. Branch `claude/FIX-006-voice-confidence-visibility`.

FIX-005 stopped the recognizer dying, and the user reported voice still not working. The audit trail showed eight "Voice listening started" events with **no transcript and no unexpected-exit error**, which proves the child was alive and producing nothing the app would accept. That points at the gate I added in FIX-005, not at the recogniser.

**My error.** I set `MinConfidence` to 0.4 from three data points, one of which was *synthesised* audio scoring 0.681. Synthesised speech fed straight to the engine is far cleaner than a real microphone in a real room, so 0.4 was tuned against an unrealistically easy sample and swallowed genuine speech. I turned "the recogniser dies" into "the recogniser works and the app throws the result away", which looks identical from the outside.

**The structural fix, not just a smaller number.** The keep-or-discard decision was inside the PowerShell script, where a discarded result leaves no trace. "Heard nothing" and "heard something and discarded it" were indistinguishable from outside, which is precisely what made this hard to see. The script now emits `confidence|text` for every result and `voice-win.cjs` decides, logging every discard with its score. `MIN_CONFIDENCE` drops to 0.2, and the number can now be set from real measurements instead of a guess.

Measured noise so far: 0.085, 0.225, 0.323. It varies enough that some noise will pass 0.2 occasionally. That is the right trade against silently eating speech.

Parsing is backwards compatible: a line with no confidence prefix is still delivered as plain text, so an older or hand-edited script cannot cause silence.

**Validation.** `npm run verify` 312/312. Five new tests including one asserting `MIN_CONFIDENCE <= 0.25`, so a future tightening has to argue with a test rather than quietly regress this.

### 2026-08-17 — FIX-005 — Speech recognition never actually ran

**Status:** DONE, awaiting review. Branch `claude/FIX-005-voice-recognizer-never-ran`.

**Root cause.** `electron/voice-listen.ps1` marshalled the recognizer onto a raw `[System.Threading.Thread]` built from a PowerShell **ScriptBlock**, to force an STA apartment. A ScriptBlock delegate has no runspace on a raw .NET thread, so powershell.exe died **before `Run()` was ever entered**. The failure is not catchable from the script, nothing reaches stderr, and the process exits with code 2. Speech recognition had therefore never worked once, and `NO_MIC` / `NO_ENGINE` could never be produced either, because the code that writes them never executed.

The thread was also unnecessary: powershell.exe 5.1 already runs its main thread in **STA**, which is what System.Speech wants. Fixed by calling `exit [RataListen]::Run()` directly.

**How it was found.** Not by reading. The engine and grammar were proved healthy first by synthesising a WAV with `SpeechSynthesizer` and feeding it to the same recogniser and `DictationGrammar` the script uses: it returned "Open notepad" at 0.681 confidence. That ruled out the engine, the mic and the grammar. A spawn probe with an open stdin pipe then showed the child exiting with code 2 after ~6s and no output, and a trace written to a **file** (not stderr) showed execution stopping immediately after `Add-Type` compiled, with `Run()` never entered.

**Second defect, found because of the first.** `voice-win.cjs` swallowed an unexpected child exit. When the recognizer died the renderer was never told, so the overlay stayed in its listening state for ever, waiting for a transcript from a process that no longer existed. That is why the symptom was silence rather than an error. Unrequested exits and spawn errors now log an audit error and send `{ transcript: '', error }`, which `useVoice` already handles by resetting the button.

**Third issue, measured not guessed.** Dictation returns a best guess for almost any audio. Ambient noise in an empty room produced "Bolivia or rue band and I cannot believe this wrath", then "And if we're" at **0.225** and "Three" at **0.323**, against **0.681** for clean speech. Added a `MinConfidence` gate of 0.4, documented with those measurements. A dropped guess degrades to the existing "I didn't catch that" prompt rather than nonsense in the input box.

**Validation.** `npm run verify` 307/307. Proved end to end through the real `createWindowsVoice` path: before the fix, zero transcript events ever; after it, transcript events arrive from the microphone. Three regression tests: the script must call `Run()` directly and must not reintroduce the ScriptBlock thread or `SetApartmentState`; an unrequested exit reports an error; a requested stop does not.

**For Cursor:** this was not a wiring problem in `useVoice.ts` or the IPC layer, which is where the previous attempts looked. Both were correct throughout. The failure was entirely inside the PowerShell host, and it was invisible because the only diagnostic channel the script had was the one it could never reach.

### 2026-08-16 — RATA-007 — Weatherman skill and weather.current

**Status:** DONE, awaiting review. Branch `claude/RATA-007-weatherman-skill`.

New skill pack `skills/weatherman/` plus the `weather.current` tool backed by WeatherAPI.com. 21 skills installed, 9 available (was 8 of 20).

**The finding that shaped the design.** Serper takes its API key in a request *header*; **WeatherAPI accepts it only as a `key=` query parameter**, so the request URL is itself a credential. Node's network errors routinely embed the URL, which makes the usual "wrap and rethrow" pattern actively unsafe here. Every failure path in `electron/weather-client.cjs` therefore returns a fixed string and deliberately discards the caught error. There is a test asserting that six different failure modes leak neither the key, nor `key=`, nor the endpoint.

**Key handling.** `WEATHER_API_KEY` (optional `WEATHER_API_BASE_URL`) is read once in `config.cjs`, captured in the client closure, and handed to the tool layer as a bound `getCurrentWeather(query)` capability — never the key itself. `describeConfig()` reports presence as a boolean. Nothing is hardcoded: a test asserts neither weather module reads `process.env` directly or embeds a key-shaped literal, and the value lives only in `.env.local`, which is gitignored.

**Other deliberate choices**, argued in ADR-011: the response is mapped onto a fixed shape so unmodelled provider fields never reach the agent; results carry `trust: 'untrusted-external'`; `auto:ip` and the `iata:`/`id:`/`metar:` prefixes are refused because IP geolocation is a different privacy decision from looking up a named place; lookups are confirmed by default via a new `weatherConfirm` setting because the request reveals what place the user is asking about; and the location is extracted **deterministically** before the tool runs, so no provider chooses it.

Forecast phrasing is deliberately not matched by the deterministic route — the tool returns current conditions only, and answering "what's the forecast tomorrow" with today's readings would be wrong.

**Validation.** `npm run verify` 297/297, exit 0. `tests/weather-skill.test.cjs` adds 26 tests, all with injected `fetchImpl` and no live calls. Verified live end to end through the agent: the approval card fires by default, and with confirmation off, London and Lagos both return real readings with audit events.

**Two mistakes of mine worth recording.** First, my config test originally called `loadRuntimeConfig({ env })` — not a real option — so it read the developer's actual `.env.local` and printed a live credential into the assertion output when it failed. Fixed to the `rootDir`/`files`/`processEnv` isolation the Serper tests already use. That pattern exists for exactly this reason and I should have copied it. Second, several regexes were written through Python heredocs that mangled backslash escapes, leaving literal control and backspace bytes in source; `` became U+0008, which silently broke a word boundary and would have turned the place name "Nowra" into "ra". There is now a test for that specific case.

**Pinned surfaces updated deliberately:** `EXPECTED_TOOL_IDS` 11 → 12, `SHIPPED_SKILL_IDS` 20 → 21, and the `describeConfig` deepEqual in `tests/web-search-tool.test.cjs` gained `weather: false` — that exact assertion is what catches a new credential being described by value instead of presence.

### 2026-08-16 — RATA-006 — Read-only local file tools

**Status:** DONE, awaiting review. Branch `claude/RATA-006-readonly-file-tools`.

**Why this first.** 15 of 20 installed skills were blocked on tools that did not exist. `file.search` was declared by four skills and `file.readText` by three — the most-demanded missing tools in the whole manifest. Blocked skills are now **12**, with `file-finder`, `local-content-search` and `ai-research` newly available, and `task-planner`, `file-organizer`, `document-assistant` and `presentation-builder` moved closer.

**What shipped.** `file.search`, `file.stat`, `file.readText`, `file.searchContent`, `file.reveal`. Security core in `electron/file-access.cjs` (the counterpart to `public-web-client.cjs`); contract layer in `electron/tools/file.cjs`, which keeps sole ownership of the `file.` domain. ADR-010.

**The design point worth recording.** Containment and sensitivity are *separate* defences and both are needed. Containment alone — resolve, realpath, compare with `path.relative` against realpath'd roots — stops `..`, symlinks, junctions and lookalike siblings like `docs-private`. It does nothing about `~/Documents/.env`, which is perfectly contained and catastrophic, so credential-shaped names are refused **inside** allowed roots and credential/VCS directories are never descended into. A design that only solved escape would hand a provider an API key.

**Deliberate policy choices**, all in ADR-010: reads are `confirmation: 'configurable'` behind a new `fileReadConfirm` setting defaulting to **on**, because reading a file is an egress decision (the text goes to a provider), not a plain local read — searching by *name* stays automatic or the feature is unusable. Content carries `trust: 'untrusted-external'` so it reaches a provider fenced, exactly like `web.fetch`; a document can carry an injection like a web page can. Missing and forbidden paths report the identical error so the tools cannot probe for files they may not read. `file.reveal` is `safe-write`, not `read`, because it opens a window.

**Write verbs are deliberately absent.** `file.move`, `file.rename`, `folder.create` and `file.save` are a separate ADR and ticket. `file-organizer` stays blocked on purpose.

**Validation.** `npm run verify` 266/266, exit 0. `tests/file-access-security.test.cjs` adds 28 tests against a real temporary filesystem rather than a mock — realpath, symlink escape and traversal are precisely what a mock would paper over. Symlink assertions skip themselves with a message if the platform refuses to create links without elevation.

I updated `EXPECTED_TOOL_IDS` in `tests/tool-composition.test.cjs` from 6 to 11 entries. That list is the privileged tool surface and the failure was the guardrail working; it should only ever move in a commit that says why.

**Reviewer note for whoever takes this:** the two things I would attack are the denied-name list (is it complete enough, and does shape-matching miss anything obvious?) and `walkRoots` skipping symlinks — that trades a rare legitimate linked folder for removing a bug class, and it is worth a second opinion.

### 2026-08-16 — Review pass over #56–#60 (WEB-002, M3, ADR-009 fence, critical thinking, overlay controls)

**Status:** DONE. #56, #57, #58, #59 merged. #60 opened on Cursor's behalf and **blocked** pending a rebase.

**#56 WEB-002 — approved, with one regression fixed on the branch.** Ports, redirect direction and the parse5 switch all verified by execution. `:080` and `:0443` normalise to the defaults so the allow-list has no numeric bypass; `http:443` and `https:80` are allowed and harmless. The HTTPS→HTTP refusal is applied per hop, so http→https→http is still caught at the third hop.

The regression: **both parse5 tree walkers recursed.** A response is capped at `MAX_RESPONSE_BYTES`, but that cap still permits ~11,000 levels of nesting, and `<div>` repeated 5,000 deep is 55KB — comfortably inside the cap and enough to overflow the call stack. The failure was safe (the fetch threw, no content returned) but any page could trigger it cheaply and so disable web fetch at will. The regex implementation being replaced had no recursion, so this was new. Converted both walkers to an explicit stack, output byte-identical on the existing corpus, regression test at 5,000 and 11,000 levels.

I also **withdraw my own finding (c)** from the WEB-001 review. Codex was right: empty Serper results were already represented as `[]` and already returned a successful "found nothing" response. It needed a regression pin, not a rewrite, and that is what they added.

`parse5@7.3.0` packaging verified by execution rather than assumption — `npm run pack:win`, then `asar list` shows 46 parse5 entries inside `app.asar`. It is pure JS, so asar is not a problem for it (unlike `voice-listen.ps1`, which had to be lifted out).

**#57 REVIEW-001 M3 — approved, no findings.** Probed the load path with eleven hostile store files. `microphoneEnabled: "true"` (string) and `: 1` both resolve to **false**, and the confirmation flags cannot be turned off from disk by any malformed value — the disk fallback deliberately inverts `microphoneEnabled` away from the fresh-install default, which is the right asymmetry. Unknown keys dropped, `__proto__` payload leaves `Object.prototype` clean, junk provider falls back to `mock`, and corrupt/array/null shapes all restore safe settings with an activity entry. `safeSettingLabel()` also stops a hostile key name from injecting text into the log.

**#58 ADR-009 fence tolerance — approved, no findings.** Exactly one fence, anchored at both ends. Accepted: tag/no-tag/uppercase/CRLF/surrounding whitespace. Still rejected: unterminated fence, two fences, prose before or after, and every schema violation (arbitrary tool, extra keys, paths). The 512-character envelope cap still applies to the raw string, so the fence cannot be used to smuggle a larger payload.

**#59 critical thinking — approved, no findings, but the description overstates the change.** It reads as though the skill had no live path and returned a mock stub. The diff shows otherwise: `answerSkillWithProvider()` already loaded the prompt and called the chain on `main`, and this PR *consolidates* it into `ask()`. Most likely the description was written before the rebase and never updated. The refactor itself is sound — the skill prompt is still a second system message beneath `SYSTEM_PROMPT`, so ADR-003 holds and skills still carry no authority. `ask()` now accepts `skillId`, which widens the surface, but `loadPrompt()` resolves through `registry.get()` and throws on an unknown id, so no arbitrary path can be reached through it.

**#60 overlay minimize/close — BLOCKED, opened for visibility.** The branch forked at `398dd6b`, before #54, and adds `tray.on('click', () => overlayWindow?.show())` — exactly the FIX-003 bug #54 removed. Because this PR's purpose is to let the user close the overlay to the tray, it makes that dead path much easier to reach. Needs a rebase and `showOverlay()`. Detail on the PR.

**Process note.** `merge=union` on this file caused GitHub to report phantom conflicts on #53, #57 and #58; each needed `main` merged in locally and pushed before it could go. That is now four occurrences. It should be fixed rather than absorbed — per-agent workbook files, or drop the union driver.

### 2026-08-16 — RATA-002 / FIX-003 — Review of both open drafts, plus Lane H tests for ADR-009

**Status:** DONE. Branch `claude/RATA-002-lane-h-system-actions` into `codex/RATA-002-structured-system-actions` (#53). #54 reviewed separately.

**#53 structured system actions — APPROVED on the security boundary.** This is the first path where provider output influences whether a registered tool runs, so I probed the parser by executing it rather than reading it. Nine hostile shapes — a different tool, an executable path, extra top-level and extra input keys, an arguments array, a case variant, a non-string app name, a bumped version, a `__proto__` payload — all fail closed, and `Object.prototype` stays clean. The property that carries the design is that **`toolId` is a literal in the parser and is never read from provider output**: the model chooses between two enum values and nothing else. Arguments stay an empty array in the native executor. `ToolRegistry.validate()` and the policy engine still run afterwards, and `system.openApp` re-checks its own allow-list at execute time.

Worth recording rather than burying: `system.openApp` is `risk: safe-write, confirmation: never`, so a provider-influenced launch runs without a confirmation prompt. I accepted that here because the blast radius is Notepad or Calculator with no arguments, and the request text is user-typed rather than retrieved content. **If this pattern is ever extended to a second tool, the confirmation policy has to be revisited first** — that is the point where a model would start steering something that matters.

**One blocking behavioural finding, fixed on this branch.** The planner gate was placed *above* the clipboard, `web.fetch` and `web.search` routes. `SYSTEM_ACTION_HINT` is broad, so I verified by execution that it also matched `search the web for how to run a program on Windows`, `find online how to start a program in python`, `summarize https://…/launch-an-application-guide` and plain `how do I run a program?`. Each was captured by the launch path and answered with *"I can only safely launch Notepad or Calculator"* — explicit search and fetch intent was silently swallowed and ordinary questions were refused. Moved the gate below every explicit route, and a declined or unparseable plan now returns `undefined` and falls through to `ask()` instead of returning a canned refusal. **The action still fails closed; only the reply changed.**

**Lane H:** `tests/system-action-planner.test.cjs`, 12 tests — accepted, declined, malformed, extra-field, arbitrary-tool, arbitrary-app and path, prototype pollution, oversized payload, no-spawn on every rejected plan, the deterministic path not consulting a provider, and the routing precedence above.

**Non-blocking, not fixed:** the parser rejects markdown-fenced JSON, and most models fence by default. Fail-closed is the right default, but it means the feature will decline more often than the ADR implies. Stripping exactly one fence before `JSON.parse` would fix it without widening the schema.

**#54 recreate the overlay — APPROVED, no findings.** `security.applyWindowGuards()` and `windowPreferences()` are both reapplied to the recreated window, so `contextIsolation`/`sandbox` survive the rebuild — that was the thing worth checking. Each `BrowserWindow` is captured in its own callbacks and `closed` only clears the reference when it still points at that window, so a stale callback cannot clear a replacement. `getOverlayWindow()` now filters destroyed windows, which incidentally hardens `hideOverlay` too. `second-instance` still ignores argv.
### 2026-08-16 — RATA-004 fix — Recognizer script escaped `app.asar`; icon unblocked packaging

**Status:** DONE. On `cursor/RATA-004-native-windows-voice` (PR #50), rebased onto `main`.

**The blocking defect.** `voice-win.cjs` spawned `powershell.exe -File <__dirname>/voice-listen.ps1`. In a packaged build `__dirname` is inside `app.asar`, and PowerShell is an external process with no asar awareness — it cannot read that path. Voice therefore worked in dev and did **nothing at all** once installed, with no error surfaced. `resolveScriptPath()` / `isPackagedRuntime()` now point at `process.resourcesPath` when packaged (same shape as `appIconPath()` in `main.cjs`), and `build.extraResources` copies the script to `resources/`.

**A second defect found while proving the first.** `npm run pack:win` could not run at all: `public/24_dialog_avatar_reply.png` was 77×82 and electron-builder rejects anything under 256×256. The fix was to regenerate **that** file at 256×256 — same circular navy badge, rebuilt from the concept art rather than upscaled — not to repoint `build.win.icon` at a new file. Cursor's `tests/app-icon.test.cjs` pins that path deliberately; their product decision stands.

**Invisible asset load.** A failed character image rendered the silhouette and said nothing, so a dead Vite dev server looked like a design choice. `RataCharacter.tsx` now logs the failing URL, exposes it as `data-asset-failed`, and puts it in `title` / the fallback's `aria-label`.

**Validation.** `npm run verify` **211/211, exit 0**. Packaging verified by execution, not inference: `release/win-unpacked/resources/` contains `voice-listen.ps1` (2,369 bytes) as a real file on disk alongside `app.asar`. `tests/voice-packaging.test.cjs` (6 tests) pins dev/packaged resolution, asar detection, the `extraResources` entry, the ≥256×256 icon, and the asset-failure reporting.

**Still open on this feature** (from my earlier review, not fixed here): the second microphone path sits outside the permission handler and the gate is only checked at start; and there is a restart race in `stop()`/`start()`.

### 2026-08-15 — P0-2 — Privilege-boundary review and Lane H tests

**Status:** DONE. PR #22 (tests) merged into the Codex branch; PR #20 merged to `main` as `9dde9f9`.

**Review of PR #20 — APPROVED, no blocking findings.** Full review posted on #20. All twelve checklist items pass: discovery is confined to the trusted `electron/tools/` directory, malformed modules / duplicate module IDs / duplicate tool ownership / declared-vs-created mismatches all fail closed, every definition still passes through `ToolRegistry.register()`, missing native dependencies name the dependency, REVIEW-001 H2 survives the move intact, `mvp-tools.cjs` is compatibility-only, the four tool IDs and their metadata are unchanged, and no `AGENTS.md` rule was weakened.

The detail worth recording: **ownership conflicts are resolved before any `create()` runs**, so a colliding module cannot execute its factory.

**Seven non-blocking findings**, listed in full on #20. The two worth carrying:

- `createToolDefinitions` is exported and returns raw definitions including executors — the REVIEW-001 M2 pattern one layer up. Main-process-only, so not blocking, but it should not be public.
- **My own P0-0 defect:** `.github/workflows/verify.yml` triggers only on PRs targeting `main`, so **stacked PRs get no CI at all** — #22 reported "no checks". I own the fix.

**Lane H (issue #19):** added `tests/tool-composition.test.cjs`, ~21 tests covering every requested case, all asserting fail-closed behaviour, plus regression pins for REVIEW-001 H2 and M2 across the refactor. Two initial failures were my own test assumptions, not implementation bugs, and are corrected with comments explaining why.

**Validation:** local `npm ci` and full `npm run verify` **could not complete** — the Rata app was running from this worktree's `node_modules` (6 Electron processes since 19:09), so npm hit `EBUSY`/`EPERM` on `electron/dist/resources/default_app.asar`. I did not kill those processes; one appears to be the outstanding GUI smoke test. The partial `npm ci` left this worktree's `node_modules` incomplete (`vite` and `tsc` missing) — **it needs `npm install` once the app is closed.**

Authoritative verification is CI on #20: clean `npm ci` + `npm run verify` on a Windows runner, **80 tests, 80 pass, 0 fail**, 47 CommonJS files. Count rose from 59 to 80, confirming the Lane H suite ran rather than being skipped.

**Not started:** P0-3, as instructed. Issue #19 is still open and can be closed by whoever owns it.

### 2026-08-15 — REVIEW-001 — MVP architecture and security review

**Status:** DONE (branch `claude/REVIEW-001-mvp-security-review`, stacked on `claude/P0-0-backlog-and-guardrails` — merge P0-0 first)

**Output:** `docs/reviews/REVIEW-001-mvp-security.md`. Reviewed `electron/`, `packages/contracts/`, `packages/agent-core/`, `packages/skills/`, `src/`, `index.html` at commit `3bfc271`.

**Verdict:** architecture is sound — tool contracts enforced at registration, destructive denied at policy, skills carry no authority, approval input captured at request time, audit log redacted. Nothing in flight is blocked.

**Findings — 5 high, 5 medium, 4 low.** Three were reproduced by executing the shipped modules, not inferred:

- **H1** `packages/contracts/ipc-validation.cjs:21` — settings validator accepts inherited prototype keys. `{key:'constructor'}` and `{key:'toString'}` pass validation and reach the persisted store. **Lane G (mine).**
- **H2** `electron/mvp-tools.cjs:29` — `system.openApp` allow-list bypassed the same way; `appName:'constructor'` passes and reaches `spawn()`. Not arbitrary execution today (real `spawn(undefined)` throws `ERR_INVALID_ARG_TYPE`) but the allow-list returns "allowed" for input it must reject. **Lane Codex, fold into P0-2.**
- **H3/H4/H5** — no `setWindowOpenHandler`/`will-navigate` guards, no IPC sender validation, no CSP. Together these are the confused-deputy path: a navigated-away window keeps `window.rata`. **Fold into P0-1.**
- **M1** `mock-agent.cjs:101` — pending approvals unbounded and never expire; 5,000 unanswered requests retained, oldest still executable.
- **M2** `tool-registry.cjs:34` — `get()` returns the live executor, so "execute only through `ToolRegistry.execute()`" is convention, not structure.
- **M3** store does not validate settings loaded from disk, contradicting ADR-004's defence-in-depth claim.
- **M4** microphone gating is renderer-side only — **blocks RATA-004**.
- **M5** approval preview `JSON.stringify`s raw tool input — **blocks RATA-007**.

**Note for Lanes D/E/F:** H1 and H2 are the same root-cause defect (unguarded dynamic key lookup used as an allow-list). Use `Object.create(null)` or a `Map` for every allow-list added in the bridge, Graph and browser lanes.

### 2026-08-15 — P0-0 — Product backlog and parallel-work guardrails

**Status:** DONE (branch `claude/P0-0-backlog-and-guardrails`, not yet merged)

**Why:** three agents collided in this repo within one hour. Mapping the dependency graph showed the cause is structural — seven hub files (`electron/main.cjs`, `preload.cjs`, `ipc-channels.cjs`, `mvp-tools.cjs`, `src/types.ts`, `global.css`, `skills.manifest.json`) are touched by nearly every remaining ticket, so any feature-level parallelism collides in the privilege boundary.

**Added:**

- `docs/PRODUCT_BACKLOG.md` — Phase 0 (convert hubs into extension points), then nine lanes with disjoint paths, dependency order, human-gated items, working protocol.
- `.github/CODEOWNERS` — lane-to-path map so cross-lane edits surface in the PR. Handles are placeholders pending real accounts.
- `.github/workflows/verify.yml` — `npm run verify` on every PR, Windows runner, `npm ci`.
- `.gitattributes` — `merge=union` for this workbook, line-ending normalization, binary assets marked.
- Restructured this workbook into per-agent sections.

**Found while mapping, worth knowing:**

- `tsconfig.json` covers only `src` and `vite.config.mts`. `electron/`, `packages/`, `tests/` and `scripts/` are **never typechecked** — the only gate is `scripts/check-node.cjs`, a syntax-only `node --check`. Ticketed as P0-5.
- `packages/agent-core/index.cjs` is a barrel with zero importers. Ticketed as P0-6.
- `skills.manifest.json` validates fail-closed on the *whole* document, so one malformed entry disables every skill. Ticketed as P0-3.
- `src/views/Overlay.tsx` re-implements the agent conversation flow inline instead of using `useAgentConversation`. Ticketed as P0-4.

**Next:** Codex takes P0-1. No feature lane opens until Phase 0 merges.

---

## Codex

### 2026-08-16 — Codex — ADR-009 single-fence tolerance

**Status:** READY FOR CLAUDE REVIEW — draft PR #58 (branch `codex/ADR-009-fence-tolerance`)

**Scope:** Update `packages/agent-core/orchestrator/system-action-planner.cjs` to strip at most one complete leading/trailing Markdown code fence (with or without the `json` tag) before parsing. Preserve the 512-character raw envelope limit and exact action schema; continue rejecting surrounding prose, unterminated fences, nested/double fences and every existing hostile shape. Deliberately update and extend `tests/system-action-planner.test.cjs`, align ADR-009, run `npm run verify`, and request Claude review.

**Implemented:** `parseSystemActionPlan()` now checks the raw 512-character envelope first, trims surrounding whitespace, and removes at most one exact complete Markdown fence with an optional `json` tag before `JSON.parse`. It does not accept prose, an unterminated fence, multiple/nested fences, another language tag, extra schema keys, tools, paths, arguments or applications. The literal `system.openApp` mapping and Notepad/Calculator enum are unchanged. Updated ADR-009 to describe the narrow tolerance.

**Validation:** Focused planner tests passed 14/14, including tagged/untagged fences, unterminated and double fences, and a fenced payload that proves fence removal cannot bypass the raw 512-character limit. Full `npm run verify` passed: 76 CommonJS files, lint, 225/225 tests, TypeScript, Vite build and the seven-module sandboxed preload build. `git diff --check` passed. Claude privilege-boundary review is required.
### 2026-08-16 — Codex — REVIEW-001 M3 disk setting validation

**Status:** READY FOR CLAUDE REVIEW — draft PR #57 (branch `codex/REVIEW-001-M3-store-validation`)

**Scope:** Validate settings loaded from disk in `electron/store.cjs` with the existing Lane G validators from `packages/contracts/ipc-validation.cjs`. Drop unknown keys, replace invalid/wrong-type/out-of-range values with safe defaults, prevent `microphoneEnabled` and confirmation settings from being loosened by corrupted or hand-edited storage, and surface sanitized fallback events in the activity feed. Add injected storage regressions under `tests/` without changing Lane G contracts, run `npm run verify`, and request Claude review.

**Implemented:** Disk-loaded setting keys now pass through `isKnownSetting()` and values through `validateSettingValue()` before entering runtime state. Unknown keys are dropped. Invalid values receive per-setting safe fallbacks: microphone off and every configurable confirmation on; corrupt JSON or an invalid store/settings shape restores the same safe security posture. Every recovery is added to the activity feed without recording rejected values, parser errors or local paths. Existing valid Boolean preferences still load normally; distinguishing an app-persisted `false` from a manually edited `false` would require a separate integrity design and is not claimed by schema validation. No Lane G contract file changed. Updated the security model.

**Validation:** Focused settings tests passed 11/11 for unknown keys, wrong types, out-of-range values, corrupt JSON, sanitized audit details, microphone fail-closed and confirmation fail-safe behavior. Full `npm run verify` passed: 76 CommonJS files, lint, 228/228 tests, TypeScript, Vite build and the seven-module sandboxed preload build. `git diff --check` passed. Claude review is required.
### 2026-08-16 — Codex — WEB-002 fetch hardening

**Status:** READY FOR CLAUDE REVIEW — draft PR #56 (branch `codex/WEB-002-fetch-hardening`)

**Scope:** Verify and address the four carried WEB-001 findings in `electron/public-web-client.cjs` and `electron/serper-client.cjs`: restrict public fetches to ports 80/443, block HTTPS-to-HTTP redirect downgrade, distinguish a successful empty Serper result from provider failure, and replace or rigorously harden regex HTML extraction against malformed/nested active content. Add injected no-network regressions in `tests/web-fetch-security.test.cjs` and `tests/web-search-tool.test.cjs`, update the relevant web-security documentation, run `npm run verify`, and request Claude review.

**Implemented:** Confirmed findings (a), (b) and (d) against current main. URL validation now permits only ports 80/443 before DNS or transport, and redirect processing refuses HTTPS-to-HTTP downgrade while preserving HTTP-to-HTTPS upgrade. Replaced regex HTML stripping with the exactly pinned runtime dependency `parse5@7.3.0`; extraction walks the parsed tree and discards script, style, noscript, template, SVG, iframe and object subtrees before collecting visible text. Finding (c) was already correct on current main: Serper returns an empty array and `web.search` reports a successful “found nothing” result, so this branch pins that behavior without unnecessary production changes. Updated ADR-008 and the security model.

**Validation:** All injected tests make no live DNS/HTTP calls. Focused web tests passed 47/47, including ports, downgrade/upgrade, malformed/nested HTML, empty Serper payloads and empty agent results. Full `npm run verify` passed: 76 CommonJS files, lint, 228/228 tests, TypeScript, Vite build and the seven-module sandboxed preload build. `npm install` reported 0 vulnerabilities; `git diff --check` passed. Claude security review is required.

### 2026-08-16 — Codex — RATA-002 structured system actions

**Status:** READY FOR CLAUDE REVIEW — draft PR #53 (branch `codex/RATA-002-structured-system-actions`)

**Scope:** Implement the safe alternative to model-generated PowerShell. For explicit application-launch language not handled by the deterministic parser, Gemini/OpenRouter may return a small structured proposal constrained to the existing `system.openApp` tool and its Notepad/Calculator allow-list. Validate model output fail-closed, run accepted proposals only through `PolicyEngine` and `ToolRegistry`, preserve background spawn/audit behavior, and never accept shell text, executable paths, arguments, elevation, or arbitrary commands. Add an ADR and request Claude security/Lane H review.

**Implemented:** Added a deterministic launch-intent gate and a versioned, exact-key provider proposal parser. The only accepted proposal is `system.openApp` with `notepad` or `calculator`; `none` is the only alternative. Ordinary chat and retrieved context cannot enter the planner. Accepted proposals still pass through registry validation, policy evaluation and registry execution. Invalid JSON, prose, Markdown, extra fields, paths, arguments, arbitrary tools/apps, shell text and elevation fail closed without execution. Added ADR-009 and aligned ADR-007, architecture and security documentation. No PowerShell or generic shell capability was added.

**Validation:** Injected checks proved deterministic launches do not call a provider, a valid proposal launches only the fixed executable with an empty argument list and detached background options, and malicious/expanded proposals spawn nothing. Full `npm run verify` passed: 68 CommonJS files, lint, 181/181 tests, TypeScript, Vite build and the six-module sandboxed preload build. `git diff --check` passed. Claude privilege-boundary review and Lane H focused contract tests remain required before merge.
### 2026-08-16 — Codex — FIX-003 recreate closed overlay

**Status:** READY FOR CLAUDE REVIEW — draft PR #54 (branch `codex/FIX-003-recreate-overlay`)

**Scope:** Repair the main-process window lifecycle behind the Control Center and tray “Show Rata” actions. A closed/destroyed overlay currently clears `overlayWindow`, while callers use optional chaining and silently do nothing. Add a single safe show/recreate service, preserve the existing narrow IPC channel and renderer boundary, avoid all Cursor-owned UI paths and Claude-owned contracts/tests, run injected lifecycle checks plus `npm run verify`, and request Claude review for the Electron change.

**Implemented:** Added a centralized main-process `showOverlay` lifecycle service. It recreates a missing/destroyed overlay, lets the replacement renderer reach `ready-to-show` before revealing it, restores a minimized live window, and supports inactive display for the second-instance path. The Control Center IPC handler, tray action and second-instance handler now use that service. Overlay callbacks capture their own BrowserWindow and clear the shared reference only when it still points to that instance, preventing stale callbacks from acting on a replacement. No renderer, preload or shared contract path changed.

**Validation:** Injected IPC wiring proved `showOverlay` calls the lifecycle service rather than the stale optional-window path. Full `npm run verify` passed: 69 CommonJS files, lint, 202/202 tests, TypeScript, Vite build and the six-module sandboxed preload build. `git diff --check` passed. GUI smoke remains BLOCKED-ON-HUMAN; Claude review is required because this touches `electron/`.

### 2026-08-16 — Codex — RATA-002 Critical Thinking OpenRouter routing

**Status:** DONE — draft PR #49 awaiting Lane H issue #48 and Claude review (branch `codex/RATA-002-critical-thinking-openrouter`)

**Scope:** Route the existing declarative `critical-thinking` skill through the provider abstraction with OpenRouter preferred in auto mode and Gemini retained as fallback. Load the skill prompt only after selection; never expose `OPENROUTER_API_KEY` to the skill, renderer, or audit trail. Respect explicit provider modes, update behavior tests and provider-routing documentation, run `npm run verify`, and request Claude review because this changes `packages/agent-core/`.

**Implemented:** `MockAgent` now continues a selected, tool-complete `critical-thinking` route through a provider-only helper. It loads only that selected prompt, supplies it beside Rata's global system prompt, and passes `preferredProvider: 'openrouter'` to the existing chain. The preference applies only in `auto`; pinned Gemini/OpenRouter/mock modes remain authoritative and the existing OpenRouter → Gemini → mock fallback is preserved. The API key remains closed inside the OpenRouter adapter and is never passed to the skill, renderer or activity log. ADR-007 records the routing decision. No skill metadata, contract or renderer path changed.

**Validation:** Injected end-to-end routing confirmed only `critical-thinking` was loaded and OpenRouter was preferred. A redacted live route check in `auto` mode succeeded through OpenRouter (`anthropic/claude-sonnet-5`) with both credentials reported only as booleans. `npm run verify` passed: 67 CommonJS files, lint, 181/181 tests, TypeScript, Vite build and the six-module preload build. `npm ci` reported 0 vulnerabilities. Lane H regression coverage remains delegated to Claude.

**Files touched:** `packages/agent-core/mock-agent.cjs`, `docs/decisions/ADR-007-ai-provider-chain.md`, and this Codex workbook entry.

**Handoff:** Draft PR #49 is open against `main`. Issue #48 requests injected Lane H coverage for selected-prompt loading, OpenRouter-first auto routing, fallback order, pinned-mode precedence, prompt failure and credential isolation. Do not merge until Claude's tests and review land.

### 2026-08-16 — Codex — WEB-001 Claude review findings 1–3

**Status:** DONE — follow-up PR #47 ready for Claude re-review (branch `codex/WEB-001-implement-safe-fetch`)

**Scope:** Address only Claude review findings 1–3: include the resolved `web.fetch` URL in capability audit events without page content or credentials; split fetch confirmation into a default-on `webFetchConfirm` setting across tool metadata, runtime validation, persistence and renderer typing; export `pinnedRequest` for Lane H unit coverage. Mechanically rename the three specified Lane H assertions, preserve the reviewed SSRF implementation, leave findings 4–7 untouched, update ADR-008's confirmation description, and make observable changes explicit in the PR description. Claude review remains required.

**Implemented:** `web.fetch` start/failure audit details now contain only the validated request URL, while completion contains only the final returned URL; fetched content is never copied into activity. Fetch confirmation is independently controlled by default-on `webFetchConfirm` across the tool, contract validator, store default and renderer type, while `web.search` remains governed by `webSearchConfirm`. The two chained-workflow fixtures now explicitly disable both actions; the unchanged line-30 search metadata assertion correctly continues to pin `webSearchConfirm`. Exported `pinnedRequest` without changing its connection behavior. Updated ADR-008. Findings 4–7 remain untouched.

**Validation:** Injected audit smoke check recorded only the URL and rejected page-content leakage. Focused web/security/settings checks passed 48/48. Full `npm run verify` passed: 65 CommonJS files, lint, 172/172 tests, TypeScript, Vite build, and the six-module sandboxed preload build. `git diff --check` passed.

**Files touched:** `packages/agent-core/mock-agent.cjs`, `electron/tools/web.cjs`, `electron/public-web-client.cjs`, `packages/contracts/ipc-validation.cjs`, `electron/store.cjs`, `src/types/settings.ts`, `tests/web-search-tool.test.cjs`, `docs/decisions/ADR-008-safe-public-web-fetch.md`, and this Codex workbook entry.

**PR handoff:** PR #40 was marked ready and merged at 23:30:38 before commit `ccc5a1d` containing these review fixes reached the branch. Main therefore contains the original WEB-001 work but not findings 1–3. Opened narrowly scoped follow-up PR #47 from the required branch; it contains only the claim and review-fix commits relative to main. PR #40's description was also updated with the observable changes for historical accuracy.

### 2026-08-16 — Codex — Speech recognition validation

**Status:** AUTOMATED CHECKS PASS; BLOCKED-ON-HUMAN for the real microphone/audio smoke test.

**Result:** The web preview at `http://127.0.0.1:5173/` does not expose Web Speech or `getUserMedia`, but a temporary hidden probe against the actual Electron 43 renderer confirmed `SpeechRecognition`, `webkitSpeechRecognition`, `navigator.mediaDevices.getUserMedia`, and a secure context are all available. The overlay implementation sets `en-GB`, disables interim results, transitions through listening/success/error/end states, and copies the first transcript into the input. `npm run typecheck` and `npm run lint` pass; the temporary probe was removed and no implementation file changed.

**Security finding:** Electron main has no `session.setPermissionRequestHandler` or `setPermissionCheckHandler`. The renderer-side `microphoneEnabled` check is only a UI affordance and does not enforce the setting at the permission boundary; this is already documented in `docs/reviews/REVIEW-001-mvp-security.md` and must be fixed before RATA-004 is complete. Do not perform or simulate the final microphone permission/audio test; it is explicitly human-owned.

### 2026-08-15 — Codex — WEB-001 implementation resumed after Phase 0

**Status:** IN PROGRESS — draft PR #40, awaiting Lane H issue #39 (branch `codex/WEB-001-implement-safe-fetch`, issue #30)

**Scope:** Add a registered, read-only `web.fetch` tool for bounded public HTTP(S) content; enforce SSRF, redirect, content-type, timeout, and response-size controls; preserve the untrusted-content boundary before provider synthesis. Serper remains scoped to `web.search`, Gemini remains scoped to its provider adapter, and neither credential is exposed to `web.fetch`. Add injected-network regression tests, an ADR/security documentation, and request Claude review before merge.

**Implemented:** Added a keyless DNS-pinned public web client and registered `web.fetch` in the discovered web tool module. It rejects URL credentials and non-HTTP(S) schemes; blocks non-public IPv4/IPv6 and mixed DNS answers; pins the connection to the vetted address; revalidates redirects; and limits time, hops, content types, bytes and extracted text. Direct URL requests, explicit “search the web” commands, and the Web Search skill now follow Serper search → safe first-result fetch → provider synthesis. Retrieved text reaches the configured provider only as `context`, which the provider contract fences as untrusted. Proposed ADR-008 records the SSRF, prompt-injection, confirmation and credential boundaries.

**Validation so far:** `check:node`, lint, typecheck and build pass. A temporary injected-network smoke harness passed public/private address checks, mixed DNS rejection, redirect-to-private rejection, byte/type limits, HTML extraction, tool metadata and provider context flow. The committed suite has four expected Lane H failures because it pins the old five-tool surface and one-definition web module. Issue #39 asks Claude to update/add tests and perform the required security review; PR #40 remains draft and must not merge until `npm run verify` is green.

**Runtime diagnosis:** The user's live chat still reported mock mode because Electron and Vite were running from the separate `rata-overlay-drag` worktree, where ignored `.env.local` credentials were absent. Stopped only that verified stale process tree and relaunched this primary checkout. The new runtime recorded `mode=auto (RATA_AI_PROVIDER) gemini=true openrouter=true search=true` and a successful Gemini response using `gemini-2.5-flash`; a separate redacted live adapter check also passed. No credential values or source configuration changed.

**Restart persistence fix:** A later restart launched another self-relative copy, `rata-app-icon`, and reproduced mock mode because only the primary checkout had the ignored `.env.local`. Found 11 existing `START_RATA_DEV.bat` worktree copies and, after verifying `.env.local` is ignored in each, created local NTFS hard links to the single canonical ignored configuration. Re-tested the exact `rata-app-icon` restart: Vite returned HTTP 200 and a redacted live Gemini check returned `OK` from `gemini-2.5-flash`. No credential value was printed or committed. Five current worktrees resolve auto/Gemini/OpenRouter/Serper correctly; six obsolete pre-provider worktrees still lack provider implementation and should not be used to launch the current app.

**Trivia runtime correction:** The reported “mock agent has no live provider” message was not an authentication failure: `rata-app-icon` was running the pre-WEB-001 `handleSkill()` implementation, which hard-codes that response for every non-calculator skill. The former primary worktree had also been switched externally to `review/drag-fix`. Created a dedicated `rata-web-001` worktree at `846de1c`, linked the ignored canonical configuration, stopped the stale app-icon Vite owner, and relaunched from WEB-001. The new runtime reports HTTP 200 and `mode=auto (RATA_AI_PROVIDER) gemini=true openrouter=true search=true`; all Electron executable paths point to `rata-web-001`. Existing verification remains 138/143 with the same five documented Lane H expectations for the expanded web tool surface.

**Trivia routing:** Added a Trivia-specific orchestration continuation: every routed Trivia & General Knowledge request executes approved Serper search first, sends the bounded result snippets as fenced `context`, and asks the provider chain to prefer Gemini then OpenRouter in `auto` mode. Explicitly pinned provider modes remain authoritative. An injected check confirmed `Serper → Gemini failure → OpenRouter success` without exposing either credential. The Lane H request must cover ordering, approval rejection, prompt loading, fenced evidence and pinned-mode precedence.

### 2026-08-15 — Codex — WEB-001 safe web fetch and research synthesis

**Status:** BLOCKED ON PHASE 0 (branch `codex/WEB-001-web-fetch-pipeline`, issue #30)

**Requested:** Link `web.fetch` with the configured Serper and Gemini capabilities.

**Finding:** `RATA_SERPER_API_KEY` is already scoped to `web.search`, and `GEMINI_API_KEY` is already scoped to the Gemini provider adapter. Passing either credential directly into a URL-fetch tool would widen secret access unnecessarily. The safe pipeline is `web.search` (Serper) → `web.fetch` (validated public URL, no provider keys) → untrusted-content fence → provider-independent orchestration → Gemini adapter.

**Blocker:** `docs/PRODUCT_BACKLOG.md` forbids feature work until all Phase 0 tickets merge. P0-4, P0-5, and P0-6 have not landed. No implementation files or credentials were changed. Issue #30 records SSRF, redirect, size/type, prompt-injection, confirmation, testing, and Claude-review requirements for implementation after the gate opens.

### 2026-08-15 — Codex — CONFIG-001 activate local AI providers

**Status:** DONE (branch `codex/CONFIG-001-activate-ai-providers`)

**Scope:** Confirm the ignored local configuration supplies Gemini, OpenRouter, and Serper credentials; validate each service without exposing credentials; relaunch the current Electron build with that configuration. No secret or source-code change is planned.

**Result:** `.env.local` remains ignored and resolves `RATA_AI_PROVIDER=auto` with Gemini, OpenRouter, and Serper configured. Redacted live calls succeeded against Gemini (`gemini-2.5-flash`), OpenRouter (`anthropic/claude-sonnet-5`), and Serper (HTTP 200). Rebuilt the six-module sandboxed preload and relaunched Electron; the renderer remained healthy at HTTP 200. No credential values were printed, committed, or sent to the renderer. GUI smoke testing remains human-owned.

**Files touched:** `AGENT_WORKBOOK.md` only. Runtime secrets stayed exclusively in the existing ignored `.env.local`.

### 2026-08-15 — P0-3 — Skills manifest to per-skill fragments

**Status:** DRAFT PR #25 — REVIEW REQUESTED
**Branch:** `codex/P0-3-skill-manifest-fragments`
**Base:** `main` after P0-2 merged

**Scope:** Replace the shared root `skills.manifest.json` array with one `skills/<id>/skill.json` fragment per skill. Update the skills registry/contracts so fragments are discovered deterministically and validation fails closed per fragment: an invalid skill is excluded and reported without disabling valid skills. Preserve declarative-only skills, prompt path confinement, public skill shape, routing behaviour, and current IDs.

**Planned validation:** migrate every manifest record without semantic drift, exercise malformed/duplicate/path-escape fragments with focused checks, run `npm run verify`, update architecture/source-map documentation, and request Claude review plus Lane H tests before merge.

**Implemented:** Replaced the root aggregate with 20 independently owned `skills/<id>/skill.json` fragments and `skills/pack.json`. Each fragment declares schema version and original routing order. The registry discovers directories deterministically, validates each fragment and prompt path independently, excludes invalid fragments, reports errors, and keeps valid skills loaded. Original skill IDs, public metadata, tool requirements, triggers, and tie-breaking order are preserved exactly. Legacy aggregate validation/loading remains compatibility-only when explicitly requested or when no skills directory exists. The packaged file list no longer names `skills.manifest.json`.

**Security/docs:** Skills remain declarative data and never grant authority. Directory/id matching, schema/order checks, path confinement, missing-prompt checks, and duplicate identity checks fail closed per fragment. ADR-003, architecture, source map, skills documentation, handover, and packaging validation guidance now describe the fragment model.

**Validation:** A semantic comparison against the former aggregate passed for all 20 records and pack metadata. Focused malformed JSON, path-escape, and invalid-pack isolation checks passed while valid skills remained loaded. `npm ci` found 0 vulnerabilities. `npm run verify` is green: 47 CommonJS files, 80/80 tests, typecheck, renderer build, and preload build. `npm run pack:win` passed; ASAR inspection found one pack descriptor, 20 fragments, 20 prompts, and zero legacy root manifests.

**Review/test handoff:** Draft [PR #25](https://github.com/ossykelvin/rata/pull/25) is open. Lane H regression coverage and the mandatory Claude Phase 0/security review are requested in [issue #24](https://github.com/ossykelvin/rata/issues/24). Do not merge before both land.

### 2026-08-15 — P0-2 — Modularize tool registration

**Status:** DRAFT PR #20 — REVIEW REQUESTED
**Branch:** `codex/P0-2-modular-tool-registration`
**Base:** `main` after P0-1 and FIX-002 merged

**Scope:** Replace the shared `electron/mvp-tools.cjs` registration hub with auto-composed domain modules under `electron/tools/`, preserving current tool IDs, metadata, policy behaviour, and dependency injection. Fold security finding H2 into the system tool by using a prototype-safe allow-list. Do not edit Claude-owned `packages/contracts/` or `tests/`; request Lane H regression coverage and Claude review before merge.

**Planned validation:** exercise discovery/composition failure cases with injected smoke checks, run `npm run verify`, and document the extension boundary in the source map and architecture docs.

**Implemented:** Moved the four MVP definitions into `electron/tools/{system,clipboard,calculator,file}.cjs`. `electron/tools/index.cjs` discovers modules deterministically, validates module declarations and ownership before construction, then registers complete definitions through `ToolRegistry`. Composition fails closed on malformed modules, duplicate module IDs, duplicate tool ownership, missing/undeclared created IDs, invalid tool metadata, and missing native dependencies. Electron runtime imports the new composition index; `electron/mvp-tools.cjs` is compatibility-only. The system allow-list remains null-prototype and checks own properties, closing REVIEW-001 H2.

**Documentation:** Added ADR-006 and updated architecture, source map, and handover guidance. Tool modules are explicitly trusted packaged application code, never user- or model-supplied plugins.

**Validation:** Injected composition checks passed for deterministic discovery, the four existing tool IDs, duplicate module IDs, duplicate ownership, declared/created ID mismatch, and invalid registry metadata. `npm ci` completed with 0 known vulnerabilities. `npm run verify` is green: 46 CommonJS files checked, 59/59 tests passed, TypeScript passed, renderer built, and the sandboxed preload bundle built.

**Review/test handoff:** Draft [PR #20](https://github.com/ossykelvin/rata/pull/20) is open. Lane H regression coverage and mandatory Claude privilege-boundary review are requested in [issue #19](https://github.com/ossykelvin/rata/issues/19). Do not merge before that review and committed composition tests land.

### 2026-08-15 — FIX-001 — Idempotent Windows development startup

**Status:** REVIEW REQUESTED
**Branch:** `codex/FIX-001-idempotent-startup`

**Root cause:** Re-running `START_RATA_DEV.bat` while Rata is already active starts a second strict-port Vite process. Vite exits because port 5173 is occupied, `concurrently -k` terminates the new Electron process, and the batch window closes while reporting exit code 0.

**Scope:** Make the batch launcher recognize an existing Rata dev server, launch Electron only in that case, enforce Electron single-instance behavior that reveals the existing Control Center, and preserve visible nonzero failures. No renderer or contract paths will be edited. Electron changes require Claude review; committed regression tests are requested from the test owner.

**Implemented:** `START_RATA_DEV.bat` now recognizes the Rata Vite page before taking an Electron-only relaunch path, propagates native PowerShell exit codes, and pauses on genuine failure. Electron owns a single-instance lock; a relaunch restores and focuses the existing Control Center. The Windows quick-start documentation describes the behavior.

**Verification:** `npm ci` and `npm run verify` pass (19/19 tests, typecheck, production build). A clean first launcher invocation started Vite and Electron. A second invocation completed with exit code 0 in 1.5 seconds, left the original server at HTTP 200, and left exactly one Electron main process. The fixed development server remains running from this worktree.

**Review/test handoff:** Draft [PR #7](https://github.com/ossykelvin/rata/pull/7) is open. Claude review and Lane H regression coverage are requested in [issue #6](https://github.com/ossykelvin/rata/issues/6). Do not merge before that review because this ticket touches `electron/main.cjs`.
### 2026-08-15 — FIX-002 — Bundle the sandboxed Electron preload

**Status:** REVIEW REQUESTED
**Branch:** `codex/FIX-002-bundle-sandboxed-preload`
**Base:** `main` after P0-1 merged as PR #4

**Root cause:** Both Electron renderers expose an empty React root because `window.rata` is undefined. The preload imports local CommonJS modules while `sandbox: true` is enforced; Electron's sandboxed preload loader permits only a limited built-in module set and cannot load those local modules.

**Scope:** Bundle the modular preload and its local bridge/contracts dependencies into one sandbox-compatible artifact, keep `sandbox: true`, `contextIsolation: true`, and `nodeIntegration: false`, wire development and packaging builds to produce it, then validate the live Control Center. Do not edit `tests/` or weaken the security boundary; request Lane H tests and Claude review.

**Implemented:** Added a build-time esbuild entry generator that discovers all bridge fragments and produces `dist-electron/preload.cjs`. Runtime bridge composition is separated from filesystem discovery so the generated artifact contains no forbidden local or Node built-in imports. Development, start, production build, and packaging scripts generate the bundle; Electron fails clearly if it is missing. The packaged file list and architecture/source-map documentation are updated.

**Validation:** After rebasing onto current `main`, `npm run verify` passes with 59/59 tests, typecheck, renderer build, and an 8.2 KB preload bundle containing all five bridge fragments; PR CI is green. The bundle's only literal runtime import is `electron`. A fresh sandboxed Electron launch renders the complete Control Center Dashboard/navigation tree and overlay UI, with exactly one Electron main instance and HTTP 200 on port 5173. The fixed dev server remains running from this worktree.

**Open verification:** `npm run pack:win` reaches Electron Builder packaging but fails twice with Windows `EPERM` while renaming `release/win-unpacked.tmp`; generated output was moved aside once and the failure reproduced. No source or user files were removed. [PR #16](https://github.com/ossykelvin/rata/pull/16) is ready for review against `main`; packaging inclusion and Lane H regressions are requested in [issue #15](https://github.com/ossykelvin/rata/issues/15). Claude review is mandatory before merge.

**Review follow-up:** Claude reported three non-blocking findings. The generated-artifact `require()` guard detects literal-string imports only and is documented as a heuristic rather than a complete parser. Lane H owns adding the hand-run bundled-preload contract verification as an automated test. The new esbuild build-time dependency is pinned exactly to `0.28.2` to keep the added postinstall supply-chain surface deliberate. PR #16 is ready for review; it must not merge until Claude's review is recorded.

### 2026-08-15 — P0-1 — Modularize the IPC boundary

**Status:** IN PROGRESS
**Branch:** `codex/P0-1-modular-ipc-boundary`

**Scope:** Replace the Electron IPC and preload hub registration with auto-composed modules under `electron/ipc/` and `electron/bridge/`, preserving the current renderer API and security settings. Contract-owned work under `packages/contracts/` remains delegated to Claude through issue #1; Codex will consume the agreed aggregate and will not edit that path.

**Planned validation:** focused IPC/bridge composition tests plus full `npm run verify`. The PR touches `electron/` and requires Claude review before merge.

**Progress:** The Electron-owned handler and bridge composition is implemented. Current APIs and channel values are preserved; module discovery, declared-channel enforcement, duplicate detection, incomplete-registration detection, and rollback fail closed. ADR-005 and the architecture/source map document the boundary. No `packages/contracts/`, `tests/`, or `src/` paths were edited.

**Validation:** Injected IPC/bridge smoke checks passed. `npm run verify` is green: 33 CommonJS files checked, 19/19 existing tests passed, TypeScript passed, and the Vite production build succeeded. `npm ci` reported 0 known vulnerabilities.

**Coordination:** Lane G contract request is issue #1. Claude-owned regression-test request is issue #3. This work must not merge until the channel-fragment contract, committed regression tests, and Claude security review are complete.

---

## Cursor

### 2026-08-17 — RATA-014 — File organize writes (folder.create, file.move, file.rename)

**Status:** DONE, PR #80
**Branch:** `cursor/RATA-014-file-organize` (stacked on `cursor/RATA-013-document-and-save` / PR #79)

**Done:** Registered `folder.create`, `file.move` and `file.rename`. Same containment as `file.save`: Documents, Downloads, Desktop; parent through existing `resolveWithinRoots`; basename rules; denied names and executable destinations refused. v1 is files-only for move/rename, folders-only for folder.create, non-recursive mkdir, same-volume rename. `file.rename` cannot change directories. Overwrite always confirms. A denied-name source may be renamed to a safe name. `file.delete` stays disabled. Skill files and planner/communicator enums were not edited.

**Files touched:** `electron/file-access.cjs`, `electron/tools/file.cjs`, `tests/file-organize.test.cjs`, `tests/file-access-security.test.cjs`, `tests/tool-composition.test.cjs`, `docs/decisions/ADR-017-file-organize-writes.md`, `docs/decisions/ADR-016-file-write-boundary.md`, `docs/decisions/ADR-010-readonly-local-file-access.md`, `docs/SECURITY.md`, `docs/CODEMAP.md`, `docs/VALIDATION.md`, `docs/TASKS.md`.

**Validation:** `npm run verify` exit 0, **476/476**. Registry proof with a composed tool registry: `file-organizer ready available=["file.search","folder.create","file.move","file.rename"] missing=[]`.

**Coordination:** Claude review requested on PR #80 for the `electron/` file-write verbs. Stacked on #79; retarget to `main` after that merges. Did not touch `packages/agent-core/mock-agent.cjs`, communicator intent enum, or ADR-009.

---

### 2026-08-17 — RATA-013 — Document create and file.save

**Status:** DONE, PR #79
**Branch:** `cursor/RATA-013-document-and-save`

**Done:** Registered `document.create`, `presentation.create`, `presentation.render`, and `file.save`. v1 is Markdown/HTML, not .docx/.pptx. `file.save` splits parent + basename and runs the parent through existing `resolveWithinRoots` (not widened). Denied names and executable extensions are refused on write. Overwrite defaults to refuse and always confirms when requested, even if `fileWriteConfirm` is off. Writes are atomic. Generation tools do no I/O and HTML-escape every interpolated value. Skill files were not edited.

**Files touched:** `electron/file-access.cjs`, `electron/tools/file.cjs`, `electron/tools/document.cjs`, `packages/agent-core/policy-engine.cjs`, `packages/contracts/ipc-validation.cjs`, `electron/store.cjs`, `src/types/settings.ts`, `src/views/control/PermissionsPage.tsx`, `tests/file-write.test.cjs`, `tests/document-tools.test.cjs`, `tests/tool-composition.test.cjs`, `tests/file-access-security.test.cjs`, `tests/settings-validation.test.cjs`, `docs/decisions/ADR-016-file-write-boundary.md`, `docs/decisions/ADR-010-readonly-local-file-access.md`, `docs/SECURITY.md`, `docs/CODEMAP.md`, `docs/VALIDATION.md`.

**Validation:** `npm run verify` exit 0, **454/454**. Registry proof with a composed tool registry: `document-assistant ready available=["file.readText","document.create","file.save"] missing=[]`; `presentation-builder ready available=["presentation.create","presentation.render","file.save"] missing=[]`.

**Coordination:** Claude review requested on PR #79 for the `electron/` file-write boundary. `file.move` / `file.rename` / `folder.create` left for Codex. Did not touch `packages/agent-core/mock-agent.cjs`, communicator intent enum, or ADR-009.

---

### 2026-08-16 — RATA-005 — System status and keep-awake tools

**Status:** DONE, PR #67
**Branch:** `cursor/RATA-005-system-status`

**Done:** Extended `electron/tools/system.cjs` with `system.info`, `system.storage`, `system.processSummary`, and `system.keepAwake.start/stop/status`. Native `os`, volume/process listers and `powerSaveBlocker` are injected via `create(deps)`. Process summaries never include command lines, arguments or window titles. Keep-awake holds one bounded blocker (4-hour cap, auto-release, quit release). Skills `system-info` and `keep-awake` report `ready` against a composed registry. SKILL.md files were not edited.

**Files touched:** `electron/tools/system.cjs`, `electron/tools/index.cjs`, `electron/main.cjs`, `tests/system-status.test.cjs`, `tests/tool-composition.test.cjs`, `tests/system-action-planner.test.cjs`, `docs/CODEMAP.md`, `docs/ARCHITECTURE.md`, `docs/SECURITY.md`, `docs/VALIDATION.md`.

**Validation:** `npm run verify` passed (315 tests). Injected tests only; no Electron or live machine state.
### 2026-08-17 — RATA-011 — Session conversation continuity

**Status:** DONE, PR #73
**Branch:** `cursor/RATA-011-session-continuity`

**Done:** In-memory session history so follow-up `ask()` turns can refer to earlier ones. History is data, not authority. Safer v1: history is passed only into `ask()`, not the communicator intent stage. No pronoun resolution for tools. Cap 16 turns / 8,000 characters; drop oldest. Quit clears. Overlay and Control Center share one MockAgent. Claude review requested on `packages/agent-core/`.

**Files touched:** `packages/agent-core/conversation-memory.cjs`, `packages/agent-core/mock-agent.cjs`, `tests/conversation-memory.test.cjs`, `docs/decisions/ADR-013-session-continuity.md`, `docs/SECURITY.md`, `docs/CODEMAP.md`, `docs/ARCHITECTURE.md`, `docs/VALIDATION.md`, `docs/TASKS.md`.

**Validation:** `npm run verify` 349/349.

**Coordination:** Stacked on #70. Retarget to `main` after Communicator merges.

---

### 2026-08-17 — RATA-008 — Communicator (understanding + voice)

**Status:** DONE, PR #70
**Branch:** `cursor/RATA-008-communicator`

**Done:** Always-on communicator, not a routed skill (`selectable: false`). Understanding sits last after deterministic routes, the skill router and ADR-009; it maps a fixed intent enum onto existing tools. Voice rewrites conversational replies through one `presentReply` seam. `communicatorEnabled` defaults to false. Claude review requested on `packages/agent-core/`.

**Files touched:** `packages/agent-core/communicator.cjs`, `packages/agent-core/mock-agent.cjs`, `packages/skills/{router,loader,contracts,index}.cjs`, `skills/communicator/`, `packages/contracts/ipc-validation.cjs`, `electron/store.cjs`, `src/types/settings.ts`, `src/views/control/PermissionsPage.tsx`, `tests/communicator.test.cjs`, `tests/skill-fragments.test.cjs`, `docs/decisions/ADR-012-communicator.md`, `docs/SECURITY.md`, `docs/CODEMAP.md`.

**Validation:** `npm run verify` 337/337 after merging current `origin/main`.
### 2026-08-17 — RATA-SKILL-007 — Filesystem Scan tools

**Status:** DONE, PR #75
**Branch:** `cursor/SKILL-007-filesystem-scan-tools`

**Done:** Registered `filesystem.scan`, `filesystem.diskUsage` and `filesystem.hash`, the three ids `skills/filesystem-scan/skill.json` has always declared. The skill now reports `ready` with an empty `missingTools`; ready skills go 9 → 10 of 21. The skill files were not edited — the ids match them character for character. ADR-014.

**The decision worth recording.** I did not write a path validator. `electron/file-access.cjs` already owns `resolveWithinRoots`, and a second validator would have started identical and ended different, at which point the *weaker* of the two becomes the real policy. Instead `normalizeRoots` and `resolveWithinRoots` gained an optional `fs` parameter (behaviour with real `node:fs` unchanged), and the new module calls them. `main.cjs` now has one `userFolderRoots()` feeding both `createFileAccess` and `createFilesystemScan`, so "which folders may Rata look at" has one answer instead of two that can drift.

What the new module *does* add is a **stricter** gate in front of that one, never a looser one: device namespaces (`\\.\`, `\\?\`), UNC shares, drive-relative and relative paths, surviving `..` segments, NUL bytes and over-length input are refused before anything reaches `realpath`. `resolveWithinRoots` would already neutralise `..` and symlinks; the value of refusing earlier is that no device handle is opened and a dead network share cannot block a scan.

**No file contents, structurally.** `scan` never opens a file. `hash` opens a read-only handle, folds 64KB chunks into the digest and drops them, and returns a hex string. A file above the 16MB cap is **refused, not partly hashed** — a prefix digest is indistinguishable from a whole-file digest to whoever receives it and would produce confident, wrong duplicate claims, which is exactly what the skill's own prompt rules 7–8 are trying to prevent. Paths come back relative to the scanned root, so the Windows user name is not in every row of output.

**Confirmation reuses `fileReadConfirm`; no new setting.** A bulk inventory of file names is at least as revealing as the text of one file and leaves the machine the same way. A second overlapping switch would let a user have one on and the other off. This is deliberately stricter than ADR-010's own reasoning for `file.search` being automatic — an unrequested inventory of everything is a different act from looking for one named file. No edits to `ipc-validation.cjs`, `store.cjs`, `settings.ts` or `PermissionsPage.tsx`, which keeps this clear of PR #70.

**Where I did not satisfy the skill's declared contract, and did not force it.** The skill declares `confirm_if_scope_is_entire_system_or_protected` and its first trigger is "Scan my C drive". Whole-volume and protected scanning is **refused**, not confirmed — `C:\Windows`, `C:\Program Files` and bare drive roots are outside the allow-list and fail closed. Refusing exceeds the declared policy rather than weakening it, so I did not add a confirmation path for it; a dialog is not a substitute for an allow-list, and the request originates in model-adjacent prompt text. Also outstanding and stated plainly rather than papered over: **cancellable background jobs** (the skill declares `background_capable: true`; there is no job manager — RATA-SKILL-004 — so a scan is bounded by time/entry caps but cannot be cancelled mid-flight) and **user-configured exclusions** (only the ADR-010 denied-name/denied-directory lists are honoured). Both are recorded in ADR-014 and `docs/SKILLS-HANDOVER.md`.

**Files touched:** `electron/filesystem-scan.cjs` (new), `electron/tools/filesystem.cjs` (new), `electron/file-access.cjs`, `electron/main.cjs`, `tests/filesystem-scan.test.cjs` (new), `tests/tool-composition.test.cjs`, `tests/skills-registry.test.cjs`, `docs/decisions/ADR-014-filesystem-inventory-boundary.md` (new), `docs/SECURITY.md`, `docs/CODEMAP.md`, `docs/VALIDATION.md`, `docs/SKILLS-HANDOVER.md`, `docs/PRODUCT_BACKLOG.md`.

**Validation:** `npm run verify` exit 0, **352/352**, 86 CommonJS files. `tests/filesystem-scan.test.cjs` adds 37 tests, all against an injected in-memory disk with no real filesystem walk, no real volume, no real Electron, and no hashing of a real file. The fake is what makes it possible to assert on device paths and junction escapes that cannot be created safely on a test machine. Registry proof with a composed tool registry: `filesystem-scan ready available=["filesystem.scan","filesystem.diskUsage","filesystem.hash"] missing=[]`.

**Two pinned surfaces moved deliberately.** `EXPECTED_TOOL_IDS` in `tests/tool-composition.test.cjs` went 12 → 15; that list is the privileged tool surface and should only move in a commit that says why. And `tests/skills-registry.test.cjs` used `filesystem-scan` as its example of a skill with *no* registered tools, so it started failing on the honest-refusal assertion — correctly, because the fixture is what changed. It now uses `screenshot-inspector` (needs `screen.capture`/`vision.analyze`, a different lane) and additionally asserts `filesystem-scan` is `ready`, so swapping the fixture cannot hide a regression.

**Coordination:** Claude security review requested — this touches `electron/` and reads the user's filesystem. Nothing under `packages/agent-core/` or `mock-agent.cjs` was touched, so this does not collide with PR #70 or PR #73. Scan output does **not** reach a provider in this PR; it carries `trust: 'untrusted-external'` so that whichever stage first forwards it has to fence it with `fenceUntrusted`. Follow-up, not done here: the Permissions page still describes this under its existing "Confirm reading file contents" row, because PR #70 is open against that file — a dedicated row belongs in a later change.

---

### 2026-08-16 — FIX — Overlay Hide and compact drag (follow-up after #60)

**Status:** IN PROGRESS
**Branch:** `cursor/FIX-overlay-hide-compact`

**Scope:** #60 merged without the Hide-button and compact-drag fixes. Hide must collapse −/× with the Ask bar. Compact widget must be a native drag surface; restore stays no-drag.

**Files currently touching:** `src/views/Overlay.tsx`, `src/styles/overlay.css`, `tests/overlay-window-controls.test.cjs`, `tests/overlay-drag.test.cjs`.

---

### 2026-08-16 — FIX — Overlay tray click must recreate via showOverlay

**Status:** DONE, PR #60
**Branch:** `cursor/FIX-overlay-min-close`

**Done:** Merged current main. Tray click and Show Rata go through `showOverlay()`, not `overlayWindow?.show()`. Hide collapses min/close with the Ask bar. Compact widget is a native `-webkit-app-region: drag` surface; restore stays `no-drag` on the inner icon. Close calls `hideOverlay()` once and does not quit.

**Files touched:** `electron/main.cjs`, `src/views/Overlay.tsx`, `src/styles/overlay.css`, `tests/overlay-window-controls.test.cjs`, `tests/overlay-drag.test.cjs`.

**Validation:** `npm run verify` passed (274 tests).

**Coordination:** Claude review required — this touches `electron/`. #60 merged before Hide/compact-drag; remaining UI fixes are on `cursor/FIX-overlay-hide-compact`.
### 2026-08-16 — FIX — Voice mid-transcript disable contract

**Status:** DONE, PR #65
**Branch:** `cursor/FIX-voice-mid-transcript-disable`

**Done:** Follow-up after #62. `start()` is a Promise through IPC and preload; rejections are clean errors (renderer `try/catch` already awaits). Disabling the mic mid-transcript **delivers** leftover buffered speech on process exit — same `stop()` path as push-to-talk release. Complete lines already emitted stay emitted.

**Files touched:** `electron/voice-win.cjs`, `tests/voice-win.test.cjs`, `tests/voice-recognition.test.cjs`, `docs/SECURITY.md`, `docs/VALIDATION.md`, `docs/ARCHITECTURE.md`.

**Validation:** `npm run verify` passed (277 tests).

**Coordination:** New PR, not a reopen of #62. Claude review required — this touches `electron/`.

---

### 2026-08-16 — FIX — Overlay minimize and close

**Status:** DONE, PR pending
**Branch:** `cursor/FIX-overlay-min-close`

**Done:** Overlay Ask bar now has minimize (−) and close (×) to the right of Open Control Center. Minimize collapses to a small draggable icon; click restores. Close calls `hideOverlay()` and does not quit. Overlay stays `skipTaskbar`; Control Center leaves the taskbar when hidden; tray left-click shows the overlay again.

**Files touched:** `src/views/Overlay.tsx`, `src/styles/overlay.css`, `electron/main.cjs`, `tests/overlay-window-controls.test.cjs`, `docs/VALIDATION.md`, `docs/ARCHITECTURE.md`.

**Validation:** `npm run verify` passed (184 tests).
### 2026-08-16 — FIX — Voice permission gate and recognizer restart race

**Status:** DONE, PR #62
**Branch:** `cursor/FIX-voice-permission-gate`

**Done:** RATA-004 review findings. Chromium `getUserMedia` and the Windows PowerShell recognizer both consult `isMicrophoneEnabled()` in `electron/security.cjs`. Disabling the microphone while a session is listening stops the child. `start()` during a pending `stop()` waits for the old child; an exiting child never clears a newer child's reference (same shape as `overlayWindow === window` in PR #54).

**Files touched:** `electron/security.cjs`, `electron/ipc/voice.cjs`, `electron/ipc/settings.cjs`, `electron/voice-win.cjs`, `tests/voice-win.test.cjs`, `tests/electron-security.test.cjs`, `docs/SECURITY.md`, `docs/VALIDATION.md`, `docs/ARCHITECTURE.md`, `docs/CODEMAP.md`.

**Validation:** `npm run verify` passed (226 tests). Injected-spawn tests cover mid-session disable, start-during-stop, and old-exit identity. No real microphone or powershell.exe.

**Coordination:** Separate from PR #59 (Critical Thinking provider). Claude review required — this touches `electron/`.
### 2026-08-16 — FIX — Critical Thinking uses the live provider

**Status:** DONE, PR pending
**Branch:** `cursor/FIX-critical-thinking-provider`

**Done:** Critical Thinking loads its `SKILL.md` prompt beneath the global system prompt and calls the provider chain with OpenRouter preferred in `auto` mode. The old “mock agent has no live provider” stub is no longer used for this skill. The model still cannot invoke tools. Missing declared tools still fail closed.

**Files touched:** `packages/agent-core/mock-agent.cjs`, `tests/critical-thinking-provider.test.cjs`, `docs/ARCHITECTURE.md`, `docs/VALIDATION.md`.

**Validation:** `npm run verify` passed (204 tests).

---

### 2026-08-16 — TRIVIA-001 — Align Trivia prompt with Serper-first routing

**Status:** DONE, PR pending
**Branch:** `cursor/TRIVIA-001-serper-first`

**Done:** Issue #42. Trivia prompt and fragment now require Serper-first `web.search` verification, treat search evidence as untrusted, prefer Gemini with OpenRouter fallback in auto mode, and state that `webSearchConfirm` stays authoritative. Confirmation metadata is `respect_web_search_policy`. Id, order, category and tool list unchanged.

**Files touched:** `skills/trivia/skill.json`, `skills/trivia/SKILL.md`.

**Validation:** `npm run verify` passed (144 tests).

**Coordination:** No edits to PR #40 or Lane H issue #39.
### 2026-08-15 — RATA-004 — Speech recognition

**Status:** DONE, PR #44
**Branch:** `cursor/RATA-004-speech-recognition`

**Done:** First STT slice of RATA-004. Overlay and Chat use `useVoice` for hold-to-talk, cancel, and permission state. Main denies Chromium `media` when `microphoneEnabled` is false (REVIEW-001 M4). No TTS and no new IPC channels.

**Files touched:** `src/hooks/useVoice.ts`, `src/components/VoiceMicButton.tsx`, `src/views/Overlay.tsx`, `src/views/control/ChatPage.tsx`, `src/views/control/PermissionsPage.tsx`, `src/views/control/DeveloperPage.tsx`, `src/styles/overlay.css`, `src/styles/control.css`, `electron/security.cjs`, `electron/main.cjs`, `tests/voice-recognition.test.cjs`, `tests/electron-security.test.cjs`, `docs/VALIDATION.md`, `docs/TASKS.md`, `docs/ARCHITECTURE.md`, `docs/CODEMAP.md`, `docs/HANDOVER.md`.

**Validation:** `npm run verify` passed (152 tests).

**Still open:** configurable cloud STT/TTS adapters and TTS.

**2026-08-16 — STT fix:** Chromium `SpeechRecognition` always fails in Electron (`network` / no Google speech service). Push-to-talk now uses Windows speech recognition from `electron/voice-win.cjs` through `rata:voice-*`. The renderer only receives the transcript. `microphoneEnabled` is enforced in the voice IPC handler. Lane G should review the three new contract channels.

**2026-08-16 — Codex b1d9c52:** The WEB-001 workbook restated REVIEW-001 M4 after probing a checkout that did not include this branch. This PR already registers `setPermissionRequestHandler` and `setPermissionCheckHandler` on `session.defaultSession` before windows are created. `media`/`microphone` are allowed only when `microphoneEnabled === true` and requested types are audio-only. Every other renderer permission is denied. The renderer checkbox remains a UI affordance only.

---

### 2026-08-15 — FIX — Overlay drag after P0-4 overflow clip

**Status:** DONE (PR pending)
**Branch:** `cursor/FIX-overlay-drag-overflow`

**Done:** Restored `overflow: visible` on the overlay drag ancestors so Chromium `-webkit-app-region: drag` works again after P0-4. Long replies still clip inside `.speech-bubble`. Overlay `html/body/#root` override via `:has(.overlay-root)`. No Electron edits.

**Files touched:** `src/styles/overlay.css`, `tests/overlay-drag.test.cjs`, `tests/overlay-speech-bubble.test.cjs`.

**Validation:** `npm run verify` passed (143 tests).
### 2026-08-15 — FIX — Application icon and taskbar

**Status:** DONE, PR #41
**Branch:** `cursor/FIX-app-icon`

**Done:** Control Center, Windows taskbar, and system tray use `public/24_dialog_avatar_reply.png`. Packaged builds take the same file as `win.icon`.

**Files touched:** `electron/main.cjs`, `package.json`, `index.html`, `tests/app-icon.test.cjs`, `docs/VALIDATION.md`.

**Validation:** `npm run verify` passed (144 tests).

---

### 2026-08-15 — P0-4 — Decouple the renderer

**Status:** DONE (branch `cursor/P0-4-decouple-renderer`)
**Branch:** `cursor/P0-4-decouple-renderer`

**Done:** Split renderer types into `src/types/` and styles into `base`/`overlay`/`control`. Control Center pages export `controlPage` and load through `import.meta.glob`. Overlay uses `useAgentConversation`. Sequenced after #32 (merged). #36 should rebase onto `src/styles/overlay.css`.

**Files touched:** `src/types/`, `src/styles/{base,overlay,control}.css`, `src/main.tsx`, `src/views/Overlay.tsx`, `src/views/ControlCenter.tsx`, `src/views/control/`, `src/hooks/useAgentConversation.ts`, `tests/renderer-decouple.test.cjs`, `tests/overlay-speech-bubble.test.cjs`, `docs/CODEMAP.md`, `docs/ARCHITECTURE.md`. Removed `src/types.ts` and `src/styles/global.css`.

**Validation:** `npm run verify` passed (141 tests, lint, typecheck, build).

---

### 2026-08-15 — ISSUE-34 — Overlay widget drag

**Status:** DONE (PR #36, branch `cursor/ISSUE-34-overlay-drag`)
**Branch:** `cursor/ISSUE-34-overlay-drag`

**Done:** The character is a native drag surface (`pointer-events: none` so the grab hits `-webkit-app-region: drag`). Ask/Hide is a separate no-drag chip. The speech-bubble header can also drag; the message, approvals, and quick input stay interactive. No Electron edits.

**Files touched:** `src/views/Overlay.tsx`, `src/components/SpeechBubble.tsx`, `src/styles/global.css`, `tests/overlay-drag.test.cjs`, `docs/VALIDATION.md`.

**Validation:** `npm run verify` passed (138 tests). GUI smoke: drag region is `drag`, character `pointer-events: none`, Ask is `no-drag` and opens the input.
**Status:** IN PROGRESS
**Branch:** `cursor/ISSUE-34-overlay-drag`

**Scope:** Lane B / renderer. Make the overlay character a native drag surface so the widget can be moved across the screen. Keep bubble body, approvals, and Ask input interactive. No Electron privilege-boundary edits.

**Files currently touching:** `AGENT_WORKBOOK.md` (claim only; implementation follows).

---

### 2026-08-15 — ISSUE-29 — Overlay long-response scroll

**Status:** DONE (PR #32, branch `cursor/ISSUE-29-overlay-scroll`)
**Branch:** `cursor/ISSUE-29-overlay-scroll`

**Done:** Overlay speech bubble keeps a fixed Rata/state header. Message body is a bounded vertical scroll region sized against remaining overlay height so the avatar and quick input stay visible. Long tokens wrap. Short replies stay compact. No Electron edits.

**Files touched:** `src/components/SpeechBubble.tsx`, `src/styles/global.css`, `tests/overlay-speech-bubble.test.cjs`, `docs/VALIDATION.md`.

**Validation:** `npm run verify` passed (134 tests). GUI smoke (VALIDATION.md item 13): short greeting stayed compact; a 24-paragraph reply with long URLs scrolled in `.bubble-body` (`scrollHeight` 2696 > `clientHeight` 123) while the Rata/state header, avatar, and quick input stayed inside the 360×470 overlay.

---

### 2026-08-15 — ISSUE-17 follow-up — Per-state character art

**Status:** DONE (branch `cursor/ISSUE-17-restore-character-image`, PR #18)
**Branch:** `cursor/ISSUE-17-restore-character-image`

**Done:** Idle/default uses `public/rata-concept.png`. Other states swap sliced PNGs under `public/character/` (peeking, thinking, question, laptop, happy, surprised, sleeping). Catalog, classes, labels, and silhouette fallback stay event-driven.

**Validation:** `npm run verify` passed.

---

### 2026-08-15 — ISSUE-17 — Restore original Rata character image

**Status:** DONE (branch `cursor/ISSUE-17-restore-character-image`, PR #18)
**Branch:** `cursor/ISSUE-17-restore-character-image`

**Done:** Kept the RATA-003 event-driven state engine, classes, labels, and silhouette fallback. Temporary visible art is the original `public/rata-concept.png` crop (`temporaryArt` in `states.json`) until production per-state assets replace it.

**Files touched:** `src/components/character/states.json`, `src/components/character/characterStates.ts`, `src/components/character/RataCharacter.tsx`, `src/styles/character.css`, `tests/character-states.test.cjs`, `docs/CHARACTER-ASSETS.md`, `docs/ARCHITECTURE.md`, `docs/VALIDATION.md`, `README.md`, `src/views/control/AppearancePage.tsx`.

**Validation:** `npm run verify` passed (`check:node`, 60 tests, `typecheck`, `vite build`).

**Blocked on:** production per-state character art remains BLOCKED-ON-HUMAN.

---

### 2026-08-15 — RATA-003 — Character animation engine

**Status:** DONE (branch `cursor/rata-003-character-animation-9241`, draft PR #5)
**Branch:** `cursor/rata-003-character-animation-9241`

**Done:** Event-driven character presentation. Overlay/Control Center/chat/dashboard keep importing `RataAvatar`; that file re-exports `RataCharacter`. States including `awaiting_approval` and `sleeping` map to `public/character/*.svg` placeholders. Unknown states use the idle asset. Missing files fall back to a letter-mark silhouette. No renderer business logic. No edits to `src/types.ts`, `src/styles/global.css`, Electron, contracts, or agent-core.

**Files touched:** `src/components/character/`, `src/styles/character.css`, `public/character/`, `src/components/RataAvatar.tsx`, `tests/character-states.test.cjs`, `docs/CHARACTER-ASSETS.md`, `docs/ARCHITECTURE.md`, `docs/CODEMAP.md`, `docs/VALIDATION.md`, `README.md`, `src/views/control/AppearancePage.tsx`, `src/views/control/DeveloperPage.tsx`.

**Validation:** `npm run verify` passed (`check:node`, 23 tests, `typecheck`, `vite build`). GUI smoke still blocked: `window.rata` is undefined until Codex P0-1.

**Blocked on:** preload/`window.rata` for Electron smoke. Real character art remains BLOCKED-ON-HUMAN. Lane C (RATA-004) waits on Lane A streaming.

---

## Session log — archive

Chronological entries from before the lane protocol. Preserved verbatim.

### 2026-08-15 — Cursor (Grok) — Point workbook at GitHub and remove orphan contracts

**Status:** DONE
**Task given:** The project lives at `https://github.com/ossykelvin/rata.git`.

**Done:**

- Recorded the canonical remote at the top of this workbook and in `README.md`.
- Deleted unreferenced `packages/contracts/index.cjs` and `packages/contracts/contracts.d.ts` (Open Item 1). Runtime contracts remain `ipc-channels.cjs` + `ipc-validation.cjs`.

**Files touched:** `AGENT_WORKBOOK.md`, `README.md`, deleted the two orphan contract files.

### 2026-08-15 — Claude (Opus 5) — Created this workbook; verified Git state

**Status:** DONE
**Task given:** "Write into a file `AGENT_WORKBOOK.md` where a summary of all work you are doing or you've done should be written into so that Claude and Cursor can stay updated."

**Done:**

- Authored `AGENT_WORKBOOK.md` (this file): usage rules, repo snapshot, session log, open items, and the coordination protocol at the bottom.
- Verified the Git state directly rather than trusting the earlier snapshot. At 15:02 there was no `.git` anywhere in the folder or its ancestors; by 15:05 it existed, with `origin` → `ossykelvin/rata` on `main`. The Codex session initialized and pushed it in between — see its entry below.
- Confirmed `package-lock.json` is tracked (not ignored), and that `node_modules/`, `dist/`, and `release/` stay ignored.
- Corrected stale cross-references in Open Items (runtime-boundary validation is `ADR-004`, not `ADR-003`).

**Confirmed at 15:05:** commits `a4ad325` → `d8f3cb2` → `de7c714`, working tree clean, `main` in sync with `origin/main`.

**Carried forward:** my two orphan contract files were included in baseline commit `a4ad325` and are now on GitHub. They are still unreferenced and still need removing — Open Item 1. I did not delete them in this session because the Codex session was actively committing at the time and an unannounced working-tree change could have collided with its next commit.

*[Resolved 15:12 — the Cursor (Grok) session removed both files in commit `e0affdc`, now pushed. I re-ran `npm run verify` afterwards to confirm the removal broke nothing: `check:node` clean, 19/19 tests pass, `typecheck` passes, `vite build` succeeds. Working tree clean, `main` level with `origin/main`.]*

### 2026-08-15 — Codex — Initialize and publish Git repository

**Status:** DONE
**Task given:** Link the local project to `https://github.com/ossykelvin/rata.git` and publish it on GitHub.

**Result:** Initialized local branch `main`, attached the empty GitHub repository as `origin`, reviewed the complete staged snapshot and ignore rules, scanned for common credential markers, created baseline commit `a4ad325`, and pushed it to `origin/main`. Generated output, dependencies, and local `.env` files remain ignored; `.env.example` is intentionally tracked.

### 2026-08-15 — Codex — Runtime-boundary refactor and multi-agent handoff

**Status:** DONE
**Task given:** Refactor the folder and prepare it for collaboration with Claude and Cursor; subsequently create this shared workbook.

**Implemented:**

- Extracted allow-listed MVP tools into `electron/mvp-tools.cjs` and centralized validated execution in `ToolRegistry.execute()`.
- Enforced complete tool metadata, declarative confirmation settings, default confirmation for external writes, and denial of destructive MVP tools.
- Added runtime validation for settings, agent messages, approval UUIDs, and individual tool inputs; added defense-in-depth store validation.
- Redacted full user requests from the default activity log.
- Integrated the shared skill registry/router, safe calculator tool, IPC channel constants, renderer types, hooks, reusable components, and split Control Center pages that landed in the shared workspace during the refactor.
- Updated architecture, security, handover, task, validation, and decision documentation. Runtime-boundary validation is recorded in `ADR-004`; skills-as-non-authority is `ADR-003`.
- Expanded `CLAUDE.md`, added always-applied Cursor workflow rules and `.cursorignore`, and linked `AGENT_WORKBOOK.md` from `AGENTS.md`, Claude, Cursor, and the README handover order.
- Added comprehensive CommonJS syntax discovery, `npm run verify`, a dependency lockfile, separate `dist/` and `release/` output, and production packaging that excludes build-only dependencies.

**Validation:**

- `npm install`: passed, 0 known vulnerabilities.
- `npm run check:node`: passed for 21 CommonJS files.
- `npm test`: 19 tests passed.
- `npm run typecheck`: passed.
- `npm run build`: passed.
- `npm run pack:win`: passed; `release/win-unpacked` created.
- Inspected the packaged ASAR and confirmed it contains the renderer, Electron runtime, contracts, skill runtime, manifest, and skill prompts.
- Started the development process and stopped it intentionally after it remained running; the GUI still needs the manual visual smoke test in `docs/VALIDATION.md`.

**Files and areas touched:** `electron/`, `packages/agent-core/`, `packages/contracts/`, `tests/`, `package.json`, `package-lock.json`, `vite.config.mts`, `scripts/check-node.cjs`, `docs/`, `CLAUDE.md`, `.cursor/`, `.cursorignore`, `README.md`, `AGENTS.md`, and `AGENT_WORKBOOK.md`.

**Remaining items:** lint/format setup, production icon, manual GUI smoke testing, RATA-002, and completion of RATA-009. See Open Items below and `docs/TASKS.md`.

### 2026-08-15 — Claude (Opus 5) — Refactor review, aborted mid-flight

**Status:** DONE (handed back to user)
**Task given:** "Refactor the code in this folder and prepare to work on this project with Codex and Cursor."

**What happened:** I read the codebase and planned a refactor against the target design already written into `docs/ARCHITECTURE.md` and `docs/SECURITY.md` (which described `packages/contracts/`, `electron/mvp-tools.cjs`, and a centralized `ToolRegistry.execute()` that the code did not yet implement).

Partway through, I discovered **another agent session was actively refactoring the same folder** — file writes were landing at 14:23–14:27 while I was reading. My attempt to rewrite `packages/agent-core/tool-registry.cjs` was correctly rejected as stale. I stopped rather than fight a concurrent session over the same files.

**Files I created (both are orphans and should be deleted — see Open Items):**

- `packages/contracts/index.cjs`
- `packages/contracts/contracts.d.ts`

Nothing references either file except each other; `tsconfig.json` does not include them. They duplicate the other session's `ipc-channels.cjs` + `ipc-validation.cjs`. I tried to move them out of the repo but the sandbox denied the move.

**Files I modified:** none. No existing file was overwritten or lost.

**Findings I reported (all since resolved by the concurrent session):**

- `package.json` had a duplicate `verify` key, silently dropping the first definition. — *Fixed.*
- Every dependency was pinned to `"latest"`, so each agent's `npm install` could resolve different Electron/React/Vite versions. — *Fixed; lockfile now present.*

**Findings still open:** lint/format config. See Open Items.

**Note for whoever reads this next:** the collision was only recoverable because the Write tool refuses to overwrite an unread file. With no git history there was no other safety net. That is the strongest argument for the first Open Item below.

---

## Open items

Everything below is now ticketed in `docs/PRODUCT_BACKLOG.md`. This section tracks only what is not yet assigned to a lane.

### Blocked on the user

- **Enable branch protection** on `main` once `verify` has run at least once (GitHub needs to see the check before it can be required). Require the `verify` check and at least one review.
- **Replace the placeholder handles in `.github/CODEOWNERS`** with the real GitHub accounts driving Codex, Cursor and Claude. Everything currently falls back to the repository owner, so the lane map documents intent but does not yet enforce it.

### Carried into Phase 0

- Lint + format config → **P0-5**
- Typecheck coverage for `electron/`, `packages/`, `tests/` → **P0-5**
- RATA-009, renderer types vs runtime validators drifting → **Lane G**

---

## Coordination protocol

Adopted after the 2026-08-15 collision. Follow this whenever more than one agent may be active.

1. **Claim before you edit.** Add an `IN PROGRESS` Session Log entry naming the files or directories you intend to change, before your first write.
2. **Check the log and file mtimes first.** If something under your intended scope changed in the last few minutes and no entry claims it, assume another session is live and stop.
3. **Never overwrite a file you have not just read.** A stale-write rejection is a signal that someone else is editing — re-read, do not force.
4. **One concern per session.** Do not combine future provider, voice, bridge, and connector milestones; keep each change aligned to one ticket in `docs/TASKS.md`.
5. **Do not weaken `AGENTS.md` constraints** to resolve a conflict. If two agents' work genuinely conflicts on a security boundary, document the conflict here and escalate to the user.
6. **Report honestly.** If you left something unfinished, broken, or clobbered, write it in Open Items. A workbook that only records successes is not worth reading.
