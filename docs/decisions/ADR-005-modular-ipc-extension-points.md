# ADR-005: Compose IPC and preload capabilities from declared modules

Status: Proposed

## Context

Electron main and preload previously held every IPC handler and every renderer bridge method in two shared objects. Provider, voice, Windows, Graph and browser features would therefore edit the same privilege-boundary files and collide during parallel development.

## Decision

- Main-process handlers live in per-domain modules under `electron/ipc/` and are discovered by `electron/ipc/index.cjs` from that fixed trusted directory.
- Preload methods live in per-domain fragments under `electron/bridge/` and are composed by `electron/bridge/index.cjs` before the single `window.rata` exposure.
- Every module declares a stable ID and the existing contract keys it owns.
- Composition fails closed on unknown channels, duplicate module IDs, duplicate channel ownership, duplicate bridge properties, undeclared handler registration, or incomplete handler registration.
- Handler modules receive narrowly scoped runtime services; renderer code still receives named functions only and never receives `ipcRenderer`.
- Channel-fragment aggregation under `packages/contracts/` remains Lane G work and must preserve the same fail-closed properties.

## Consequences

- A feature can add Electron IPC behavior without editing `electron/main.cjs` or `electron/preload.cjs`.
- Current renderer method names and IPC channel values remain unchanged.
- Packaged code discovery depends on `electron/**/*` remaining in electron-builder's file list.
- The fixed module directories contain trusted application code, not user- or model-supplied plugins.
