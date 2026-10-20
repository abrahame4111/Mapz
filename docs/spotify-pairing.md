# Spotify login from your phone (pairing)

Spotify's login page does not work in the head unit's old browser (typing and Continue do nothing). So the login is done on
your **phone**: the unit shows a 6-character code, you open `queueit.live/pair` on the phone, enter the code, log in to
Spotify, and the unit picks up the result by itself.

## How it works

1. Unit: Connect Spotify -> makes a PKCE verifier (stays on the unit) and a code, sends the code + public challenge to the relay.
2. Phone: `queueit.live/pair` -> you type the code -> the page fetches the challenge from the relay and sends you to Spotify.
3. Spotify redirects to `queueit.live/api/spotify/callback`, which leaves the one-time authorization code with the relay.
4. Unit: polls the relay, gets the authorization code once, and exchanges it with Spotify itself (using the verifier).

The relay never sees tokens or passwords, and the authorization code is useless without the verifier. No client secret is used.

## One-time setup (works from a phone)

1. Cloudflare dashboard -> Workers & Pages -> Create -> **Pages** -> connect the GitHub repo `Mapz`.
   Build command: none. Output directory: `site`.
2. Create a KV namespace (Storage & databases -> KV -> Create), name it e.g. `mapz-pair`.
3. In the Pages project: Settings -> Bindings -> Add -> **KV namespace**, variable name `PAIR`, pick the namespace. Redeploy.
4. Open `https://<project>.pages.dev/health` to check it answers.
5. Put the address in `site/relay-config.js` (`window.MAPZ_RELAY`) and in `.env.local` as `VITE_RELAY_URL`. Push (GitHub Pages redeploys queueit.live).

The same project also serves as an extra routing path (see `route-relay.md`).
