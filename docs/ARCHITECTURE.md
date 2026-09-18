# Haven architecture

## Runtime

Haven is a Next.js App Router application. The current release is a client-side demonstration: there is no server database or external care-record integration.

```text
src/app route
  → HavenApp shell
  → page component
  → HavenDataProvider
  → Zod-validated create action
  → React state
  → versioned localStorage snapshot
```

## Source boundaries

- `src/app/`: root layout, global theme, and the catch-all App Router entry.
- `src/components/haven-app.tsx`: responsive shell, sidebar, route selection, and header notification state.
- `src/components/pages/`: one product page per operational area.
- `src/components/ui/`: owned shadcn-style primitives.
- `src/components/create-dialog.tsx`: validated create flows for six record types.
- `src/components/data-provider.tsx`: client state, persistence, notification mutations, and immediate record insertion.
- `src/lib/`: domain types, schemas, mock data, metrics, and helpers.
- `tests/`: schema and derived-metric behaviour.

The provider sits above the page shell in the root layout, so client-side navigation preserves state. The storage payload is checked for the expected top-level shape before use. Every form is parsed with its specific Zod schema before mutation.

## Routing and design system

The optional catch-all route renders the common application shell. Sidebar links expose stable URLs for all nine sections while avoiding duplicate shell markup.

Tailwind CSS v4 supplies theme tokens and responsive utilities. UI primitives follow the shadcn ownership model and use Radix for accessible dialog/label behaviour. Recharts provides line, area, bar, and pie visualisations.

## Future backend boundary

Authentication, multi-home tenancy, an audited database, role-based access control, attachment storage, and real CQC/provider integrations are deliberately out of scope. They must replace—not wrap—the browser persistence layer before Haven stores real care data.
