# Rata MVP Handover Notes

## What you are receiving

A functioning Electron vertical slice, not a static mockup.

The application proves:

1. A floating Rata desktop window can coexist with a standard Control Center.
2. Rata can be dragged and remain always on top.
3. Renderer code is isolated from Node/native capability.
4. Agent requests flow through a tool registry and policy engine.
5. Tool actions are auditable.
6. A user approval can gate a system write.
7. Settings persist across launches.

## Deliberately mocked or incomplete

- AI provider: deterministic `MockAgent` only.
- Character: concept-sheet crop with CSS animation, plus a letter-mark fallback if the PNG is missing.
- Voice: push-to-talk uses Windows speech recognition in the main process. Chromium `SpeechRecognition` is not used because Electron cannot reach Google's speech service. Main denies `media` when the microphone setting is off. TTS is not wired.
- Windows control: safe allow-listed app launch only.
- Skills: registry/router loaded; only calculator and existing MVP tools can act.
- Microsoft 365: UI placeholder; no OAuth yet.
- Browser automation: not yet implemented.
- Secret vault: not needed until credentials are introduced.
- Native Windows UI Automation bridge: not yet built.

This is intentional. Do not solve the missing capabilities by bypassing the tool/policy architecture.

## First commands to verify

```bash
npm install
npm run verify
npm run dev
```

Then test:

```text
open notepad
open calculator
copy Hello from Rata to clipboard
what is 36 * 14?
```

The clipboard operation should request approval with the default settings.

## Source ownership

- `src/`: React UI only.
- `electron/`: desktop process, IPC, tray, persistence glue.
- `electron/tools/`: auto-composed, dependency-injected allow-listed native adapters. `electron/mvp-tools.cjs` is a compatibility export only.
- `packages/agent-core/`: model-independent agent/tool/policy foundation.
- `packages/contracts/`: runtime validation for privileged IPC contracts.
- `packages/skills/`: skill registry, prompt loader and deterministic router.
- `skills/`: declarative skill prompts. Not executable.
- `docs/`: product engineering contract and next steps. See `docs/CODEMAP.md`.

## Recommended next PRs

Do not combine all milestones into one huge change. Use the tasks in `docs/TASKS.md` as separate, reviewable PRs.

Claude uses `CLAUDE.md`; Cursor uses the always-applied rules in `.cursor/rules/`. Both defer to `AGENTS.md` when instructions overlap.
