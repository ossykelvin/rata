# ADR-016: Local file write boundary

Status: Proposed — requires Claude security review before acceptance

Supersedes nothing. Completes the write half that ADR-010 deferred. Organize
verbs (`file.move`, `file.rename`, `folder.create`) are specified in
`docs/decisions/ADR-017-file-organize-writes.md`.

## Context

ADR-010 registered read-only local file tools and deliberately left write
verbs for a later ticket, so adding them would be a conscious decision rather
than a diff to an existing module. `skills/document-assistant/` and
`skills/presentation-builder/` have declared `document.create`,
`presentation.create`, `presentation.render` and `file.save` since the pack
landed. Skills carry no authority (ADR-003); those ids staying unregistered is
what kept both skills `unavailable`.

Two failure modes matter, and they are independent of the read-side ones:

1. **Escape on a path that does not exist yet.** `realpath` cannot run on the
   target. A second, looser containment check that skipped realpath would
   become the real policy the moment it disagreed with `resolveWithinRoots`.
2. **Creation of something that should never exist.** A contained
   `~/Documents/payload.ps1` or `~/Documents/.env` is still a credential or an
   executable. Overwriting an existing file without asking is a silent
   destructive write.

v1 also has to say what a "document" is. Shipping `.docx` / `.pptx` would
mean a new native dependency and a parser attack surface. Markdown and
self-contained HTML are text, require no library, and can be opened on
Windows without granting Word or PowerPoint any authority.

## Decision

**Containment resolves the parent, not the target.** `file.save` splits the
input into parent directory + basename and runs the *parent* through the
existing `resolveWithinRoots`. The roots list stays Documents, Downloads and
Desktop. `resolveWithinRoots` is not widened: a missing target would make
realpath fail closed as `not-found`, so teaching that gate to skip realpath
would weaken every reader. Basename is checked separately: no path separator,
no `..`, no NUL, no drive letter, no colon, no reserved Windows device name
(CON, PRN, AUX, NUL, COM1–9, LPT1–9, with or without extension), and no
leading or trailing dots or spaces (Windows silently strips those and would
make the name we checked different from the name that landed).

**Denied names and executable extensions are refused on write.** The
read-side `isDeniedName` list still applies: Rata cannot create `.env`,
`id_rsa`, `credentials` or `.npmrc` inside an allowed root. A deny-list of
executable and script suffixes is refused case-insensitively (`.exe`, `.dll`,
`.com`, `.scr`, `.bat`, `.cmd`, `.ps1`, `.psm1`, `.vbs`, `.vbe`, `.js`,
`.jse`, `.wsf`, `.wsh`, `.msi`, `.msp`, `.reg`, `.lnk`, `.cpl`, `.hta`,
`.jar`, `.sys`, `.drv`, `.inf`, `.chm`). Creating a script is not a document
save.

**Overwrite always confirms.** Default is refuse. `overwrite: true` is
required to replace an existing file. When it is set, `PolicyEngine` confirms
even if `fileWriteConfirm` is false. Both skills declare
`confirm_before_overwrite`; always confirming exceeds that rather than
weakening it. A configurable setting that could turn overwrite silent would
be a destructive write with the risk label of a safe one.

**Writes are atomic.** Content is written to a temp file in the same
directory, then renamed onto the target. A failed write removes the temp in
`finally`, so a crash cannot leave a `.rata-write-*.tmp` next to the user's
files. Content is capped at 5MB, must be a string, and has NUL bytes stripped.

**Generation and saving are separate tools.** `document.create`,
`presentation.create` and `presentation.render` are pure transforms with
`risk: 'read'` and `confirmation: 'never'`. They do not touch the disk.
`file.save` is the only write, `risk: 'safe-write'`, `confirmation:
'configurable'` behind `fileWriteConfirm` (default on). Splitting them means
a model can draft a memo without writing it, and the approval card for a save
names a resolved absolute path, a byte count, and whether it overwrites.

**v1 ships Markdown/HTML, not .docx/.pptx.** `document.create` produces
Markdown, optionally HTML. `presentation.render` produces a self-contained
HTML deck. This is not Word and not PowerPoint. There is no `docx` or
`pptxgenjs` dependency. Every interpolated value is HTML-escaped; raw HTML,
`javascript:` / `data:` URLs and `onerror=` attributes are not accepted.
Unescaped deck text is stored XSS.

`file.delete` stays registered and disabled. `file.move`, `file.rename` and
`folder.create` are specified in ADR-017.

## Consequences

`document-assistant` and `presentation-builder` become available. The user
still cannot write outside three folders, cannot create an executable or a
credential-shaped file, and cannot overwrite without asking. Widening any of
those is a policy change requiring review.

A rendered deck is an `.html` file the user opens in a browser. It is not a
`.pptx`. Skill-facing tool descriptions say so in plain language; the skill
files themselves are not edited (ADR-003).

## Alternatives rejected

**Hand-rolling a second containment check for non-existent targets.** It
would start identical to `resolveWithinRoots` and drift. The weaker of the
two would become the effective policy.

**Widening `resolveWithinRoots` so missing paths pass.** Readers rely on
realpath-before-compare. Skipping realpath for writers would create a second
mode inside the one gate ADR-010 asked every filesystem domain to share.

**Letting `fileWriteConfirm: false` skip overwrite confirmation.** Overwrite
destroys the previous bytes. A setting named "confirm saves" is not consent
to replace a file the user already has.

**In-place `writeFile` onto the target.** A crash mid-write leaves a torn
file with no original and no temp. Same-directory rename is the smallest
atomic option Node gives us; Windows still has to unlink-then-rename when
replacing, which is recorded rather than pretended to be POSIX-atomic.

**A document/presentation library.** New native dependency, parser surface,
and a promise of `.docx`/`.pptx` that this MVP would not honestly keep.
Markdown and HTML are text, and `file.save` already refuses executables.
