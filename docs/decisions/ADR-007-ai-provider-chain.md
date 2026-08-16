# ADR-007: AI provider chain and web search egress

Status: Accepted

## Context

RATA-002 requires a provider abstraction. The product brief specifies Gemini as
the primary provider, OpenRouter as the secondary for complex work or when
Gemini does not answer promptly, and Serper as the web search backend.

All three are network services holding credentials, so this is the first change
that sends user content off the machine.

## Decision

**Providers return text and nothing else.** A provider cannot invoke a tool,
reach the policy engine, or see another provider's credential. Model output is
untrusted input to the rest of the runtime. The model is told in its system
prompt that it has no ability to act, but that is a UX measure. Ordinary answer
text remains display-only. ADR-009 adds one strict parser through which a
provider may propose a fixed registered tool and allow-listed input; it cannot
execute that tool or bypass validation and policy.

**Chain order.** `auto` mode tries Gemini, then OpenRouter, then mock. Requests
that look complex — long, or matching an analysis/design/debug vocabulary — go
to OpenRouter first, because a fallback after a slow primary would double the
latency. Each provider carries its own timeout (Gemini 20s, OpenRouter 45s) so a
hung primary hands over rather than blocking. Mock is the terminal fallback so
the user always receives an answer.

An orchestrated skill may supply a preferred provider when its product flow
declares a specific order. The hint applies only in `auto` mode: Trivia uses
Serper evidence, then prefers Gemini, then OpenRouter, with mock still terminal.
An explicitly pinned `gemini`, `openrouter` or `mock` mode remains authoritative.

**Mock stays the default.** The stored `provider` setting ships as `mock`, so a
fresh install performs no network egress until the user opts in. The `provider`
setting is constrained to known ids; an arbitrary slug was previously accepted.

**Web search is confirmed by default.** `web.search` is `read` risk, because it
only reads — but running it sends the user's query to a third party, and a query
can contain sensitive text. `docs/SECURITY.md` requires external communication
to be confirmed by default, so confirmation is `configurable` via
`webSearchConfirm`, defaulting to on. The approval card states that the query
leaves the machine.

**Retrieved content is fenced.** Anything with the `context` role is wrapped in
an explicit untrusted-content block telling the model to treat it as data. A
closing fence inside the content is neutralised so retrieved text cannot escape
its own block.

**Credentials stay in the main process.** They are read from `.env.local` /
`.env` by `electron/config.cjs`, never sent over IPC, never written to the JSON
store, never placed in an audit event. The renderer learns only booleans. Errors
are passed through a redactor before reaching a log or the UI. Keys travel in
request headers, never in a URL, so they cannot leak through a logged endpoint.

## Consequences

- Switching provider in Control Center takes effect on the next message; the
  chain is rebuilt per call rather than pinned at startup.
- Tests inject `fetch` and never reach the network.
- Enabling a live provider means conversation content leaves the machine. That
  is inherent to a cloud provider and is not separately confirmed per message —
  the opt-in is choosing a non-mock provider. This is called out here because it
  is a real privacy consequence, not an oversight.
- The complexity heuristic is a routing hint, never a security decision. Both
  providers are equally untrusted to the runtime.
- A skill-level provider preference is also a routing hint, not access to a
  provider credential. Skills and tool results never receive provider secrets.
- A plain env file is still a development convenience. Production credentials
  belong in OS-backed secret storage — unchanged from `docs/SECURITY.md`.
