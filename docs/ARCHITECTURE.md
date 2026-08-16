# Rata Architecture

## Goal

Rata is a character-driven desktop assistant with a strict separation between **conversation** and **authority**.

The language model may propose actions. Only registered tools may perform them.

## MVP runtime

```text
Overlay + Control Center (React)
           │
           ▼
  electron/preload.cjs
           │ narrow IPC
           ▼
  electron/main.cjs
           │ validated IPC contracts
           ▼
       MockAgent
           │
    ┌──────┴──────┐
    ▼             ▼
SkillRouter   PolicyEngine
    │             │
    ▼             ▼
SkillRegistry  ToolRegistry
                  │
                  ▼
         Allow-listed OS / calculator tools
```

Skills may be selected and described. Only registered tools may act. When the router selects Critical Thinking, the agent loads that skill prompt beneath the global system prompt and calls the provider chain. The model still cannot invoke tools.

## Current source boundaries

- `src/`: unprivileged React renderers. Shared renderer types live in `src/types/` behind a barrel. Overlay and Control Center styles are `src/styles/{base,overlay,control}.css`; Control Center pages self-register from `src/views/control/*Page.tsx`. Overlay conversation state uses `useAgentConversation`.
- `electron/main.cjs`: Electron lifecycle and dependency composition only.
- `electron/ipc/`: auto-discovered per-domain main-process handler modules. Each module declares the contract keys it owns and cannot register undeclared channels.
- `electron/bridge/`: auto-discovered per-domain preload fragments. Duplicate bridge properties or channel ownership fail closed before exposure. The build generates one `dist-electron/preload.cjs` artifact containing every fragment because sandboxed Electron preloads cannot import local CommonJS modules at runtime.
- `electron/tools/`: auto-discovered per-domain tool modules. Each module declares the tool IDs it owns and creates complete registry definitions from injected native dependencies. Composition fails closed on duplicate or undeclared IDs. `electron/mvp-tools.cjs` remains a compatibility export only.
- `electron/public-web-client.cjs`: keyless, DNS-pinned public HTTP(S) reader used by the registered `web.fetch` tool. It rejects non-public destinations and returns bounded text marked as untrusted external content.
- `packages/contracts/`: runtime validation at privileged IPC boundaries.
- `packages/agent-core/`: provider-independent policy, tool registration and orchestration foundations.
- `packages/skills/`: per-fragment skill registry, prompt loader and deterministic router. The registry scans `skills/<id>/skill.json` deterministically; an invalid fragment is excluded and reported without disabling valid skills.
- `skills/`: declarative skill metadata and prompt packs. Each skill owns its `skill.json` and `SKILL.md`; neither is executable or grants authority.

Tool execution is centralized in `ToolRegistry.execute()`. A registered tool must declare its risk, confirmation policy and input validator before it can execute.

Web research keeps service authority separated: Serper supplies search results through `web.search`; `web.fetch` retrieves a validated public result without credentials; only then may provider-independent orchestration pass the text to the configured provider as fenced `context` data.

Explicit application-launch requests have one narrower provider-assisted path.
After deterministic intent gating, the provider may return a versioned JSON
proposal for `system.openApp`; a strict parser accepts only Notepad or
Calculator and rejects every other tool, field, argument, path or command. The
proposal then enters the normal policy and Tool Registry path. Ordinary chat
output and retrieved content never enter this planner. See
`docs/decisions/ADR-009-structured-system-actions.md`.

Adding a tool domain means adding one trusted module under `electron/tools/`; it does not require editing the composition index or Electron lifecycle. Tool modules are application code packaged with Rata, never user- or model-supplied plugins.

Adding an IPC-backed capability extends the trusted boundary with a handler module and a preload bridge fragment instead of editing the shared main/preload hubs. `npm run build:preload` discovers and statically bundles new bridge fragments. Contract channel fragments are owned separately under `packages/contracts/`.

## Target runtime

```text
User / microphone
       ↓
Conversation Manager
       ↓
Intent + Context
       ↓
Skill Router
       ↓
Planner / Orchestrator
       ↓
Policy Engine
       ↓
Approval when required
       ↓
Tool Registry
       ↓
┌──────────┬────────────┬────────────┬──────────────┐
│ Windows  │ Microsoft  │ Web        │ Files/System │
│ Bridge   │ Graph      │ Browser    │              │
└──────────┴────────────┴────────────┴──────────────┘
       ↓
Verifier
       ↓
Audit + response + character state
```

## Window model

Rata uses separate windows:

- **Overlay**: transparent, frameless, draggable, always-on-top, `skipTaskbar`, small attack surface. Minimize collapses the widget to a small draggable icon; close hides the window without quitting.
- **Control Center**: normal application window for settings, chat, permissions, integrations, memory and logs. Closing it hides the window (`skipTaskbar`) rather than quitting.
- **Tray**: notification-area icon for the running process. Show/Hide overlay, Open Control Center, and Quit live here so a closed overlay does not leave a taskbar launch.

The overlay must never gain privileged APIs that the Control Center does not need either. Both use the same restricted preload.

## Character architecture

The character consumes state/events only:

```text
idle → listening → thinking → awaiting_approval → working → success → idle
```

`sleeping` is also a presentation state. The renderer maps those events in `src/components/character/`; it does not choose tools. Idle uses `public/rata-concept.png`. Other states load matching art from `public/character/`. Missing assets fall back to a letter-mark silhouette.

Production assets should be transparent WebM, Rive, Live2D or another state-driven renderer. Tool logic must not live in animation code.

## Native Windows bridge target

Create a C#/.NET process with authenticated local IPC for:

- Windows UI Automation
- window discovery/focus
- keyboard/mouse
- clipboard
- screen capture
- process launch/close
- filesystem operations

Use UI Automation first. Vision/coordinate automation is a fallback.

## Connectors target

- Microsoft Graph: delegated user permissions for Outlook Mail, Calendar, Contacts.
- Browser: Playwright behind tool contracts.
- AI: provider adapters for OpenAI, Anthropic, Gemini and local models.
- Voice: dedicated STT and TTS adapters. Push-to-talk STT uses Windows speech recognition from `electron/voice-win.cjs` through `rata:voice-*` channels. The renderer only receives the transcript string. Chromium `media` permission and the Windows recognizer both consult `isMicrophoneEnabled()`; turning the setting off stops an in-flight child process. Cloud STT/TTS adapters still belong behind `packages/agent-core/voice/`.
