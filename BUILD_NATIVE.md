# BUILD_NATIVE — getting TreeQ onto iOS & Android

This is a runbook for first-time native builds. It assumes you've already merged
the Capacitor scaffolding (`package.json` deps, `capacitor.config.ts`,
`diagnostics.html`) but have **not** yet run `npx cap add ios` or `npx cap add
android` — those create native project folders and should only be done once.

## 0. Why we're doing this

App Store Guideline 4.2 ("minimum functionality") requires three native
integrations. TreeQ ships with:

- **Camera** — `@capacitor/camera` for photo-first job pricing
- **Geolocation** — `@capacitor/geolocation` for property/dump-site distance math
- **Push Notifications** — `@capacitor/push-notifications` for "quote sent" alerts

Plus:

- **Speech Recognition** — `@capacitor-community/speech-recognition` (native streaming;
  better than Whisper round-trip on chainsaw-adjacent audio because there's no upload)
- **Splash Screen** — `@capacitor/splash-screen` for cold-start brand polish

See `research/R3-capacitor-wrap.md` and `research/R4-store-enrollment.md` for the
underlying decisions.

## 1. First-time setup on your Mac (iOS)

You need a Mac with Xcode 15+. Cameron is on Windows for day-to-day; the iOS build
is a Mac-only step. Options:

1. **Mac mini at home** — easiest if you have one.
2. **Mac-in-cloud** (MacStadium, MacInCloud) — ~$30/month.
3. **GitHub Actions runner `macos-latest`** — CI route; needs the iOS signing
   cert + provisioning profile stored as secrets.

Once on a Mac:

```bash
# 1. clone the project
git clone <repo>   # or sync the folder
cd TreeQ

# 2. install JS deps
npm install

# 3. create the iOS project (ONE TIME ONLY — produces ios/ folder)
npx cap add ios

# 4. copy the web assets + sync the plugins
npx cap sync ios

# 5. open in Xcode
npx cap open ios
```

In Xcode:

1. Select the **App** target → **Signing & Capabilities**
2. Set **Team** to your NMC LLC team (will be visible once Apple Developer
   enrollment + D-U-N-S verification is complete)
3. Bundle Identifier: `com.treeq.app` (matches `capacitor.config.ts`)
4. Add capabilities: **Push Notifications**
5. Add **Background Modes** → "Remote notifications" if you want background pushes
6. Plug in an iPhone, select it as run target, ⌘R to build to device

For TestFlight upload:

1. **Product → Archive**
2. Distribute App → App Store Connect → Upload
3. In App Store Connect, the build appears under TestFlight within ~10 minutes
   (after Apple processes the binary)
4. Add internal testers, send invites

## 2. First-time setup on Windows (Android)

You need Android Studio Hedgehog (2023.1+) and JDK 17.

```bash
# 1. install deps
npm install

# 2. create the Android project (ONE TIME — produces android/ folder)
npx cap add android

# 3. copy web assets + sync
npx cap sync android

# 4. open in Android Studio
npx cap open android
```

In Android Studio:

1. Wait for Gradle sync to finish
2. **Build → Generate Signed Bundle / APK** → AAB (Android App Bundle, required
   by Play Store)
3. Create a new keystore (save the .jks file outside the repo + back it up —
   losing it means you can never update the published app)
4. Keystore password, alias, alias password — store all three in 1Password
5. Build the release AAB
6. Upload to Google Play Console → Internal testing track

## 3. Permission strings (already set or todo?)

iOS reads from `Info.plist`, Android from `AndroidManifest.xml`. After
`npx cap add`, the templates will not have TreeQ-specific copy. Add these
before submitting for review:

### iOS — `ios/App/App/Info.plist`

```xml
<key>NSCameraUsageDescription</key>
<string>TreeQ uses the camera to capture photos of trees and job sites for accurate pricing.</string>
<key>NSLocationWhenInUseUsageDescription</key>
<string>TreeQ uses your location to calculate distance to dump sites and to plot job addresses.</string>
<key>NSMicrophoneUsageDescription</key>
<string>TreeQ uses the microphone to capture voice notes and run hands-free job questions.</string>
<key>NSSpeechRecognitionUsageDescription</key>
<string>TreeQ uses speech recognition to transcribe your voice into job descriptions and search queries.</string>
<key>NSPhotoLibraryUsageDescription</key>
<string>TreeQ lets you attach existing photos from your library to a job.</string>
```

### Android — `android/app/src/main/AndroidManifest.xml`

```xml
<uses-permission android:name="android.permission.CAMERA" />
<uses-permission android:name="android.permission.RECORD_AUDIO" />
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
<uses-permission android:name="android.permission.INTERNET" />
```

## 4. Verifying the plugins work

After `cap sync`, deploy a debug build to a device and open `diagnostics.html`.
Each test button calls the corresponding Capacitor plugin and reports success or
the actual native error. If the page shows **Platform: web · Native: no**, you're
in a browser — open it from inside the wrap.

## 5. Bundle vs hosted

`capacitor.config.ts` currently sets `server.url = "https://treeqapp.com"`, so the
wrap is a thin shell over the live site. Pros: no rebuild needed when frontend
changes; same code path as web. Cons: requires network for ALL UI, even cached.

When v0.2 ships offline support (PowerSync per R5), flip `server.url` to `null`
and bundle the static files. That triggers a full Xcode/Studio build for every
release — but the app works on a roof with no LTE.

## 6. What you do NOT need yet

- **Apple Push Notification key** — only needed when you actually send pushes
- **Firebase project for Android** — only for push; can ship without and add later
- **Privacy nutrition labels** — REQUIRED in App Store Connect, but for the wrap
  the answers are: collects camera + location + diagnostic data, none linked to
  identity at v0.1 since auth is flag-gated off. Revisit when auth ships.
- **Sign in with Apple** — research/R4 confirms B2B exemption applies because
  TreeQ uses org-style accounts (Spartan = first org). Skip until Google login
  is added, then add SiwA simultaneously per App Store §4.8.
