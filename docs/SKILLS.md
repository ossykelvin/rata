# Rata Skills Pack v1

This folder is a drop-in prompt and capability specification pack for the Rata Office Assistant.

## What is included

Each skill lives under `skills/<skill-id>/` and contains `skill.json` routing/permission metadata plus `SKILL.md` prompt text:

- YAML-like metadata for loading/routing
- purpose
- example user triggers
- the skill-specific system prompt
- required Rata permissions
- expected registered tools
- confirmation/risk policy
- implementation notes

`skills/pack.json` describes the core pack. The registry scans and validates each `skills/<skill-id>/skill.json` independently, so one malformed skill is reported and excluded without disabling valid skills.

## Important architecture rule

A skill is **not authority**.

Skills may reason about an action, but all real operating-system, file, browser, mail and calendar actions must still flow through:

```text
User
→ Rata Orchestrator
→ Skill Router
→ Selected Skill
→ Tool Registry
→ Policy Engine
→ Approval (when required)
→ Tool/Native Bridge
→ Verification
→ Audit Event
```

Never expose unrestricted shell, PowerShell, command prompt, filesystem writes, browser scripting, OAuth tokens or native APIs directly to a skill/model.

## Background-capable skills

Each skill fragment marks whether it is `background_capable`. In Rata this means:

- the application may run the task on its own worker/task queue;
- the task has an ID and status;
- it is cancellable;
- it emits progress events;
- the UI remains responsive;
- completion is shown through Rata/Control Center.

It does **not** mean the LLM receives unrestricted background execution.

Recommended event names:

```text
rata.skill.started
rata.skill.progress
rata.skill.approval_required
rata.skill.completed
rata.skill.failed
rata.skill.cancelled
```

## Recommended loader behavior

1. Scan `skills/<skill-id>/skill.json` in deterministic order and validate each fragment independently.
2. Exclude and report malformed fragments; never let one fragment disable valid skills.
3. Match user intent against `triggers`, category and tool availability.
4. Load only the selected `SKILL.md`, not all prompts into every conversation.
5. Merge it below Rata's global system prompt.
6. Check every requested tool against the Tool Registry and Policy Engine.
7. Reject any tool not explicitly registered.
8. Record skill ID in the audit event.

## First implementation order

Start with:

1. `calculator`
2. `app-launcher`
3. `keep-awake`
4. `file-finder`
5. `filesystem-scan`
6. `web-search`
7. `critical-thinking`
8. `ai-research`
9. `presentation-builder`
10. Microsoft 365 skills

These give Rata useful capability while keeping the security boundary understandable.
