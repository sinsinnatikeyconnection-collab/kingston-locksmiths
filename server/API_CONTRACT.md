# Self-hosted API contract

The static frontend sends same-origin requests to `/api` (or to
`VITE_API_BASE_URL` plus `/api`). A self-hosted backend or reverse proxy must
implement the following routes:

- `GET /auth/me`
- `POST /auth/login`, `/auth/register`, `/auth/verify-otp`,
  `/auth/resend-otp`, `/auth/reset-password-request`, `/auth/reset-password`
- `GET /auth/provider/:provider` for optional OAuth
- `GET|POST|PATCH|DELETE /entities/:entity`
- `POST /entities/:entity/search`
- `POST /functions/:name`
- `POST /uploads` accepting multipart form data with a `file` field

`/functions/:name` actions used by the UI include `decodeVin`, `aiService`,
`createBooking`, `createMailIn`, `createVinUnlock`, `create-checkout`,
`notifyContact`, `emergencyDispatch`, `transferCertificate`,
`translateContent`, `logSystemHealth`, and `pingSearchEngines`.

The backend owns all secrets and integrations. `decodeVin` may proxy NHTSA VPIC;
AI uses OpenAI when configured; payment uses Stripe; email uses Resend; data
and authentication use Supabase. Return JSON errors with an appropriate HTTP
status and an `error` string. The frontend will show failures instead of
silently treating unavailable services as successful.

Camera and thermal frames are captured in the browser only after explicit
permission. Upload or AI analysis is opt-in; do not persist frames by default.

This repository includes a minimal dependency-free reference server at
`server/index.mjs`, started with `npm run api`. It implements auth, entities,
VIN decoding, OpenAI analysis, and health/translation placeholders. Add object
storage upload handling, Stripe checkout/webhooks, Resend email, and OAuth
provider callbacks before enabling those production features.
