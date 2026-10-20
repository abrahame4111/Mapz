# Mapz routing relay (Cloudflare Pages, free)

## Why

The head unit (Android 9, 2021 firmware) cannot connect to servers whose certificate is Let's Encrypt **ECDSA** ("YE1" /
"YE2"): measured with the app's network check. That includes both public routing servers (OSRM demo, FOSSGIS). It CAN
connect to hosts with Google certificates (the map tiles) and Let's Encrypt RSA ("YR") certificates.

`*.pages.dev` uses a Google certificate ("WE1"), so a small Cloudflare Pages Function can sit in the middle: the unit asks
the relay, and the relay asks the OSRM server. (`*.workers.dev` was tried first and got the unsupported YE1 certificate,
so a Worker does not work.)

The relay code is in this repo: `functions/route/v1/driving/[[path]].js` and `functions/health.js`. It relays only
driving-route requests, only for the Mapz app's own origins.

## Set it up from a phone (about 5 minutes, free, no card)

1. Cloudflare dashboard, then **Compute**, then **Workers & Pages**, then **Create application**.
2. IMPORTANT: choose **Pages**, not Workers. On the newer screens the Pages path is easy to miss: look for a small link such as
   **"Looking to deploy Pages? Get started"** near the bottom, then **Import an existing Git repository**
   (or **Connect to Git**).
3. Connect your GitHub account. When GitHub asks, allow the Cloudflare app for **only the repository `Mapz`**.
4. Pick the repository `abrahame4111/Mapz`, then **Begin setup**.
5. Settings:
   - Project name: `mapz-relay`
   - Production branch: `main`
   - Framework preset: **None**
   - Build command: leave empty
   - Build output directory: `site`
   - Root directory: leave empty
6. **Save and Deploy.** It takes about a minute. The address is shown on the success page, like
   `https://mapz-relay.pages.dev` (it may have extra letters if the name was taken).
7. Send that address to Claude. It goes into `.env.local` as `VITE_ROUTE_RELAY_URL` and the next build uses it first.

Every push to `main` redeploys automatically.

## Checking it

A browser address bar sends no `Origin` header, so opening `https://<project>.pages.dev/health` shows **Forbidden**. That is the
protection working. The real test is the app: choose a destination and a route should appear. The app's network check
(tap the small build label) lists the relay.

## Cleaning up

The earlier Worker (`mapz-route`, workers.dev) is no longer used. Delete it: Workers & Pages, open `mapz-route`, Settings, Delete.

## Other hosts

If Cloudflare Pages will not work: `*.vercel.app` also uses a Google certificate (WR1), so the same logic could run as a
Vercel function. Or use OpenRouteService with a free key (its certificate type works on the unit).
