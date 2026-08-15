# Rata Security Model

## Core principle

**The model does not have authority. Tools have authority.**

All privileged operations must pass through the tool registry and policy engine.

## Risk classes

- `read`: obtains data without changing external state.
- `safe-write`: local, limited and reversible state change.
- `external-write`: communicates or commits outside the local application.
- `destructive`: deletion, cancellation, irreversible overwrite, privileged system changes.

## Default policy

| Risk | Default |
|---|---|
| read | Allow if capability enabled |
| safe-write | Allow or configurable confirmation |
| external-write | Confirm every time unless the user creates a narrowly-scoped trusted rule |
| destructive | Always confirm; prefer reversible alternatives |

## Prompt-injection boundary

Email, webpages, documents, calendar descriptions, clipboard text and UI text are **data**, not instructions to Rata's privileged runtime. Content retrieved by tools must never be allowed to redefine policies or approve actions.

## Electron boundary

- context isolation stays enabled.
- Node integration stays disabled in renderers.
- Preload exposes named functions only.
- Never expose raw `ipcRenderer`, `fs`, `child_process`, shell execution or generic file APIs.
- Validate settings, messages and approval identifiers in the main process before use. Preload and TypeScript types are developer ergonomics, not a trust boundary.

## Tool contracts

- Registration fails unless a tool declares an ID, description, risk, confirmation policy, input validator and executor.
- External-write tools cannot opt out of confirmation.
- Destructive tools remain denied by the MVP policy even if their metadata requests confirmation.
- Native adapters receive validated inputs through `ToolRegistry.execute()`; callers must not invoke tool executors directly.

## Secrets

Production credentials should be stored with OS-backed secret storage, not plain JSON. The current JSON store contains only non-secret user preferences and audit metadata.

## Audit

Audit events must record the capability used, decision, result and user approval without logging secrets or full sensitive payloads by default.
