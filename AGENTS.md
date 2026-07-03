# AGENTS.md

## Cursor Cloud specific instructions

BrainX ERP is a **frontend-only** app (Vite + React + TypeScript + shadcn/ui + Tailwind). There is no local backend to run — it talks to a **hosted Supabase** project whose credentials are committed in `.env` (`VITE_SUPABASE_URL`, anon key, etc.). Supabase Edge Functions under `supabase/functions/` are deployed to that hosted project; you do not run them locally.

- **Package manager:** use `npm` (multiple lockfiles exist — `package-lock.json`, `pnpm-lock.yaml`, `bun.lock` — but `npm install` is the working, README-endorsed path). `pnpm-workspace.yaml` contains placeholder text and is not a reliable pnpm setup.
- **Scripts** (see `package.json`): `npm run dev` (Vite dev server, **port 8080**), `npm run build`, `npm run lint`, `npm run test` (vitest, run-once) / `npm run test:watch`.
- **Lint:** `npm run lint` runs but reports a large number of **pre-existing** errors across `src/` and `supabase/functions/` (mostly `@typescript-eslint/no-explicit-any`). These are not environment problems.
- **Tests:** `npm run test` — most tests pass, but 2 test files fail for pre-existing reasons (`src/__tests__/anvisa-monitoring.test.ts` has literal `\n` in its source, and `src/hooks/__tests__/use-entidade-upsert.test.ts` imports a missing `./use-supabase`). Not caused by setup.
- **Quick end-to-end / hello-world:** on `/auth`, use the yellow **"Entrar na Demo"** card (account `demo@brainxerp.com`). Fill name/email/phone + consent → "Acessar Demonstração" to land on `/dashboard` with pre-loaded demo data. Note the in-app banner: demo data resets daily at 04:00, and NF-e emission / emails / payments are disabled in demo mode.
