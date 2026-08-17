# Rata Security Model

## Core principle

**The model does not have authority. Tools have authority.**

All privileged operations must pass through the tool registry and policy engine.

## Risk classes

- `read`: obtains data without changing external state.
- `safe-write`: local, limited and reversible state change.
- `external-write`: communicates or commits outside the local application.
- `destructive`: deletion, cancellation, irreversible overwrite, privileged system changes.

## Default policy

| Risk | Default |
|---|---|
| read | Allow if capability enabled |
| safe-write | Allow or configurable confirmation |
| external-write | Confirm every time unless the user creates a narrowly-scoped trusted rule |
| destructive | Always confirm; prefer reversible alternatives |

## Prompt-injection boundary

Email, webpages, documents, calendar descriptions, clipboard text and UI text are **data**, not instructions to Rata's privileged runtime. Content retrieved by tools must never be allowed to redefine policies or approve actions.

### Public web retrieval

- `web.search` alone receives the bound Serper capability; `web.fetch` receives no API key.
- Fetch accepts only absolute HTTP(S) destinations without URL credentials.
- Fetch permits only ports 80/443 and refuses HTTPS-to-HTTP redirect downgrade.
- DNS must resolve exclusively to public addresses, and the connection is pinned to the vetted answer so DNS rebinding cannot redirect it into a private network.
- Redirects are revalidated; time, redirect, content-type and response-size limits fail closed.
- HTML is parsed structurally and active-content subtrees are removed before
  any page text becomes provider context.
- Retrieved text is marked untrusted and enters an AI provider only through the fenced `context` role. Page content never selects tools, changes policy or supplies approval.
- See `docs/decisions/ADR-008-safe-public-web-fetch.md`.

### Local file retrieval

- Read-only. `file.search`, `file.stat`, `file.readText`, `file.searchContent` and `file.reveal` never write, move, rename or delete. `file.delete` stays registered and disabled.
- Access is confined to an allow-list of roots (Documents, Downloads, Desktop) fixed in `main.cjs` and closed over by the capability. No tool input names a root and no tool module can widen them.
- Paths are resolved and realpath'd *before* containment is checked, and compared with `path.relative` rather than string prefixes, so `..`, symlinks, Windows junctions and lookalike siblings such as `docs-private` all fail.
- Directory traversal skips symlinks and junctions outright rather than resolving them.
- Containment is not sufficient on its own: credential-shaped files are refused **inside** allowed roots (`.env*`, `id_rsa`, `*.pem`, `*.key`, `*.kdbx`, `.npmrc`, `.netrc`, `credentials`, `secrets.*`), and credential/VCS directories such as `.ssh`, `.aws`, `.gnupg` and `.git` are never descended into.
- Size, result, depth and traversal limits fail closed; a file containing a NUL byte is refused as binary rather than returned as text.
- A path outside the roots and a path that does not exist report the same error, so the tools cannot probe for files they may not read.
- File text is marked untrusted and reaches a provider only through the fenced `context` role. A document can carry a prompt injection exactly like a web page.
- Reading content is confirmed by default (`fileReadConfirm`) because the text leaves the machine for a provider; searching by *name* is automatic.
- See `docs/decisions/ADR-010-readonly-local-file-access.md`.

### Storage inventory

- Read-only. `filesystem.scan`, `filesystem.diskUsage` and `filesystem.hash` never write, move, rename, delete, quarantine or compress. There is no bulk-hash and no write verb in the domain at all.
- **No tool in this domain returns file contents.** `filesystem.scan` returns names, relative paths, sizes, modified times and an is-directory flag. `filesystem.hash` opens a read-only handle, folds fixed 64KB chunks into a digest and discards them, and returns the hex digest, a byte count and a name. Reading text is `file.readText`, a different tool with a different contract.
- Path confinement is the *same* gate as local file retrieval: `resolveWithinRoots` in `electron/file-access.cjs`. There is one place that decides which paths Rata may touch, and both domains call it. `main.cjs` supplies both capabilities from one `userFolderRoots()` list.
- A stricter syntax gate runs first and refuses, without touching the filesystem: non-string, empty and whitespace-only input, NUL bytes, over-length paths, device namespaces (`\\.\`, `\\?\`), UNC shares, drive-relative and relative paths, and any surviving `..` segment.
- Whole-volume and protected scanning is **refused, not confirmed**. `C:\Windows`, `C:\Program Files`, other system directories and bare drive roots are outside the allow-list and fail closed. The skill declares `confirm_if_scope_is_entire_system_or_protected`; refusing exceeds that rather than weakening it.
- Containment is checked inside `validateInput`, which runs before `PolicyEngine`, so a forbidden path never produces an approval card the user could accept.
- Everything is capped and truncation is reported by name: depth 6, 20,000 entries visited, 200 entries returned, 50 folder aggregates, 15 seconds, and 16MB per hash. Directory entries are sorted before the walk and results are sorted largest-first, so a truncated result is reproducible rather than arbitrary.
- A file above the hash cap is refused rather than hashed in part: a prefix digest is indistinguishable from a whole-file digest and would produce confident, wrong duplicate claims. The cap is re-checked against bytes actually read.
- Credential-shaped names are not inventoried at all, and credential/VCS directories are not descended into — a name and a size is already more than this surface needs to disclose about `~/Documents/.env`.
- **Scan output is untrusted input.** Results carry `trust: 'untrusted-external'`; a file name can carry a prompt injection exactly like a web page. Control characters and bidirectional overrides are stripped from every name, so a name cannot forge structure inside a fence or spoof an extension. Any stage that forwards these results to a provider must fence them with `fenceUntrusted`.
- Audit records the scope and the counts, never a directory listing: `MockAgent` builds audit detail from `result.summary`, and the per-file list lives only in the user-facing `message`.
- Confirmed by default under the existing `fileReadConfirm` setting rather than a second overlapping switch. A bulk inventory of file names is at least as revealing as the text of one file, and it leaves the machine the same way.
- See `docs/decisions/ADR-014-filesystem-inventory-boundary.md`.

### Communicator (understanding and voice)

- Communicator is not a routed skill. It cannot grant tools, change policy or approve actions. See `docs/decisions/ADR-012-communicator.md` and ADR-003.
- The user's request text is never rewritten. Understanding produces a validated interpretation; voice rewrites only conversational replies.
- Understanding sits last, after every deterministic route, the skill router and the ADR-009 planner. It cannot override a match those stages already made.
- The model returns a fixed intent enum (`weather`, `webSearch`, `fileSearch`, `none`). It never names a tool. `intent → toolId` is a literal in trusted code. Extracted parameters are untrusted and still pass `ToolRegistry.validate()` and the tool's own validator.
- The stage cannot reach destructive or external-write tools. Confirmation policy is unchanged.
- Invalid JSON, an unknown intent, a missing parameter, a provider error or a timeout fall through to ordinary `ask()`. The user never sees an error that exists only because this stage ran.
- Voice never rewrites approval cards (including `detail`/`title`), `awaiting_approval` replies, audit/activity text, or refusal reasons (`I blocked that action:`). A rewrite that drops a number, path, URL or quoted string is discarded.
- Untrusted tool text reaching the voice provider is wrapped with `fenceUntrusted`.
- Both stages send text to a provider, so `communicatorEnabled` defaults to **false**. When it is off, neither stage calls a provider.

### Session conversation history

- History is in-memory on the shared `MockAgent` instance. It is data, not instructions, not approval, and not a tool grant. See `docs/decisions/ADR-013-session-continuity.md`.
- The current user request is still passed exactly as typed. History sits beside it and is not used to fill tool parameters in this version.
- Prior assistant turns (tool results, retrieved pages, model replies) are wrapped with `fenceUntrusted` before they reach a provider. Activity, audit events and approval-card internals are not history.
- History cannot bypass `PolicyEngine`, confirmation, or `ToolRegistry.validate()`. A matching deterministic route still wins.
- Caps drop the oldest turns. The transcript is not persisted; quitting clears it.

### Weather lookup

- The key is read from `WEATHER_API_KEY` in the main process and captured in the client closure. The tool layer receives a bound `getCurrentWeather(query)` capability, never the credential, and `describeConfig()` reports presence as a boolean only.
- WeatherAPI accepts its key **only as a `key=` query parameter**, unlike Serper which uses a header, so the request URL is itself a secret. No error, log or returned value may contain it: every failure path returns a fixed string and the caught error is discarded rather than wrapped.
- The response is mapped onto a fixed shape. Unmodelled provider fields never reach the agent, malformed numbers become `null`, and text is stripped of control characters and clamped.
- Results carry `trust: 'untrusted-external'`. Third-party condition text is data to report, never an instruction.
- Locations are restricted to place names, postcodes and coordinates. `auto:ip` IP geolocation and the `iata:`/`id:`/`metar:` prefixes are refused.
- The location is extracted deterministically before the tool runs; no provider chooses it. A question with no place asks which place rather than assuming the user's location.
- Lookups are confirmed by default (`weatherConfirm`) because the request reveals what place the user is asking about.
- See `docs/decisions/ADR-011-weather-lookup.md`.

## Electron boundary

- context isolation stays enabled.
- Node integration stays disabled in renderers.
- Preload exposes named functions only.
- Never expose raw `ipcRenderer`, `fs`, `child_process`, shell execution or generic file APIs.
- Microphone capture is gated by `isMicrophoneEnabled()` in `electron/security.cjs`. Chromium `media`/`microphone` permissions and the Windows speech child process both consult it. Turning the setting off stops an in-flight recognizer. A leftover partial transcript already buffered from that session is still delivered to the renderer; it is not dropped.
- Local speech to text (RATA-009) records in the renderer through `getUserMedia`, so it passes the same `decideRendererPermission()` gate. The gate is re-checked in the IPC handler at transcription time, because a renderer could hold a recording made before the setting was turned off.
- The transcriber executable path is resolved in the main process from known install locations, never supplied by the renderer or a model. Arguments are a fixed list whose only variable is a temp path the main process created, and `execFile` is used rather than a shell.
- Audio is validated twice, at the IPC edge and again before a process is spawned: the renderer is not a boundary. Oversized or non-WAV payloads are refused before anything touches disk.
- The recording is the user's voice: it is written to a randomly named temp file and removed in a `finally` on every path. The transcript is never written to an audit event, and failure messages are fixed strings because the transcriber's stderr carries model and machine detail.
- Transcription is fully offline and adds no network egress, so unlike file reads and weather it needs no confirmation setting.
- See `docs/decisions/ADR-013-local-speech-to-text.md`.
- Validate settings, messages and approval identifiers in the main process before use. Preload and TypeScript types are developer ergonomics, not a trust boundary.
- Settings loaded from disk pass through the same runtime validators as IPC
  writes. Unknown and invalid values are rejected and audited; invalid
  microphone access falls back off, while confirmation settings fall back on.

## Tool contracts

- Registration fails unless a tool declares an ID, description, risk, confirmation policy, input validator and executor.
- External-write tools cannot opt out of confirmation.
- Destructive tools remain denied by the MVP policy even if their metadata requests confirmation.
- Native adapters receive validated inputs through `ToolRegistry.execute()`; callers must not invoke tool executors directly.
- Model output is never a shell command. A model-assisted action must use a
  versioned, exact-key schema that maps only to an existing registered tool and
  allow-listed input. Invalid JSON, extra fields and unsupported values fail
  closed before policy evaluation. The initial system-action schema permits
  only `system.openApp` for Notepad or Calculator, with no paths, arguments,
  elevation or command text.

## Secrets

Production credentials should be stored with OS-backed secret storage, not plain JSON. The current JSON store contains only non-secret user preferences and audit metadata.

## Audit

Audit events must record the capability used, decision, result and user approval without logging secrets or full sensitive payloads by default.
