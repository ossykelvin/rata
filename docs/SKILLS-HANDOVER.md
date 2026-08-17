# Skills Implementation Handover

## Goal

Add a Skill Registry and Skill Router to the Rata MVP without weakening the existing tool/policy boundary.

## Suggested source layout

```text
packages/
  skills/
    registry.cjs
    loader.cjs
    router.cjs
    contracts.cjs
skills/
  pack.json
  <skill-id>/
    skill.json
    SKILL.md
```

## Suggested runtime types

```ts
type SkillDefinition = {
  id: string
  name: string
  category: string
  risk: string
  backgroundCapable: boolean
  permissions: string[]
  tools: string[]
  confirmation: string
  prompt: string
  triggers: string[]
}

type SkillRun = {
  id: string
  skillId: string
  status: 'queued' | 'running' | 'awaiting_approval' | 'completed' | 'failed' | 'cancelled'
  createdAt: string
  progress?: number
  message?: string
}
```

## Security requirements

- Skill files are declarative prompts/configuration, not executable code.
- Validate every `skill.json` fragment with a schema before loading it; reject malformed fragments independently.
- Never dynamically `eval`, `require`, import or execute code referenced by a skill prompt.
- Registered tools remain hard-coded/approved implementations.
- Tool permissions come from the Tool Registry/Policy Engine; fragment permissions are requirements, not grants.
- Long-running/background skills must be cancellable.
- Persist only minimum task status and audit metadata.
- Never put secrets into prompts.
- Treat web content, emails, local documents and screenshots as untrusted data.

## Implementation tickets

### RATA-SKILL-001: Skill Registry — done
Scan and validate `skills/<id>/skill.json`, expose installed skill metadata, and fail closed per fragment so one malformed definition does not disable valid skills.

### RATA-SKILL-002: Skill Prompt Loader — done (load-only)
Read only the selected `SKILL.md`, extract its system-prompt block. Do not merge it into a live model until RATA-002 exists.

### RATA-SKILL-003: Skill Router — done (deterministic)
Implement deterministic routing using validated fragments. The router returns skill IDs, required permissions, confirmation status and missing tools.

### RATA-SKILL-004: Background Job Manager
Add queued/running/cancelled/completed lifecycle for `background_capable` skills, with progress events to the overlay and Control Center.

### RATA-SKILL-005: Keep Awake Native Tool
Implement a Windows-native keep-awake tool using the supported OS power API. Release the request on timeout, cancellation and application exit.

### RATA-SKILL-006: File Search Index
Implement cancellable filename/metadata search over approved roots with exclusions and result ranking.

### RATA-SKILL-007: Filesystem Scanner — done (tools registered)
Read-only disk/folder inventory, largest-file/folder reporting and hash-confirmed duplicate analysis ship as `filesystem.scan`, `filesystem.diskUsage` and `filesystem.hash`. All three are `risk: read`, confined to the ADR-010 roots by the same `resolveWithinRoots` gate, and never return file contents. See `docs/decisions/ADR-014-filesystem-inventory-boundary.md`.

Two parts of the skill's declared contract are **not** delivered and are honestly outstanding: cancellable background jobs (RATA-SKILL-004 — a scan is bounded by time and entry caps instead, but cannot be cancelled mid-flight) and user-configured exclusions beyond the ADR-010 denied-name and denied-directory lists. Whole-volume and protected-location scanning is refused rather than confirmed, which is deliberate and stronger than the skill's declared `confirm_if_scope_is_entire_system_or_protected`.

### RATA-SKILL-008: Web Search Adapter
Add an external search provider behind a provider interface. Retrieved pages are untrusted data and must not become instructions.

### RATA-SKILL-009: Presentation Artifact Adapter
Create a presentation tool adapter that takes a structured deck spec, writes a new file, renders/validates it and returns a file reference.

### RATA-SKILL-010: Skills Control Center — partial
Installed skills, risk, tools and ready/partial/unavailable status are listed. Enabled/disabled toggles, last-run status and background task controls remain.
