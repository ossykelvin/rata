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
3. Overlay can be dragged by grabbing the character or the speech-bubble header. Use the Ask chip to open input; clicks on fully transparent pixels still pass through to the desktop. Minimize (−) collapses to a small icon you can drag; click the icon to restore. Close (×) removes the overlay from the screen without quitting. Rata stays in the notification area (Show hidden icons). Left-click the tray icon or choose Show Rata to bring the overlay back. Quit Rata from the tray to exit.
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
14. Click the overlay or Chat microphone to start dictation, speak, then click again to stop. Holding for half a second also stops on release. Escape cancels. The transcript fills the input; it is not sent until you submit. Character state becomes `listening` while the mic is down.
15. Permissions → Microphone off denies Chromium `media` permission in the main process and stops an in-flight Windows speech session. A leftover partial transcript already buffered from that session still fills the input. The renderer cannot bypass that setting.
16. Hold-to-talk uses Windows speech recognition in the main process, not Chromium's Google speech service. Transcripts fill the input. Spoken replies (TTS) are not wired yet.
17. Control Center → Skills shows **Filesystem Scan** as ready, with `filesystem.scan`, `filesystem.diskUsage` and `filesystem.hash` all listed as available.
18. Ask `find large files`. With **Confirm reading file contents** on, an approval card appears first and states that no file contents are read. Allow returns file names, relative paths and sizes from Documents, Downloads and Desktop, largest first, and says so is a partial picture when a cap was hit. Cancel returns nothing. No file *text* appears in the reply.
19. Ask `give me a storage health report`. The reply reports used/free/total capacity for the drive and no file names.
20. Ask `scan my C drive`. Rata must refuse the scope and say it can only inspect Documents, Downloads and Desktop. It must not walk `C:\`, `C:\Windows` or `C:\Program Files`, even if you approve the card. Same for a network path such as `\\server\share`.
21. Activity page records the scan as counts and a scope (for example `filesystem.scan: Scanned Documents: 412 file(s), 1.3 GB`) and **not** as a list of file names.
22. “Think critically about this…” loads the Critical Thinking skill prompt and answers through the provider chain (OpenRouter first in `auto` mode, then Gemini). It must not reply that the mock agent has no live provider. Mock remains the terminal fallback if live providers are unset or fail; `RATA_AI_PROVIDER=auto` (or a stored non-mock provider) is required for Gemini/OpenRouter.
23. In one session, a follow-up such as “what colour did I mention?” after “my favourite colour is teal” is answered with that earlier fact. `weather in Leeds` still runs the weather tool. Quitting Rata clears the transcript.
24. “Think critically about this…” loads the Critical Thinking skill prompt and answers through the provider chain (OpenRouter first in `auto` mode, then Gemini). It must not reply that the mock agent has no live provider. Mock remains the terminal fallback if live providers are unset or fail; `RATA_AI_PROVIDER=auto` (or a stored non-mock provider) is required for Gemini/OpenRouter.
25. “How much RAM do I have?” / “How much disk space is free?” use `system.info` and `system.storage`. Process summaries must not show command lines or window titles.
26. “Keep my PC awake for two hours” holds one sleep blocker and auto-releases. “Stop keeping the computer awake” is safe even if nothing was held. Quit Rata from the tray also releases the blocker.
27. Ask Rata to draft a memo and save it under Documents (or Downloads / Desktop). Control Center → Skills shows **Document Assistant** and **Presentation Builder** as ready. The save approval card names the resolved absolute path and the byte count. After Allow, the file exists as Markdown or HTML, not `.docx`. Cancel writes nothing.
28. Ask Rata to save `payload.exe` (or `.ps1` / `.bat` / `.js`) inside Documents. It must refuse. No new file appears in that folder. The same refusal applies to `.env`, `id_rsa` and `CON.txt`.
29. Save a file once, then ask Rata to save again to the same path. Without an explicit overwrite it must refuse and leave the original bytes. With overwrite requested, an approval card appears even if **Confirm saving files** is off, names the absolute path, and says it overwrites. Cancel leaves the original; Allow replaces it.
30. Ask Rata to turn notes into slides and render the deck. Open the saved HTML in a browser. Slide headings and bullets that contained `<script>`, `javascript:` or `onerror=` show as text, not as executable content. This is an HTML deck, not PowerPoint.
31. Ask Rata to create a folder under Documents (or Downloads / Desktop). Control Center → Skills shows **File Organizer** as ready. The parent folder must already exist; a missing parent is refused and no tree appears. A name that already exists is refused.
32. Ask Rata to move a file into that folder. After Allow, the file is gone from the old path and present at the new one. Ask it to rename a file in the same folder; a rename that points at a different folder is refused with an instruction to use move.
33. Ask Rata to move or rename a file onto `payload.exe` (or `.ps1` / `.bat` / `.js`) inside Documents. It must refuse. Directory contents are unchanged. The same refusal applies to `.env`, `id_rsa` and `CON.txt`.
34. Move or rename onto a path that already exists. Without an explicit overwrite it must refuse and leave both files. With overwrite requested, an approval card appears even if **Confirm saving files** is off, names the resolved absolute source and destination, and says it overwrites. Cancel leaves both files; Allow replaces the destination.

The Control Center window, Windows taskbar, and system tray use `public/24_dialog_avatar_reply.png`. Packaged Windows builds take the same file as `win.icon`.
