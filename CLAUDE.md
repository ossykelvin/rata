# Haven Project Guide

Start with `AGENTS.md`; it is authoritative. Then read the workbook, code map, architecture, security model, tasks, and relevant ADRs. Record active work before material changes and update the workbook at handoff.

## Commands

```bash
npm install
npm run verify
npm run dev
```

## Review priorities

- Keep the App Router and client-state boundaries simple.
- Check create flows for runtime validation and immediate metric updates.
- Review tables and dialogs for keyboard and screen-reader accessibility.
- Treat localStorage as demonstration persistence only.
- Never place genuine care records, staff records, or secrets in source or test fixtures.
- Keep docs and implementation consistent when capabilities change.
