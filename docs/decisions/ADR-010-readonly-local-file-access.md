# ADR-010: Read-only local file access boundary

Status: Proposed — requires Claude security review before acceptance

## Context

Fifteen of the twenty installed skills declared tools that did not exist, so
they reported `unavailable` and could never run. The most-demanded were local
file tools: `file.search` is declared by four skills and `file.readText` by
three. `file-finder`, `local-content-search` and `ai-research` are blocked
entirely on them, and four more skills need them alongside write verbs.

This is the first tool domain that reads the user's own documents. It differs
from every existing tool in one way that drives the whole design: the tools
read data the user did not type and did not choose per-request, and that data
then flows to a cloud provider. `web.fetch` has the same property, but a public
URL is public. `~/Documents` is not.

Two failure modes matter, and they are independent:

1. **Escape.** A path that resolves outside the folders the user allowed —
   through `..`, through a symlink or Windows junction, or through a string
   prefix that merely looks contained (`docs-private` starts with `docs`).
2. **Sensitivity.** A file that is genuinely inside an allowed folder but must
   still never be read. `~/Documents/.env` is contained and catastrophic.

A design that only solves escape would happily hand a provider an API key.

## Decision

**Read-only, by construction.** The domain registers `file.search`,
`file.stat`, `file.readText`, `file.searchContent` and `file.reveal`. No tool
writes, moves, renames or deletes. `file.delete` remains registered and
disabled. Write verbs (`file.move`, `file.rename`, `folder.create`,
`file.save`) are deliberately deferred to a separate ADR and ticket, so that
adding them is a conscious decision rather than a diff to an existing module.

**Roots are an allow-list, fixed at composition.** Access is confined to the
user's Documents, Downloads and Desktop, resolved from `app.getPath()` in
`main.cjs` and closed over by the capability handed to the tool module. No
discovered tool module can widen them, and no tool input names a root. A root
that does not exist on the machine is skipped rather than fatal.

**Containment is checked after resolution, not before.** Every path is
`path.resolve`d and then `fs.realpathSync.native`'d, and the result is compared
against realpath'd roots with `path.relative`. Resolving first is what makes
`..` and symlinks harmless; using `path.relative` rather than string prefixes is
what makes `docs-private` fail. Directory traversal skips symlinks and
junctions outright rather than resolving them per entry — following them would
require re-checking containment on every entry and can be made to cycle.

**Sensitivity is enforced separately and last.** Credential-shaped names are
refused inside allowed roots: `.env*`, `id_rsa`, `*.pem`, `*.key`, `*.pfx`,
`*.kdbx`, `.npmrc`, `.netrc`, `credentials`, `secrets.*`, and local database
files. Credential and VCS directories — `.ssh`, `.aws`, `.gnupg`, `.kube`,
`.git` and friends — are never descended into; a git config can carry a token
in a remote URL. The list matches on *shape*, not location.

**Reads are bounded and typed.** 128KB per file, 50,000 characters returned,
50 results, 20,000 entries scanned, 8 levels deep. A file containing a NUL byte
is refused as binary rather than returned as garbage that would be forwarded to
a provider.

**Read content is untrusted.** `file.readText` and `file.searchContent` return
`trust: 'untrusted-external'`, the same label `web.fetch` uses, so content
reaches a provider through the fenced `context` role. A document is exactly as
capable of carrying a prompt injection as a web page.

**Reading content is confirmed by default.** `file.search`, `file.stat` and
`file.reveal` are automatic — a file *name* is low-stakes and confirming every
search would make the feature unusable. `file.readText` and
`file.searchContent` are `confirmation: 'configurable'` behind a new
`fileReadConfirm` setting, default **on**. The reasoning is that reading a file
is an egress decision, not a local read: the text leaves the machine for a
provider. This mirrors `webFetchConfirm`.

**Errors do not distinguish missing from forbidden.** A path outside the roots
and a path that does not exist both report the same generic failure, so the
tools cannot be used to probe for the existence of files they may not read.

**`file.reveal` passes the same gate.** Opening Explorer changes nothing on
disk, but it is a visible side effect rather than a pure read, so it is
`risk: 'safe-write'`. Its path is resolved through the same containment check,
so it cannot be used to point Explorer outside the roots.

## Consequences

`file-finder`, `local-content-search` and `ai-research` become available.
`task-planner`, `file-organizer`, `document-assistant` and
`presentation-builder` move closer but still need calendar or write tools.

Write verbs are specified in `docs/decisions/ADR-016-file-write-boundary.md`.
This ADR remains the containment and sensitivity gate those writes reuse.

The user cannot ask Rata about a file outside three folders, and cannot read
their own `.env` through Rata even deliberately. Both are intended. Widening
either is a policy change requiring review, not a configuration tweak.

Search is capped, so on a large Documents folder results are a bounded sample
rather than an exhaustive answer, and `truncated` is reported so the agent can
say so.

## Alternatives rejected

**A deny-list of dangerous folders instead of an allow-list of safe ones.**
Anything not yet enumerated would be readable, and the enumeration can never be
complete on a machine the developers have not seen.

**Resolving symlinks during traversal instead of skipping them.** Correct in
principle, but it requires a containment check per entry and is vulnerable to
link cycles. Skipping costs the rare legitimate linked folder and removes a
whole class of bug.

**Treating file reads as ordinary local reads with no confirmation.** The
skills describe themselves as read-only and the risk vocabulary agrees, but
that framing ignores where the text goes afterwards. Provider egress is the
boundary that matters.
