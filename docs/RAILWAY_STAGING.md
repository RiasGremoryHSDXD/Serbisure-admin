# Railway staging admin

Branch: `chore/railway-api-url`.

Backend: `https://serbisure-backend-staging-production.up.railway.app`.
It uses the isolated Neon `staging-environment` database. API and WebSocket
connections use the same selected backend; no runtime fallback is configured.

In Vercel, set `VITE_API_URL` to this address for **Preview**, restricted to this
Git branch. Redeploy the branch preview, then add its exact hostname to the
backend's `REALTIME_ALLOWED_ORIGINS`. Leave Production variables and its domain
unchanged. A pre-existing variable overrides the source default, so verify the
built preview actually uses the Railway address.

For local QA, use an ignored `.env.local` with the same `VITE_API_URL`, then
restart Vite. Sign out/in when switching datasets.

Rollback: return to `main` or `backup/pre-railway-staging-20261024`
(`6322672bb9540ac12232fa2e1d7e755d77427132`), and restore your previous ignored
local environment override. This staging branch does not change the production
admin deployment.
