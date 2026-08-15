# Rata Skills Pack v1

This folder is a drop-in prompt and capability specification pack for the Rata Office Assistant.

## What is included

Each skill lives under `skills/<skill-id>/SKILL.md` and contains:

- YAML-like metadata for loading/routing
- purpose
- example user triggers
- the skill-specific system prompt
- required Rata permissions
- expected registered tools
- confirmation/risk policy
- implementation notes

`skills.manifest.json` provides the same information in machine-readable form for the future Skill Registry.

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

The manifest marks several skills as `background_capable: true`. In Rata this means:

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

1. Parse `skills.manifest.json`.
2. Match user intent against `triggers`, category and tool availability.
3. Load only the selected `SKILL.md`, not all prompts into every conversation.
4. Merge it below Rata's global system prompt.
5. Check every requested tool against the Tool Registry and Policy Engine.
6. Reject any tool not explicitly registered.
7. Record skill ID in the audit event.

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
