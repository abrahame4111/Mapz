# CLAUDE.md — Mapz (Polo head-unit minimap; formerly "Mapz")

Project guide for Claude Code. Read this fully before making changes, and keep it updated as decisions are made.

## 1. What we're building

A custom navigation/HUD app for an **Android-based Blaupunkt head unit in a VW Polo**. It shows a **Need for Speed–style minimap** while driving: a stylized, heading-up, tilted map with a glowing car marker, animated route line, and a game-like HUD. Everything is **theme-driven** so the map style, car, UI skin, fonts and HUD layout are highly customizable.

Deployment flow: build on a laptop, copy the APK to a USB drive, sideload onto the head unit.

Two map modes:
1. **Custom map mode**: self-styled vector map (MapLibre + OpenStreetMap data) with a fully custom game-like style.
2. **Map API mode**: live tiles over WiFi from the phone hotspot (cached for offline fallback).

## 2. Target platform (ASSUMPTIONS — verify on the real unit)

| Item | Status |
|---|---|
| OS | Android (version unknown, to be confirmed in Settings > About) |
| WebView | Unknown. **Biggest risk**: old WebView may lack WebGL2 or modern JS |
| Screen | Unknown resolution/orientation. Layout must be responsive, not hardcoded |
| APK install from USB | Assumed possible (Unknown sources enabled) |
| GPS | Unknown whether built in. Phone GPS over network is the fallback |
| WiFi | Assumed it can join the phone hotspot |

Design for the **weakest plausible device** (Android 6–8, low-end SoC, ~1–2 GB RAM). Treat every performance and compatibility decision through that lens.

## 3. Tech stack

- **Language:** TypeScript (strict mode)
- **Build:** Vite, with a legacy/low build target (ES2015-ish) for old WebViews
- **Map:** MapLibre GL JS with custom style JSON. **Never Google Maps** (its terms forbid restyling into a game-like map)
- **Tiles:** OpenStreetMap-derived vector tiles (MapTiler, Protomaps/PMTiles, or self-hosted). Keep the provider swappable behind one config. **Current dev default: OpenFreeMap** (keyless, OpenMapTiles schema; set in `src/core/config.ts` / `VITE_TILE_URL`). CARTO dark raster tiles were tried and now require an API key
- **MapLibre version:** pinned to **2.4.0** (exact). The head unit WebView is **Chrome 61, WebGL1 only, no ResizeObserver** (measured via the on-screen diagnostics). 2.4.0 ships ES2015/ES2016 code. Chrome 61 also lacks **AbortController** and **ResizeObserver**: polyfilled in src/polyfills.ts, and the worker is started through a blob that installs the AbortController polyfill first. We use MapLibre's **CSP build with the worker as a separate asset** (src/map/maplibre.ts); the default build embeds the worker as text, which the legacy Babel transform breaks. The Vite legacy plugin is set to legacy-only (renderModernChunks:false), because Chrome 61 loads type=module but cannot parse dynamic import()
- **UI:** Vanilla TS + DOM/CSS/SVG with a tiny state store. **No heavy frameworks** (no React) unless profiling proves it is fine on-device
- **Android wrapper:** Capacitor **6** (JDK 17, minSdk 22; app id com.example.nfsnav, placeholder)
  Capacitor (WebView app → APK). Fall back to a native Kotlin shell only if the unit's WebView is unusable
- **Laptop tools:** Node scripts for the theme builder and USB packaging
- **Tests:** Vitest for logic, plus a manual on-device checklist

## 4. Architecture

```
┌────────────────────────── Android head unit (WebView app) ──────────────────────────┐
│                                                                                     │
│  data/ (sources)          core/ (state)             render                          │
│  ├─ gps.ts          ──►   vehicle state     ──►     map/   MapLibre + camera rig    │
│  ├─ obd.ts (opt.)         { lat, lng, speed,        hud/   speedo, gauges, widgets  │
│  └─ simulator.ts           heading, rpm, ...}       theme/ loads + applies packs    │
│                           settings/config           safety/ driving lockout         │
└─────────────────────────────────────────────────────────────────────────────────────┘
        ▲                                                         ▲
   phone hotspot (tiles, optional)                      theme packs on USB / bundled
```

### Folder layout (target)

```
/
├─ CLAUDE.md
├─ package.json, tsconfig.json, vite.config.ts
├─ src/
│  ├─ main.ts                 # app bootstrap
│  ├─ core/                   # state store, event bus, config, logger
│  ├─ data/                   # VehicleDataSource interface + gps / obd / simulator
│  ├─ map/                    # MapLibre setup, camera rig, car marker, route layer
│  ├─ hud/                    # HUD widgets (speed, rpm, clock, compass, etc.)
│  ├─ theme/                  # theme loader, validator, applier (CSS vars + map style)
│  ├─ safety/                 # speed-based lockout, glanceability rules
│  └─ offline/                # tile cache, offline region handling
├─ themes/
│  ├─ _schema/theme.schema.json
│  └─ nfs-underground/        # first theme pack (see section 5)
├─ tools/
│  ├─ theme-builder/          # laptop tool: preview, validate, export theme
│  └─ package-usb/            # copies APK + themes to a USB folder structure
├─ android/                   # Capacitor Android project (generated)
└─ docs/                      # device test results, decisions, screenshots
```

### Key design rules

1. **`VehicleDataSource` interface** is the only way data enters the app. GPS, OBD-II and the simulator all implement it, so the whole app runs on a laptop with the simulator and no car.
2. **Single source of truth:** one vehicle state store. Map and HUD only read from it and never talk to data sources directly.
3. **Themes are data, not code.** Adding or changing a theme must never require editing `src/`.
4. **Everything degrades gracefully:** no GPS → last known position + banner; no network → cached tiles; no OBD → hide those widgets.

## 5. Theme pack spec

Each theme is a folder:

```
themes/<theme-id>/
├─ theme.json       # metadata, colors, fonts, HUD layout, car config, sounds
├─ map-style.json   # MapLibre style (roads, water, buildings, labels)
└─ assets/          # car sprite/model, icons, fonts, sound cues
```

`theme.json` covers: `id`, `name`, `version`, color tokens, font families, HUD widget layout (positions, sizes, which widgets), car (sprite/glow color/marker size), camera defaults (pitch, zoom, look-ahead), and optional sound cues. Validate against `themes/_schema/theme.schema.json` on load, and reject or fall back to default if invalid.

First theme: **nfs-underground**. Dark city, neon road glow, wet-asphalt feel, magenta/cyan accents. Later themes: Heat-style daylight palette, a clean "OEM" theme.

## 6. Guidelines

### Safety (non-negotiable)
- This is a driver display. **No interaction that needs attention while moving.** Above ~5 km/h, lock settings/menus and block text input.
- Glanceable: large numerals, high contrast, no more than a few widgets visible, no flashing or strobing effects, no distracting animation on the map beyond smooth movement.
- Default themes must pass a readability check in direct sunlight and at night (dimmed, no glare).
- Do not display or encourage speed-challenge or race-style gamification of real driving.

### Performance
- Target **30 fps on the head unit**, with a configurable cap (30/20/15). Provide a "low power" mode that drops tilt, shadows and effects.
- Keep the bundle small. Lazy-load anything not needed at boot.
- Avoid per-frame allocations and layout thrashing. Update HUD text only when values change.
- Profile on the real device early. Do not assume laptop performance is representative.

### Compatibility
- Transpile for old Chromium/WebView. Feature-detect WebGL and show a clear fallback screen if it is unavailable.
- No dependency that needs modern browser APIs without a polyfill and a fallback.

### Data & licensing
- Always show required **OpenStreetMap and tile provider attribution**.
- Read API keys from config/env. **Never commit keys.** Provide `.env.example`.
- Respect tile provider terms (caching limits, rate limits). Keep the provider behind one abstraction.
- Only use fonts, icons, sounds and artwork we have rights to. **Do not copy EA/Need for Speed assets, logos or trademarked names**. Evoke the style (neon, dark, urban); don't reproduce the IP.

### Code quality
- TypeScript strict, no `any` without a comment explaining why.
- Small modules, one responsibility each. Pure functions for math (heading smoothing, projection, interpolation) so they can be unit-tested.
- Smooth GPS: apply filtering/interpolation for position and heading. Raw GPS makes the car marker jitter.
- Comment the *why* for anything device-specific or hacky.
- Conventional commits (`feat:`, `fix:`, `chore:`, `docs:`), small focused commits.

### Testing
- Unit tests for state store, theme validation, geo/camera math.
- Simulator must support: straight drive, city route replay (GPX file), GPS dropout, speed changes.
- Keep `docs/device-tests.md` as a log: device, Android version, WebView version, fps, issues.

## 7. Roadmap

1. **Scaffold (DONE):** Vite + TS + MapLibre, simulator-driven moving car marker on a basic dark map
2. **Camera rig (rotation BUILT, device test pending):** heading-up rotation with frame-rate-independent smoothing (`src/map/camera.ts`, `config.camera.bearingTauMs`; `?north` forces north-up). **Zoom (BUILT, device test pending):** pinch only (the +/- buttons were removed; pan/rotate/tilt by touch are off, zoom anchored on the car; the camera pauses while two fingers are down because per-frame jumpTo() cancels pinch gestures). **Map button** (button 4 in the left column): toggles the circular minimap <-> full-screen map. In full screen the map fills the screen behind the left buttons and right panel, mask and ring are hidden, and camera padding (`paddingFor` in `src/map/camera.ts`, `map.setPadding`) keeps the car exactly where the minimap centre is (a little left of screen centre), so it never moves when switching. Mode is remembered (`src/core/prefs.ts`). Zoom level 10..19, persisted in localStorage. Zoom stays available while moving (no text/menus; revisit with the safety lockout). Still to do: pitch/tilt, speed-based zoom, look-ahead (car lower on screen)
3. **Theme system:** loader + schema validation + `nfs-underground` pack (map style + HUD skin)
4a. **Lyrics mode (BUILT; Spotify login untested end-to-end because the callback page is not hosted yet, and untested on the unit):** button 3 (music note) turns the right panel into a Spotify-style lyrics card (big bold lines, current line bright, list slides to keep it in view; line-level sync). Pure logic in `src/lyrics/` (LRC parser, current-line finder, position interpolation, LRCLIB client; all unit-tested); UI `src/hud/lyricsView.ts`, wiring `src/app/lyrics.ts`. Lyrics come from **LRCLIB** (free, keyless, timed LRC; Spotify has no public lyrics API). The song/position come from a `NowPlayingSource`: `src/spotify/nowPlaying.ts` polls Spotify Web API `currently-playing` every 4 s (no Premium needed; the phone plays over Bluetooth). Login = OAuth Authorization Code **with PKCE** (`src/spotify/pkce.ts`, `auth.ts`; tokens in localStorage, auto-refresh), started by the Connect button in the lyrics card (locked while moving). Spotify redirects to `https://queueit.live/api/spotify/callback`, a static page (`site/api/spotify/callback/index.html`, return-address allow-list) that forwards the code back into the app. Client ID from `.env.local` (`VITE_SPOTIFY_CLIENT_ID`). Capacitor `server.allowNavigation` keeps Spotify pages inside the WebView. Setup/hosting options: `docs/spotify-setup.md`. Open risk: Spotify login page on the unit Chrome 61 WebView; fallback = phone login via a small backend. `?lyricsdemo` uses a built-in pretend song with original made-up lyrics. **Never put the Spotify client secret in the app or repo** (see memory). Spotify requires attribution when its metadata is shown.
4. **HUD widgets:** speedometer (BUILT: big speed in the idle panel, small speed while navigating), street name (BUILT: next street in the turn panel), clock, compass, optional RPM/temp (todo). **Right panel while navigating shows ONLY the turn symbol and the distance to that turn** (no label, street name, remaining distance or speed; a short "Finding route..." line appears only while routing). On the final leg it shows a straight arrow with the distance left; on arrival it returns to the speed view and the popup takes over. **Right panel is glassmorphism** (frosted pane, bright top edge, soft highlight). `backdrop-filter` needs Chrome 76, the unit has Chrome 61, so the base style is a tinted translucent glass that is legible on its own and `@supports` adds real blur where available (dev browser). Layout: left column of 6 buttons (1 = search, 2 = end route, 3 = lyrics, 4 = map minimap/full-screen, 5-6 reserved/empty), circular minimap, right panel
5. **Real GPS (BUILT, device test pending):** WebView `navigator.geolocation` (not the Capacitor plugin, which may need Google Play Services the unit lacks); `src/data/gps.ts` + pure `src/core/gpsTracker.ts` (accuracy/out-of-order rejection, speed/heading derivation, heading hold when stopped, 5 s dropout watchdog). Native app uses GPS by default, desktop browser uses the simulator; `?gps` / `?sim` override
6. **Routing (BUILT, device test pending):** search = **Photon** (OSM, keyless, made for search-as-you-type; `src/nav/geocode.ts`), routing = **OSRM public demo server** (`src/nav/routing.ts`; dev use only, self-host or swap before relying on it). Both sit behind `GeocodingProvider` / `RoutingProvider`. **Google Places/Maps is deliberately NOT used:** its terms forbid showing Google data on a non-Google map (and this project never uses Google Maps). `Navigator` (`src/nav/navigator.ts`) owns the trip: progress along the route, off-route detection (60 m for 5 s) with automatic reroute, arrival (30 m). Pure logic is unit-tested (turn classification, OSRM/Photon parsing, projection, state machine). Route drawn as neon purple glow (`src/map/routeLayer.ts`), driven part trimmed away, chequered finish flag marker. 10 Apple-style turn symbols (`src/hud/turnIcons.ts`: straight, slight/normal/sharp left+right, U-turn left+right, arrive). Destination search uses a **built-in dark on-screen keyboard** (`src/hud/keyboard.ts`, `typing.ts`; black and grey only, no purple; large keys, auto-capitalised words, a 123 symbols page, hold-to-repeat backspace, a light-grey Search key that takes the first suggestion) instead of Android's: a web app cannot force the system keyboard dark and the unit may not have one. The search field is a big 34 px text, not a native input, so the system keyboard never opens. Limitation: Latin letters only for now (add layouts if non-Latin place names are needed). Search is locked above 5 km/h (`src/safety/lockout.ts`; `?nolock` for dev). Arrival popup: supplied neon flag artwork (`src/assets/arrival-flag.png`, swaying slowly), no card/border, only a Close button below; Close clears the route and the flag marker. Dev params: `?nolock`, `?simspeed=N`. Needs internet (hotspot) for search + routing; offline is step 7
7. **Offline:** tile caching and pre-downloaded city region
8. **Android packaging:** Capacitor APK, USB packaging tool, install instructions
9. **On-device tuning:** test on the Blaupunkt unit, fix WebView and performance issues
10. **Theme builder (laptop):** live preview, validation, export to USB
11. **Optional:** ELM327 OBD-II over Bluetooth for real RPM and engine data

## 8. Commands (fill in once scaffolded)

```
npm install
npm run dev          # laptop dev server with simulator (?dropout simulates GPS loss; ?gps uses browser geolocation)
npm run build        # typecheck + production web build (modern + legacy bundles)
npm test             # unit tests (vitest)
npm run android:sync # build web + capacitor sync
npm run android:apk  # build debug APK (needs JDK 17 + Android SDK; android/local.properties sdk.dir)
npm run pack:usb     # copy APK to ./dist-usb/mapz-build-N.apk (themes not yet)
npm run build:bump   # increment build-number.txt for a new iteration
```

## 9. Open questions (update as answered)

- [x] Head unit: **Blaupunkt Key Largo 970, Android 9** (firmware A50-OAE-V1.0.45R1-210401_1626, MCU A50M01-IA03A51.H3, 2 GB RAM, 16 GB). **WebView: Chrome 61, WebGL1 only (no WebGL2), no ResizeObserver; screen 1024x541.** **Sideloading fix:** the unit refused ALL third-party APKs ("App not installed") until **Settings > General > Factory Settings > Other settings > "closed system" was switched off**. No browser or Play Store on the launcher
- [ ] Does the unit have built-in GPS? Probably yes: GPS status icon + built-in "GPS Test" app (unverified; test in step 5)
- [ ] Can the unit join the phone hotspot, and is its browser/WebView WebGL-capable?
- [ ] Preferred tile provider and budget (free tier vs self-hosted PMTiles)
- [ ] Routing engine choice for turn-by-turn / route line
- [x] App name: **Mapz** (decided 2026-10-20; avoids the Need for Speed trademark). Internal identifiers deliberately keep the old name (app id com.example.nfsnav, localStorage keys nfsnav.*) so existing installs keep their settings and Spotify login

## 10. Instructions for Claude Code

- **Do not build/send an APK or bump the build number without asking the user first** (they test each one in the car). Verify with typecheck, vitest and the dev server, then ask.
- **Build numbering:** every APK handed to the head unit gets the next iteration number. `build-number.txt` holds the current one; run `npm run build:bump` before building a new iteration, then `npm run android:apk` and `npm run pack:usb`. The number is the APK versionCode ("build N"), the file name (`dist-usb/mapz-build-N.apk`), and is shown on screen. Build 1 = first APK, 2 = targetSdk 28, 3 = diagnostics, 4 = Chrome 61 legacy bundle + MapLibre 2.4, 5 = AbortController polyfills (map works on the unit), 6 = real GPS (confirmed on the unit), 7 = heading-up map rotation (confirmed smooth on the unit), 8 = pinch zoom + on-screen +/- buttons, 9 = buttons purple (#b066ff) and 30% smaller (50 px), 10 = custom app icon (regenerate with `node tools/icons/make-icons.mjs`; source art is inside that script), 11 = new layout (6 buttons | circular minimap | turn panel), destination search, routing, glowing route + finish flag, turn-by-turn, arrival popup, 12 = arrival popup uses the supplied flag image (borderless, Close button only). 14 = app icon is the supplied sunset/palm-trees picture (tools/icons/icon-art.png, regenerate with node tools/icons/make-icons.mjs). 13 = Mapz rename, map button (minimap/full-screen), glass panel, lyrics mode with Spotify login (PKCE) via https://queueit.live/api/spotify/callback. Name sent files and captions with the build number.

- Start every session by reading this file. If a decision changes, update the relevant section.
- Work in small steps. After each step the app should still run on the laptop with the simulator.
- Prefer the simplest approach that works on a weak device. Ask before adding a dependency over ~50 KB gzipped.
- Never commit secrets, large map data or generated build output (use `.gitignore`).
- When unsure about device behaviour, add a note to the open questions and build a feature-detected fallback instead of guessing.
