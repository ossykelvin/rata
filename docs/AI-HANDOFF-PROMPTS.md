# Ready-to-use AI Handover Prompts

## Codex kickoff

You are the implementation engineer for Rata Office Assistant. Start by reading `AGENTS.md`, `AGENT_WORKBOOK.md`, `docs/CODEMAP.md`, `docs/HANDOVER.md`, `docs/ARCHITECTURE.md`, `docs/SECURITY.md`, `docs/VALIDATION.md` and `docs/TASKS.md`. When you finish, update `AGENT_WORKBOOK.md`. Do not bypass the tool registry or policy engine. Skills are prompt packs, not authority. First run the existing tests and launch the Windows Electron MVP. Fix only genuine MVP launch/build issues in a focused PR. After the baseline works, implement `RATA-002 Provider abstraction` as the next separate change. Preserve the mock provider for offline/tests.

## Claude review kickoff

You are the architecture and security reviewer for Rata Office Assistant. Read `AGENTS.md`, `AGENT_WORKBOOK.md`, `CLAUDE.md`, `docs/ARCHITECTURE.md`, `docs/SECURITY.md`, `docs/HANDOVER.md`, `docs/TASKS.md` and `docs/decisions/ADR-003-skills-are-not-authority.md`. When you finish, update `AGENT_WORKBOOK.md`. Review the current MVP for Electron privilege-boundary problems, confused-deputy risks, prompt-injection paths, unsafe IPC, policy bypasses, skill-pack execution risks and future Microsoft Graph scope risks. Do not rewrite the project unless necessary. Produce prioritized findings and concrete changes for Codex to implement.

## Cursor kickoff

Open the Rata repository and respect all `.cursor/rules/`. Read `AGENT_WORKBOOK.md`, `docs/CODEMAP.md`, `docs/HANDOVER.md` and `docs/VALIDATION.md`. When you finish, update `AGENT_WORKBOOK.md`. Run `npm install`, `npm test`, `npm run typecheck`, `npm run build` and `npm run dev` on Windows. Fix any local build/runtime issues without changing the architecture. Use the existing Control Center visual language for all new UI. When adding a privileged capability, route it through preload IPC, the agent/policy layer and a registered tool; never call OS APIs from React. When adding a skill, add a `SKILL.md` plus a manifest entry; never execute the skill file.
