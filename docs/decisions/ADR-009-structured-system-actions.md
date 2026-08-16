# ADR-009: Structured provider proposals for bounded system actions

Status: Proposed

## Context

Users may describe a simple application launch in language that the fixed
command parser does not recognise, such as "bring up the text editor". Gemini
or OpenRouter can classify that intent, but AGENTS.md rules 10 and 11 prohibit
unrestricted shell access and execution of model-generated commands.

The existing `system.openApp` tool already provides the required authority
boundary. It accepts only the application names `notepad` and `calculator`,
maps them to fixed executables inside trusted application code, supplies no
arguments, and launches the process detached in the background.

## Decision

Rata may ask the configured provider chain to propose an action only after a
deterministic gate identifies explicit application-launch language. The call
contains the user's request, not web, clipboard, document or other untrusted
retrieved context.

The provider returns text, which is parsed as one exact, versioned JSON shape:

```json
{ "version": 1, "action": "system.openApp", "input": { "appName": "notepad" } }
```

The only alternative is `{"version":1,"action":"none"}`. The parser tolerates
at most one complete Markdown code fence, with or without a `json` language
tag, because providers commonly wrap otherwise exact JSON that way. The raw
512-character limit is checked before removing that fence. The parser still
rejects invalid JSON, surrounding prose, unterminated or multiple fences,
extra keys, unknown actions, unknown app names, paths, URLs, arguments, scripts,
shell text and elevation. A valid proposal is still passed through
`ToolRegistry.validate()`, the policy engine, and `ToolRegistry.execute()` in
that order. The provider never receives a tool executor and never calls a
native adapter.

The audit trail records whether the proposal was accepted, declined or
rejected, followed by the existing tool lifecycle events when execution occurs.
It does not record provider output or credentials.

## Consequences

- Natural variants of an explicit request can launch Notepad or Calculator.
- No PowerShell, command shell, executable path or model-generated argument is
  introduced.
- Unsupported and malformed proposals fail closed without executing anything.
- Adding an application or action requires a deliberate schema and trusted-tool
  change; prompt wording alone cannot expand authority.
- This ADR remains Proposed until Claude reviews the privilege-boundary change
  and Lane H adds focused contract tests.
