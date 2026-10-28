# Spotify lyrics: setup

Lyrics mode shows the lyrics of whatever your Spotify account is playing (for example on your phone, connected to the
head unit over Bluetooth). It needs a one-time Spotify login on the unit.

## How the login works

1. You press the music button (slot 3), then **Connect Spotify** (only while the car is stopped).
2. The app sends the unit's browser to Spotify's login page.
3. After you log in, Spotify sends the browser to `https://mapz-b9u.pages.dev/api/spotify/callback?code=...`.
4. That page (`site/api/spotify/callback/index.html`) is static. It just forwards the one-time code back into the app.
5. The app swaps the code for tokens itself using PKCE, so **no client secret is needed anywhere in the app**.

Tokens are kept in the WebView's storage and refreshed automatically.

## What you need

- A Spotify developer app (done): Client ID in `.env.local` (git-ignored) as `VITE_SPOTIFY_CLIENT_ID`.
- Redirect URI registered in the Spotify dashboard: `https://mapz-b9u.pages.dev/api/spotify/callback`. (The domain was changed from mapz.live to mapz-b9u.pages.dev, so add this new one in the dashboard under Settings > Redirect URIs and save; the old mapz.live one can be removed.)
- **Your own Spotify account added under "User management"** in the dashboard. Apps in development mode only work for
  accounts on that list.
- The callback page published at that address (below).
- **The client secret is not used by the app.** It was shared in chat, so rotate it in the dashboard; the app will
  keep working because PKCE does not use it.

## Publishing the callback page

The folder `site/` is the whole website: it must answer at `https://mapz-b9u.pages.dev/api/spotify/callback` (with or without a
trailing slash, and keep the `?code=...` query).

It is served by the Cloudflare Pages project `mapz-b9u` (build command none, output directory `site`), the same project that
runs the pairing relay (docs/spotify-pairing.md). It used to be served at queueit.live through GitHub Pages; that was dropped
because queueit.live belongs to a different site. If GitHub Pages is still enabled for this repo, turn it off (Settings >
Pages) and remove the custom domain.

## Testing

- Open `https://mapz-b9u.pages.dev/api/spotify/callback?code=x&state=y`: it should say "This login link is not valid."
- On the unit: music button > Connect Spotify. If Spotify's login page does not load or cannot be used on the unit's old
  browser (Chrome 61), tell me what you see: the fallback is logging in on a phone.
- After login the lyrics card opens by itself. Play a song on your phone to see the lyrics.

## Notes

- Spotify requires attribution where its metadata is shown; the card credits it.
- Reading "currently playing" needs no Premium.
- Lyrics come from LRCLIB (community-run, timed lyrics). Not every song has them.
