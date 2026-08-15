# Agent Workbook

Shared running log for every AI agent working in this repository (Claude, Codex, Cursor).

`AGENTS.md` is the **engineering contract** — what you must and must not do.
This workbook is the **activity log** — what has actually been done, by whom, and what is still open.

## How to use this file

- **Before starting work:** read the Repo Snapshot and Open Items below, then check the Session Log for anything in flight.
- **While working:** if you begin a substantial change, add a Session Log entry with status `IN PROGRESS` *before* you start editing, so a parallel agent can see it.
- **When finishing:** update your entry to `DONE`, list files touched, and move anything unresolved into Open Items.
- **Attribution matters.** Always say which agent did a thing. A shared log with anonymous entries is worse than no log.
- Newest Session Log entry goes at the top.

---

## Repo snapshot

*Last verified: 2026-08-15 15:01 by Codex.*

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
| **Version control (git)** | **Not initialized — see Open Items** |
| **Lint / format config** | **None — see Open Items** |

---

## Session log

### 2026-08-15 — Codex — Initialize and publish Git repository

**Status:** IN PROGRESS
**Task given:** Link the local project to `https://github.com/ossykelvin/rata.git` and publish it on GitHub.

**Scope:** Initialize a local `main` branch, attach the empty GitHub repository as `origin`, verify the complete initial file set and ignore rules, create the baseline commit, and push it. No existing remote history was found; GitHub CLI authentication is active for `ossykelvin`.

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

**Remaining items:** Git initialization, orphan contract-file cleanup, lint/format setup, production icon, manual GUI smoke testing, RATA-002, and completion of RATA-009. See Open Items below and `docs/TASKS.md`.

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

**Findings still open:** no git repository; no lint/format config. Both in Open Items.

**Note for whoever reads this next:** the collision was only recoverable because the Write tool refuses to overwrite an unread file. With no git history there was no other safety net. That is the strongest argument for the first Open Item below.

---

## Open items

Ordered by how much they block multi-agent work.

### 1. Initialize git — blocking

There is no `.git` directory. Two or more agents editing this folder concurrently with no version control means silent collisions, no diffs, no review, and no recovery. This should land before any further refactoring.

```bash
git init && git add -A && git commit -m "Initial commit: Rata MVP after runtime-boundary refactor"
```

`.gitignore` already covers `node_modules/`, `dist/`, `release/`, `.env`. Confirm `package-lock.json` is **not** ignored — it must be committed.

### 2. Delete two orphan files — trivial, do it now

```bash
rm packages/contracts/index.cjs packages/contracts/contracts.d.ts
```

Created by the Claude session above, superseded by `ipc-channels.cjs` + `ipc-validation.cjs`. Leaving them risks a future agent importing the wrong contracts module.

### 3. Add lint + format config

None exists. Codex and Cursor will churn style on every file they touch, producing noisy diffs that hide real changes. Needs ESLint (flat config) + Prettier + `.editorconfig`, wired into `npm run verify`.

### 4. RATA-009 — unify renderer types with runtime schemas

Tracked in `docs/TASKS.md` and noted in ADR-003. Renderer compile-time types and the CommonJS runtime validators are currently maintained separately. Until they are generated from one source, a change to one can silently drift from the other.

---

## Coordination protocol

Adopted after the 2026-08-15 collision. Follow this whenever more than one agent may be active.

1. **Claim before you edit.** Add an `IN PROGRESS` Session Log entry naming the files or directories you intend to change, before your first write.
2. **Check the log and file mtimes first.** If something under your intended scope changed in the last few minutes and no entry claims it, assume another session is live and stop.
3. **Never overwrite a file you have not just read.** A stale-write rejection is a signal that someone else is editing — re-read, do not force.
4. **One concern per session.** Do not combine future provider, voice, bridge, and connector milestones; keep each change aligned to one ticket in `docs/TASKS.md`.
5. **Do not weaken `AGENTS.md` constraints** to resolve a conflict. If two agents' work genuinely conflicts on a security boundary, document the conflict here and escalate to the user.
6. **Report honestly.** If you left something unfinished, broken, or clobbered, write it in Open Items. A workbook that only records successes is not worth reading.
