# Haven validation

## Automated

Run:

```bash
npm run verify
```

This executes ESLint, Vitest, strict TypeScript checking, and the production Next.js build.

## Browser smoke

Run `npm run dev`, open `http://localhost:3000`, and verify:

1. The dashboard loads with the blue sidebar, CQC KLOE cards, stats, area chart, and bar chart.
2. All nine sidebar routes load and active navigation follows the route.
3. Collapsing and expanding the desktop sidebar preserves the page.
4. The header bell opens Notifications and shows the live unread total.
5. Add one resident, staff member, audit, compliance check, incident, and asset; each appears immediately and updates its page stats.
6. Invalid/empty create forms remain open and show a validation error.
7. Search, status, KLOE, category, severity, type, and status-tab filters narrow their registers.
8. Notifications support mark-one-read, mark-all-read, delete, and All/Unread/Alerts/Warnings filters.
9. Refreshing preserves created records in localStorage.
10. Reports render line and pie charts and export a CSV summary.
