# ADR-017: Microsoft Graph delegated scopes and auth

Status: **Proposed — blocked on the user.** Needs an Entra app registration and
explicit consent to the scope list below before RATA-006 can start.

Amended once after review: mail reads narrowed to `Mail.ReadBasic`,
`MailboxSettings.Read` added, and sending mail and deleting calendar events
removed from v1. See "Amendments" at the end for what changed and why.

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
token grants access to **the user's mailbox and calendar**. Scope choices are
effectively permanent: users do not re-read a consent screen.

## Decision

### Scopes

**RATA-006, read only:**

```
openid  profile  offline_access
User.Read
Mail.ReadBasic
Calendars.Read
MailboxSettings.Read
```

**RATA-007, requested incrementally at the first draft, not at sign-in:**

```
Mail.ReadWrite       (create drafts)
Calendars.ReadWrite  (create and update events)
```

**`Mail.Send` is not requested at all.** Rata drafts into the mailbox; the user
sends from Outlook.

`offline_access` allows a refresh token so the user is not re-prompted on every
launch. `User.Read` is for the signed-in identity shown in Control Center.

### Scopes deliberately not requested

- **`Mail.Send`** — removed in v1. Sending as the user is the highest-consequence
  capability in the product and it is not needed for drafting.
- **`Mail.Read`** — `Mail.ReadBasic` is used instead. It excludes message bodies,
  attachments and, per current Graph documentation, `bodyPreview` as well.
  RATA-006 must confirm the exact exclusion list against current docs, because
  it decides what `mail.search` results can show.
- `Mail.Read.Shared`, `Calendars.Read.Shared` — other people's mailboxes
- `Files.Read`, `Sites.Read.All`, `Contacts.Read`, `People.Read`,
  `Directory.Read.All`, `User.ReadBasic.All` — none back a declared tool
- **Any application permission.** Rata acts as the signed-in user, never as a
  service principal with tenant-wide reach.

### Three interactions that would otherwise defeat these choices

These are the reason this section exists rather than a plain list.

**1. `Mail.ReadWrite` re-grants body access.** There is no draft-only mail scope
in Graph; creating a draft requires `Mail.ReadWrite`, which includes full read
of message bodies. So the `Mail.ReadBasic` narrowing holds **only while RATA-007
is not deployed**. Once drafting ships, the token can read bodies again, whatever
`mail.read` chooses to return.

Three honest ways to handle that, and RATA-007 must pick one explicitly rather
than discovering it:

  a. **Accept it.** `Mail.ReadBasic` is a real narrowing for the read-only phase,
     and RATA-007 widens it. Say so on the consent prompt.
  b. **Drop `mail.createDraft` too.** Then no `Mail.ReadWrite` is ever requested
     and the narrowing is permanent. email-assistant becomes search and triage
     only.
  c. **Keep `Mail.ReadWrite` but hold the line in code**, with `mail.read`
     never returning a body. Weaker, because the scope is the real boundary and
     a future tool could simply read one.

This ADR does not decide (a) versus (b); it requires RATA-007 to state which.

**2. Removing a tool is not the same as removing a capability.** A skill reports
unavailable if *any* declared tool is missing, so simply not implementing
`mail.send` and `calendar.delete` would leave email-assistant and
calendar-assistant blocked — the opposite of the point.

Both are therefore **registered and disabled**, following the existing
`file.delete` precedent: the tool exists, declares its risk, and its executor
throws. The skills become available, the capability does not exist, and no scope
backs it.

**3. `Calendars.ReadWrite` permits deletion at the API level.** There is no
create-and-update-only calendar scope. Refusing `calendar.delete` is therefore a
code-level restriction, not a scope-level one. That is weaker than removing
`Mail.Send`, and this ADR states it plainly rather than implying the token
cannot delete.

### Auth flow

**Public client, authorization code with PKCE, in the system browser.**

- A desktop app cannot keep a client secret, so this is a public client with no
  secret and `Allow public client flows` enabled.
- Sign-in opens with `shell.openExternal` and returns to a loopback redirect
  (`http://localhost` on an ephemeral port).
- **Not an embedded `BrowserWindow`.** Microsoft blocks embedded webviews for
  sign-in, and putting a Microsoft credential form inside Rata's own window
  trains users to type their password into our chrome, which is the shape of a
  phishing attack. `electron/security.cjs` already refuses navigation away from
  the app's own origin; this respects that rather than carving an exception.
- `@azure/msal-node` handles the flow. One account is pinned per install and the
  signed-in identity is shown in Control Center.

**Supported account types: multitenant, including personal Microsoft accounts.**
Two consequences RATA-006 must verify rather than assume:

- `MailboxSettings.Read` is a work/school concept. Personal accounts are likely
  to reject it or return nothing useful, so `calendar.findAvailability` must
  degrade to inferring from events rather than failing when working hours are
  unavailable.
- Scope behaviour and consent text differ between account types, so the sign-in
  path needs testing on both a work account and an outlook.com account.

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

| Tool | Risk | Confirmation | Notes |
|---|---|---|---|
| `mail.search` | `read` | configurable, default **on** | Metadata only under `Mail.ReadBasic` |
| `mail.read` | `read` | configurable, default **on** | Headers and metadata; **no body** in v1 |
| `calendar.list` | `read` | configurable, default **on** | |
| `calendar.findAvailability` | `read` | configurable, default **on** | Degrades gracefully without working hours |
| `mail.createDraft` | `safe-write` | configurable, default **on** | Writes a draft; never sends |
| `mail.send` | `external-write` | n/a | **Registered and disabled.** No scope requested |
| `calendar.create` | `external-write` | **always** | |
| `calendar.update` | `external-write` | **always** | |
| `calendar.delete` | `destructive` | n/a | **Registered and disabled** |

Reads are confirmable rather than automatic because the content is the user's
private correspondence, and because a read result is fed to an AI provider.
`calendar.create` and `calendar.update` cannot opt out: `docs/SECURITY.md`
already says external-write tools may not, and they reach other people.

## Threat model

**Confused deputy on external writes.** With `mail.send` gone, the remaining
external writes are calendar create and update, which notify attendees. The
approval card shows the actual attendee list, title and time; the payload is
snapshotted at approval time and the executed payload must be identical to the
approved one (REVIEW-001 M1 already does this); an attendee that never appeared
on the card is a bug that fails closed.

**Prompt injection from mail.** An email is untrusted text written by someone
else, and it is the most adversarial content Rata will handle — unlike a web
page, it is delivered to the user specifically. Everything retrieved reaches a
provider only through the fenced `context` role (`fenceUntrusted`). An email
subject saying "add me to your 3pm" is data. It must never populate an attendee
field, and with `Mail.Send` absent it cannot cause a send at all.

Dropping body access materially reduces this surface: a subject line is a much
smaller injection payload than a full HTML body.

**Token exfiltration.** Covered by the bound-capability rule above. The failure
to avoid is a future tool taking `accessToken` as a parameter "for convenience".

**Over-broad consent.** The scope list is fixed in code and reviewed here.
Requesting a scope not in this ADR is a change that needs a new ADR, because the
user cannot meaningfully re-evaluate a consent screen they already accepted.

**Audit.** Never log message bodies — trivially satisfied in v1, since none are
retrieved. Reads log counts and message ids. Calendar writes log the title,
time and attendee count.

**Refresh failure.** An expired or revoked token must surface as "sign in again"
rather than a silent retry loop, and must never present a cached response as
current.

## What the user must do

This is the blocked step, and it is the only one:

1. Register an application in Entra ID (Azure portal → App registrations → New).
   - Platform: **Mobile and desktop applications**
   - Redirect URI: `http://localhost`
   - **Allow public client flows: Yes**
   - Supported account types: **Accounts in any organizational directory and
     personal Microsoft accounts**
2. Put the values in `.env.local`, which is gitignored:
   `MSGRAPH_CLIENT_ID`, and `MSGRAPH_TENANT_ID=common`.
3. Approve the scope list above.

No secret is needed, and none should be created.

## Consequences

email-assistant, calendar-assistant and task-planner become available, taking
skills from 13 of 22 to 16 of 22 — because `mail.send` and `calendar.delete` are
registered and disabled rather than absent.

**Rata cannot send mail and cannot delete calendar events.** Those are the two
capabilities most likely to cause harm from a misinterpretation, and neither is
needed for the assistant to be useful: it drafts, and the user sends.

**email-assistant is weaker than its description suggests.** Without body
access it can search, list and triage by subject and sender, but it cannot
summarise the contents of a message. Its `SKILL.md` must say so, or the skill
will promise something it cannot do — the same failure as telling the user they
have PowerPoint when they have HTML.

Personal-account users may not get working-hours-aware availability.

## Alternatives rejected

**Request every scope at first sign-in.** Simpler, and it means a user who only
ever reads mail has still granted permission to send as them.

**Embedded `BrowserWindow` sign-in.** Blocked by Microsoft, and it teaches users
to enter credentials inside Rata.

**Store tokens in `rata-store.json`.** Plain JSON on disk next to preferences,
and `docs/SECURITY.md` already forbids it.

**Device code flow.** Works without a loopback listener and is a reasonable
fallback on a locked-down machine, but it asks the user to type a code into a
browser, which is a worse first run. Keep as a documented fallback if loopback
binding fails.

**Dropping `mail.send` and `calendar.delete` entirely rather than disabling
them.** It would leave both skills permanently unavailable, since a skill needs
every tool it declares.

## Amendments

Amended after review, before acceptance:

| Change | Effect |
|---|---|
| `Mail.Read` → `Mail.ReadBasic` | No message bodies. Smaller injection surface, weaker email-assistant |
| Added `MailboxSettings.Read` | Working-hours-aware availability on work accounts |
| Removed `Mail.Send` | Rata cannot send mail. `mail.send` registered and disabled |
| Removed calendar deletion | Rata cannot cancel or remove events. `calendar.delete` registered and disabled |
| Account types fixed | Multitenant including personal Microsoft accounts |
