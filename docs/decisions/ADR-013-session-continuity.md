# ADR-013: Session conversation history is data, not authority

Status: Proposed — requires Claude privilege-boundary review before acceptance

## Context

Each `MockAgent.handle()` call was an isolated turn. Follow-ups such as
"what about tomorrow?" or "the Preston one" could not refer to earlier
replies. Overlay and Control Center already share one `MockAgent` instance
in `electron/main.cjs`, so a session-scoped transcript can live on that
object without new IPC.

RATA-008 established that the user's request text is never rewritten.
History must sit beside the current turn, not replace it.

## Decision

**In-memory only.** `packages/agent-core/conversation-memory.cjs` holds the
current process session. It is not written to the JSON store. Quitting Rata
clears it. `resetConversation()` exists for tests and future UI; this ticket
does not add an IPC reset.

**History is data.** It cannot grant tools, skip `PolicyEngine`, skip
`ToolRegistry.validate()`, or approve an action. Skills still carry no
authority (ADR-003). The current user text is appended to the provider
payload unchanged.

**Safer v1 placement.** History is injected only into `ask()`. It is not
passed to the communicator understanding stage, and this version does not
resolve pronouns such as "there" into a previous weather location. A matching
deterministic route still wins and never consults history. Confirmation is
unchanged.

**Untrusted assistant turns are fenced.** Prior assistant text — including
tool results, web page extracts and model replies — is wrapped with
`fenceUntrusted` and sent as the `context` role. Prior user text is sent as
`user` turns so the model can see what was actually typed. Approval card
internals and activity/audit events are not conversation history.
`awaiting_approval` replies are not stored until the action completes or is
cancelled. The parked user text lives on that approval snapshot, so a later
`ask()` while the card is open is recorded as its own turn and cannot steal
the parked request.

**Caps.** Default 16 turns and 8,000 characters. Overflow drops the oldest
turn. The cap fails closed by dropping, never by hanging.

**Communicator stays optional.** `communicatorEnabled` still gates only the
understanding and voice stages. Session history for `ask()` works when
Communicator is off.

## Consequences

- Follow-up questions in the same Electron session can refer to earlier turns.
- A long session cannot unbounded-grow provider context.
- Adding pronoun resolution for tools would be a later ADR: it would let
  history influence which tool input runs, and must revalidate that input.

## Alternatives rejected

**Persisting the transcript to `rata-store.json`.** Conversation can contain
untrusted web/file text and user content that should not sit on disk next to
settings without a dedicated retention design.

**Passing history into the communicator intent stage.** That would let a
prior location or filename fill in "there" / "that file". Safer v1 leaves
that to ordinary `ask()` so a model cannot steer a registered tool from
remembered context.
