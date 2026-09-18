# Haven Engineering Contract

This is the shared instruction set for coding agents operating in this repository.

## Read first

Before modifying code, read:

- `AGENT_WORKBOOK.md` and record active work before material changes
- `docs/CODEMAP.md`
- `docs/ARCHITECTURE.md`
- `docs/SECURITY.md`
- `docs/TASKS.md`

Preserve other workbook entries. Never record secrets or sensitive resident/staff content. Major boundary changes require an ADR under `docs/decisions/`.

## Product boundaries

1. Haven is a Next.js App Router web application; keep routes under `src/app/`.
2. Keep reusable product UI under `src/components/` and domain/data helpers under `src/lib/`.
3. Prefer owned shadcn/ui primitives and Tailwind tokens over one-off component styling.
4. Validate create/update inputs with Zod before mutating client state.
5. Treat the bundled records as fictional demonstration data.
6. Do not add real resident or staff data to fixtures, screenshots, logs, or commits.
7. Do not hardcode API keys, access tokens, passwords, or tenant secrets.
8. Browser storage is demo persistence, not an approved store for real care records.
9. Add or update tests whenever behaviour changes.
10. Update docs when a public contract or user-visible capability changes.
11. Run `npm run verify` before handoff and use `npm run dev` for browser smoke tests.
12. Do not edit generated `.next/` output or dependencies under `node_modules/`.

## Definition of done

A task is done only when it builds, lint/type checks and tests pass, relevant failure states are handled, docs stay consistent, and key user flows are browser-verified.
