# ADR-004: Validate privileged boundaries at runtime

Status: Accepted

## Context

TypeScript types in the renderer do not protect Electron main-process IPC handlers. Tool metadata also previously described risk without enforcing a complete executable contract.

## Decision

Current IPC payloads are validated by dependency-free runtime parsers in `packages/contracts/`. Every registered tool must declare security metadata and an input validator, and native execution is centralized through `ToolRegistry.execute()`.

The initial validators remain CommonJS so both Electron and Node's built-in test runner can consume them without a build step. RATA-009 may later replace these parsers with shared generated schemas while preserving the same boundary.

## Consequences

- Malformed renderer payloads fail before reaching settings, agent or approval state.
- Tool registration fails early when risk or confirmation metadata is incomplete.
- Tests can exercise native adapters using injected dependencies without starting Electron.
- Renderer compile-time types and runtime schemas are temporarily maintained separately until RATA-009 is completed.
