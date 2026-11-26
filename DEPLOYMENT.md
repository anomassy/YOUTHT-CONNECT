# Render Deployment

Youth Connect runs as a Render web service with a Render-managed PostgreSQL database. The repository's `render.yaml` Blueprint defines both resources and connects them through the database's internal connection string. The application and database run on Render, with Clerk used for sign-in.

On Render, music uploads and profile photos are stored in the PostgreSQL database as binary objects (`BYTEA`), controlled by `STORAGE_BACKEND=postgres`. The object table is created automatically at API startup. This avoids the unavailable Replit object-storage service and requires no separate storage URL.

## 1. Deploy the app and database to Render

1. Push this repository to GitHub.
2. In Render, create a **Blueprint** and select this repository. Render reads `render.yaml` and creates:
   - The `YOUTHT-CONNECT` web service, built from `Dockerfile`.
   - The `youtht-connect-db` PostgreSQL database.
3. Review the Blueprint resources and approve creation. The web service's `DATABASE_URL` is linked to the database's private connection string; do not enter a separate database URL.
4. Provide a strong `ADMIN_PASSWORD` when prompted, or set it under the web service's **Environment** settings. This variable must be set on the web service (not the PostgreSQL resource). Render generates `SESSION_SECRET` automatically; keep it stable.
5. After creation, wait for the database and web service to become available. The API creates missing database tables at startup and does not drop existing data.
6. Visit `https://youtht-connect.onrender.com/api/healthz` and confirm the health check succeeds, then open `https://youtht-connect.onrender.com`.

The configured database is a **new, empty database**. The app creates its schema automatically, but no old Oracle data is copied.

## Database file-storage limits

The PostgreSQL database stores uploaded audio files (up to 100 MB each) and profile photos (up to 10 MB each) alongside app data. Large uploads consume database capacity quickly and increase backup/restore times. The Render free database has limited storage and expires after 30 days, so this setup is suitable for testing only. Monitor database usage in Render and do not upload large libraries to the free database. Upgrade to persistent paid storage before relying on uploaded content.

The Blueprint sets `STORAGE_BACKEND=postgres` on the web service. Keep that value when deploying to Render; do not use `local` (ephemeral across deploys) or `replit` (requires the Replit storage sidecar). If storage was previously configured as `replit`, redeploy this Blueprint so the new setting takes effect. Previously uploaded Replit files are not copied automatically.

## 2. Free database limitations

The Blueprint uses Render's free PostgreSQL plan for initial testing. Free Render databases are temporary and expire after 30 days; they are not appropriate for production data that must be retained. Check the database's expiration date in the Render dashboard.

Before the free database expires, create a paid Render PostgreSQL database and migrate or restore the data if you want to keep it. Verify the migration before allowing the old database to expire. Choose a paid persistent plan before relying on the service for production use.

Render's free web service may spin down while idle. This affects startup latency, not database persistence.

## 3. Connect Clerk authentication

1. In the Clerk Dashboard, create or select the Clerk application for Youth Connect. Configure its production instance and allowed application domain for `https://youtht-connect.onrender.com` (or your production custom domain).
2. Copy the Clerk **publishable key** and set `VITE_CLERK_PUBLISHABLE_KEY` in the Render web service's environment. This is a public frontend key, not a secret key. The frontend reads it when Vite builds the site, so set it before deploying and rebuild after changing it.
3. Find the Clerk Frontend API or issuer domain in the Clerk Dashboard. Set `CLERK_ISSUER` to that HTTPS origin, without a trailing slash, and set `CLERK_JWKS_URL` to the same origin followed by `/.well-known/jwks.json`. For example, if the issuer is `https://example.clerk.accounts.dev`, use `https://example.clerk.accounts.dev/.well-known/jwks.json` for the JWKS URL.
4. Set `CLERK_ALLOWED_ORIGINS` to the exact production origin that Clerk puts in the session token's authorized-party (`azp`) claim, such as `https://youtht-connect.onrender.com`. For a custom domain, use that origin instead. Do not use a wildcard or include a path.
5. Set `AUTH_PROVIDER` to `clerk` only after the Clerk values are configured. For Clerk users who should have administrator access, add their Clerk user IDs as comma-separated values to both `ADMIN_CLERK_IDS` and `VITE_ADMIN_CLERK_IDS`. The frontend variable is included in the built client, so only put user IDs there, never secrets. Rebuild after changing either `VITE_CLERK_PUBLISHABLE_KEY` or `VITE_ADMIN_CLERK_IDS`.

Use the production Clerk instance's values, not development-instance values. Never put a Clerk secret key in a `VITE_` variable or in frontend code. The app's server-side Clerk token verification uses the issuer and JWKS URL rather than a Clerk secret key.

## 4. Sabbath School Quarterly

The app lists the current Seventh-day Adventist Adult Sabbath School Bible Study Guide quarter and its weekly lesson schedule. The schedule includes lesson titles, dates, and page references; use an authorized quarterly edition for the full lesson text.

## 5. Render configuration details

- **Blueprint:** `render.yaml`
- **Web service build:** `Dockerfile`
- **Database:** Render PostgreSQL; the Blueprint injects its internal connection string as `DATABASE_URL`
- **Health check:** `/api/healthz`
- **Database setup:** runs automatically when the API starts; setup errors are reported in Render logs

Add the Clerk variables above to the Render web service's environment settings; they are intentionally not database credentials and do not belong on the PostgreSQL resource. For any changed `VITE_` variable, trigger a new deploy so the frontend bundle is rebuilt. After changing server-only variables, restart or redeploy the web service.

## Webzim cPanel hosting

The supplied **Webzim Hosting Guide 2026 v3** covers cPanel, MySQL setup, file uploads, and SSH access. The Webzim plan for this deployment has separately been confirmed to support a persistent Python ASGI app, same-origin `/api` routing, and persistent upload storage. The static React site alone is not the complete app; the API serves sign-in, lessons, and other authenticated features.

This deployment uses **one fresh Webzim MySQL database** as the app database. The application currently supports one active `DATABASE_URL`; it cannot split its tables across two database servers. Audio and profile uploads use persistent files, not a second database. No existing database records are imported by these steps.

1. In cPanel, create a MySQL database and user, then grant the user access to that database. Configure these values in the ASGI app's private environment (not in `public_html` or source control):
   - `DATABASE_URL=mysql://<db-user>:<url-encoded-password>@<db-host>:3306/<db-name>`
   - `STORAGE_BACKEND=local`
   - `LOCAL_STORAGE_DIR=<absolute persistent path outside public_html>`
   - `AUTH_PROVIDER=local`, a long random `SESSION_SECRET`, and a strong `ADMIN_PASSWORD`; alternatively, configure Clerk using the instructions above.
2. Build the client before uploading: `pnpm --filter @workspace/web build`. Install the API dependencies in the ASGI environment with `python -m pip install -r artifacts/api-server/requirements.txt`.
3. Configure the cPanel ASGI runner with `artifacts/api-server` as the Python import directory and `server.main:app` as the application. For a runner that accepts a command from the repository root, use `uvicorn server.main:app --app-dir artifacts/api-server --host 0.0.0.0 --port ${PORT:-10000}`. Follow Webzim's instructions for its assigned port and process management.
4. Upload the `artifacts` directory, including `artifacts/api-server` and `artifacts/web/dist/public`, while preserving their relative paths. FastAPI serves the built app and SPA routes from `artifacts/web/dist/public`, as well as `/api`. Do not upload only the web build to `public_html`.
5. Keep `LOCAL_STORAGE_DIR` outside `public_html` and on persistent storage. Do not set `STORAGE_BACKEND=postgres` for this MySQL deployment; PostgreSQL object storage requires a PostgreSQL `DATABASE_URL`. Do not use the Replit storage backend.
6. On first startup, the API creates its tables in the fresh MySQL database. Check the ASGI logs for `Database tables verified.` and visit `https://youth-connect.co.zw/api/healthz`. Activate a valid SSL certificate before signing in, then verify sign-in, messaging, and quarterly lesson loading.

The fresh database starts with the app schema only; no Oracle, PostgreSQL, or local MySQL data is copied. Back up any source database separately before planning a migration.

## Troubleshooting

- **Database connection or startup failure:** Confirm both Blueprint resources are available and the web service's `DATABASE_URL` is linked to `youtht-connect-db` using its internal connection string. Review the web service logs.
- **Database tables missing:** Review startup logs for a schema setup error. The API initializes tables on service startup.
- **Music or photo upload reports object storage is not configured:** Confirm the web service has `STORAGE_BACKEND=postgres`, `DATABASE_URL` is linked to the Render database, and the latest deployment has started successfully. The API creates the `stored_objects` table during startup.
- **Clerk sign-in fails:** Check the production publishable key, issuer, JWKS URL, and that `CLERK_ALLOWED_ORIGINS` exactly matches the token's authorized-party origin.
- **Database nearing expiration:** Back up or migrate the free database to a paid Render PostgreSQL database before its expiration date.
- **Admin login says the password is not configured:** In Render, open the deployed `YOUTHT-CONNECT` web service (not the Blueprint page or PostgreSQL resource), go to **Environment**, and add `ADMIN_PASSWORD` with a non-empty value. Save the change and wait for the service to redeploy or manually restart it. Then retry the admin login. Changing the variable locally or on the database resource does not change the running web service's environment.
