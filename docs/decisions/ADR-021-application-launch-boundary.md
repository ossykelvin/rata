# ADR-021: Application launch boundary

Status: Proposed — requires Claude security review before acceptance

Supersedes nothing. Leaves `system.openApp` (Notepad/Calculator, no
arguments) in place. Does not extend ADR-009's planner enum or the
communicator intent enum.

## Context

`skills/app-launcher/` has declared `app.find`, `app.launch` and `app.focus`
since the skill pack landed. None were registered, so the Skills page reported
the pack unavailable. A skill is prompt data (ADR-003) and cannot invent tools.

Launching an arbitrary executable is code execution. If a model-supplied
string ever reaches `execFile`/`spawn` as a file path, arguments, or a script
body, the tool is a shell. The same shape as screen-capture handles (ADR-020)
and file-access roots (ADR-010) is required: the adapter discovers what exists,
mints an opaque id, and the tool schema accepts only that id.

The skill JSON names this risk `local-write`. The tool registry's risk enum is
`read | safe-write | external-write | destructive` and does not include
`local-write`. Inventing a new class would fail registration. This ADR uses
`safe-write` for `app.launch` and `app.focus`, and makes launch confirmation
`always` so the weaker label cannot turn into a silent spawn.

## Decision

**The model never names an executable.** `app.find` / `app.launch` / `app.focus`
accept a catalog id (SHA-256 of the canonical resolved target) or, for find, a
name query. Paths, UNC, `..`, appended suffixes, and any `args` field are
refused at `validateInput`. There is no args field on the schema at all.

**The catalog is the allow-list.** `electron/app-catalog.cjs` enumerates `.lnk`
files under the machine and user Start Menus, resolves each shortcut, and
keeps only targets that survive every rejection check. A path that is not in
the catalog cannot be launched. Discovery skips symlinks and junctions the
same way `walkRoots` does, and caps depth and entry count.

**Rejection happens at catalog-build time.** Bad entries never exist to be
selected:

- Target extension must be `.exe`. `.msi`, `.bat`, `.cmd`, `.ps1`, `.vbs`,
  `.vbe`, `.js`, `.jse`, `.wsf`, `.scr`, `.reg`, `.hta`, `.lnk`, `.com` and
  `.pif` are refused.
- Name or target matching `/uninstall|repair|setup|installer/i` is refused.
- Interpreters and LOLBins are refused by target basename, case-insensitive,
  including `cmd.exe`, `powershell.exe`, `pwsh.exe`, `wscript.exe`,
  `cscript.exe`, `mshta.exe`, `rundll32.exe`, `regsvr32.exe`, `regedit.exe`,
  `reg.exe`, `msiexec.exe`, `certutil.exe`, `bitsadmin.exe`, `curl.exe`,
  `wmic.exe`, `installutil.exe`, `msbuild.exe`, `conhost.exe` and `wt.exe`.
  A shortcut labelled "System Tools" that points at `powershell.exe` is
  refused because of the target, not the label.
- The target must exist and be a regular file, not a symlink.

**Shortcut resolution does not interpolate caller input into a script.**
Production parses the MS-SHLLINK binary (`LinkInfo` local base path / Unicode
path) in-process. Tests inject `resolveShortcut`. UWP / shell-item links
without a local path are skipped (out of scope).

**Launch uses `execFile` with a fixed empty argument array and `shell: false`.**
Never `exec`, never `cmd /c`, never PowerShell `-Command`, never `-Verb RunAs`.
The launched file is the catalog's resolved target, looked up again at execute
time so a refresh between approval and execution cannot swap it. No elevation.

**The resolved path belongs only on the approval card.** `describeInput` names
the application and the target path. Tool return values, summaries and audit
records carry the app identity and outcome, not the path, not window titles,
not document names.

**`app.focus` does not start a second instance.** It looks for a running
process whose executable path equals the catalog target and focuses that
window. If focusing is not possible it returns an honest failure. Process
listing and `SetForegroundWindow` use repo-owned PowerShell `-File` scripts
copied to `extraResources` (PowerShell cannot read `app.asar`). The only
variable is a PID validated as a positive integer and passed as a separate
argument; nothing caller-derived is interpolated into a script body.

**`system.openApp` is unchanged.** Notepad and Calculator stay on their own
allow-list with no arguments. `app.*` is a separate module with different ids.

**Planner and communicator enums are not extended.** ADR-009 still permits
only `system.openApp` with notepad/calculator. Communicator still cannot name
`app.launch`. Catalog launch is a registered tool the skill router can select,
not a model-authored shell.

## Consequences

- Application Launcher reports `ready` once the three ids are registered.
- Launch is `safe-write` + `always`. Focus is `safe-write` + `configurable`
  behind `appFocusConfirm` (default on). Find is `read` + `never`.
- Catalog is built once at startup and refreshed only through an explicit
  `refresh()`. Find/launch/focus do not rebuild it.
- v1 does not launch UWP/Store apps, does not pass arguments, does not "open
  this file with that app", and does not enumerate windows beyond focus.

## Out of scope

UWP / Microsoft Store apps, launch arguments, file-type associations,
elevation, and window enumeration beyond `app.focus`.
