# Haven code map

| Path                               | Purpose                                                                                |
| ---------------------------------- | -------------------------------------------------------------------------------------- |
| `src/app/layout.tsx`               | Root metadata, global styles, and client data provider                                 |
| `src/app/[[...slug]]/page.tsx`     | App Router entry for all dashboard URLs                                                |
| `src/components/haven-app.tsx`     | Responsive navigation shell and page selection                                         |
| `src/components/pages/`            | Dashboard, checks, residents, staff, audits, reports, incidents, assets, notifications |
| `src/components/create-dialog.tsx` | Six validated add/schedule/report dialogs                                              |
| `src/components/data-provider.tsx` | Shared client state and versioned local persistence                                    |
| `src/components/shared.tsx`        | Page headers, stats, search, filters, badges, empty states                             |
| `src/components/ui/`               | Owned shadcn-style UI primitives                                                       |
| `src/lib/mock-data.ts`             | Fictional UK care-home demonstration records and chart series                          |
| `src/lib/schemas.ts`               | Zod runtime validation for mutable records                                             |
| `src/lib/metrics.ts`               | Derived dashboard metrics                                                              |
| `src/lib/types.ts`                 | Domain types                                                                           |
| `tests/`                           | Validation and metric behaviour tests                                                  |

## Main flow

```text
route → shell → product page → provider → schema → state/localStorage → live stats and table
```
