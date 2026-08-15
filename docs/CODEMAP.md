# Rata source map

Read this after `AGENTS.md` when you need to know where to edit.

## Runtime flow

```text
src/views (React UI)
  → generated dist-electron/preload.cjs from electron/preload.cjs + electron/bridge/*.cjs
  → electron/main.cjs + electron/ipc/*.cjs (auto-registered handlers)
  → packages/agent-core/mock-agent.cjs
  → packages/skills/router.cjs (selects a skill id)
  → packages/agent-core/policy-engine.cjs
  → packages/agent-core/tool-registry.cjs
  → electron/tools/index.cjs + electron/tools/*.cjs (auto-composed allow-listed adapters)
  → audit event → UI
```

## Ownership

| Path | Owns | Must not |
|---|---|---|
| `src/` | Overlay, Control Center, character presentation | Node, Electron, OS, tools |
| `src/types/` | Renderer domain types and barrel | Privileged contracts or Electron APIs |
| `src/styles/` | `base.css`, `overlay.css`, `control.css`, plus per-component sheets | Privileged styling or Node imports |
| `src/views/control/` | Self-registered Control Center pages (`controlPage` + `import.meta.glob`) | Editing `ControlCenter.tsx` or `model.ts` to add a page |
| `src/components/character/` | Event-driven character states and asset catalog | Tools, policy, IPC |
| `electron/preload.cjs` | Defines installation of the composed `window.rata` bridge; bundled before launch | Generic `ipcRenderer` / `fs` |
| `electron/bridge/` | Per-domain preload bridge fragments | Raw or undeclared IPC channels |
| `esbuild.preload.cjs` | Discovers bridge fragments and generates the single sandbox-compatible preload artifact | Runtime authority or renderer code |
| `electron/main.cjs` | Windows, tray, runtime dependency composition | Per-domain IPC handler implementations |
| `electron/ipc/` | Per-domain validated IPC handlers | Undeclared channels or renderer APIs |
| `electron/security.cjs` | Navigation, popup and IPC sender guards | Business logic or tool execution |
| `electron/tools/index.cjs` | Discovers and composes declared tool-domain modules | User/model-supplied modules, undeclared tool IDs |
| `electron/tools/*.cjs` | Per-domain allow-listed native tool adapters | Unrestricted shell, policy bypass |
| `electron/mvp-tools.cjs` | Compatibility export for existing consumers | New tool registration logic |
| `electron/store.cjs` | Non-secret JSON preferences + audit metadata | Tokens / secrets |
| `packages/contracts/` | IPC channel names and payload validation | Native I/O |
| `packages/agent-core/` | Mock agent, policy, tool registry, calculator parser | Provider SDKs in UI |
| `packages/skills/` | Per-fragment validation/load, prompt extract, deterministic router | Executing skill files |
| `skills/<id>/skill.json` | Independently validated routing/permission metadata | Authority, code, credentials |
| `skills/<id>/SKILL.md` | Declarative prompt text loaded only for a selected skill | Code, credentials |
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
3. Add each tool domain as a declared module in `electron/tools/` with tests.
4. Add a Control Center page as `src/views/control/*Page.tsx` that exports `controlPage`. Do not edit `ControlCenter.tsx` or `model.ts` to register it.
