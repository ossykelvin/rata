# ADR-017: File organize writes

Status: Proposed — requires Claude security review before acceptance

Supersedes nothing. Extends ADR-016 with `folder.create`, `file.move` and
`file.rename`. Does not change `file.save` or the document/presentation
generation tools.

## Context

ADR-016 registered `file.save` and left organize verbs out of scope on
purpose. `skills/file-organizer/` has declared `folder.create`, `file.move`
and `file.rename` since the pack landed. Skills carry no authority (ADR-003);
those ids staying unregistered is what kept the skill `unavailable`.

The containment problem is the same as save: a destination may not exist yet,
so it cannot be handed to `resolveWithinRoots` (realpath would fail closed as
`not-found`). The extra risks are different:

1. **Rename becoming an undeclared move.** A `name` that is actually a path
   would relocate a file without going through `file.move`.
2. **Executable drop via rename.** Moving `notes.txt` onto `payload.exe` is a
   malware-drop primitive even though no bytes were invented.
3. **Surprise directory trees.** Recursive `mkdir` would let Rata create a
   nested path the user never saw.
4. **Silent cross-volume copy.** `fs.rename` across volumes becomes
   copy-then-delete. A partial copy plus a deleted source is data loss.
5. **Directory relocation.** Moving a folder can walk a tree out of the
   allow-list if bounds are not re-checked on every descendant.

## Decision

**Same gate, same roots, same basename rules as `file.save`.** Destinations
that do not exist yet split parent + basename. The parent goes through
existing `resolveWithinRoots`. The basename is checked by
`assertWritableBasename`: no separator, no `..`, no NUL, no colon or drive
letter, no reserved Windows device name, no leading or trailing dots or
spaces, no denied name, no denied directory name, no executable or script
extension. The roots list stays Documents, Downloads and Desktop.
`resolveWithinRoots` is not widened to skip realpath.

**v1 is files-only for move/rename and folders-only for `folder.create`.**
Moving or renaming a directory is refused. File Organizer's v1 path is
`folder.create` then `file.move` of a file into that folder. Directory move
would need recursive containment of every descendant and is a later ticket.

**`folder.create` is non-recursive and fail-closed if the name exists.** The
parent must already exist. Intermediate parents are not created. A folder that
already exists is refused rather than treated as success, so the user can see
the collision. No files are created inside the new folder.

**`file.rename` cannot change directories.** The destination directory is the
source directory. A new name that is a path, or a destination whose parent is
not the source parent, is refused with an instruction to use `file.move`.

**`file.move` requires an existing destination directory when moving into a
folder.** A destination that already exists as a directory receives the source
basename. A destination that does not exist is treated as a file path whose
parent must exist (created via `folder.create` first). Cross-root moves are
allowed only when both source and destination resolve inside the allow-listed
roots.

**Same-volume rename only.** The operation is `fs.rename`. Cross-volume
(`EXDEV`, or a different drive-letter root) fails closed. There is no
copy-then-delete fallback in v1. Documents, Downloads and Desktop are
normally the same user-profile volume.

**Denied-name sources may be moved out of a dangerous name; destinations may
not be dangerous.** `resolveWithinRoots` still refuses denied names for
readers. Organize sources pass `{ allowDeniedName: true }` so a Desktop
`id_rsa` can be renamed to a safe name. The destination still goes through
`assertWritableBasename`, so Rata cannot create or move-to `.env`, `id_rsa`,
`.npmrc`, or an executable suffix. Denied directories (`.ssh`, `.git`, …)
still refuse the source: organizer is not a way to pick files out of those
trees. Containment is unchanged; only the sensitivity check on an existing
source basename is skipped.

**Overwrite always confirms.** Default is refuse. `overwrite: true` is
required to replace an existing destination file. `PolicyEngine` then confirms
even if `fileWriteConfirm` is false, the same rule ADR-016 uses for
`file.save`. The approval card names the resolved absolute source and
destination and says whether it overwrites.

**Confirmation otherwise reuses `fileWriteConfirm`.** All three tools are
`risk: 'safe-write'`, `confirmation: 'configurable'` behind the existing
setting (default on). A third overlapping switch would let one write family
be silent while another still asked.

**`file.delete` stays registered and disabled.** These verbs do not add
deletion, recursive trees, or cross-volume copy.

## Consequences

`file-organizer` becomes available. The user still cannot write outside three
folders, cannot create or move-to an executable or credential-shaped name,
cannot overwrite without asking, cannot mkdir a surprise tree, and cannot
relocate a directory. Widening any of those is a policy change requiring
review.

`file.rename` remaining a same-directory name change keeps the approval card
honest: a move is always `file.move`.

## Alternatives rejected

**Hand-rolling a second containment check for non-existent destinations.**
Rejected in ADR-016 and rejected here for the same reason.

**Copy-then-delete across volumes.** A failed copy plus an unlinked source is
silent data loss. Fail closed and say so.

**Recursive `mkdir`.** Convenient for "put this in `2024/invoices/`", and also
how a model creates a tree the user never approved. Parent-must-exist is the
smaller v1.

**Directory move.** Correct only with a recursive bound check. Files into a
new folder is the skill's actual v1 loop.

**Letting `file.rename` accept a path in another folder.** That is `file.move`
with a different name. Two verbs that both relocate files would split the
audit trail.

**Refusing to touch a denied-name source at all.** That would strand `id_rsa`
on Desktop. Moving it to a safe name is organizer work; keeping the dangerous
name, or reading it, is not.
