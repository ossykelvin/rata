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
| Cursor | ISSUE-29 overlay long-response scroll | `cursor/ISSUE-29-overlay-scroll` | IN PROGRESS |
| Cursor | ISSUE-17 restore character image | `cursor/ISSUE-17-restore-character-image` | DONE, PR #18 |

---

## Claude

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

### 2026-08-15 — ISSUE-29 — Overlay long-response scroll

**Status:** IN PROGRESS
**Branch:** `cursor/ISSUE-29-overlay-scroll`

**Scope:** Lane B / renderer. Keep the overlay speech-bubble header fixed and scroll only the message body inside the 360×470 window. Wrap long tokens. Keep avatar, approvals, and quick input visible. No Electron or privilege-boundary edits.

**Files currently touching:** `AGENT_WORKBOOK.md` (claim only; implementation follows).

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
