# Haven security model

## Current release

Haven is a frontend demonstration with fictional data. It does not authenticate users, call a care-record system, or send records to a backend.

## Data handling rules

- Never commit real resident, relative, staff, health, safeguarding, or incident data.
- Never treat localStorage as an approved production care-record store.
- Never hardcode credentials or secrets.
- Validate all mutable form input before state changes; current create flows use Zod.
- Keep mock data clearly fictional and avoid realistic contact identifiers.
- Do not add analytics that capture form contents, table rows, or URLs containing record identifiers.
- Screenshots used for development must contain only the bundled demonstration records.

## Browser persistence

The `haven-care-data-v1` localStorage item exists solely so prototype changes survive refresh. The loader checks the expected top-level array shape and falls back to bundled data when parsing fails. This is corruption resistance, not a security boundary.

## Requirements before real deployment

Real care data requires authenticated server-side persistence, tenant isolation, role-based access control, encryption, retention controls, immutable audit trails, backup/recovery, DPIA review, and explicit handling for UK GDPR special-category data. Browser-only persistence must be removed before that point.
