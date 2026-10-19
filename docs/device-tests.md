# Device test log

| Date | Device | Android | WebView | fps | Notes / issues |
|---|---|---|---|---|---|
| 2026-10-19 | Blaupunkt Key Largo 970 (A50-OAE-V1.0.45R1) | 9.0 | ? | ? | Install works after disabling "closed system" in Factory Settings > Other settings. Run results pending |

Dev-environment note: the Claude desktop browser pane does not fire `requestAnimationFrame`, so the map
appears blank there. Verify in a normal browser (or shim rAF with timers).

## 2026-10-19 Key Largo 970 diagnostics
- WebView UA: Chrome/61.0.3163.98 (device 8227L_demo, Android 9). webgl1=true, webgl2=false, screen 1024x541, dpr 1.
- Failures seen with MapLibre 4.7.1 + modern/legacy split: SyntaxError on import() (modern bundle), "Unexpected token ." (worker), ResizeObserver undefined.
- Fix: legacy-only bundle, ResizeObserver polyfill, MapLibre 2.4.0 CSP build with separate worker. Re-test pending on device.
- Build 4 device run (MapLibre 2.4 CSP build): marker + speed rendered; map blank with "ReferenceError: AbortController is not defined". Fix: AbortController polyfill in page and worker. Build 5 fixes this; re-test pending.
- Build 5 device run: map renders on the unit (dark vector map, marker, attribution). Simulator only.
- Build 6: real GPS added; device test pending (needs location permission prompt answered, GPS fix outdoors).
- Build 6 device run: real GPS confirmed (marker on the actual road, position from the unit).
- Build 7: heading-up map rotation added; device test pending.
