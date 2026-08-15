# Rata Next Tasks

Skill registry, prompt loader and deterministic router are now in `packages/skills/`. Calculator is a working read tool. Remaining skill tickets are in `docs/SKILLS-HANDOVER.md`.

## RATA-002 - Provider abstraction

**Owner suggestion:** Codex implementation, Claude review

Introduce a provider interface with streaming chat/tool-call support. Add one provider at a time. Do not put provider calls in React.

Acceptance:
- provider interface
- mock provider retained for tests/offline mode
- streaming events surfaced through IPC
- secrets loaded from secure/configured location
- no provider-specific UI coupling

## RATA-003 - Character animation engine

Replace the temporary concept-sheet crop with transparent state assets.

Acceptance:
- states: idle, listening, thinking, awaiting approval, working/typing, success, error, sleeping
- event-driven state changes
- graceful missing-asset fallback
- no business logic in the renderer

## RATA-004 - Production voice

Add STT and TTS adapters.

Acceptance:
- push-to-talk
- microphone permission state
- configurable STT/TTS provider
- interrupt/cancel speech
- audio data not retained by default

## RATA-005 - Native Windows bridge

Build `Rata.WindowsBridge` in C#/.NET using local authenticated IPC.

Acceptance:
- window list/focus
- UI Automation inspect/invoke/set-value
- keyboard/mouse APIs behind explicit tools
- process allow-list foundations
- per-call audit correlation ID
- bridge refuses unauthenticated local callers

## RATA-006 - Microsoft identity + Graph read

Add delegated Microsoft authentication and read-only mail/calendar tools.

Acceptance:
- Entra/MSAL delegated OAuth
- least-privilege scopes
- secure token cache
- `mail.search`, `mail.read`, `calendar.list`, `calendar.findAvailability`
- no send/create permissions in this PR

## RATA-007 - Microsoft Graph writes

Add `mail.draft`, `mail.send`, `calendar.create`, `calendar.update`.

Acceptance:
- external writes require approval by default
- preview of recipients/subject/time before approval
- result verified after execution
- audited without logging sensitive bodies

## RATA-008 - Browser agent

Add Playwright through explicit browser tools.

Foundation: WEB-001 adds keyless, SSRF-resistant `web.fetch` for bounded public text and provider-independent synthesis. It does not download a browser binary or grant interactive page authority.

Acceptance:
- browse/read actions separated from submit/upload/write actions
- submit/upload always approval-gated initially
- downloaded files treated as untrusted
- page content cannot alter system/tool policy

## RATA-009 - Structured contracts

**Status:** In progress. Runtime validators now cover current IPC payloads and MVP tool inputs; shared generated TypeScript/schema contracts remain to be introduced as the surface grows.

Move IPC/tool payloads to a shared schema package (e.g. Zod).

Acceptance:
- validate all privileged IPC inputs
- version tool contracts
- typed renderer bridge generated or shared from schemas

## RATA-010 - Tests and Windows packaging hardening

Acceptance:
- unit tests for policy decisions
- agent/tool integration tests
- renderer smoke tests
- Windows installer verified
- code-signing plan documented
- auto-update deferred until signing strategy exists
