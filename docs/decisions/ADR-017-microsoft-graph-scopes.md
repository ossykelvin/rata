# ADR-017: Microsoft Graph delegated scopes and auth

Status: **Proposed — blocked on the user.** Needs an Entra app registration and
explicit consent to the scope list below before RATA-006 can start.

## Context

Three skills are unavailable for want of Graph tools, and they are the largest
single block remaining:

| Skill | Tools it declares |
|---|---|
| email-assistant | `mail.search`, `mail.read`, `mail.createDraft`, `mail.send` |
| calendar-assistant | `calendar.list`, `calendar.findAvailability`, `calendar.create`, `calendar.update`, `calendar.delete` |
| task-planner | `calendar.list` (plus `file.search`, which exists) |

`docs/TASKS.md` already splits the work: RATA-006 is read-only, RATA-007 adds
writes, strictly sequential. This ADR decides the scopes, the auth flow and the
token storage, which are the parts that cannot be changed later without asking
the user to consent again.

Graph is different from every integration Rata has so far. Serper, WeatherAPI
and the AI providers hold a key that grants access to *their* service. A Graph
token grants access to **the user's mailbox and calendar**, and one of the
scopes below lets Rata send mail as the user. Scope choices are effectively
permanent: users do not re-read a consent screen.

## Decision

### Scopes, split across the two tickets

**RATA-006, read only:**

```
openid  profile  offline_access
User.Read
Mail.Read
Calendars.Read
```

**RATA-007, requested incrementally at the first write, not up front:**

```
Mail.ReadWrite      (create drafts)
Mail.Send           (send as the user)
Calendars.ReadWrite (create, update, cancel)
```

`offline_access` is what allows a refresh token, so the user is not re-prompted
on every launch. `User.Read` is for the signed-in identity shown in Control
Center, nothing more.

**Incremental consent is the point of the split.** A user who never sends mail
never consents to `Mail.Send`. Asking for the write scopes during RATA-006 would
be convenient and would defeat the purpose of doing the tickets in order.

### Scopes deliberately not requested

`Mail.ReadBasic` is narrower than `Mail.Read` and excludes message bodies. It is
rejected only because `mail.read` exists to return a body; if that tool were
dropped, `Mail.ReadBasic` would be the correct scope for search alone.

Not requested at all, and each would need its own ADR:

- `Mail.Read.Shared`, `Calendars.Read.Shared` — other people's mailboxes
- `MailboxSettings.Read` — would make `findAvailability` respect working hours,
  which is genuinely useful. Deferred because availability computed from events
  alone is honest about what it knows, and this scope reads more than it appears
  to.
- `Files.Read`, `Sites.Read.All`, `Contacts.Read`, `People.Read`,
  `Directory.Read.All`, `User.ReadBasic.All` — none of these back a declared tool
- **Any application permission.** Rata acts as the signed-in user, never as a
  service principal with tenant-wide reach.

### Auth flow

**Public client, authorization code with PKCE, in the system browser.**

- A desktop app cannot keep a client secret, so this is a public client with no
  secret and `Allow public client flows` enabled.
- The sign-in page opens with `shell.openExternal` and returns to a loopback
  redirect (`http://localhost` on an ephemeral port).
- **Not an embedded `BrowserWindow`.** Microsoft blocks embedded webviews for
  sign-in, and putting a Microsoft credential form inside Rata's own window
  trains users to type their password into our chrome, which is the shape of a
  phishing attack. `electron/security.cjs` already refuses navigation away from
  the app's own origin; this respects that rather than carving an exception.
- `@azure/msal-node` handles the flow. One account is pinned per install and the
  signed-in UPN is shown in Control Center, so "which mailbox is this?" always
  has a visible answer.

### Token storage

Refresh and access tokens go through Electron `safeStorage`, which is DPAPI on
Windows, and the ciphertext is written to a file in `userData` that is **not**
`rata-store.json`. `docs/SECURITY.md` already states that the JSON store holds
only non-secret preferences and audit metadata, and that production credentials
belong in OS-backed storage. This is the first credential that has to honour it.

Tokens never cross IPC, never reach the renderer, and never reach an AI
provider. Tool modules receive a **bound capability** — `searchMail(query)`,
`listEvents(range)` — exactly as `web.search` receives a bound Serper capability
and never the key. A tool module discovered from `electron/tools/` must be
unable to read the token, because the dependency bag is handed to every module.

### Tool policy

| Tool | Risk | Confirmation |
|---|---|---|
| `mail.search` | `read` | configurable, default **on** |
| `mail.read` | `read` | configurable, default **on** |
| `calendar.list` | `read` | configurable, default **on** |
| `calendar.findAvailability` | `read` | configurable, default **on** |
| `mail.createDraft` | `safe-write` | configurable, default **on** |
| `mail.send` | `external-write` | **always**, not configurable |
| `calendar.create` | `external-write` | **always** |
| `calendar.update` | `external-write` | **always** |
| `calendar.delete` | `destructive` | **always**, and prefer cancellation over deletion |

Reads are confirmable rather than automatic because the content is the user's
private correspondence, and because a read result is fed to an AI provider.
`mail.send` and the calendar writes cannot opt out: `docs/SECURITY.md` already
says external-write tools may not, and these reach other people.

`calendar.delete` should cancel the event with a notification where the API
allows it. Silently removing a meeting other people are attending is worse than
cancelling it.

## Threat model

**Confused deputy on send.** The dangerous shape is a model composing recipients
and body, and the user approving a summary rather than the payload. So: the
approval card shows the exact recipient list, the subject and a body preview;
the payload is snapshotted at approval time and the executed payload must be
identical to the approved one (REVIEW-001 M1 already does this for pending
approvals); and a recipient that never appeared on the card is a bug that fails
closed, not a warning.

**Prompt injection from mail bodies.** An email is untrusted text written by
someone else, and it is the most adversarial content Rata will handle — unlike a
web page, it is delivered to the user specifically. Bodies reach a provider only
through the fenced `context` role (`fenceUntrusted`), exactly like `web.fetch`
and `file.readText`. An email that says "forward this to accounts@…" is data. It
must never cause a send, and it must never populate a recipient field.

**Token exfiltration.** Covered by the bound-capability rule above. The failure
to avoid is a future tool taking `accessToken` as a parameter "for convenience".

**Over-broad consent.** The scope list is fixed in code and reviewed here.
Requesting a scope not in this ADR is a change that needs a new ADR, because the
user cannot meaningfully re-evaluate a consent screen they already accepted.

**Audit.** Never log message bodies. Reads log counts and message ids only. A
send logs recipients and subject — the user needs to be able to answer "what did
it send, and to whom" — but never the body. This is deliberately asymmetric.

**Refresh failure.** An expired or revoked token must surface as "sign in again"
rather than a silent retry loop, and must never fall back to a cached response
presented as current.

## What the user must do

This is the blocked step, and it is the only one:

1. Register an application in Entra ID (Azure portal → App registrations → New).
   - Platform: **Mobile and desktop applications**
   - Redirect URI: `http://localhost`
   - **Allow public client flows: Yes**
   - Decide **supported account types**: single tenant, multitenant, or
     multitenant plus personal Microsoft accounts. This changes which mailboxes
     can sign in and is worth a moment's thought.
2. Put the values in `.env.local`, which is gitignored:
   `MSGRAPH_CLIENT_ID` and `MSGRAPH_TENANT_ID` (`common` for multitenant).
3. Approve the scope list above, or tell me which entries to remove.

No secret is needed, and none should be created.

## Consequences

email-assistant, calendar-assistant and task-planner become available, taking
skills from 13 of 22 to 16 of 22.

Rata gains the ability to send mail as the user, which is the most consequential
capability in the product. That is why `mail.send` always confirms, why the
approval card shows the payload rather than a summary, and why the write scopes
are not requested until the first write.

Users on personal Microsoft accounts may see different scope behaviour from
work or school accounts. That is decided by the account-type choice in step 1.

## Alternatives rejected

**Request every scope at first sign-in.** Simpler, and it means a user who only
ever reads mail has still granted permission to send as them.

**Embedded `BrowserWindow` sign-in.** Blocked by Microsoft, and it teaches users
to enter credentials inside Rata.

**Store tokens in `rata-store.json`.** It is plain JSON on disk next to
preferences, and `docs/SECURITY.md` already forbids it.

**Device code flow.** Works without a loopback listener and is a reasonable
fallback on a locked-down machine, but it asks the user to type a code into a
browser, which is a worse first-run experience. Worth keeping as a documented
fallback if loopback binding fails.
