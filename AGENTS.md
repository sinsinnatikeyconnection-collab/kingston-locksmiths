# AGENTS.md

## Project Context

This is a user-owned React/Vite application. Keep changes focused, preserve
existing conventions, and read `README.md` for setup and deployment assumptions.

## Key Files

- `src/`: frontend application source.
- `src/api/apiClient.js`: generic frontend client for the self-hosted `/api` contract.
- `vite.config.js`: Vite configuration.
- `.env.local`: local-only environment values; never commit secrets.

## Working Notes

- Use `npm run dev` for local frontend development.
- Keep backend credentials on the server; never expose service keys through Vite.
- Run the relevant checks from `package.json` before finishing code changes.
