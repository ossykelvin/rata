# MVP Validation Status

## Validated in the current Windows workspace

- `npm run check:node` checks every CommonJS file under `electron/`, `packages/`, and `tests/`.
- `npm test` covers policy, tool contracts, IPC validation, calculator behavior, skill registry/loader/router behavior, and the mock-agent integration.
- `npm run typecheck` passes with strict TypeScript settings.
- `npm run build` produces the Vite renderer bundle.
- `npm run pack:win` produces `release/win-unpacked`; its ASAR contains the renderer, Electron runtime, contract modules, skill runtime, manifest, and skill prompts.
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
3. Overlay can be dragged.
4. `open notepad` opens Notepad.
5. `open calculator` opens Calculator.
6. `copy Hello Rata to clipboard` requests approval.
7. Allow copies the text; Cancel does not.
8. Appearance settings persist after restart.
9. Activity page records the actions.
10. `what is 36 * 14?` returns `504` without approval.
11. Control Center Skills page lists installed skills and marks unregistered tools.

The unpacked build currently uses Electron's default application icon. Add a production `.ico` asset before installer release.
