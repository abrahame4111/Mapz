# Mapz routing relay (Cloudflare Worker, free)

Needed because the head unit cannot connect to the public OSRM routing servers directly (see `worker.js`).
Cloudflare's free plan is plenty (100,000 requests a day).

## Set it up (about 5 minutes, no coding)

1. Create a free account at https://dash.cloudflare.com/sign-up (an email and a password; no card needed).
2. In the dashboard, open **Workers & Pages**, then **Create**, then **Create Worker**. Give it a name such as
   `mapz-route`. Click **Deploy** (it deploys a "Hello World" first; that's fine).
3. Click **Edit code**. Delete everything in the editor, paste the whole contents of `worker.js` from this folder, and
   click **Deploy**.
4. Copy the worker's address. It looks like `https://mapz-route.<your-name>.workers.dev`.
5. Send that address to Claude. It goes into the app's settings (`VITE_ROUTE_RELAY_URL` in `.env.local`) and a new
   build uses it first.

## Checking it

A browser address bar sends no `Origin` header, so opening the address directly shows **Forbidden**. That is the
protection working. The real test is the app: pick a destination and a route should appear. The unit's network check
(tap the small build label) also lists the relay.

## Notes

- Only requests of the form `/route/v1/driving/<lng,lat;lng,lat>` from the Mapz app's own origins are relayed.
- Identical requests within a minute are cached.
- If you later move to a different routing server, change `UPSTREAM` in the worker and redeploy; the app needs no change.
