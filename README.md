# SKM Zagłębie website

Source for `https://skm-zaglebie.pl`, including the public website and the authenticated Members → Hangar application.

## Production resources

- Cloudflare Worker: `skm-cf`
- D1 binding: `DB` (`skm-members`)
- KV binding: `MEDIA`
- Workers AI binding: `AI`
- Static Assets binding: `ASSETS`

The deployed secrets and account-specific variables are intentionally not stored in Git. The Worker expects `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `FB_PAGE_ACCESS_TOKEN`, and `ADMIN_EMAIL` in the Cloudflare environment. Existing production variables are preserved by `keep_vars`.

## Safety

Do not deploy from an incomplete checkout. A production backup must include the active Worker version, D1 export, all KV media objects, and live static assets. Database dumps, sessions, member records, uploaded photos, `.dev.vars`, and Wrangler caches must never be committed.

The GitHub `main` branch is connected to an automatic Cloudflare production deployment. Treat every push to `main` as a production release. Worker version preview URLs are disabled to avoid exposing discarded preview assets.

`schema/production.sql` contains schema only—no production rows or private member data.

## Database migrations

Apply numbered migrations in order before deploying Worker code that depends on them. Migration `0004_model_photos.sql` is additive: it creates the three-photo table and backfills every existing `models.cover_key` as photo position 0. The Worker continues updating `cover_key` for compatibility with the previous production version, which makes a staged rollout and rollback safe.
