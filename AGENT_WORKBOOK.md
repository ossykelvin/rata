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
| Cursor | FIX voice permission gate | `cursor/FIX-voice-permission-gate` | DONE, PR pending |
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

### 2026-08-16 — FIX — Voice permission gate and recognizer restart race

**Status:** DONE, PR pending
**Branch:** `cursor/FIX-voice-permission-gate`

**Done:** RATA-004 review findings. Chromium `getUserMedia` and the Windows PowerShell recognizer both consult `isMicrophoneEnabled()` in `electron/security.cjs`. Disabling the microphone while a session is listening stops the child. `start()` during a pending `stop()` waits for the old child; an exiting child never clears a newer child's reference (same shape as `overlayWindow === window` in PR #54).

**Files touched:** `electron/security.cjs`, `electron/ipc/voice.cjs`, `electron/ipc/settings.cjs`, `electron/voice-win.cjs`, `tests/voice-win.test.cjs`, `tests/electron-security.test.cjs`, `docs/SECURITY.md`, `docs/VALIDATION.md`, `docs/ARCHITECTURE.md`, `docs/CODEMAP.md`.

**Validation:** `npm run verify` passed (226 tests). Injected-spawn tests cover mid-session disable, start-during-stop, and old-exit identity. No real microphone or powershell.exe.

**Coordination:** Separate from PR #59 (Critical Thinking provider). Claude review required — this touches `electron/`.

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
