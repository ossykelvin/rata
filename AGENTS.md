# Rata Engineering Contract

This file is the shared instruction set for Codex and any coding agent operating in this repository.

## Read first

Before modifying code, read:

- `AGENT_WORKBOOK.md` (shared work log; record active work before material changes and update it at handoff)
- `docs/CODEMAP.md`
- `docs/ARCHITECTURE.md`
- `docs/SECURITY.md`
- `docs/TASKS.md`

If the task changes a major architectural boundary, create or update an ADR under `docs/decisions/`.

Preserve other contributors' workbook entries. Record scope, material changes, validation, and blockers without including secrets or sensitive user content.

## Non-negotiable rules

1. Renderer components must not access Node.js or native OS APIs directly.
2. Keep Electron `contextIsolation: true` and `nodeIntegration: false`.
3. Expose only narrowly scoped APIs through `electron/preload.cjs`.
4. Validate privileged IPC inputs before production release. Add schemas as the contracts package is introduced.
5. OS, browser, mail, calendar and file actions must be represented as registered tools.
6. Every tool must declare a risk level and confirmation policy.
7. The policy engine must evaluate every state-changing tool before execution.
8. External writes such as sending email, sending messages, submitting forms or inviting attendees require confirmation by default.
9. Destructive operations require explicit confirmation and must be reversible where possible. They are blocked in this MVP.
10. Never give an LLM unrestricted shell access.
11. Never execute model-generated code or commands without an explicit safe tool contract.
12. Never hardcode API keys, access tokens, passwords or tenant secrets.
13. Do not log OAuth tokens, message bodies or sensitive file contents by default.
14. Provider-specific logic belongs behind an AI provider adapter.
15. Character animation reacts to agent events/state and must not contain business logic.
16. Skills are declarative prompt packs. They never grant authority or execute code.
17. Update tests when changing behaviour.
18. Update docs when changing a public contract or user-visible capability.
19. Do not silently bypass security controls to make a demo work.

## Preferred development pattern

```text
UI
→ preload contract
→ Electron main / agent facade
→ orchestrator
→ skill router (selects prompt + required tools)
→ policy engine
→ tool registry
→ adapter/bridge
→ result verification
→ audit event
→ UI
```

## Definition of done

A task is done only when:

- it compiles,
- tests/type checks pass where applicable,
- failure states are handled,
- permissions are enforced,
- activity is auditable,
- documentation is updated if contracts changed.
