---
id: "my-skill"
name: "My Skill"
version: "1.0.0"
category: "utility"
risk: "read-only"
background_capable: false
confirmation: "none"
permissions:
  - example.read
tools:
  - example.read
---

# My Skill

## Purpose

Describe one narrow capability.

## Example triggers

- "Example request"

## System prompt

```text
You are Rata's My Skill skill.

Your job is...

Rules:
1. ...
```

## Integration contract

- **Risk:** `read-only`
- **Background capable:** `false`
- **Confirmation policy:** `none`
- **Permissions:** `example.read`
- **Registered tools:** `example.read`

## Agent implementation notes

A skill supplements the global Rata prompt. It never bypasses Tool Registry, Policy Engine, user approval, audit or verification.
