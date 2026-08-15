# Rata source map

Read this after `AGENTS.md` when you need to know where to edit.

## Runtime flow

```text
src/views (React UI)
  → electron/preload.cjs + electron/bridge/*.cjs (composed named IPC only)
  → electron/main.cjs + electron/ipc/*.cjs (auto-registered handlers)
  → packages/agent-core/mock-agent.cjs
  → packages/skills/router.cjs (selects a skill id)
  → packages/agent-core/policy-engine.cjs
  → packages/agent-core/tool-registry.cjs
  → electron/mvp-tools.cjs (allow-listed adapters)
  → audit event → UI
```

## Ownership

| Path | Owns | Must not |
|---|---|---|
| `src/` | Overlay, Control Center, character presentation | Node, Electron, OS, tools |
| `electron/preload.cjs` | Exposes the composed `window.rata` bridge | Generic `ipcRenderer` / `fs` |
| `electron/bridge/` | Per-domain preload bridge fragments | Raw or undeclared IPC channels |
| `electron/main.cjs` | Windows, tray, runtime dependency composition | Per-domain IPC handler implementations |
| `electron/ipc/` | Per-domain validated IPC handlers | Undeclared channels or renderer APIs |
| `electron/mvp-tools.cjs` | Allow-listed native tool adapters | Unrestricted shell |
| `electron/store.cjs` | Non-secret JSON preferences + audit metadata | Tokens / secrets |
| `packages/contracts/` | IPC channel names and payload validation | Native I/O |
| `packages/agent-core/` | Mock agent, policy, tool registry, calculator parser | Provider SDKs in UI |
| `packages/skills/` | Manifest load, prompt extract, deterministic router | Executing skill files |
| `skills/` | Declarative `SKILL.md` prompts | Code, credentials |
| `tests/` | Policy, IPC, skill, calculator regressions | Live network or real OS side effects |
| `docs/` | Architecture, security, tasks, ADRs | Implementation secrets |
| `AGENT_WORKBOOK.md` | Cross-agent work log (read and update each session) | Architecture contracts (those stay in `AGENTS.md`) |

## Working MVP tools

- `system.openApp` — Notepad and Calculator only
- `clipboard.write` — confirmation configurable
- `calculator.evaluate` — arithmetic parser, no `eval`
- `file.delete` — registered and blocked

## First safe changes for agents

1. `RATA-002` provider interface in `packages/agent-core/`, not in React.
2. Load `packages/skills/loader.cjs` prompts only after a provider exists.
3. Add tools in `electron/mvp-tools.cjs` (or a future bridge) with tests.
4. Keep new Control Center pages under `src/views/control/`.
