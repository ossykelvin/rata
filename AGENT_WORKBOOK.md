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
| Claude | P0-0 backlog + guardrails | `claude/P0-0-backlog-and-guardrails` | DONE, awaiting merge |
| Codex | P0-1 modular IPC boundary | `codex/P0-1-modular-ipc-boundary` | IN PROGRESS |
| Cursor | — | — | idle |

---

## Claude

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

### 2026-08-15 — P0-1 — Modularize the IPC boundary

**Status:** IN PROGRESS
**Branch:** `codex/P0-1-modular-ipc-boundary`

**Scope:** Replace the Electron IPC and preload hub registration with auto-composed modules under `electron/ipc/` and `electron/bridge/`, preserving the current renderer API and security settings. Contract-owned work under `packages/contracts/` remains delegated to Claude through issue #1; Codex will consume the agreed aggregate and will not edit that path.

**Planned validation:** focused IPC/bridge composition tests plus full `npm run verify`. The PR touches `electron/` and requires Claude review before merge.

---

## Cursor

*No entries under the lane protocol yet. Earlier work is in the archive below.*

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
