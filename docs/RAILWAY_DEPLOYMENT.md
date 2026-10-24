# Railway admin backend

Production and Preview builds use
`https://serbisure-production-backend.up.railway.app` for API requests
and authenticated WebSockets. The URL is declared in `src/api/apiClient.ts`.
The public hostname matches the production service; its name does not select a database.

The admin does not read a database connection string. Railway's backend
`DATABASE_URL` determines the database. The production backend must select
`serbisure-production-db` in its Railway configuration; deploying this admin
change does not change that database connection.

## Deploying the admin

No API URL variable is required in Vercel. Legacy `VITE_API_URL` values are ignored
by the code, including existing hosting settings. They can be removed from Vercel
later for clarity. Build and deploy the desired Git commit normally.

Add `https://serbisure-admin-one.vercel.app` and any required Preview origins to
the backend's `REALTIME_ALLOWED_ORIGINS` before testing their WebSocket connections.
After deploying, verify API requests use the Railway HTTPS address and realtime
connects to the same host at `wss://.../ws/events/`.

## Local development

`npm run dev` uses Railway by default. To work with a local backend, set this in
an ignored `.env.local`, then restart Vite:

```dotenv
VITE_DEV_API_URL=http://localhost:8000
```

Vite proxies `/api` and `/ws` to that backend, so phones can use the development
page's LAN address. `VITE_DEV_API_URL` has no effect on Production or Preview
builds. There is no automatic fallback to another backend.
