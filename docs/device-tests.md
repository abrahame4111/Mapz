# Device test log

| Date | Device | Android | WebView | fps | Notes / issues |
|---|---|---|---|---|---|
| 2026-10-19 | Blaupunkt Key Largo 970 (A50-OAE-V1.0.45R1) | 9.0 | ? | ? | Install works after disabling "closed system" in Factory Settings > Other settings. Run results pending |

Dev-environment note: the Claude desktop browser pane does not fire `requestAnimationFrame`, so the map
appears blank there. Verify in a normal browser (or shim rAF with timers).
