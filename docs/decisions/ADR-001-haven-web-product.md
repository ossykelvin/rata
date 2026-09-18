# ADR-001 — Replace the desktop assistant with Haven

**Status:** Accepted  
**Date:** 2026-09-18

## Context

The repository previously shipped a Windows Electron assistant. The Haven project requires a care-home CQC compliance SaaS dashboard, and retaining both runtimes would leave conflicting build scripts, dependencies, tests, documentation, and product boundaries.

## Decision

Haven becomes the only active product and runtime:

- Next.js App Router replaces Electron/Vite.
- Tailwind CSS and owned shadcn-style components provide the UI system.
- Recharts provides dashboard visualisations.
- Zod validates client mutations.
- React context plus versioned localStorage supports prototype persistence.
- Superseded desktop runtime, skills, assets, tests, and documentation are removed.

## Consequences

The repository has one build and one product identity. Existing Rata features are no longer available from this branch. Browser persistence remains demonstration-only; production care records require a separate authenticated server architecture.
