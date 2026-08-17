# ADR-014: Read-only filesystem inventory boundary

Status: Proposed — requires Claude security review before acceptance

Supersedes nothing. Extends ADR-010 (read-only local file access) to bulk
metadata, volume capacity and file digests.

## Context

`skills/filesystem-scan/` has been installed since the skill pack landed, and it
declares three tools: `filesystem.scan`, `filesystem.diskUsage` and
`filesystem.hash`. None of them existed, so the Control Center Skills page
reported the skill `unavailable` with all three ids listed as missing. A skill is
declarative prompt data (ADR-003) and carries no authority, so it cannot reach
past the Tool Registry to supply what is not registered. The only way to unblock
it is to register the tools.

ADR-010 already established the read-only local file boundary for *one file at a
time*: name search, stat, bounded text read, content search, reveal. This ticket
is different in three ways that change the risk, not just the volume:

1. **It is bulk.** A single `file.stat` discloses one file the user named. An
   inventory discloses the *shape of the user's life* — every project name,
   client name, medical document and job application in three folders. The
   individual facts are the same class; the aggregate is not.
2. **It reads bytes without returning them.** A duplicate report needs a digest,
   and a digest needs the whole file read. That is the first place in the app
   where file contents are consumed without being returned, and the reason the
   contents are consumed has to be a property of the code, not of a comment.
3. **The skill's own prompt asks for a scope this app must refuse.** The
   declared trigger is *"Scan my C drive and tell me what is taking space"* and
   the declared confirmation is
   `confirm_if_scope_is_entire_system_or_protected`.

That last point is the interesting one and is addressed explicitly below.

## Decision

**Containment is not re-implemented.** `electron/filesystem-scan.cjs` calls
`resolveWithinRoots` from `electron/file-access.cjs` for every path. There is
exactly one place in the app that decides which paths Rata may touch. A second
validator would drift from the first and the *weaker* of the two would become
the effective policy. To make that reuse possible without either module owning
the other, `normalizeRoots` and `resolveWithinRoots` now take the `fs`
implementation as an optional parameter; behaviour with the real `node:fs` is
unchanged.

**A stricter syntax gate runs in front of it, never a looser one.** Before any
path reaches `realpath`, `assertScannablePath` refuses non-strings, empty and
whitespace-only input, NUL bytes, anything over 4096 characters, device
namespaces (`\\.\`, `\\?\`), UNC shares (`\\server\share`), drive-relative and
relative paths, and any remaining `..` segment. `resolveWithinRoots` would
already neutralise `..` and symlinks by resolving before comparing; the value of
refusing earlier is that a device handle is never opened and a dead network
share can never block the scan.

**Roots are the same three folders as ADR-010.** Documents, Downloads and
Desktop, resolved from `app.getPath()` in `main.cjs` and closed over by the
capability. `userFolderRoots()` is now a single function in the composition root
feeding both `createFileAccess` and `createFilesystemScan`, so there is one
answer to "which folders may Rata look at" rather than two that can diverge.
`C:\Windows`, `C:\Program Files`, other system directories and bare drive roots
are outside the allow-list and are refused for scanning and hashing.

The module deliberately does **not** take `os` as a dependency. A tool module
that can read `os.homedir()` can derive its own roots, and a module that can
derive its own roots can widen them. Roots arrive from the composition root or
they do not exist.

**No tool returns file contents. Ever.** `filesystem.scan` returns a name, a
*relative* path, a size, a modified time and an is-directory flag. Nothing opens
a file. `filesystem.hash` opens a read-only handle, reads in 64KB chunks, folds
each chunk into the digest and discards it; it returns a hex digest string, a
byte count and a name. If a skill's phrasing implies reading content, that is
`file.readText` — a different tool with a different contract, already shipped.

Paths are returned relative to the scanned root and prefixed with the root's
folder name (`Documents\reports\q3.xlsx`). Absolute paths would put the
Windows user name into every row of output that may be sent to a provider, for
no benefit to the user, who knows where their own Documents folder is.

**Everything is capped, and truncation is reported.** Depth 6, 20,000 entries
visited, 200 entries returned, 50 folder aggregates, 15 seconds of wall clock,
and 16MB for a hash. A truncated result sets `truncated: true` and names the cap
that stopped it (`entry-budget`, `depth`, `time`, `result-limit`) so the agent
can say the picture is partial rather than presenting a sample as an answer.
Totals still count everything visited even when the returned list is trimmed.

Truncation is **deterministic**: directory entries are sorted before the walk,
and results are sorted largest-first with path as the tie-break. Without that,
"your ten largest files" would change between two identical runs for reasons the
user cannot see.

**A file above the hash cap is refused, not partly hashed.** A prefix digest is
indistinguishable from a whole-file digest to whoever receives it, and would
produce confident, wrong duplicate claims — which the skill's own prompt (rules
7 and 8) is trying to avoid. The cap is also re-checked against bytes actually
consumed, not just the size `stat` reported, so a file that grows mid-read
cannot exceed it.

**Sensitivity carries over from ADR-010, and is applied to the walk too.**
Credential-shaped names are not even inventoried: a name and a size is more than
this surface needs to disclose about `~/Documents/.env`. Credential and VCS
directories are never descended into. `filesystem.hash` refuses a
credential-shaped file for the same reason `file.readText` does.

**Names are sanitised before they leave the module.** A file name is
attacker-controlled text heading for a UI and possibly a provider prompt.
Control characters can forge line structure inside an untrusted-content fence,
and bidirectional overrides can make `invoice.txt.exe` render as
`invoice.exe.txt`. Both classes are stripped, and names are clamped to 260
characters.

**All three tools are `risk: 'read'` and `confirmation: 'configurable'` behind
the existing `fileReadConfirm` setting, default on.** No new setting is
introduced. `fileReadConfirm` already means "confirm before local file data
leaves the machine for a provider", and a bulk inventory of file names is at
least as revealing as the text of one file. Adding a second overlapping
storage-confirmation setting would give the user two switches for one decision
and make it possible to have one on and the other off.

This is deliberately *stricter* than ADR-010's own reasoning for
`file.search`, which is automatic because a targeted name lookup is low-stakes
and confirming every search would make the feature unusable. An unrequested
inventory of everything is a different act from looking for one named file.

**Scan output is untrusted input.** Results carry
`trust: 'untrusted-external'`, the same label `web.fetch` and `file.readText`
use. In this change the results reach the user's reply and do not pass through a
provider, so nothing new is fenced here; the label exists so that the first
stage which *does* forward them has to fence them with `fenceUntrusted`, exactly
like page or document text.

**Audit records counts, not a directory listing.** `MockAgent` builds its audit
detail from `result.summary`, so `summary` carries the scope and the totals only.
The per-file list lives in `message`, which is shown to the user and is not
copied into the activity log.

**Validation refuses a forbidden path before policy runs.** Containment is
checked inside `validateInput`, not only inside `execute`, because
`ToolRegistry.validate()` runs before `PolicyEngine.evaluate()`. A path the tool
would refuse anyway must never produce an approval card the user could say yes
to.

## The skill's declared scope, and what was not implemented

The skill declares `confirm_if_scope_is_entire_system_or_protected` and its
first trigger asks to scan `C:\`. Implementing that literally would mean walking
system directories and treating "the user approved a prompt" as sufficient
authority to do so.

That is not implemented, and it is not deferred pending a better prompt. Whole-
volume and protected-location scanning is **refused**, not confirmed:
`C:\Windows`, `C:\Program Files` and bare drive roots are outside the
allow-list and fail closed with a clear message. Refusing is strictly stronger
than confirming, so the declared policy is satisfied by exceeding it rather than
by weakening the boundary.

The honest consequence is that *"scan my C drive"* will report that Rata can only
inspect Documents, Downloads and Desktop. The skill's `SKILL.md` states
"Default to user folders or explicitly selected locations", which is what
shipped; only the first example trigger overstates the scope. The skill files
were not edited, because the tool ids had to match them character for character
and rewriting a trigger to match an implementation is the wrong direction of
travel.

Two further items in the skill's contract are also not delivered by this change,
and the skill's declared `background_capable: true` is currently a claim the
runtime cannot honour:

- **Cancellable background jobs** (`SKILL.md` rule 2). There is no job manager;
  this is RATA-SKILL-004. A scan is bounded by the time and entry caps instead,
  so it cannot run away, but the user cannot cancel one mid-flight.
- **Configured exclusions** (rule 4). Only the ADR-010 denied-name and
  denied-directory lists are honoured. A user-editable exclusion list is a
  settings surface and a separate ticket.

## Consequences

`filesystem-scan` reports `ready`; ready skills go from 9 to 10 of 21 installed.

The privileged tool surface grows from 12 to 15 tools. That list is pinned in
`tests/tool-composition.test.cjs` and must only move in a commit that says why.

Duplicate detection is a two-step flow by design: size and metadata from
`filesystem.scan` produce *candidates*, and `filesystem.hash` confirms them one
file at a time. There is no bulk-hash tool, so a duplicate sweep across a large
folder is many confirmed calls rather than one. That is the intended trade — a
bulk hash tool would read every file in three folders on a single approval.

The Permissions page still describes this capability under its existing
"Confirm reading file contents" row rather than a row of its own. PR #70 is
open against that file; adding a dedicated row belongs in a follow-up rather
than a conflicting edit.

## Alternatives rejected

**A second confirmation setting, e.g. `filesystemScanConfirm`.** Two switches
for one decision, with a state where one is on and the other off. `fileReadConfirm`
already names the boundary that matters (local file data leaving for a provider).

**Its own path validator inside the new module.** It would start identical to
`resolveWithinRoots` and end different, and the weaker one would silently become
the policy. Threading an injectable `fs` through the existing validator was the
smaller change and keeps one gate.

**Shelling out to PowerShell, `wmic` or `Get-PSDrive` for capacity.**
`fs.promises.statfs` gives totals directly on the supported Node version, so
there is no reason to add a process-spawning path to a read-only tool. There is
a test asserting these modules contain no `child_process`, `spawn`, `exec`,
`powershell`, `wmic` or `cmd.exe` reference at all.

**Returning a partial digest for an oversized file.** Cheap to implement and
actively harmful: it looks exactly like a full digest to the caller.

**Confirming whole-volume scans instead of refusing them.** A confirmation
prompt is not a substitute for an allow-list. The user cannot reasonably
evaluate "may I walk C:\" in a dialog, and the skill prompt asking for it is
model-adjacent text, not authority.
