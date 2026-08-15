# REVIEW-001 — MVP architecture and security review

**Reviewer:** Claude (Opus 5) · **Date:** 2026-08-15 · **Commit reviewed:** `3bfc271`
**Scope:** `electron/`, `packages/contracts/`, `packages/agent-core/`, `packages/skills/`, `src/`, `index.html`

Every finding marked **CONFIRMED** was reproduced by executing the shipped modules, not inferred by reading. Reproduction snippets are in each finding.

## Verdict

The architecture is sound. Tool contracts are enforced at registration, destructive tools are denied at policy, skills carry no authority, approval inputs are captured at request time rather than re-supplied at approval time, and the audit log no longer records full user requests. Those are the hard parts and they are right.

Two defects are **allow-list bypasses of the same root cause**, and the Electron shell is missing three standard hardening controls. None is remotely exploitable today — the renderer is the only IPC caller and there is no untrusted content in the app yet. All five become serious the moment RATA-006 (email bodies) or RATA-008 (web pages) lands.

**Merge posture:** nothing currently in flight is blocked. H1–H5 must land before any lane that introduces externally-controlled content.

---

## H1 — Settings validator accepts inherited prototype keys · CONFIRMED

**File:** `packages/contracts/ipc-validation.cjs:21`
**Lane:** G (Claude) · **Blocks:** RATA-009

`validateSettingValue` looks up `settingValidators[key]` with no own-property check. `Object.prototype` members are inherited and truthy, so they resolve to a function and are then *called as the validator*:

```js
parseSettingChange({ key: 'constructor', value: { polluted: true } })  // ACCEPTED
parseSettingChange({ key: 'toString',    value: { polluted: true } })  // ACCEPTED
```

`settingValidators['constructor']` is `Object`; `Object({polluted:true})` returns a truthy object, so validation passes. The value then flows to `store.setSetting`, which assigns it blindly (`electron/store.cjs:49`), persists it to `rata-store.json`, and returns it through `getSettings()` — which is broadcast to every renderer.

Reproduced:

```
store.setSetting('constructor') SUCCEEDED
own key now present in getSettings(): true
```

`__proto__`, `valueOf`, `toLocaleString` and `hasOwnProperty` happen to throw and fail closed. That is luck, not design.

**Impact:** arbitrary key/value injection into persisted settings; store corruption; a `settings` object whose `constructor` is attacker-controlled is handed to renderer code. Not RCE.

**Fix (Lane G):**

```js
const hasValidator = Object.prototype.hasOwnProperty.call(settingValidators, key)
if (!hasValidator) throw new TypeError(`Unknown setting: ${String(key)}`)
```

Better: build `settingValidators` with `Object.create(null)`, or validate `key` against a frozen `SETTING_KEYS` array. Add defence in depth in `store.setSetting` — re-check membership before assigning. Add a regression test asserting `constructor` and `toString` are rejected.

---

## H2 — `system.openApp` allow-list bypassed by inherited keys · CONFIRMED

**File:** `electron/mvp-tools.cjs:29`
**Lane:** Codex (P0-2) · **Blocks:** RATA-005

Same root cause, higher-stakes location:

```js
if (typeof value.appName !== 'string' || !APP_ALLOW_LIST[value.appName]) throw ...
```

`APP_ALLOW_LIST['constructor']` is inherited and truthy, so the check passes for an application that is not in the allow-list. Reproduced:

```
appName=constructor  PASSED validation -> {"appName":"constructor"}
appName=toString     PASSED validation -> {"appName":"toString"}
appName=evil         rejected
```

Execution then reaches `spawnProcess(target.exe, ...)` with `target.exe === undefined`.

**Impact, stated precisely:** this is **not** arbitrary process execution today. Real `child_process.spawn(undefined, …)` throws `ERR_INVALID_ARG_TYPE`, which `MockAgent.execute` catches. But the allow-list — the control that decides which binaries Rata may launch — returns "allowed" for input it should reject, and that decision reaches `spawn()`. It becomes execution the moment any inherited property resolves to something with a string `.exe`, or the lookup shape changes.

`Object.freeze` does not help; frozen objects still inherit.

**Fix (Codex, in P0-2):**

```js
const APP_ALLOW_LIST = Object.freeze(Object.assign(Object.create(null), { notepad: …, calculator: … }))
```

or `Object.prototype.hasOwnProperty.call(APP_ALLOW_LIST, value.appName)`. Prefer a `Map`. Add a test asserting `appName: 'constructor'` is rejected. **Apply the same pattern to every allow-list added in Lanes D, E and F** — this is the template for `bridge/` process allow-lists.

---

## H3 — No navigation or window-open guards · Electron privilege boundary

**File:** `electron/main.cjs:45`, `:70` (both `BrowserWindow` creations)
**Lane:** Codex (P0-1) · **Blocks:** RATA-008

Neither window sets `setWindowOpenHandler` nor handles `will-navigate`. A renderer that is tricked into navigating — or any `window.open` — loads the target origin **into a window whose preload has already exposed `window.rata`**. That origin then holds the full privileged bridge: `agentMessage`, `approveAction`, `setSetting`.

This is the confused-deputy path in this codebase. `contextIsolation` and `sandbox` do not prevent it; they isolate the bridge's implementation, not its availability.

**Fix (Codex, in P0-1), for both windows:**

```js
const contents = win.webContents
contents.setWindowOpenHandler(() => ({ action: 'deny' }))
contents.on('will-navigate', (event, url) => {
  if (url !== win.webContents.getURL()) event.preventDefault()
})
```

Allow only the dev server origin in development and the packaged `file://` entry in production.

---

## H4 — IPC handlers do not validate the sender

**File:** `electron/main.cjs:126` (`registerIpc`)
**Lane:** Codex (P0-1)

Every `ipcMain.handle` ignores `event.senderFrame`. On its own this is low risk. Combined with H3 it completes the chain: hostile origin loaded into a Rata window → calls any privileged handler.

**Fix:** assert `event.senderFrame` matches an expected origin in a shared wrapper, so new handlers inherit the check rather than each remembering it. P0-1 modularizes IPC registration — put the check in the registration helper, not in each module.

---

## H5 — No Content-Security-Policy

**File:** `index.html:3`
**Lane:** Codex (P0-1) · **Blocks:** RATA-006, RATA-008

No CSP meta tag and no `onHeadersReceived` CSP. Today React escapes interpolated text and there are no `dangerouslySetInnerHTML`, `eval`, or `new Function` call sites — I checked, the renderer is clean. So there is no live XSS.

That changes when Lane E renders email bodies and Lane F renders page content. CSP is the control that keeps an injected `<script>` from reaching `window.rata`, and it must exist *before* those lanes land, not after.

**Fix:** add a restrictive CSP (`default-src 'self'`; no `unsafe-inline` in production) and verify the Vite dev server still functions under it.

---

## M1 — Pending approvals never expire and are unbounded · CONFIRMED

**File:** `packages/agent-core/mock-agent.cjs:101`
**Lane:** A (Codex, RATA-002)

`this.pending` is a `Map` with no TTL and no size cap. Reproduced with 5,000 unanswered requests:

```
pending approvals retained after 5000 unanswered requests: 5000
oldest approval still executable: true
```

**Impact:** unbounded main-process memory growth driven from the renderer, and — the security half — an approval requested hours ago remains executable indefinitely. A user who walks away and later clicks "Allow" on a stale card authorizes an action whose context is long gone.

**Fix:** TTL (5 minutes is reasonable) plus a hard cap with oldest-first eviction; prune on insert. Return the "expired" message that `approve()` already implements. Add tests for expiry and eviction.

---

## M2 — `ToolRegistry.get()` hands out the executor · CONFIRMED

**File:** `packages/agent-core/tool-registry.cjs:34`
**Lane:** G (Claude) with Codex

`CLAUDE.md` states tools must execute "through `ToolRegistry.execute()` so input validation cannot be skipped." `get()` returns the live tool object including `execute`, so that guarantee is convention, not structure. Reproduced:

```
get() returns execute fn: true
direct executor call bypassing validate(): {"summary":"s","message":"m"}
```

`MockAgent`, `registry.summarize` and the router all call `get()`. None currently abuse it.

**Fix:** add `describe(id)` returning metadata only (`id`, `description`, `risk`, `confirmation`, `confirmationSetting`) and migrate all metadata callers to it. Keep `execute()` as the only path to an executor. Low effort, closes the gap by construction rather than by discipline.

---

## M3 — Store does not validate settings loaded from disk

**File:** `electron/store.cjs:32`
**Lane:** G (Claude)

`load()` merges `parsed.settings` with no validation. `ADR-004` claims "defense-in-depth store validation", but validation exists only on the write path. A corrupted or hand-edited `rata-store.json` puts arbitrary values into memory and broadcasts them to renderers.

**Fix:** coerce each key through `validateSettingValue` on load, discarding invalid entries and falling back to the default. Update ADR-004 so the claim matches the code.

---

## M4 — Microphone gating is renderer-side only

**File:** `src/views/Overlay.tsx` (the `microphoneEnabled` check)
**Lane:** C (Cursor, RATA-004) · **Blocks RATA-004**

`microphoneEnabled` is checked in React before starting speech recognition. That is a UI affordance, not a boundary — `docs/SECURITY.md` says exactly this about renderer-side checks. There is no `session.setPermissionRequestHandler`, so the renderer can obtain media permission regardless of the setting.

**Fix (before RATA-004):** register a permission request handler in main that denies `media` when `microphoneEnabled` is false, and deny every permission not explicitly required.

---

## M5 — Approval preview will leak sensitive tool input

**File:** `packages/agent-core/mock-agent.cjs:111`
**Lane:** A (Codex) · **Blocks RATA-007**

```js
detail: id === 'clipboard.write' ? `Copy “${validatedInput.text}” …` : JSON.stringify(validatedInput)
```

Two problems. The clipboard branch interpolates up to 1,000,000 characters into an approval card. The fallback `JSON.stringify(validatedInput)` renders *whatever the tool's input is* — which for RATA-007 means mail bodies and recipients, and for a future auth tool could mean tokens.

`docs/SECURITY.md` requires external writes to preview recipients/subject/time. It does not permit dumping raw input.

**Fix:** move preview generation into the tool contract — an optional `describeInput(input)` returning a short redacted string, with a truncating generic fallback. Never `JSON.stringify` raw input into UI.

---

## Low

| # | File | Issue | Fix |
|---|---|---|---|
| L1 | `packages/skills/loader.cjs:25` | `loadPrompt` uses `path.resolve`, not the `resolveUnder` containment helper. Safe today only because the manifest was validated at load. | Re-check containment at read time. |
| L2 | `packages/skills/registry.cjs:7` | `resolveUnder` checks the lexical path; no `realpath`. A symlink under `skills/` escapes containment. | `fs.realpathSync` then re-check the prefix. |
| L3 | `electron/mvp-tools.cjs:88` | `file.delete` accepts any object as input. Unreachable — policy denies destructive first. | Validate a path when the tool is implemented. |
| L4 | `packages/skills/router.cjs:88` | `needsConfirmation` is advisory and correctly ignored by the policy engine. Risk is a future implementer treating it as authoritative. | Comment it as advisory; assert in a test that policy ignores it. |

---

## Architectural note — two risk vocabularies

Tools use `read` / `safe-write` / `external-write` / `destructive` (`packages/agent-core/tool-registry.cjs`).
Skills use `read-only` / `local-write` / `file-write` / `external-write` / `local-state` / `screen-read` / `mixed-read` / `none` (`skills.manifest.json`).

`router.cjs:82` already string-matches across both. Two overlapping vocabularies for the same concept is how a `file-write` skill eventually gets treated as a `safe-write` tool. Fold into one enum under RATA-009, or document the mapping explicitly and test it.

---

## What is already right

Worth recording so a later change does not undo it:

- Tool registration rejects incomplete security metadata, and external-write tools cannot set `confirmation: 'never'`.
- Policy fails closed for `configurable` — it confirms unless the setting is exactly `false`.
- Destructive tools are denied at policy even when their metadata requests confirmation.
- Approval executes the input captured at request time; the renderer cannot substitute input at approval time. This is the single most important control in the approval flow.
- Approval ids are `crypto.randomUUID()` and validated against a strict UUIDv4 pattern.
- The audit log records request length, not request content.
- Skill prompts are extracted by regex and never evaluated (`ADR-003` holds).
- `resolveUnder` correctly contains manifest paths to the project root.
- No `eval`, `new Function`, `dangerouslySetInnerHTML`, `shell.openExternal`, or renderer-side Node imports anywhere in the tree.

---

## Recommended order

1. **H1, H2** — one-line fixes each, plus tests. Same root cause; fix together.
2. **H3, H4, H5** — fold into P0-1 while the IPC boundary is already being modularized.
3. **M2, M3** — Lane G, alongside RATA-009.
4. **M1, M5** — Lane A, before RATA-002 ships an approval-generating provider.
5. **M4** — gate on RATA-004.
6. **L1–L4** and the vocabulary merge — opportunistic.
