# Rata Office Assistant MVP

Rata is a Windows-first draggable desktop assistant inspired by the spirit of Clippy, but designed as a modern permission-aware AI agent.

This repository is the **first working vertical-slice MVP**. It intentionally proves the desktop shell and safety architecture before adding unrestricted desktop automation or live AI credentials.

## What works now

- Transparent, frameless, always-on-top Rata overlay.
- Drag Rata around the desktop.
- Speech bubble and quick chat input.
- Microphone button with browser SpeechRecognition fallback when available.
- Full Rata Control Center.
- Persistent local settings using a JSON store in Electron `userData`.
- Configurable overlay opacity and always-on-top behaviour.
- System tray controls.
- Agent runtime boundary with a `ToolRegistry` and `PolicyEngine`.
- Risk-aware confirmation flow.
- Working allow-listed Windows tools:
  - `open notepad`
  - `open calculator`
  - `copy <text> to clipboard`
- Safe calculator (`what is 36 * 14?`, `calculate 15% of 2400`) with no `eval`.
- Skill registry, deterministic router, and Control Center Skills page.
- Activity/audit log.
- Destructive tools blocked in the MVP.
- Secure Electron renderer boundary: context isolation enabled, Node integration disabled, preload exposes a narrow API.

## Quick start on Windows

Requirements for development only:

- Node.js 22.12+ (Electron 43 requirement)
- npm

```bash
npm install
npm run verify
npm run dev
```

To make a local Windows installer:

```bash
npm run dist:win
```

For a quicker unpacked Windows build:

```bash
npm run pack:win
```

## Demo commands

Type these into Rata:

```text
open notepad
open calculator
copy Hello from Rata to clipboard
what is 36 * 14?
what can you do
```

Clipboard writes ask for approval by default so the permission flow can be demonstrated.

## Architecture

```text
React renderer
    ↓
restricted preload IPC
    ↓
Electron main process
    ↓
MockAgent / future Orchestrator
    ↓
Skill Router
    ↓
PolicyEngine
    ↓
ToolRegistry
    ↓
Windows / Microsoft Graph / Browser / other connectors
```

**Never let a renderer component or model call privileged OS functionality directly.**

## Handover order

Before coding, AI agents should read:

1. `AGENTS.md`
2. `AGENT_WORKBOOK.md`
3. `docs/CODEMAP.md`
4. `docs/HANDOVER.md`
5. `docs/ARCHITECTURE.md`
6. `docs/SECURITY.md`
7. `docs/TASKS.md`
8. `docs/VALIDATION.md`
9. `docs/AI-HANDOFF-PROMPTS.md`

Claude should also read `CLAUDE.md`. Cursor loads rules from `.cursor/rules/`.

## Character asset note

The current widget uses `public/rata-concept.png` when present, otherwise a letter-mark fallback. Replace this with transparent animation states (`idle`, `thinking`, `typing`, `working`, etc.) without changing the agent runtime. See `docs/CHARACTER-ASSETS.md`.
