# R3 — Capacitor Wrap for App Store + Play Store

> Per `treeq_delivery_mode` memory: TreeQ ships as a Capacitor wrap of the current single-file app. Cameron has not yet done this — there is no native build today, no `capacitor.config.json`, no `ios/` or `android/` folder.
> Goal: a clear "first build" runbook + known pitfalls. No code generated; no `npm install` run. Recommendations only.
> Prepared 2026-05-10 overnight session #2.

---

## TL;DR

- **Capacitor 7 (current GA) and Capacitor 8 (announced) are both actively maintained.** Use Capacitor 7 unless there's a specific 8-only feature needed; 7 has the broader plugin ecosystem in May 2026.
- **The migration path is short.** TreeQ is already a static HTML/JS app — no Next.js export step needed. Drop `index.html` + `icons/` into a `webDir` folder, point `capacitor.config.json` at it, run `npx cap add ios` and `npx cap add android`, you have a build.
- **iOS** requires Apple Developer account ($99/yr — see R4) + Xcode on a Mac (or a CI/CD service like GitHub Actions runner). Android can be built on Windows via Android Studio.
- **`sms:` URI works inside Capacitor's WKWebView (iOS) and Chrome WebView (Android) without a plugin** because the WebView treats it as a native intent. No `@capacitor/app-launcher` needed for the basic flow. *But* for safety, prefer App Launcher for explicit native intent control.
- **Offline-first**: Capacitor automatically caches the `webDir` contents in the app bundle. If `index.html` + species data are inlined (which they are), the app works fully offline including the picker/calculator. SMS-fallback button is still gated behind cellular SMS reachability — Capacitor doesn't change that.
- **Push notifications** are not needed for v1. If/when we add them: use `@capacitor-firebase/messaging` (handles iOS APNs swizzling + FCM token unification).

---

## 1. The migration is not big

TreeQ today: **one static `index.html` + folder of SVG icons.** No build pipeline. No bundler. No npm.

A Capacitor wrap of a static-HTML app is the simplest possible Capacitor scenario. Per [Capacitor Web Documentation](https://capacitorjs.com/docs/web), the framework only needs:

- A `webDir` folder containing `index.html` + assets
- A `capacitor.config.json` pointing at it
- Native projects (`ios/` and `android/`) that Capacitor scaffolds

There's no Next.js static export to do, no `output: 'export'` to set, no image-optimization workarounds (which is the hard part of Next.js→Capacitor migrations). TreeQ skips all of that.

---

## 2. First-build runbook

A 30-minute path to a buildable iOS + Android project. Run from `C:\Users\camer\OneDrive\Documents\Claude\Projects\TreeQ\` or a fresh sibling folder; recommend a sibling folder (`TreeQ-mobile/`) so the Capacitor scaffolding doesn't pollute the existing project root.

> **Out-of-scope-for-research-mode:** these commands are NOT executed. They are listed as the runbook Cameron will follow when the Capacitor-wrap ticket is cut.

### 2.1 Prerequisites

- **Node.js 20+** (Capacitor 7 requires it per [Capacitor 7 release notes](https://capacitorjs.com/docs/updating/7-0)).
- **For iOS:** macOS with Xcode 15+ installed. (Cameron is on Windows — he'll need either a Mac, a Mac-in-cloud service, or GitHub Actions with `macos-latest` runners.)
- **For Android:** Android Studio + JDK 17.
- **Apple Developer account** — see R4. Required for distribution; not required for local simulator.
- **Google Play Console account** — see R4. Required for distribution; not required for local emulator.

### 2.2 Scaffold the project

```bash
mkdir TreeQ-mobile && cd TreeQ-mobile
npm init -y
npm install @capacitor/core @capacitor/cli
npx cap init "TreeQ" "com.nextmillion.treeq" --web-dir="www"
```

This creates:
- `package.json`
- `capacitor.config.json` with `webDir: "www"`, `appId: "com.nextmillion.treeq"`, `appName: "TreeQ"`

### 2.3 Drop in the web app

Copy the static assets into `www/`:

```
TreeQ-mobile/
├── www/
│   ├── index.html        # the production index.html (current ~115 KB)
│   ├── icons/            # all 14 leaf SVGs
│   └── species_data/     # if any client-readable CSVs are referenced
├── capacitor.config.json
└── package.json
```

(For dev iteration, set up a build step that copies from `../TreeQ/` to `www/` so the source-of-truth `index.html` doesn't fork.)

### 2.4 Add native platforms

```bash
npm install @capacitor/ios @capacitor/android
npx cap add ios
npx cap add android
```

This creates `ios/` and `android/` folders, each containing a complete native project that opens in Xcode and Android Studio respectively.

### 2.5 Sync + open

```bash
npx cap sync                # copies www/ into native projects + updates plugins
npx cap open ios            # opens Xcode
npx cap open android        # opens Android Studio
```

In Xcode: select a simulator (iPhone 15) → click Run. The app launches with `index.html` rendering inside a WKWebView.

In Android Studio: pick an emulator → click Run. Same.

### 2.6 Iteration loop

Edit `index.html` → copy into `www/` → `npx cap sync` → reload in simulator. Or use `npx cap run ios --livereload` to point the WebView at a localhost dev server.

---

## 3. iOS-specific considerations

### App Store Connect provisioning

- Apple Developer Program enrollment required (see R4).
- Create an App ID in the developer portal: `com.nextmillion.treeq`.
- Provisioning profile: distribution + dev certs.
- App Store Connect listing: app name, screenshots (6.7" + 6.5" + 5.5" iPhone, plus iPad), privacy nutrition labels, support URL, app review notes.

### Capacitor iOS plugins likely needed for v1

| Plugin | Purpose | Required? |
|---|---|---|
| `@capacitor/app` | App state events (background/foreground), URL open events | **yes** |
| `@capacitor/preferences` | Persist auth tokens (per R5 §5) | **yes** when auth lands |
| `@capacitor/network` | Detect online/offline for SMS-fallback button toggle | yes |
| `@capacitor/geolocation` | "Stamp my location" button on saved trees (ROADMAP F2) | not v1; P3 |
| `@capacitor/browser` | OAuth flows (per R5 §5) | yes when auth lands |
| `@capacitor/app-launcher` | Open `sms:` URI explicitly | optional; the WebView's anchor-tag handler usually works |
| `@capacitor-firebase/messaging` | Push notifications | not v1 |

### `sms:` URI scheme

Per [iOS sms: docs](https://weblog.west-wind.com/posts/2013/Oct/09/Prefilling-an-SMS-on-Mobile-Devices-with-the-sms-Uri-Scheme):

```js
window.location.href = `sms:+15855551234?body=${encodeURIComponent(packet)}`;
```

Inside an iOS WKWebView, this triggers the OS to leave the app and open Messages with the pre-filled body. Works without a plugin. The user taps Send, then Apple returns control to TreeQ.

**Edge case:** iPad Wi-Fi-only devices have no SMS capability. The URI does nothing. The spec §9 already plans for this — hide the button via UA heuristic.

### Required iOS capabilities (Xcode → Signing & Capabilities)

For v1, none — we're a pure WebView app. Add later when relevant:
- "Push Notifications" — if/when we ship push (P3+).
- "Sign in with Apple" — required if any social login is offered (per R5 §5; App Store Review Guidelines §4.8). Once we ship Google sign-in, **Apple Sign-In becomes mandatory on iOS.**

### App Tracking Transparency

If we add analytics that read IDFA, we must show the App Tracking Transparency prompt. v1 doesn't track — defer.

---

## 4. Android-specific considerations

### Google Play signed APK

- Google Play Console enrollment ($25 one-time, see R4).
- Android Studio → Build → Generate Signed Bundle/APK → keystore creation.
- **Save the keystore in 1Password.** Lose it = can't update the app, period.

### Target SDK

As of May 2026, **target SDK 35 (Android 15)** is required for new submissions and updates per Google Play policy. Capacitor 7 already targets API 34/35 by default.

### `sms:` and `smsto:` schemes

Per [Android Common Intents](https://developer.android.com/guide/components/intents-common):

- `sms:+15855551234?body=...` works inside Capacitor's Chrome WebView.
- `smsto:+15855551234?body=...` is preferred to disambiguate from email apps that might also catch `sms:`.

```js
const scheme = navigator.userAgent.includes('Android') ? 'smsto:' : 'sms:';
window.location.href = `${scheme}+15855551234?body=${encodeURIComponent(packet)}`;
```

This branch is small enough to inline in the SMS button handler.

### AndroidManifest considerations

For v1: nothing special. The default Capacitor manifest has `INTERNET` permission, plus various WebView features. Capacitor's defaults are sensible.

For later (P3+ when GPS lands): add `ACCESS_FINE_LOCATION` (and request at runtime). `@capacitor/geolocation` handles the runtime permission flow.

---

## 5. Five known pitfalls (with mitigations)

### Pitfall 1: Capacitor + Supabase OAuth PKCE failure

Already covered in detail at R5 §5. Summary: the OAuth code verifier disappears between SFSafariViewController and the app on iOS. **Mitigation:** Cap-go's `capacitor-supabase` plugin, OR use `@capacitor/browser` with `signInWithOAuth({skipBrowserRedirect: true})` and handle the deep link manually via `App.addListener('appUrlOpen', ...)`.

### Pitfall 2: WebView storage doesn't persist auth tokens reliably

`localStorage` works in a WebView but iOS can purge backgrounded WebView storage under memory pressure. **Mitigation:** wire Supabase's `auth.storage` to `@capacitor/preferences` (R5 §5 has the snippet). On Android, `localStorage` is more durable but use Preferences anyway for symmetry.

### Pitfall 3: WKWebView CORS for `/api/estimate`

Capacitor serves the WebView from a custom scheme like `capacitor://localhost`. When the app fetches `https://treeqapp.com/api/estimate`, that's a cross-origin request from the WebView's perspective. **Mitigation:** the Worker's response needs `Access-Control-Allow-Origin` configured. For dev, allow `capacitor://localhost`; for prod, allow the app's actual origin (which is also `capacitor://localhost` because that's what Capacitor uses regardless of the CDN URL — it's an embedded WebView). Set the header in `deploy/functions/api/estimate.js`.

### Pitfall 4: iOS App Store review around Sign in with Apple

If TreeQ ships Google Sign-In or Facebook Login, Apple's §4.8 requires Sign in with Apple as an equivalent option. Reviewers reject otherwise. **Mitigation:** ship Apple Sign-In on day-one of iOS launch, even if Cameron prefers Google for himself.

### Pitfall 5: Live-reload during dev breaks deep-link callbacks

When using `npx cap run ios --livereload`, the WebView origin becomes `http://<cameron-ip>:8100/` instead of `capacitor://localhost`. OAuth redirect URLs configured in Supabase won't match. **Mitigation:** during OAuth-integration work, build & sync (don't live-reload) so the origin is stable.

---

## 6. The "first build" checklist (one-screen version)

- [ ] Install Node 20+ on dev machine
- [ ] Sibling folder: `mkdir TreeQ-mobile && cd TreeQ-mobile && npm init -y`
- [ ] `npm install @capacitor/core @capacitor/cli @capacitor/ios @capacitor/android`
- [ ] `npx cap init "TreeQ" "com.nextmillion.treeq" --web-dir=www`
- [ ] Copy `index.html`, `icons/`, plus any other client-readable assets into `TreeQ-mobile/www/`
- [ ] `npx cap add ios && npx cap add android`
- [ ] `npx cap sync`
- [ ] **iOS:** open Xcode, select simulator, click Run. Confirm picker loads, modal opens, calc works
- [ ] **Android:** open Android Studio, select emulator, click Run. Confirm same
- [ ] Add core plugins: `@capacitor/app`, `@capacitor/network`, `@capacitor/preferences` → `npx cap sync`
- [ ] Set up Apple Developer account + Google Play Console (R4)
- [ ] Generate signing keys (iOS dev/distribution cert, Android keystore)
- [ ] Test build → ad-hoc install on Cameron's iPhone + Android device
- [ ] Test SMS-fallback button against Cameron's Quo number
- [ ] Submit for store review (R4 covers the listing checklist)

---

## 7. Open questions

1. **Single-codebase vs separate-folder?** Recommend `TreeQ-mobile/` sibling. Keeps Capacitor scaffolding (`ios/`, `android/`, `node_modules/`) out of the OneDrive sync that runs the prod `index.html`. Build step copies `../TreeQ/index.html` → `www/index.html` on every sync.
2. **CI/CD on Mac for iOS builds?** Cameron is on Windows. Options: (a) Mac mini in cloud (~$30/mo, MacInCloud or AWS EC2 Mac), (b) GitHub Actions with `macos-latest` runners (free for public repo, $0.08/min for private), (c) buy a used Mac mini. Recommend GitHub Actions for first launch + occasional updates.
3. **App icon + splash screen.** Need a 1024×1024 master icon + splash variants. Capacitor has `@capacitor/assets` to generate all sizes from a master. Low priority but pre-launch blocker.
4. **In-app browser vs system browser for OAuth?** R5 §5 says use Cap-go plugin or `@capacitor/browser` with manual deep-link handling. Confirm choice before P2 lands.
5. **Capacitor 7 vs 8.** Capacitor 8 was announced (per [Capacitor 8 announcement](https://ionic.io/blog/announcing-capacitor-8)). Still on 7 for now — wait until 8 has 6+ months of plugin-ecosystem catch-up.

---

## Sources

- [Capacitor 7 GA announcement](https://ionic.io/blog/capacitor-7-has-hit-ga)
- [Capacitor 7 update guide](https://capacitorjs.com/docs/updating/7-0)
- [Capacitor 8 announcement](https://ionic.io/blog/announcing-capacitor-8)
- [Capacitor configuration](https://capacitorjs.com/docs/config)
- [Capacitor web documentation](https://capacitorjs.com/docs/web)
- [Capacitor App API](https://capacitorjs.com/docs/apis/app)
- [Capacitor App Launcher API](https://capacitorjs.com/docs/apis/app-launcher)
- [Capacitor Push Notifications API](https://capacitorjs.com/docs/apis/push-notifications)
- [Push Notifications guide for Capacitor (Capawesome)](https://capawesome.io/blog/the-push-notifications-guide-for-capacitor/)
- [iOS Critical Alerts in Capacitor (Medium)](https://medium.com/@alonwo/ios-critical-alerts-in-capacitor-apps-fcm-push-notifications-ce591179feec)
- [Android common intents (sms / smsto)](https://developer.android.com/guide/components/intents-common)
- [SMS URI scheme prefilling](https://weblog.west-wind.com/posts/2013/Oct/09/Prefilling-an-SMS-on-Mobile-Devices-with-the-sms-Uri-Scheme)
- Cross-references: R5 §5 (Capacitor + Supabase OAuth), R6 (Quo SMS endpoint), R10 (where Capacitor wrap fits in the architecture)
