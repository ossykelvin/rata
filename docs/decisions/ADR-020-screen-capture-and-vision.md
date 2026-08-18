# ADR-020: Screen capture and vision

Status: Proposed — requires Claude security review before acceptance

Supersedes nothing. Extends ADR-007 (provider chain) with an additive image
field, and follows ADR-010's "confirm because it leaves the machine" reasoning.

## Context

`skills/screenshot-inspector/` has been installed since the skill pack landed.
It declares `screen.capture` and `vision.analyze`. Neither existed, so the
Skills page reported the pack unavailable. A skill is prompt data (ADR-003) and
cannot invent tools.

This is the most sensitive egress the app has taken so far. File text and a
search query are things the user typed or named. A screenshot is everything
currently on the primary display — other windows, notifications, a password
manager, a customer record, an incognito browser. Once those pixels leave the
machine they cannot be recalled.

Two failure modes matter, and they are independent:

1. **Invisible egress.** The user approves a description ("Capture Screen 1")
   and a different image is what actually goes to the provider.
2. **Prompt injection in pixels.** A webpage, email or document on screen can
   contain "ignore previous instructions" as text in the bitmap. That is data,
   not authority, exactly like `web.fetch` HTML.

## Decision

**The user sees the exact image before it leaves the machine.** Not a window
title, not a display name, not a generated caption. The approval card for
`vision.analyze` renders the PNG that will be sent. Bytes are snapshotted into
the pending approval (REVIEW-001 M1) as a SHA-256 digest of the live buffer.
Execute recomputes the digest and refuses if the in-memory slot was mutated.
The preview travels to the trusted renderer only, as a data URL on the approval
payload. It is not written to the JSON store, not placed in an audit event, and
not returned to the agent.

**Confirmation is `always`, and it is not configurable.** The skill declares
`respect_screen_capture_policy_and_exclusions`. Requiring a fresh approval
exceeds that rather than weakening it, the same call as filesystem inventory
(ADR-014) refusing whole-volume scans. There is no "remember this choice" and
no setting that turns confirmation off. Capture does not run on start and does
not run in the background (`background_capable: false`).

**A master switch defaults off.** `screenCaptureEnabled` is not a confirmation
toggle. When it is off, both tools refuse in `validateInput` before
`desktopCapturer` is called. When it is on, confirmation is still always. The
safe disk fallback is `false` — invalid stored values fail closed, unlike
confirmation settings that fall back to on. Turning it on means Rata may
capture the screen and send images to the configured AI provider.

**Primary display only. No window targeting by name.** Window titles leak
document names, customer names and URLs. `system.processSummary` already
refuses titles for that reason. v1 requests `desktopCapturer` screen sources
only, picks the primary display, and never enumerates windows. Rata's own
windows are excluded from the source list by media-source id, not by title, and
`setContentProtection(true)` is applied where the platform allows.

**Handles, not bytes, reach the agent.** `screen.capture` stores one PNG in the
main process, TTL five minutes, single slot, cleared after `vision.analyze`
consumes it. The tool return is `{ handle, width, height, byteCount }`. Raw
bytes, base64 and data URLs are not returned, not logged, and not persisted.
Images are not written to disk. Oversized captures (wider than 1920 after
downscale, or more than 4MB PNG) are refused rather than truncated.

**`vision.analyze` accepts only a handle and a question.** Paths and raw image
fields are rejected. An unknown, expired, consumed or mutated handle fails
closed. The tool never silently recaptures.

**Vision output is untrusted.** The result carries `trust: 'untrusted-external'`.
A later provider call receives it only through `fenceUntrusted`. It does not
select a tool, change policy or supply approval.

**The provider contract is extended additively.** `content` remains a
non-empty string. An optional sibling `image: { mimeType, data }` is allowed on
a user turn. Existing text-only callers are unchanged; malformed text still
throws. Gemini maps the field to an `inline_data` part (REST
`mime_type` / `data`). OpenRouter maps it to an `image_url` content block with a
data URL, per current API docs. Providers declare `supportsVision`. The chain
skips text-only providers, including mock, and refuses with a clear error when
no vision-capable provider is configured. There is no silent fallthrough to
text-only.

These tools are not added to the ADR-009 planner enum or the communicator
intent enum. A model cannot trigger a capture by proposing a structured action
or an interpreted intent.

## Consequences

Screenshot Inspector becomes `ready` when both tools are registered. A user
with the master switch off still cannot capture. A user on the mock provider
can capture locally after approval, then `vision.analyze` fails closed until a
vision-capable provider is configured.

Window-targeted capture, region capture, excluded-app lists beyond Rata's own
windows, and saving a screenshot to disk are deferred. Each would be a new
decision, not a flag on this one.

## Alternatives rejected

**Configurable confirmation, default on, like `fileReadConfirm`.** A screenshot
is not one named file. The cost of an accidental "always allow" is the whole
desktop, every time. Always is the product.

**Capture on the approval card for `screen.capture` itself.** That would take a
screenshot before the user had approved taking one. Capture happens on execute
after the first approval; the image is shown on the `vision.analyze` card,
which is the moment pixels leave.

**Enumerating windows so the user can pick one.** Titles are sensitive. v1
captures the primary display or it captures nothing.

**Returning PNG bytes to the agent so the model can "see" them in the tool
result.** The agent is not a boundary. Bytes stay in main until a confirmed
`vision.analyze` call, and even then they go to the provider adapter, not into
audit or history.

**Making `content` polymorphic (string | part[]).** Every existing caller and
`assertMessages` check would have to learn the union. A sibling field keeps the
text contract intact.
