# Rata Product Backlog — MVP to v1.0

How three AI agents (Claude, Codex, Cursor) build Rata to completion without conflicting.

- `AGENTS.md` — the engineering contract. What you must and must not do. Authoritative.
- `AGENT_WORKBOOK.md` — the activity log. Who is doing what right now.
- **This file** — the plan. What gets built, in what order, by whom.

---

## Why this file exists

On 2026-08-15 three agents wrote to this repository within one hour. They collided: two prepared work a third had already finished, and one agent's discarded draft files were committed to GitHub by another. Nothing was lost only because the tooling refused a stale overwrite.

That was a structural problem, not a discipline problem. Seven **hub files** are touched by nearly every remaining ticket:

| Hub file | Why almost every feature needs it |
|---|---|
| `electron/main.cjs` | 14 `ipcMain.handle` registrations plus all dependency composition |
| `electron/preload.cjs` | the entire `window.rata` surface |
| `packages/contracts/ipc-channels.cjs` | one frozen `IPC` object holding every channel name |
| `electron/mvp-tools.cjs` | the only tool registration site |
| `src/types.ts` | `RataBridge` mirror, `RataSettings`, the `ControlPage` union |
| `src/styles/global.css` | one stylesheet serving both windows |
| `skills.manifest.json` | 478-line flat array with fail-closed whole-file validation |

RATA-002, 004, 005, 006, 007, 008 and SKILL-004 all need `main.cjs`, `preload.cjs` and `ipc-channels.cjs`. Handing those tickets to different agents in parallel guarantees merge conflicts in the privilege boundary — the worst possible place for a careless merge.

**Phase 0 fixes that first.** It converts each hub from a shared file into an extension point, where adding a feature means adding a new file rather than editing a common one. Feature lanes open only after Phase 0 merges.

---

## Working protocol

1. **One ticket, one branch, one PR.** Branch name `<agent>/<TICKET>-<slug>` — e.g. `codex/RATA-002-provider-interface`.
2. **Claim before editing.** Add an `IN PROGRESS` entry to your own section of `AGENT_WORKBOOK.md` and push the branch *before* your first substantive edit. An unpushed branch is not a claim.
3. **Stay in your lane.** Editing a path `.github/CODEOWNERS` assigns to another agent requires that agent's review on the PR.
4. **Rebase before opening the PR.** Never force-push `main`.
5. **`npm run verify` green before requesting review.** CI enforces this.
6. **Claude reviews before merge** for anything touching `electron/`, `packages/contracts/`, `packages/agent-core/`, or registering a new tool.
7. **Never weaken `AGENTS.md`** to resolve a conflict. Document the conflict in the workbook and escalate to the user.
8. **Update the workbook at handoff** — scope, changes, validation, blockers.

### Cross-lane changes

A lane needing a new IPC channel, setting, or tool contract opens a **contract request** against Lane G rather than editing `packages/contracts/` itself. Lane G lands the contract; the lane then builds against it. This keeps the privilege boundary under a single reviewer.

---

## Phase 0 — Make parallelism possible

**Sequential. No feature work starts until all of Phase 0 has merged.** Running Phase 0 alongside features reintroduces the problem it exists to solve.

Owner: **Codex** implements. **Claude** reviews every PR against `docs/SECURITY.md` — these changes move the privilege boundary, so review is not optional.

| # | Ticket | Change | Key files |
|---|---|---|---|
| P0-0 | Backlog and guardrails | This file, CODEOWNERS, CI, `.gitattributes`, workbook restructure. | *(done — Claude)* |
| P0-1 | Modularize the IPC boundary | `electron/ipc/index.cjs` auto-registers handler modules from `electron/ipc/*.cjs`. `electron/bridge/*.cjs` compose the preload surface. `packages/contracts/channels/*.cjs` merge into the `IPC` aggregate. Adding a feature becomes three new files and zero edits to shared ones. | `electron/main.cjs`, `electron/preload.cjs`, `packages/contracts/ipc-channels.cjs` |
| P0-2 | Modularize tool registration | Split `electron/mvp-tools.cjs` into `electron/tools/{system,clipboard,calculator,file}.cjs`, composed by `electron/tools/index.cjs`. Each future tool domain is a new file. | `electron/mvp-tools.cjs` → `electron/tools/` |
| P0-3 | Skills manifest to per-skill fragments | Replace the flat array with `skills/<id>/skill.json`; `registry.cjs` scans the directory. Validation stays fail-closed **per fragment**, so one malformed skill no longer disables the whole subsystem. Adding a skill becomes "add a directory". | `skills.manifest.json`, `packages/skills/registry.cjs`, `packages/skills/contracts.cjs` |
| P0-4 | Decouple the renderer | `src/types.ts` → `src/types/` per-domain modules plus a barrel. `global.css` → `src/styles/{base,overlay,control}.css` plus per-component CSS. Control Center pages self-register via `import.meta.glob`, so `model.ts` and `ControlCenter.tsx` stop being edited per page. `Overlay.tsx` adopts `useAgentConversation` — it currently duplicates that logic inline. | `src/types.ts`, `src/styles/global.css`, `src/views/control/model.ts`, `src/views/ControlCenter.tsx`, `src/views/Overlay.tsx` |
| P0-5 | Quality gates | ESLint flat config, Prettier, `.editorconfig`. **Extend typechecking to `electron/`, `packages/` and `tests/`** — today `tsconfig.json` covers only `src` and `vite.config.mts`, so most of the codebase is never typechecked. Add `lint` to `npm run verify`. | `tsconfig.*.json`, `eslint.config.js`, `package.json` |
| P0-6 | Housekeeping | Delete the dead barrel `packages/agent-core/index.cjs` (zero importers). Append any new top-level directory to `build.files`. | `packages/agent-core/index.cjs`, `package.json` |

### Phase 0 exit criteria

- `npm run verify` green, including lint and the widened typecheck.
- CI passing on a pull request.
- **Proof of parallelism:** two throwaway branches each add an IPC channel, a tool and a Control Center page, then both merge into a scratch branch with zero conflicts. Run this deliberately. If it conflicts, Phase 0 is not finished.

---

## Lanes

Open only after Phase 0. Each lane owns disjoint paths.

| Lane | Tickets | Owner | Owns (exclusive) |
|---|---|---|---|
| **A — Provider & orchestration** | RATA-002 | Codex | `packages/agent-core/providers/`, `packages/agent-core/orchestrator/`, `electron/ipc/provider.cjs` |
| **B — Character & presentation** | RATA-003 | Cursor | `src/components/character/`, `src/styles/character.css`, `public/character/` |
| **C — Voice** | RATA-004 | Cursor | `packages/agent-core/voice/`, `electron/ipc/voice.cjs`, `src/hooks/useVoice.ts` |
| **D — Windows bridge** | RATA-005 | Codex | `bridge/` (new C#/.NET project), `electron/tools/windows.cjs` |
| **E — Microsoft Graph** | RATA-006 → RATA-007 | Codex | `packages/connectors/graph/`, `electron/tools/graph.cjs`, `electron/ipc/graph.cjs` |
| **F — Browser agent** | RATA-008 | Codex | `packages/connectors/browser/`, `electron/tools/browser.cjs` |
| **G — Contracts & typing** | RATA-009 | Claude | `packages/contracts/` (all), `src/types/` |
| **H — Tests, CI, packaging** | RATA-010 | Claude + human | `tests/`, `.github/`, `scripts/`, electron-builder config |
| **S — Skill capabilities** | SKILL-004…010 | Cursor | `skills/*/`, `packages/skills/`, `src/views/control/pages/SkillsPage.tsx` |

Claude additionally reviews every PR in every lane. That is the role `CLAUDE.md` assigns, and it is the only cross-lane consistency check in the system.

### Dependency order

```
Phase 0  ──────────────────────────────────────────► gate: nothing starts before this
   │
   ├─► A (RATA-002) ──┬─► C (RATA-004, needs streaming)
   │                  └─► F (RATA-008, needs orchestration)
   ├─► B (RATA-003)         independent
   ├─► D (RATA-005)         independent, longest lead time — start early
   ├─► E (RATA-006) ──► E (RATA-007)   strictly sequential, same files
   ├─► G (RATA-009)         continuous, runs alongside everything
   └─► S (SKILL-004…010)    independent after P0-3
                                 │
                                 └─► H (RATA-010) closes v1.0
```

**Safe first parallel wave after Phase 0:** A, B, D and S — four lanes, zero shared files.

---

## Backlog detail

Acceptance criteria are summarized here; `docs/TASKS.md` and `docs/SKILLS-HANDOVER.md` remain authoritative.

### Lane A — RATA-002 Provider abstraction · Codex

Provider interface with streaming chat and tool-call support. Add one provider at a time. No provider calls in React.

Done when: provider interface exists; mock provider retained for tests and offline mode; streaming events surfaced through IPC; secrets loaded from a secure configured location; no provider-specific UI coupling.

### Lane B — RATA-003 Character animation engine · Cursor

Replace the concept-sheet crop with transparent state assets.

Done when: states idle, listening, thinking, awaiting-approval, working/typing, success, error, sleeping all render; state changes are event-driven; missing assets degrade gracefully; no business logic in the renderer.
**BLOCKED-ON-HUMAN:** character art assets. Build the state machine and fallback against placeholders.

### Lane C — RATA-004 Production voice · Cursor

STT and TTS adapters. Depends on Lane A streaming.

Done when: push-to-talk works; microphone permission state is surfaced; STT/TTS provider is configurable; speech can be interrupted and cancelled; audio data is not retained by default.

### Lane D — RATA-005 Native Windows bridge · Codex

`Rata.WindowsBridge` in C#/.NET over local authenticated IPC. Longest lead time in the plan — start it in the first wave.

Done when: window list and focus work; UI Automation inspect/invoke/set-value work; keyboard and mouse sit behind explicit tools; process allow-list foundations exist; every call carries an audit correlation ID; the bridge refuses unauthenticated local callers.
Requires a Claude threat-model review and an ADR before merge.

### Lane E — RATA-006 then RATA-007 Microsoft Graph · Codex

Strictly sequential — read before write, same files.

**RATA-006 (read):** Entra/MSAL delegated OAuth; least-privilege scopes; secure token cache; `mail.search`, `mail.read`, `calendar.list`, `calendar.findAvailability`; **no send or create permissions in this PR**.
**RATA-007 (write):** `mail.draft`, `mail.send`, `calendar.create`, `calendar.update`; external writes require approval by default; recipients/subject/time previewed before approval; result verified after execution; audited without logging sensitive bodies.
**BLOCKED-ON-HUMAN:** Azure app registration, tenant and client ID, scope consent.

### Lane F — RATA-008 Browser agent · Codex

Playwright behind explicit browser tools. Depends on Lane A.

Done when: browse/read actions are separated from submit/upload/write; submit and upload are always approval-gated initially; downloaded files are treated as untrusted; **page content cannot alter system or tool policy** — this is the prompt-injection boundary and needs a Claude review.
**BLOCKED-ON-HUMAN:** consent to Playwright browser binary download.

### Lane G — RATA-009 Structured contracts · Claude

In progress. Runtime validators cover current IPC payloads and tool inputs; shared generated schemas remain.

Done when: all privileged IPC inputs are validated; tool contracts are versioned; the typed renderer bridge is generated or shared from the schemas rather than hand-mirrored.

### Lane H — RATA-010 Tests and packaging hardening · Claude + human

Done when: unit tests cover policy decisions; agent/tool integration tests exist; renderer smoke tests exist (**none today**); the Windows installer is verified on a clean machine; the code-signing plan is documented. Auto-update stays deferred until a signing strategy exists.
**BLOCKED-ON-HUMAN:** code-signing certificate purchase and key custody; clean-machine install test.

### Lane S — Skill capabilities · Cursor

From `docs/SKILLS-HANDOVER.md`. SKILL-001/002/003 are done. Remaining: SKILL-004 background job manager, SKILL-005 keep-awake native tool, SKILL-006 file search index, SKILL-007 filesystem scanner, SKILL-008 web search adapter, SKILL-009 presentation artifact adapter, SKILL-010 Skills Control Center (partial — toggles, last-run status and background task controls remain).

Each new tool declares risk and confirmation policy and routes through `ToolRegistry.execute()`.

---

## Human-gated items

Agents must not complete, simulate, or work around these. Stop and report instead.

| Item | Ticket | Why it is yours |
|---|---|---|
| Entra/Azure app registration, tenant + client ID | RATA-006 | Your Azure account; agents must never handle real credentials |
| Consent to delegated Graph scopes | RATA-006/007 | The least-privilege scope list needs your approval before it is requested |
| Code-signing certificate purchase and key custody | RATA-010 | Financial transaction plus private key handling |
| GUI visual smoke test | every UI ticket | `docs/VALIDATION.md` needs a human looking at the screen |
| GitHub branch protection and required checks | Phase 0 | Repository settings on your account |
| Character art assets | RATA-003 | Design deliverable, not code |
| Playwright browser download consent | RATA-008 | Downloads binaries onto your machine |

---

## Verification

- **Per PR:** `npm run verify` — `check:node` → `lint` → `test` → `typecheck` → `build`, enforced by CI.
- **Per lane:** new tests under `tests/`. The test glob picks new files up with no index to edit, so test files are conflict-free by construction.
- **Security-sensitive lanes (D, E, F):** Claude threat-model review plus an ADR under `docs/decisions/` before merge.
- **Release:** `npm run dist:win`, install the NSIS output on a clean Windows machine, then walk `docs/VALIDATION.md` by hand.
