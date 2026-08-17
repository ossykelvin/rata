# Rata source map

Read this after `AGENTS.md` when you need to know where to edit.

## Runtime flow

```text
src/views (React UI)
  → generated dist-electron/preload.cjs from electron/preload.cjs + electron/bridge/*.cjs
  → electron/main.cjs + electron/ipc/*.cjs (auto-registered handlers)
  → packages/agent-core/mock-agent.cjs
  → packages/skills/router.cjs (selects a skill id; skips selectable:false packs)
  → packages/agent-core/communicator.cjs (last-chance intent, then voice on the way out)
  → packages/agent-core/conversation-memory.cjs (session history injected into ask() only)
  → packages/agent-core/policy-engine.cjs
  → packages/agent-core/tool-registry.cjs
  → electron/tools/index.cjs + electron/tools/*.cjs (auto-composed allow-listed adapters)
  → audit event → UI
```

## Ownership

| Path | Owns | Must not |
|---|---|---|
| `src/` | Overlay, Control Center, character presentation | Node, Electron, OS, tools |
| `src/hooks/useVoice.ts` | Push-to-talk UI and transcript display | Audio capture, Node, OS speech |
| `electron/voice-win.cjs` | Windows speech recognition adapter | Generic shell, model-generated commands |
| `electron/file-access.cjs` | Root containment, denied names, bounded reads, `file.save`, `folder.create`, `file.move` and `file.rename`. `resolveWithinRoots()` is the single path gate; writes resolve the parent through it and validate the basename separately (ADR-016, ADR-017) | Delete, writing outside the roots, creating or moving-to executables or denied names, recursive mkdir, directory move, cross-volume copy |
| `electron/filesystem-scan.cjs` | Bounded metadata inventory, volume totals and file digests over the same roots (ADR-014) | Its own path validator, file contents in any return value, deriving its own roots |
| `electron/weather-client.cjs` | Bound WeatherAPI capability, response mapping, credential-safe errors | The key in any log, error or return value |
| `electron/handy-stt.cjs` | Local transcription: fixed executable path and arguments, temp-file lifecycle | Renderer-supplied paths or flags, transcripts in the audit log |
| `src/hooks/useAudioRecorder.ts` | Microphone capture, 16 kHz mono WAV encoding | Sending audio anywhere except the declared IPC channel |
| `src/types/` | Renderer domain types and barrel | Privileged contracts or Electron APIs |
| `src/styles/` | `base.css`, `overlay.css`, `control.css`, plus per-component sheets | Privileged styling or Node imports |
| `src/views/control/` | Self-registered Control Center pages (`controlPage` + `import.meta.glob`) | Editing `ControlCenter.tsx` or `model.ts` to add a page |
| `src/components/character/` | Event-driven character states and asset catalog | Tools, policy, IPC |
| `electron/preload.cjs` | Defines installation of the composed `window.rata` bridge; bundled before launch | Generic `ipcRenderer` / `fs` |
| `electron/bridge/` | Per-domain preload bridge fragments | Raw or undeclared IPC channels |
| `esbuild.preload.cjs` | Discovers bridge fragments and generates the single sandbox-compatible preload artifact | Runtime authority or renderer code |
| `electron/main.cjs` | Windows, tray, runtime dependency composition | Per-domain IPC handler implementations |
| `electron/ipc/` | Per-domain validated IPC handlers | Undeclared channels or renderer APIs |
| `electron/security.cjs` | Navigation, popup, IPC sender, renderer permission guards, and `isMicrophoneEnabled()` | Business logic or tool execution |
| `electron/tools/index.cjs` | Discovers and composes declared tool-domain modules | User/model-supplied modules, undeclared tool IDs |
| `electron/tools/*.cjs` | Per-domain allow-listed native tool adapters | Unrestricted shell, policy bypass |
| `electron/tools/filesystem.cjs` | Sole owner of `filesystem.scan`, `filesystem.diskUsage`, `filesystem.hash` | Any write verb, returning file contents |
| `electron/tools/document.cjs` | Sole owner of `document.create`, `presentation.create`, `presentation.render`. Pure Markdown/HTML transforms, no I/O (ADR-016) | Disk writes, .docx/.pptx, unescaped HTML, a document library |
| `electron/mvp-tools.cjs` | Compatibility export for existing consumers | New tool registration logic |
| `electron/store.cjs` | Non-secret JSON preferences + audit metadata | Tokens / secrets |
| `packages/contracts/` | IPC channel names and payload validation | Native I/O |
| `packages/agent-core/` | Mock agent, policy, tool registry, calculator parser, communicator | Provider SDKs in UI |
| `packages/agent-core/communicator.cjs` | Always-on understanding parser and voice sanitiser (ADR-012) | Tool execution, request rewriting, routed skill selection |
| `packages/agent-core/conversation-memory.cjs` | In-memory session transcript for `ask()` (ADR-013 session continuity) | Persistence, tool grants, rewriting the current request |
| `packages/skills/` | Per-fragment validation/load, prompt extract, deterministic router | Executing skill files |
| `skills/<id>/skill.json` | Independently validated routing/permission metadata | Authority, code, credentials |
| `skills/<id>/SKILL.md` | Declarative prompt text loaded only for a selected skill | Code, credentials |
| `skills/communicator/` | Always-on understanding and voice prompts (`selectable: false`) | Authority, routed matching, tool names |
| `tests/` | Policy, IPC, skill, calculator regressions | Live network or real OS side effects |
| `docs/` | Architecture, security, tasks, ADRs | Implementation secrets |
| `AGENT_WORKBOOK.md` | Cross-agent work log (read and update each session) | Architecture contracts (those stay in `AGENTS.md`) |

## Working MVP tools

- `system.openApp` — Notepad and Calculator only
- `system.info` — OS name/version/build, architecture, RAM, uptime
- `system.storage` — per-drive total/free/used
- `system.processSummary` — process count and top few by memory; never command lines, arguments or window titles
- `system.keepAwake.start` / `.stop` / `.status` — one bounded Electron `powerSaveBlocker` (max 4 hours, auto-release, released on quit)
- `clipboard.write` — confirmation configurable
- `calculator.evaluate` — arithmetic parser, no `eval`
- `file.delete` — registered and blocked
- `web.search` — Serper-backed result discovery; confirmation configurable
- `web.fetch` — keyless, bounded public-page retrieval; confirmation configurable
- `file.search` / `file.stat` / `file.readText` / `file.searchContent` / `file.reveal` — read-only, root-confined local access
- `file.save` — write Markdown/HTML text inside the same roots; overwrite always confirms; executables and denied names refused
- `folder.create` / `file.move` / `file.rename` — organize files inside the same roots; non-recursive mkdir; files-only move/rename; overwrite always confirms; executable destinations refused
- `document.create` / `presentation.create` / `presentation.render` — Markdown or self-contained HTML generation; no I/O; not .docx/.pptx
- `filesystem.scan` / `filesystem.diskUsage` / `filesystem.hash` — read-only storage inventory over the same roots; metadata and digests only, never file contents; confirmation configurable
- `weather.current` — WeatherAPI current conditions and air quality; confirmation configurable

## First safe changes for agents

1. `RATA-002` provider interface in `packages/agent-core/`, not in React.
2. Load `packages/skills/loader.cjs` prompts only after a provider exists.
3. Add each tool domain as a declared module in `electron/tools/` with tests.
4. Add a Control Center page as `src/views/control/*Page.tsx` that exports `controlPage`. Do not edit `ControlCenter.tsx` or `model.ts` to register it.
