# MVP Validation Status

## Validated in the current Windows workspace

- `npm run check:node` checks every CommonJS file under `electron/`, `packages/`, and `tests/`.
- `npm test` covers policy, tool contracts, IPC validation, calculator behavior, skill registry/loader/router behavior, and the mock-agent integration.
- `npm run typecheck` passes with strict TypeScript settings.
- `npm run build` produces the Vite renderer bundle.
- `npm run pack:win` produces `release/win-unpacked`; its ASAR contains the renderer, Electron runtime, contract modules, skill runtime, per-skill metadata fragments, and skill prompts.
- `npm install` reports no known dependency vulnerabilities.

Run all non-interactive checks with:

```powershell
npm run verify
```

## Manual Windows smoke test

The Electron GUI still requires a manual interactive smoke test. Run:

```powershell
.\scripts\bootstrap-windows.ps1
```

or double-click:

```text
START_RATA_DEV.bat
```

Then verify:

1. Control Center opens.
2. Transparent Rata overlay appears.
3. Overlay can be dragged by grabbing the character or the speech-bubble header. Use the Ask chip to open input; clicks on fully transparent pixels still pass through to the desktop.
4. `open notepad` opens Notepad.
5. `open calculator` opens Calculator.
6. `copy Hello Rata to clipboard` requests approval.
7. Allow copies the text; Cancel does not.
8. Appearance settings persist after restart.
9. Activity page records the actions.
10. `what is 36 * 14?` returns `504` without approval.
11. Control Center Skills page lists installed skills and marks unregistered tools.
12. Overlay and Control Center character follow agent states (`idle`, `listening`, `thinking`, `awaiting_approval`, `working`, `success`, `error`, `sleeping`). Idle shows `public/rata-concept.png`; other states swap images. A missing file falls back to the letter-mark silhouette.
13. A long overlay reply stays inside the 360×470 window: the Rata/state header stays visible, the message body scrolls vertically, long URLs wrap, and the avatar plus quick input remain usable. Short replies still look compact.
14. Hold the overlay or Chat microphone to dictate. Release to stop. Escape cancels. The transcript fills the input; it is not sent until you submit. Character state becomes `listening` while the mic is down.
15. Permissions → Microphone off denies Chromium `media` permission in the main process. The renderer cannot bypass that setting.
16. If this Chromium build has no Speech Recognition API, the mic explains that speech recognition is unavailable. Spoken replies (TTS) are not wired yet.

The Control Center window, Windows taskbar, and system tray use `public/24_dialog_avatar_reply.png`. Packaged Windows builds take the same file as `win.icon`.
