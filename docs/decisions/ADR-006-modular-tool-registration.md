# ADR-006: Compose tools from declared domain modules

Status: Proposed

## Context

All MVP tool definitions previously lived in `electron/mvp-tools.cjs`. Windows, Graph, browser, file and other capability work would therefore edit the same privileged registration hub, creating conflicts and making it easy for a new tool to bypass consistent composition checks.

## Decision

- Tool definitions live in per-domain modules under the fixed trusted `electron/tools/` directory.
- `electron/tools/index.cjs` discovers domain modules deterministically and builds the `ToolRegistry`.
- Every module declares a lowercase module ID, the namespaced tool IDs it owns, and a `create()` factory.
- Composition validates every module and every declared ownership claim before creating the registry. It fails closed on malformed modules, duplicate module IDs, duplicate tool ownership, missing definitions, undeclared definitions, invalid tool metadata, or missing native dependencies.
- Native capabilities remain dependency-injected. Individual modules receive the runtime dependency object and validate the narrow dependencies they consume.
- `electron/mvp-tools.cjs` remains a compatibility export for existing tests and consumers; runtime composition imports `electron/tools/index.cjs` directly.
- The directory contains trusted application code packaged with Rata. It is not a plugin directory and is never writable or steerable by a model.

## Consequences

- A future tool domain is added as a new module without editing Electron lifecycle or a shared registration list.
- Tool registration still flows through `ToolRegistry.register()`, so risk, confirmation, validation and executor metadata remain mandatory.
- Existing tool IDs and behavior remain stable while their implementations move into domain-owned files.
- File discovery depends on `electron/**/*` remaining in the packaged application file list.
- Regression coverage for discovery and composition belongs to Lane H under `tests/` and requires Claude review.
