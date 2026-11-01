# Render and Oracle Deployment

Youth Connect is deployed as one Render web service. Render builds the frontend and FastAPI backend from the repository's `Dockerfile`; the backend connects to Oracle Autonomous Database (ADB) using an ADB wallet.

## 1. Create the Oracle Autonomous Database

1. In the Oracle Cloud Infrastructure (OCI) Console, create an Autonomous Database and wait for it to become available.
2. Create a dedicated application database user in the database. Use a strong password and grant only the permissions the application needs to create and update tables in that user's schema.
3. Download a client credentials wallet for the database and set a wallet password. Keep the wallet and all database credentials private; do not commit them to Git or paste them into chat.
4. Open the wallet's `tnsnames.ora` file and note one of its service aliases. Use that exact alias for `ORACLE_DSN` in Render.
5. Configure the ADB network access control list to allow connections from the Render service's outbound IP addresses. Use the outbound IP information shown for the Render service. If the service needs stable outbound IPs, check Render's current plan requirements for static outbound IPs. Do not allow unrestricted access from all IP addresses.

## 2. Configure Render to connect to Oracle

Create a Render Blueprint from this repository and select `render.yaml`, or configure the web service manually with the same settings. The Blueprint uses the repository's `Dockerfile` and configures `/api/healthz` as the health check.

In the Render service dashboard, set these environment variables:

| Variable | Value |
| --- | --- |
| `DATABASE_URL` | `oracle://` |
| `ORACLE_USER` | The dedicated Oracle application username |
| `ORACLE_PASSWORD` | The password for that Oracle user |
| `ORACLE_DSN` | The service alias from the wallet's `tnsnames.ora` |
| `ORACLE_WALLET_LOCATION` | `/etc/secrets` |
| `ORACLE_WALLET_PASSWORD` | The password used when downloading the wallet |
| `SESSION_SECRET` | Keep Render's generated value, or provide a long, random secret |

Upload the wallet files to the Render service as **Secret Files**, placing the wallet contents directly in `/etc/secrets`. The directory must contain at least `tnsnames.ora` and the wallet files referenced by the Oracle client configuration (typically including `sqlnet.ora` and wallet certificate/key files). Do not upload the wallet into the repository or include it in the Docker image.

The application reads `ORACLE_USER`, `ORACLE_PASSWORD`, `ORACLE_DSN`, `ORACLE_WALLET_LOCATION`, and `ORACLE_WALLET_PASSWORD` to establish the connection. `DATABASE_URL=oracle://` selects the Oracle database adapter; `ORACLE_DSN` tells it which wallet service to use. Ensure the ADB network allowlist, Render outbound IPs, wallet service alias, and Render secrets all match.

## 3. Connect Clerk authentication

1. In the Clerk Dashboard, create or select the Clerk application for Youth Connect. Configure its production instance and allowed application domain for `https://youtht-connect.onrender.com` (or your production custom domain).
2. From the Clerk Dashboard, copy the **publishable key** and set `VITE_CLERK_PUBLISHABLE_KEY` in Render. This is a public frontend key, not a secret key. The frontend reads it when Vite builds the site, so set it before deploying and rebuild after changing it.
3. Find the Clerk Frontend API or issuer domain in the Clerk Dashboard. Set `CLERK_ISSUER` to that HTTPS origin, without a trailing slash, and set `CLERK_JWKS_URL` to the same origin followed by `/.well-known/jwks.json`. For example, if the issuer is `https://example.clerk.accounts.dev`, use `https://example.clerk.accounts.dev/.well-known/jwks.json` for the JWKS URL.
4. Set `CLERK_ALLOWED_ORIGINS` to the exact production origin that Clerk puts in the session token's authorized-party (`azp`) claim, such as `https://youtht-connect.onrender.com`. For a custom domain, use that origin instead. Do not use a wildcard or include a path.
5. Set `AUTH_PROVIDER` to `clerk` in Render only after the Clerk values are configured. For Clerk users who should have administrator access, add their Clerk user IDs as a comma-separated list to both `ADMIN_CLERK_IDS` and `VITE_ADMIN_CLERK_IDS`. The frontend variable is included in the built client, so only put user IDs there, never secrets. Rebuild after changing `VITE_CLERK_PUBLISHABLE_KEY` or `VITE_ADMIN_CLERK_IDS`.

Use the production Clerk instance's values, not development-instance values. Never put a Clerk secret key in a `VITE_` variable or in frontend code. Keep any Clerk secret key out of Git and chat; this app's server-side Clerk token verification uses the issuer and JWKS URL rather than a Clerk secret key.

## 4. Connect OpenAI summaries

1. Create an OpenAI API key in the OpenAI platform for the project you intend to use. Keep the key private.
2. Add `OPENAI_API_KEY` to the Render service's environment variables. Treat it as a secret; do not use a `VITE_` prefix, put it in frontend configuration, or commit it to the repository.
3. Optionally set `OPENAI_MODEL` to a model available to that API project. If omitted, the application defaults to `gpt-4o-mini`.
4. Save the settings and redeploy or restart the Render service. Open the reading page and confirm the daily chapter summary appears. The API reports actionable configuration errors if the key, quota, permissions, or model is not accepted. Without `OPENAI_API_KEY`, daily readings remain available but AI summaries are not generated.

Monitor usage and set suitable usage limits in the OpenAI project. The application caches generated summaries per chapter, but API usage may still incur charges.

## 5. Deploy and verify

1. Save the Render environment variables and secret files.
2. Confirm `DATABASE_URL`, the Oracle connection variables, the Clerk variables, and `AUTH_PROVIDER=clerk` are set as intended. Set the OpenAI variables if you want AI summaries.
3. Deploy the service from the Blueprint or trigger a deploy from the Render dashboard.
4. Review the deploy and runtime logs. The API initializes missing database tables during startup and fails startup if Oracle cannot be reached or initialization fails. It does not drop existing data.
5. Open `https://youtht-connect.onrender.com/api/healthz` and confirm the health check succeeds. Then open `https://youtht-connect.onrender.com`, verify Clerk sign-in, and check a daily reading summary if OpenAI is configured.

The Render service builds with `Dockerfile` and runs the API on Render's `$PORT`. The Blueprint's health check path is `/api/healthz`.

When using the Blueprint, add any Clerk and OpenAI variables that it does not already list in the Render dashboard. If a `VITE_` variable changes, trigger a new build/deploy because its value is embedded in the frontend bundle.

## Troubleshooting the Oracle connection

- **Missing configuration:** Confirm all five `ORACLE_*` variables are set, and `DATABASE_URL` is exactly `oracle://`.
- **Wallet not found:** Confirm the wallet files are uploaded as Render Secret Files under `/etc/secrets` and that `/etc/secrets/tnsnames.ora` exists.
- **Service alias error:** Set `ORACLE_DSN` to an exact alias present in `tnsnames.ora`; do not use the wallet filename or database display name.
- **Connection timeout or network error:** Check that the ADB network access control list allows the Render service's outbound IP addresses.
- **Authentication error:** Verify the Oracle username and password, the wallet password, and that the wallet was downloaded for the intended database.
- **Schema or permission error:** Verify the application user can create and update the database objects required by the app in its own schema.

After changing environment variables or secret files, redeploy or restart the Render service so the running application picks them up.
