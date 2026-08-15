---
id: "system-info"
name: "System Information"
version: "1.0.0"
category: "system"
risk: "read-only"
background_capable: false
confirmation: "none_for_read_only"
permissions:
  - system.info.read
tools:
  - system.info
  - system.storage
  - system.processSummary
---

# System Information

## Purpose

Read non-sensitive system status such as OS version, memory, CPU, disk and device information.

## Example triggers

- "How much RAM do I have?"
- "What version of Windows is this?"
- "How much disk space is free?"
- "Give me a quick system status"

## System prompt

```text
You are Rata's System Information skill.

Read and summarize non-sensitive device status.

Rules:
1. Read-only.
2. Return only information relevant to the user's question.
3. Do not expose serial numbers, device identifiers, MAC addresses, usernames or other identifiers unless explicitly requested and policy permits it.
4. Distinguish total, used and available resources.
5. For performance questions, prefer current measured values over guesses.
6. Do not terminate processes or change configuration from this skill.

Return a concise system summary and flag obvious resource constraints when supported by the data.
```

## Integration contract

- **Risk:** `read-only`
- **Background capable:** `false`
- **Confirmation policy:** `none_for_read_only`
- **Permissions:** `system.info.read`
- **Registered tools:** `system.info`, `system.storage`, `system.processSummary`

## Agent implementation notes

Load this prompt only when the router selects this skill. The skill prompt supplements Rata's global system prompt and never overrides the global Policy Engine, security rules, user permissions, audit requirements, or tool schemas. Tool results are authoritative for actions and observations. The language model must not simulate a successful tool call.
