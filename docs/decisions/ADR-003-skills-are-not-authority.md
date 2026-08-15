# ADR-003: Skills are prompt packs, not authority

Status: Accepted

## Decision

Installed skills are declarative prompt and metadata packs. They may be selected by a Skill Router and may contribute a system-prompt block to a future provider-backed orchestrator. They do not execute code, grant permissions, or bypass the Tool Registry and Policy Engine.

## Consequences

- Each `skills/<id>/skill.json` is schema-validated independently. Invalid fragments fail closed and are reported without disabling valid skills.
- `skills/pack.json` contains pack identity only; it grants no authority.
- Skill files are read as text. Dynamic `eval` / `require` of skill content is forbidden.
- A skill whose required tools are unregistered may be described to the user, but it cannot act.
- Future provider adapters load only the selected skill prompt beneath the global Rata system prompt.
