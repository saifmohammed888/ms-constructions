# MS Constructions — Site tracker

Single-owner web app for a Bangalore residential build: expenses, tasks, contacts, and documents. Built from the Construction Tracker PRD (Next.js, Postgres, Google Drive + Calendar).

## Local run

```bash
cp .env.example .env.local
# set SESSION_SECRET, ENCRYPTION_KEY, and APP_PASSWORD_HASH
npm run hash-password -- 'your-password'   # paste the hash into APP_PASSWORD_HASH
npm install
npm run dev
```

Open http://127.0.0.1:43123

Without `DATABASE_URL`, the app uses a local Postgres-compatible file database in `./data`. That is for development only.

**Local preview password** (if you use the sample hash in this environment): `site2026`

## Vercel deploy

1. Connect this GitHub repo in Vercel.
2. Create a Neon Postgres database (Vercel Storage → Neon) and set `DATABASE_URL`.
3. Set environment variables (see `.env.example`):
   - `APP_PASSWORD_HASH` — from `npm run hash-password -- '…'`
   - `SESSION_SECRET` — long random string
   - `ENCRYPTION_KEY` — 64 hex characters (32 bytes)
   - `APP_URL` — `https://your-app.vercel.app`
   - `CRON_SECRET` — random; Vercel Cron sends it as `Authorization: Bearer …` if you configure it, or set the same value in Vercel Cron headers
   - `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` — Google Cloud OAuth client
4. Google OAuth redirect URI: `https://your-app.vercel.app/api/auth/google/callback`
5. OAuth scopes: `drive.file` and `calendar.events`, offline access.

Hobby Cron: weekly Sunday 20:00 IST (`30 14 * * 0` UTC) hits `GET /api/cron/backup`.

## Restore

If the app is gone, documents and calendar events remain in Google. Structured data is in Drive `Backups/backup-YYYY-MM-DD.zip`.

```bash
# unzip, then:
DATABASE_URL=… npm run restore -- ./backup.json
```

Then set the same env vars on a fresh Vercel deploy.

## First-run

Sign in → Settings: project name, total budget, per-category budgets → Connect Google (creates `Construction – [project name]` with Legal, Drawings, Approvals, Receipts, Photos, Contracts, Misc, Backups).
