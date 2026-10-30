# Render Deployment

Render runs the FastAPI app and serves the website and API from the same web service.

## Run Locally with XAMPP on Windows

The local setup uses XAMPP's MariaDB for the database, FastAPI for the API, and Vite for the website. Install Python 3.13, Node.js, and pnpm first. The API creates its tables automatically on first startup. GitHub remains the source-code repository; it is not needed to run the local app.

1. Install XAMPP and start **MySQL** in the XAMPP Control Panel.
2. Open phpMyAdmin at `http://localhost/phpmyadmin`, select **Import**, and import `artifacts/api-server/setup-xampp.sql`. This creates the `youth_connect` database.
3. Copy `.env.example` to `.env` in the repository root. The example uses XAMPP's default `root` account with no password. If you configured a MariaDB password, add it to `DATABASE_URL` (URL-encode special characters in the password). Change local secrets before use.
4. In a PowerShell terminal at the repository root, install the API dependencies:

   ```powershell
   python -m pip install -r artifacts\api-server\requirements.txt
   ```

5. Start the API in that terminal:

   ```powershell
   $env:PYTHONPATH = "artifacts\api-server"
   python -m hypercorn server.main:app --bind 127.0.0.1:8001
   ```

   On startup, the API creates any missing tables. Check `http://localhost:8001/api/healthz`.
6. In a second PowerShell terminal at the repository root, start the website:

   ```powershell
   pnpm --filter @workspace/web dev -- --host 127.0.0.1
   ```

7. Open `http://localhost:5173`. Vite proxies `/api` requests to the local FastAPI server on port 8001.

Keep both terminals and XAMPP running while using the site. Do not expose XAMPP's database port to the public internet. Admin music uploads are saved under `artifacts/api-server/storage` (or the directory set by `LOCAL_STORAGE_DIR`) and are served by the API. The directory is ignored by Git; back it up separately if needed. Profile-photo uploads still use the configured Replit object-storage service.

### Automatic startup on Windows

Run `scripts\start-youth-connect.ps1` to wait for XAMPP MySQL, start the FastAPI and Vite servers in the background, and open the site in Google Chrome. To start it automatically when your Windows account signs in, create a shortcut to that script in the current user's Startup folder. XAMPP's MySQL Windows service should be set to **Automatic**. Startup and server logs are written to `%LOCALAPPDATA%\YouthConnect\logs`. Remove the shortcut from Startup to disable automatic app launch; this does not change MySQL's service startup setting.

## Clerk Sign-in and Daily AI Summaries

The web sign-in can use the existing Clerk application (`app_3L2sitj0F5UQaLMa8IxrwOdY0yp`). In its Clerk Dashboard, open **API Keys** and copy the development publishable key into `VITE_CLERK_PUBLISHABLE_KEY` in the repository-root `.env`. Copy the Frontend API domain into `CLERK_ISSUER` and set `CLERK_JWKS_URL` to that domain plus `/.well-known/jwks.json`. Keep `CLERK_ALLOWED_ORIGINS` restricted to the localhost app origins. Set `AUTH_PROVIDER=clerk` only after these values are configured. Add the Clerk user IDs for administrators to both `ADMIN_CLERK_IDS` and `VITE_ADMIN_CLERK_IDS`. Restart both the API and Vite after editing `.env`; until Clerk is fully configured, keep `AUTH_PROVIDER=local`. Do not paste secret keys into chat or commit them.

Existing users remain in MariaDB with their posts and reading progress. Password hashes are not transferred; each existing user must create/sign in to a Clerk account and set a Clerk password. To retain an existing local profile, an administrator links the Clerk user ID to its local row in phpMyAdmin:

```sql
UPDATE users SET clerk_id = 'user_clerk_id' WHERE id = 123;
```

Only run that statement after confirming the Clerk account belongs to that user. New Clerk accounts with no matching local email/username are linked automatically on first sign-in.

The built-in daily Bible schedule assigns one chapter per day from Genesis through Revelation. It starts today by default; optionally set `BIBLE_PLAN_START_DATE=YYYY-MM-DD` before the first API startup to choose another start date. AI summaries use the public-domain World English Bible chapter text and OpenAI; set `OPENAI_API_KEY` in `.env` to enable them. Summaries are cached per chapter. Without a key, the reading schedule still works and the page will explain that summaries are not configured.

## Deploy

1. In Render, create a Blueprint from this repository and select `render.yaml`.
2. In OCI, create an Oracle Autonomous Database and download its wallet. Create a dedicated application user with only the permissions needed to create and update objects in its own schema.
3. Configure `ORACLE_USER`, `ORACLE_PASSWORD`, `ORACLE_DSN`, and `ORACLE_WALLET_PASSWORD` as Render secrets. `ORACLE_DSN` is the service alias from the wallet's `tnsnames.ora`; keep `DATABASE_URL` set to `oracle://`.
4. Upload the wallet files as Render secret files so they are available under `/etc/secrets`, matching `ORACLE_WALLET_LOCATION`. Keep the wallet files and passwords out of Git and chat.
5. Restrict Autonomous Database network access to the Render service's outbound IP addresses. Do not enable unrestricted public access. A static outbound IP may require a paid Render service plan.
6. Set `ADMIN_PASSWORD` in Render if using local administrator sign-in. Set or generate `SESSION_SECRET` and keep it stable between deploys. Deploy the Blueprint. Render builds the frontend and API into one Docker service; the API creates missing tables when it starts.

The service is configured to serve the website and API at `https://youtht-connect.onrender.com`. Verify `/api/healthz` after deployment. Startup database setup does not drop existing data.

## Render Commands

- Build: Render builds the website and API from `Dockerfile`
- Dockerfile: `Dockerfile`
- Database verification: `python artifacts/api-server/predeploy.py`
- Database setup: runs on API startup
- Start: the Dockerfile starts Uvicorn on Render's `$PORT`
- Health check: `/api/healthz`

Database setup creates missing tables and exits with an error if Oracle cannot be reached or setup fails. It does not drop existing data.

## Run Locally

From the repository root, install dependencies and start the app:

```sh
python -m pip install -r artifacts/api-server/requirements.txt
export DATABASE_URL='postgresql://USER:PASSWORD@HOST:PORT/DATABASE'
export SESSION_SECRET='replace-with-a-long-random-secret'
python artifacts/api-server/predeploy.py
PYTHONPATH=artifacts/api-server hypercorn server.main:app --bind 0.0.0.0:8001
```

For Oracle Autonomous Database, set `DATABASE_URL=oracle://`, `ORACLE_USER`, `ORACLE_PASSWORD`, `ORACLE_DSN`, `ORACLE_WALLET_LOCATION`, and `ORACLE_WALLET_PASSWORD` in the environment. Put the downloaded wallet files in the wallet directory and keep it out of Git. Run `pnpm --filter @workspace/web dev -- --host 127.0.0.1` in another terminal and open `http://localhost:5173`. The API health check is at `http://localhost:8001/api/healthz`.
