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
