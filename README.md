const db = globalThis.__B44_DB__ || { auth:{ isAuthenticated: async()=>false, me: async()=>null }, entities:new Proxy({}, { get:()=>({ filter:async()=>[], get:async()=>null, create:async()=>({}), update:async()=>({}), delete:async()=>({}) }) }), integrations:{ Core:{ UploadFile:async()=>({ file_url:'' }) } } };

# Sinsinnati Key Connection

React/Vite frontend for the Sinsinnati Key Connection website.

## Prerequisites

1. Clone the repository.
2. Navigate to the project directory.
3. Install dependencies: `npm install`.

## Run Locally

Run the frontend development server from the project root:

```bash
npm run dev
```

## Self-Hosted Deployment

Build the frontend with `npm run build` and serve the generated `dist` directory
with a static web server configured to fall back to `index.html` for client-side routes.
The frontend expects a same-origin application API at `/api`; provide the API
through a self-hosted backend or reverse proxy. If the API is unavailable, requests
fail with an explicit error and authenticated routes remain locked.

The API contract is:

- `GET /api/auth/me`, plus `POST /api/auth/{login,register,verify-otp,resend-otp,reset-password-request,reset-password}`
- `GET|POST|PATCH|DELETE /api/entities/:entity` and `POST /api/entities/:entity/search`
- `POST /api/functions/:name` for application actions such as booking, AI, uploads, and checkout
- `POST /api/uploads` for multipart file uploads
- `GET /api/auth/provider/:provider` for optional OAuth login

External services required by the backend are Supabase (database/auth), Stripe
(checkout/webhooks), Resend (email), OpenAI (AI assistant), and the NHTSA VIN
decoder. Configure credentials and service URLs in the backend only; no secrets
are needed by the static frontend.

## Docs & Support

## Self-hosted Proxmox deployment

Build with `npm run build` and serve `dist` from a static web server with an
`index.html` fallback. Set `VITE_API_BASE_URL` only when the API is hosted on a
different origin; otherwise proxy `/api` to your backend. Copy `.env.example`
to the backend's environment configuration and keep all service keys server-side.
The required route and payload contract is documented in
`server/API_CONTRACT.md`.

The backend needs Supabase credentials for data/auth, Stripe credentials for
checkout and webhooks, Resend credentials for email, and an OpenAI key for AI
analysis. NHTSA VPIC is used for public VIN data. OAuth provider credentials
are optional. Browser camera access requires HTTPS and explicit user permission.
The thermal UI can accept a supported thermal camera stream or image, but an
ordinary camera only provides visible-light frames; it cannot measure
temperature, continuity, shorts, or opens. Electrical conclusions require
appropriate measurement hardware and technician review.
Use the issue tracker for project-specific deployment and backend questions.
