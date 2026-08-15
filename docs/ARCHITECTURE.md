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

Skills may be selected and described. Only registered tools may act.

## Current source boundaries

- `src/`: unprivileged React renderers and shared renderer types.
- `electron/main.cjs`: Electron lifecycle and dependency composition only.
- `electron/ipc/`: auto-discovered per-domain main-process handler modules. Each module declares the contract keys it owns and cannot register undeclared channels.
- `electron/bridge/`: auto-discovered per-domain preload fragments. Duplicate bridge properties or channel ownership fail closed before exposure.
- `electron/mvp-tools.cjs`: allow-listed native tool adapters for the MVP.
- `packages/contracts/`: runtime validation at privileged IPC boundaries.
- `packages/agent-core/`: provider-independent policy, tool registration and orchestration foundations.
- `packages/skills/`: skill registry, prompt loader and deterministic router.
- `skills/`: declarative skill prompt packs. Not executable.

Tool execution is centralized in `ToolRegistry.execute()`. A registered tool must declare its risk, confirmation policy and input validator before it can execute.

Adding an IPC-backed capability extends the trusted boundary with a handler module and a preload bridge fragment instead of editing the shared main/preload hubs. Contract channel fragments are owned separately under `packages/contracts/`.

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

- **Overlay**: transparent, frameless, draggable, always-on-top, small attack surface.
- **Control Center**: normal application window for settings, chat, permissions, integrations, memory and logs.

The overlay must never gain privileged APIs that the Control Center does not need either. Both use the same restricted preload.

## Character architecture

The character consumes state/events only:

```text
idle → listening → thinking → awaiting_approval → working → success → idle
```

`sleeping` is also a presentation state. The renderer maps those events in `src/components/character/`; it does not choose tools. Placeholder SVGs live in `public/character/` until production art arrives. Missing assets fall back to a letter-mark silhouette.

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
- Voice: dedicated STT and TTS adapters.
