# GCP Cloud Run Deployment Guide
### For NestJS (Backend) + Next.js (Frontend) + Cloud SQL (PostgreSQL)

Based on real deployment experience — includes all gotchas and fixes.

---

## Architecture Overview

```
GitHub
  ├── push to main/backend/** → GitHub Actions → Cloud Run (NestJS backend)
  └── push to main/frontend/** → Vercel auto-deploy (Next.js frontend)

User → Vercel (Next.js) → Cloud Run (NestJS) → Cloud SQL (PostgreSQL)
                                    ↑
                              Secret Manager
                           (DATABASE_URL, JWT_SECRET, etc.)
```

**Why Vercel for frontend?**
Vercel is built by the Next.js team — App Router, server components, and image optimization work with zero config. Only use Cloud Run for the frontend if your org mandates everything stays on GCP.

---

## Prerequisites

- Node.js 20+
- `gcloud` CLI installed and authenticated
- PostgreSQL instance (Cloud SQL)
- GitHub repository
- Vercel account (for frontend)

---

## Phase 1 — GitHub Setup

### 1. Initialize and push your repo

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
git branch -M main
git push -u origin main
```

### 2. Root-level `.gitignore`

Even if you have per-app `.gitignore` files in `frontend/` and `backend/`, add a root-level one for monorepo-level files:

```
.env
.DS_Store
*.log
```

> ✅ Per-app `.gitignore` files are fine and the recommended pattern for monorepos.

---

## Phase 2 — GCP Project Setup

### 3. Set your existing GCP project

```bash
gcloud auth login
gcloud config set project YOUR_PROJECT_ID

# Find your project ID if unsure
gcloud projects list
```

> ⚠️ **Gotcha:** Always use your existing project ID consistently in ALL commands. Never mix project IDs — everything (Artifact Registry, secrets, service accounts, Cloud SQL) must be in the same project.

### 4. Enable required APIs

```bash
gcloud services enable \
  run.googleapis.com \
  sqladmin.googleapis.com \
  secretmanager.googleapis.com \
  artifactregistry.googleapis.com \
  cloudbuild.googleapis.com
```

---

## Phase 3 — Cloud SQL (PostgreSQL)

### 5. Create the instance

```bash
gcloud sql instances create YOUR_DB_INSTANCE_NAME \
  --database-version=POSTGRES_16 \
  --tier=db-f1-micro \
  --edition=ENTERPRISE \
  --region=us-central1 \
  --storage-auto-increase \
  --backup-start-time=02:00
```

> ⚠️ **Gotcha:** GCP now defaults to `ENTERPRISE_PLUS` edition which doesn't support `db-f1-micro`. Always explicitly pass `--edition=ENTERPRISE` for cost-effective deployments.

> ⚠️ **Gotcha:** If you get "instance already exists", delete it first:
> ```bash
> gcloud sql instances delete YOUR_DB_INSTANCE_NAME
> ```

### 6. Create database and user

```bash
gcloud sql databases create YOUR_DB_NAME --instance=YOUR_DB_INSTANCE_NAME

gcloud sql users create YOUR_DB_USER \
  --instance=YOUR_DB_INSTANCE_NAME \
  --password=YOUR_STRONG_PASSWORD
```

> ⚠️ **Gotcha:** If your password contains special characters like `@`, `#`, `!`, you must **URL-encode** them in the connection string. For example, `@` becomes `%40`:
> ```
> postgresql://user:password%40with%40ats@localhost/dbname
> ```
> Failing to do this causes cryptic `Authentication failed` errors even when credentials are correct.

### 7. Note your connection name

```bash
gcloud sql instances describe YOUR_DB_INSTANCE_NAME --format="value(connectionName)"
# Output: YOUR_PROJECT_ID:us-central1:YOUR_DB_INSTANCE_NAME
```

---

## Phase 4 — Secret Manager

Store sensitive values in Secret Manager — never hardcode in Cloud Run env vars.

### 8. Create secrets

```bash
# URL-encode special characters in password before storing!
echo -n "postgresql://USER:PASSWORD@localhost/DBNAME?host=/cloudsql/PROJECT:REGION:INSTANCE" \
  | gcloud secrets create DATABASE_URL --data-file=-

echo -n "your-jwt-secret-min-32-chars" \
  | gcloud secrets create JWT_SECRET --data-file=-
```

> ⚠️ **Gotcha:** To update an existing secret (not create a new one):
> ```bash
> echo -n "new-value" | gcloud secrets versions add SECRET_NAME --data-file=-
> ```

---

## Phase 5 — Artifact Registry

### 9. Create a Docker registry

```bash
gcloud artifacts repositories create YOUR_REPO_NAME \
  --repository-format=docker \
  --location=us-central1
```

> ⚠️ **Gotcha:** Create this in the **same project** as everything else. Cross-project pushes require extra IAM permissions and cause `PERMISSION_DENIED` errors during `gcloud builds submit`.

---

## Phase 6 — Dockerfile (NestJS)

### 10. Create `backend/Dockerfile`

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
ENV DATABASE_URL="postgresql://placeholder:placeholder@localhost/placeholder"
RUN npx prisma generate
RUN npm run build

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma
COPY package*.json ./

EXPOSE 3001
CMD ["node", "dist/src/main"]
```

> ⚠️ **Gotcha — Prisma generate needs DATABASE_URL at build time:** Even though `prisma generate` doesn't connect to the DB, newer versions of Prisma with a `prisma.config.ts` file try to resolve env vars at config load time. Set a dummy `DATABASE_URL` env var before running `prisma generate`.

> ⚠️ **Gotcha — Find the correct output path:** NestJS compiles to `dist/` but the exact path depends on your `tsconfig.build.json`. The output could be:
> - `dist/main.js` — if `rootDir` is `src`  
> - `dist/src/main.js` — if `rootDir` is the project root (default)
>
> **To debug**, add this temporarily to your Dockerfile after `npm run build`:
> ```dockerfile
> RUN ls -la /app/dist/
> RUN ls -la /app/dist/src/   # if src folder exists
> ```
> Check the Cloud Build logs to see what's actually compiled, then set CMD accordingly.

> ⚠️ **Gotcha — `package.json` start script:** Check your `scripts` in `package.json`. If `start:prod` is `node dist/main` (no `.js`), your CMD should match:
> ```dockerfile
> CMD ["node", "dist/src/main"]   # no .js extension needed
> ```

### 11. Create `backend/.dockerignore`

```
node_modules
dist
.env
```

---

## Phase 7 — Build and Push Image

### 12. Build and push

```bash
cd backend
gcloud builds submit \
  --tag us-central1-docker.pkg.dev/YOUR_PROJECT_ID/YOUR_REPO_NAME/backend:latest
```

> ⚠️ **Gotcha — Use explicit version tags for redeployments:** The `latest` tag can be cached by Cloud Run. When redeploying after fixes, use explicit tags like `:v2`, `:v3` to force Cloud Run to pull the new image:
> ```bash
> gcloud builds submit --tag ...backend:v2
> gcloud run deploy ... --image=...backend:v2
> ```

---

## Phase 8 — IAM Service Account

### 13. Create service account and grant permissions

```bash
gcloud iam service-accounts create YOUR_SA_NAME \
  --display-name="Your Service Account"

# Grant Cloud SQL access
gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
  --member="serviceAccount:YOUR_SA_NAME@YOUR_PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/cloudsql.client"

# Grant Secret Manager access
gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
  --member="serviceAccount:YOUR_SA_NAME@YOUR_PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

---

## Phase 9 — Deploy Backend to Cloud Run

### 14. Deploy

```bash
gcloud run deploy YOUR_SERVICE_NAME \
  --image=us-central1-docker.pkg.dev/YOUR_PROJECT_ID/YOUR_REPO_NAME/backend:latest \
  --region=us-central1 \
  --service-account=YOUR_SA_NAME@YOUR_PROJECT_ID.iam.gserviceaccount.com \
  --add-cloudsql-instances=YOUR_PROJECT_ID:us-central1:YOUR_DB_INSTANCE_NAME \
  --set-secrets="DATABASE_URL=DATABASE_URL:latest,JWT_SECRET=JWT_SECRET:latest" \
  --set-env-vars="NODE_ENV=production,FRONTEND_URL=https://placeholder.vercel.app" \
  --allow-unauthenticated \
  --min-instances=1 \
  --port=3001
```

> ⚠️ **Gotcha — `PORT` is reserved:** Do NOT include `PORT=3001` inside `--set-env-vars`. Cloud Run reserves the `PORT` env var. Use `--port=3001` as a separate flag instead.

> ⚠️ **Gotcha — Chicken-and-egg with FRONTEND_URL:** You need the backend URL to deploy the frontend, and the frontend URL for the backend's CORS config. Solution:
> 1. Deploy backend with `FRONTEND_URL=https://placeholder.vercel.app`
> 2. Deploy frontend with the real backend URL
> 3. Update backend with the real frontend URL:
> ```bash
> gcloud run services update YOUR_SERVICE_NAME \
>   --region=us-central1 \
>   --set-env-vars="NODE_ENV=production,FRONTEND_URL=https://your-real-app.vercel.app"
> ```

> ✅ **Tip — `--min-instances=1`:** Prevents cold starts, important for apps using HttpOnly cookie auth where the first request establishes a session.

### 15. Read logs for debugging

```bash
gcloud logging read \
  "resource.type=cloud_run_revision AND resource.labels.service_name=YOUR_SERVICE_NAME" \
  --project=YOUR_PROJECT_ID \
  --limit=50 \
  --format="value(textPayload)" \
  --order=asc
```

---

## Phase 10 — Run Migrations (Cloud SQL Auth Proxy)

### 16. Download the proxy (Windows)

```powershell
curl -o cloud-sql-proxy.exe https://storage.googleapis.com/cloud-sql-connectors/cloud-sql-proxy/v2.15.2/cloud-sql-proxy.x64.windows.exe
```

### 17. Set up Application Default Credentials

```bash
gcloud auth application-default login
```

### 18. Start the proxy on a non-conflicting port

```cmd
cloud-sql-proxy.exe YOUR_PROJECT_ID:us-central1:YOUR_DB_INSTANCE_NAME --port=5433
```

> ⚠️ **Gotcha — Port conflict:** Your local PostgreSQL already uses port `5432`. Always use `--port=5433` (or any other free port) for the proxy to avoid conflicts. If you use 5432, you'll get:
> ```
> bind: An attempt was made to access a socket in a way forbidden by its access permissions
> ```

> ⚠️ **Gotcha — Proxy window closes immediately:** This means credentials aren't set up. Run `gcloud auth application-default login` first.

### 19. Run migrations (new terminal, PowerShell)

```powershell
$env:DATABASE_URL="postgresql://USER:PASSWORD%40ENCODED@localhost:5433/DBNAME"
npx prisma migrate deploy
npx ts-node prisma/seed.ts
```

> ⚠️ **Gotcha — `.env` file overrides terminal env vars:** Prisma's `prisma.config.ts` loads `.env` via `dotenv/config` at startup, which overrides anything you set in the terminal. Either:
> - Temporarily edit your `.env` file's `DATABASE_URL` to point to `localhost:5433`
> - Or pass the env var inline with the command:
> ```powershell
> $env:DATABASE_URL="postgresql://..."; npx prisma migrate deploy
> ```

---

## Phase 11 — Deploy Frontend to Vercel

### 20. Import repo on Vercel

1. Go to [vercel.com](https://vercel.com) → **Add New Project** → import your GitHub repo
2. Set **Root Directory** to `frontend` (critical for monorepos)
3. Add environment variable: `NEXT_PUBLIC_API_URL` = your Cloud Run backend URL
4. Deploy

> ⚠️ **Gotcha — 404 on Vercel after deploy:** Two possible causes:
> 1. **Root Directory not set** — Vercel is looking at the wrong folder. Set it to `frontend` in Settings → General → Root Directory, then redeploy.
> 2. **No route at `/`** — Dashboard apps often redirect from `/` to `/login`. Try visiting `/login` directly to confirm the app works.

### 21. Update backend FRONTEND_URL

```bash
gcloud run services update YOUR_SERVICE_NAME \
  --region=us-central1 \
  --set-env-vars="NODE_ENV=production,FRONTEND_URL=https://your-real-app.vercel.app"
```

---

## Phase 12 — CI/CD (GitHub Actions)

### 22. Create `.github/workflows/deploy-backend.yml` at repo root

```yaml
name: Deploy Backend

on:
  push:
    branches: [main]
    paths: [backend/**]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - id: auth
        uses: google-github-actions/auth@v2
        with:
          credentials_json: ${{ secrets.GCP_SA_KEY }}

      - name: Build and push
        run: |
          gcloud builds submit backend/ \
            --tag us-central1-docker.pkg.dev/YOUR_PROJECT_ID/YOUR_REPO_NAME/backend:latest

      - name: Deploy to Cloud Run
        run: |
          gcloud run deploy YOUR_SERVICE_NAME \
            --image=us-central1-docker.pkg.dev/YOUR_PROJECT_ID/YOUR_REPO_NAME/backend:latest \
            --region=us-central1
```

### 23. Add GCP service account key to GitHub Secrets

1. GCP Console → **IAM & Admin → Service Accounts** → click your SA
2. **Keys** tab → **Add Key → Create new key → JSON** → download
3. GitHub repo → **Settings → Secrets and variables → Actions → New repository secret**
4. Name: `GCP_SA_KEY`, value: entire contents of the JSON file

> ✅ Vercel handles frontend CI/CD automatically on every push — no extra config needed.

---

## Phase 13 — Production Hardening Checklist (From This Project)

Use this checklist before every production deploy to avoid the same failures.

### Backend checklist

- Ensure auth supports both cookie and bearer token extraction.
- Ensure login returns `access_token` in response body (frontend fallback), not cookie-only.
- Ensure disabled users are blocked at both login and JWT validation.
- Ensure management-final lock is enforced in all mutation paths (`addResponse`, `addDynamicPoint`, `submitReview`).
- Ensure direct employee -> management hierarchy generation stops escalation (do not create extra reviewer level).

### Frontend checklist

- Ensure API client sends credentials/cookies and has bearer fallback token injection.
- Ensure auth bootstrap waits for `/auth/me` success before role redirects.
- Ensure route guards do not self-loop on access denied pages.
- Ensure reports/reviews table/dropdown employee lists are sorted by name (better UX for large teams).
- Ensure print CSS hides non-report UI elements (for example, Powered by badge).

### Env/config checklist

- `FRONTEND_URL` exactly matches deployed frontend origin (scheme + domain).
- `DATABASE_URL` uses URL-encoded password characters.
- `JWT_SECRET` is present and stable across revisions.
- Cloud Run uses explicit image tags (avoid `latest` in critical fixes).

---

## Phase 14 — Post-Deploy Smoke Test (10 Minutes)

Run this quick test every time backend is redeployed.

1. Health and startup

```bash
gcloud run services describe YOUR_SERVICE_NAME --region=us-central1 --format="value(status.url)"
```

Open returned URL and confirm service responds (not 5xx).

2. Authentication flow

- Login from frontend and verify no infinite loading/redirect loop.
- Refresh the page on a protected route and verify session is preserved.
- Logout and confirm protected routes redirect to login.

3. Role-based routing

- Test employee, manager, management/admin route entry points.
- Confirm access denied page does not redirect back into itself.

4. Review workflow checks

- Submit management review for one employee.
- Confirm subordinate edit/submit operations are now blocked.

5. Reporting and print

- Open report and print preview.
- Confirm Powered by badge is hidden in print output.

---

## Quick Troubleshooting Reference

| Error | Cause | Fix |
|---|---|---|
| `Invalid Tier for ENTERPRISE_PLUS` | GCP defaults to ENTERPRISE_PLUS | Add `--edition=ENTERPRISE` to SQL instance create |
| `PERMISSION_DENIED on artifactregistry` | Cloud Build SA in different project | Grant `roles/artifactregistry.writer` to Cloud Build SA, or keep everything in same project |
| `Cannot find module '/app/dist/main'` | Wrong output path in CMD | Check actual dist output with `RUN ls -la /app/dist/` debug step, update CMD accordingly |
| `PrismaConfigEnvError: Cannot resolve DATABASE_URL` | Prisma config reads env at build time | Add `ENV DATABASE_URL="placeholder..."` before `prisma generate` in Dockerfile |
| `PORT is reserved env var` | Cloud Run reserves PORT | Remove `PORT=xxxx` from `--set-env-vars`, keep only `--port=xxxx` flag |
| `Authentication failed for user admin` | Password has special chars (`@`) not URL-encoded | URL-encode special chars: `@` → `%40`, `#` → `%23` etc. |
| `bind: forbidden access permissions` on port 5432 | Local Postgres already using 5432 | Run proxy on `--port=5433` instead |
| `could not find default credentials` | Proxy needs ADC | Run `gcloud auth application-default login` first |
| `.env` overrides terminal DATABASE_URL | Prisma loads `.env` via dotenv | Edit `.env` temporarily or use `$env:DATABASE_URL="..."; npx prisma ...` inline |
| Cloud Run still runs old image after redeploy | `latest` tag cached | Use explicit version tags: `:v2`, `:v3` etc. |
| Vercel 404 after successful build | Wrong root directory or no `/` route | Set Root Directory to `frontend` in Vercel settings; try `/login` directly |
| Infinite login/loading loop in production | Cookie/session bootstrap mismatch between frontend/backend | Return `access_token` in login response, keep cookie auth, add bearer fallback, and wait for `/auth/me` before route redirects |
| Access denied page keeps looping | Guard redirects user back to a protected route repeatedly | Add explicit guard escape for access denied route and normalize active role before redirecting |
| Manager column appears when employee is directly under management | Hierarchy logic still expects employee -> manager -> management | Stop escalation when direct reviewer role is `management`; hide manager columns when no manager review exists |
| Reports PDF includes UI badge/watermark | Global layout element is still visible in print | Add print CSS to hide badge class (for example `.powered-by-badge { display: none !important; }`) |
| Prisma Studio crashes with `ERR_STREAM_PREMATURE_CLOSE` | Proxy/network stream is unstable; Studio is not reliable for emergency updates | Use Cloud SQL Proxy + `psql` for updates; avoid Studio for critical production edits |
| Password updated in DB but login fails | Plain text password stored instead of bcrypt hash | Generate bcrypt hash and update `User.password` with hashed value only |

---

## Emergency DB Ops (When Prisma Studio Fails)

If Studio is unstable in production (`ERR_STREAM_PREMATURE_CLOSE`), use this flow.

1. Start proxy:

```bash
cloud-sql-proxy YOUR_PROJECT_ID:us-central1:YOUR_DB_INSTANCE_NAME --port=5433
```

2. Generate bcrypt hash (from `backend/`):

```bash
node -e "const bcrypt=require('bcrypt'); bcrypt.hash('NewPassword@123',10).then(h=>console.log(h))"
```

3. Update user password using SQL (PostgreSQL):

```sql
UPDATE "User"
SET "password" = '$2b$10$REPLACE_WITH_BCRYPT_HASH'
WHERE "email" = 'user@example.com';
```

4. Verify:

```sql
SELECT "id", "email" FROM "User" WHERE "email" = 'user@example.com';
```

---

## Redeployment Cheatsheet

After making backend changes:

```bash
# Build new image with version tag
gcloud builds submit --tag us-central1-docker.pkg.dev/PROJECT/REPO/backend:vN

# Deploy
gcloud run deploy SERVICE_NAME --image=...backend:vN --region=us-central1

# Check logs if it fails
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=SERVICE_NAME" \
  --limit=50 --format="value(textPayload)" --order=asc
```

After making frontend changes:
```
Just push to main — Vercel auto-deploys.
```

---

*Guide compiled from a real NestJS + Next.js + Cloud SQL deployment on GCP.*
