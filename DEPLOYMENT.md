# Render Deployment

Youth Connect runs as a Render web service with a Render-managed PostgreSQL database. The repository's `render.yaml` Blueprint defines both resources and connects them through the database's internal connection string. The application and database run on Render; Clerk and OpenAI remain external services used for sign-in and AI summaries.

## 1. Deploy the app and database to Render

1. Push this repository to GitHub.
2. In Render, create a **Blueprint** and select this repository. Render reads `render.yaml` and creates:
   - The `youtht-connect` web service, built from `Dockerfile`.
   - The `youtht-connect-db` PostgreSQL database.
3. Review the Blueprint resources and approve creation. The web service's `DATABASE_URL` is linked to the database's private connection string; do not enter a separate database URL.
4. Provide a strong `ADMIN_PASSWORD` when prompted, or set it under the web service's **Environment** settings. This variable must be set on the web service (not the PostgreSQL resource). Render generates `SESSION_SECRET` automatically; keep it stable.
5. After creation, wait for the database and web service to become available. The API creates missing database tables at startup and does not drop existing data.
6. Visit `https://youtht-connect.onrender.com/api/healthz` and confirm the health check succeeds, then open `https://youtht-connect.onrender.com`.

The configured database is a **new, empty database**. The app creates its schema automatically, but no old Oracle data is copied.

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

## 4. Connect OpenAI summaries

1. Create an OpenAI API key in the OpenAI platform for the project you intend to use. Keep the key private.
2. Add `OPENAI_API_KEY` to the Render web service's environment variables. Treat it as a secret; do not use a `VITE_` prefix, put it in frontend configuration, or commit it to the repository.
3. Optionally set `OPENAI_MODEL` to a model available to that API project. If omitted, the application defaults to `gpt-4o-mini`.
4. Save the settings and redeploy or restart the Render web service. Open the reading page and confirm the daily chapter summary appears. The API reports actionable configuration errors if the key, quota, permissions, or model is not accepted. Without `OPENAI_API_KEY`, daily readings remain available but AI summaries are not generated.

Monitor usage and set suitable usage limits in the OpenAI project. The application caches generated summaries per chapter, but API usage may still incur charges.

## 5. Render configuration details

- **Blueprint:** `render.yaml`
- **Web service build:** `Dockerfile`
- **Database:** Render PostgreSQL; the Blueprint injects its internal connection string as `DATABASE_URL`
- **Health check:** `/api/healthz`
- **Database setup:** runs automatically when the API starts; setup errors are reported in Render logs

Add the Clerk and OpenAI variables above to the Render web service's environment settings; they are intentionally not database credentials and do not belong on the PostgreSQL resource. For any changed `VITE_` variable, trigger a new deploy so the frontend bundle is rebuilt. After changing server-only variables, restart or redeploy the web service.

## Troubleshooting

- **Database connection or startup failure:** Confirm both Blueprint resources are available and the web service's `DATABASE_URL` is linked to `youtht-connect-db` using its internal connection string. Review the web service logs.
- **Database tables missing:** Review startup logs for a schema setup error. The API initializes tables on service startup.
- **Clerk sign-in fails:** Check the production publishable key, issuer, JWKS URL, and that `CLERK_ALLOWED_ORIGINS` exactly matches the token's authorized-party origin.
- **AI summaries unavailable:** Check `OPENAI_API_KEY`, the selected `OPENAI_MODEL`, and the OpenAI project's quota and model permissions.
- **Database nearing expiration:** Back up or migrate the free database to a paid Render PostgreSQL database before its expiration date.
- **Admin login says the password is not configured:** In Render, open the deployed `YOUTHT-CONNECT` web service (not the Blueprint page or PostgreSQL resource), go to **Environment**, and add `ADMIN_PASSWORD` with a non-empty value. Save the change and wait for the service to redeploy or manually restart it. Then retry the admin login. Changing the variable locally or on the database resource does not change the running web service's environment.
