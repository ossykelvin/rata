# ADR-012: Communicator is an always-on stage, not a routed skill

Status: Proposed — requires Claude privilege-boundary review before acceptance

## Context

Literal command matching misses polite variants of the same request.
"What's the weather in Preston?" already hits the weather route; "Can you look
up the weather in Preston?" does not. Skills cannot close that gap: they are
prompt packs (ADR-003) and the router must not be given extra authority.

A provider can classify intent and can rewrite a reply to sound like a person.
Both calls send text off the machine. Neither call may choose a tool, skip a
validator, rephrase an approval card, or become a user-visible error.

## Decision

Communicator is **not a routed skill**. `skills/communicator/` holds prompt
text only. `skill.json` declares `selectable: false`, empty `tools` and empty
`triggers`. The router never returns it. The pack grants no authority.

The user's request is **never rewritten**. It is passed to every continuation
exactly as typed. Communicator separately produces a validated interpretation
so an existing deterministic tool can run when pattern matching missed.

### Understanding stage

Placement in `MockAgent.handle()`, after every explicit route, the skill
router, and the ADR-009 system-action planner, immediately before `ask()`:

```text
deterministic routes
  → skills router
  → system-action planner
  → communicator intent
  → ask()
```

It runs last, and only when nothing else matched. It cannot override a
deterministic hit.

The model returns exactly one JSON object. The parser mirrors ADR-009:
version 1, exact keys, a 512-character envelope, at most one complete Markdown
fence. Allowed `intent` values are a fixed enum in code: `weather`,
`webSearch`, `fileSearch`, `none`. Nothing else parses.

The model never names a tool. `intent → toolId` is a literal object in
`packages/agent-core/communicator.cjs`:

- `weather` → `weather.current` with `{ query: location }`
- `webSearch` → `web.search` with `{ query }`
- `fileSearch` → `file.search` with `{ query }`

A model returning `system.openApp`, `file.delete`, or any tool id is an
invalid intent. Extracted parameters are untrusted: `ToolRegistry.validate()`
and the tool's own `validateInput` still run. Weather locations still pass
`validateQuery` on execute. Confirmation policy is unchanged. The stage may
only reach tools the user could already reach by a supported phrase.

Invalid JSON, an unknown intent, a missing parameter, a provider error or a
timeout fail closed **and fail quiet**: the request falls through to `ask()`.
The user never sees an error that exists only because this stage ran.

### Voice stage

Conversational replies pass through one `presentReply` seam on `handle()` and
`approve()`. The 24 `return { message, state }` sites are not edited.

These are never rewritten, as an allow-list in code rather than a model
instruction:

1. `reply.approval` entirely, including `detail` and `title`. Rephrasing
   "Delete report.docx" would be a confused deputy.
2. Any reply whose `state` is `awaiting_approval`, including `message`.
3. Activity and audit text.
4. Refusal reasons that start `I blocked that action:`.
5. Tool result values. After a rewrite, every number, file path, URL and
   quoted string from the original must still be present; otherwise the
   rewrite is discarded and the deterministically sanitised original is used.

Untrusted tool text is wrapped with `fenceUntrusted` before it reaches the
voice provider.

### Dashes

`sanitizeVoice()` runs after a model rewrite and when the model is unavailable.
It removes U+2014, U+2013, U+2015, U+2012 and U+2212. A dash between two
numbers, including an ASCII hyphen in a numeric range, becomes ` to `. Token
hyphens such as `Stratford-upon-Avon`, `read-only`, `--force` and Windows
paths are left alone. AI-assistant tells are stripped. The function is
idempotent.

### Egress

Both stages send text to a provider, so both widen egress. `communicatorEnabled`
defaults to **false**. When it is off, neither stage calls a provider;
`sanitizeVoice` may still run locally. Preferred provider is Gemini, with the
existing chain as fallback. Each stage times out at 8 seconds.

## Consequences

- Polite weather, search and file-find phrasing can reach the tools that
  already exist, without teaching the router new matching logic.
- Adding an intent requires a code change to the enum and the literal mapping.
  Prompt wording cannot expand authority.
- Approval cards, refusals and audit events stay byte-identical.
- A fresh install does not send extra conversation text off the machine until
  the user opts in on the Permissions page.

## Alternatives rejected

**Selecting Communicator through the skill router.** That would make it
optional per request and would compete with Weatherman, Web Search and File
Finder. It has to apply to every unmatched request, and skills carry no
authority.

**Rewriting the user's request so existing regexes fire.** That would put a
model between the user and every later stage, including confirmation previews
and audit correlation. The original text is the authority boundary.

**Letting the model name a tool id.** ADR-009 already rejected this. The
literal mapping is the whole security property.
