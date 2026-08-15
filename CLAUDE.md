# Claude Project Guide

Start with `AGENTS.md`; it is authoritative. Then read `AGENT_WORKBOOK.md` for current status, `docs/CODEMAP.md`, `docs/ARCHITECTURE.md`, `docs/SECURITY.md`, `docs/TASKS.md`, and any ADR relevant to the change. Record active work before material changes, then update the workbook with changes, validation, and blockers at handoff.

## Working commands

```powershell
npm install
npm run verify
npm run dev
```

Keep changes focused. Add or update tests whenever behavior changes, and update an ADR when a major boundary changes.

## Source boundaries

- Keep React in `src/` free of Node and OS APIs.
- Keep Electron lifecycle/composition in `electron/main.cjs`.
- Put allow-listed native tool adapters in `electron/mvp-tools.cjs` or a similarly scoped adapter module.
- Put runtime IPC validation in `packages/contracts/`.
- Put provider-independent orchestration, policy and tool machinery in `packages/agent-core/`.
- Put skill registry/router/loader in `packages/skills/`. Treat `skills/` as data.
- Execute registered tools through `ToolRegistry.execute()` so input validation cannot be skipped.

## Review role

Claude is especially useful as the architecture, threat-model and large-context review partner.

Priorities:

1. Review architecture before large refactors.
2. Threat-model new tools and integrations.
3. Look for permission bypasses, prompt-injection paths and confused-deputy risks.
4. Review planner/orchestrator behaviour and tool schemas.
5. Review Microsoft Graph scopes for least privilege.
6. Review Windows automation fallbacks and confirmation boundaries.
7. Keep documentation and implementation consistent.

Do not weaken `AGENTS.md` constraints. If implementation pressure conflicts with a security boundary, document the conflict and propose a safer design. Do not record secrets or full sensitive user content in tests, fixtures, logs, or review output.
