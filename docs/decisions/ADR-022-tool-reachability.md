# ADR-022 — Tool reachability is a boundary, not a detail

**Status:** Accepted
**Date:** 2026-08-18
**Supersedes:** nothing. Extends ADR-002 (permission/tool boundary) and ADR-006 (modular tool registration).

## Context

ADR-002 establishes that the model does not have authority; tools do. ADR-006
makes registration modular so a tool arrives with its schema, risk level and
confirmation policy attached. Both are about what a tool is *allowed* to do.

Neither says anything about whether a user can ask for it.

Nothing between a user's sentence and `ToolRegistry.execute()` is supplied by
the model. The ADR-009 planner proposes `system.openApp` and nothing else, and
there is no general provider-driven tool-calling path. A tool is therefore
reachable only if a deterministic phrase route exists for it. Registration,
validation, policy and tests can all pass for a tool that no user can ever
invoke.

This was not theoretical. Five tools shipped unreachable and were found one at a
time through GUI testing — weather, voice, file search, `file.save` — and an
end-to-end pass then found eleven more at once. 19 of 30 registered tools had no
route.

The failure mode is worse than "the feature does nothing", because the request
does not stop. It falls through to `ask()`, and with a provider connected the
model answers from general knowledge with `state: 'success'`:

| Request | Tools run | What the user was told |
|---|---|---|
| "how much RAM do I have?" | none | a confident wrong figure |
| "keep my PC awake for two hours" | none | "I have kept your PC awake" |

The second is the one that forces this ADR. No power-save blocker was held, the
machine went on to sleep, and Rata reported a completed action. An assistant
that narrates actions it did not take is a safety problem, not a gap in
coverage — the audit trail is truthful, the reply is not, and the user has no
way to tell them apart.

## Decision

**1. Every route lives in one table.** `packages/agent-core/tool-routes.cjs`
holds every deterministic phrase → tool mapping. Routes are not written inline
in the agent. The point is not tidiness: a route set scattered through a
dispatch function cannot be counted, and an uncountable route set is how five
tools shipped unreachable.

**2. A route extracts, it never composes.** A route pulls arguments out of the
user's own words. It does not build filesystem paths, invent targets, or consult
a model. Path composition stays in `file-access.cjs`, where the roots are. Every
input a route produces still passes `validateInput` and the policy engine, so a
route cannot widen what a tool permits — the worst a wrong route can do is send
a well-formed request that the tool then refuses.

**3. Unreachable is a state that must be declared.** A registered tool is either
routable, or listed in `INTENTIONALLY_UNROUTED` with a reason. A test fails the
build otherwise. "No route" is exactly the defect this table exists to prevent,
so an unexplained exemption is the bug wearing a disguise.

**4. Reachability is reported to the user.** The Skills page previously derived
readiness from registration alone and showed nine skills as "ready" while they
could not perform their core function. `unroutableTools` is now a separate field
on the public skill contract, reported apart from `missingTools`: the tool
exists but the sentence does not reach it, and those are different problems with
different fixes.

## Consequences

- Adding a tool now has a second obligation beyond registering it. That is the
  intent: the obligation was always real, and was previously discovered in use.
- The skills package must not import the route table — it would depend on
  `agent-core`. Routable ids are injected at composition time in `main.cjs`, the
  same way `toolRegistry` already is.
- Tools reached through `handleSkill` rather than a phrase route
  (`calculator.evaluate`, `screen.capture`, `vision.analyze`) count as
  reachable. Omitting them would make the Skills page lie in the other
  direction.
- A guard that refuses provider answers for unrouted action skills was
  considered and rejected. Once the routes existed, every demonstrated false
  claim was fixed at the cause, and a runtime refusal would have broken
  legitimate flows where a skill produces text that `file.save` later writes
  (`document-assistant`, `presentation-builder`). The coverage test is the
  durable protection; a runtime guard would have been a second mechanism
  guarding a hole that no longer exists.

## Notes

Giving `file.rename` a route ran it through the agent for the first time and
exposed a latent defect: the agent validates to build the approval card, then
`ToolRegistry.execute()` validates again on purpose so no caller can skip it —
but `file.rename` accepted `path` and returned `source`, so the second pass
rejected the first pass's output and the rename failed *after* the user had
approved it. Validation must be idempotent, and there is now a test asserting
that property across every write tool rather than only the one that failed.
