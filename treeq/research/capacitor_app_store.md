# TreeQ → App Store + Play Store Path

Compiled 2026-05-12 via WebSearch + WebFetch.

## 1. Capacitor wrap basics

Capacitor copies a folder of compiled web assets into a native iOS Xcode project and a native Android Studio project, loads `index.html` inside a `WKWebView` / `WebView`. The contract is `webDir` in `capacitor.config.ts`.

**Today:** TreeQ can wrap the existing static `index.html` directly. `npx cap init`, set `webDir: 'public'`, `npx cap add ios`, `npx cap add android`. No build system required.

**Inflection point:** When TreeQ migrates to Next.js (planned, per memory), `webDir` becomes `out/` (`next export`).

**Recommendation:** raw static for v0.1 store submission. Migrate to Next.js when math engine ships.

## 2. iOS App Store — the four risks

### Risk 1: Guideline 4.2 "minimum functionality" — the wrapper trap

Apple rejects apps that "look and feel like a mobile browser." Reviewers hunt for: Safari-style loading bars, hamburger-only navigation, no push notifications, no native permission prompts, browser "You are offline" error.

**TreeQ must demonstrate at least 3 native integrations to clear 4.2:**
1. **Native push notifications** via APNs + `@capacitor-firebase/messaging`
2. **Native camera** via `@capacitor/camera` (needed for tree photos anyway)
3. **Native geolocation** via `@capacitor/geolocation` (needed for job-site addresses)
4. **Working offline state** — TreeQ-branded screen + queue-and-retry, not the WebKit page
5. **No browser chrome** — native splash via `@capacitor/splash-screen`

These are not optional for first submission.

### Risk 2: AI-specific guidelines (post-Nov 13, 2025)

Apple's Nov 2025 update added rules targeting third-party AI calls:
- **Guideline 5.1.2(i)** — explicit in-app disclosure when personal data is transmitted to a third-party AI service, with **named identification of the AI provider** (Anthropic). Generic privacy-policy links insufficient — Apple wants an in-app pop-up or visible consent surface.
- Adjust **age rating** in App Store Connect questionnaire honestly.

### Risk 3: Sign in with Apple — TreeQ has a B2B exemption

Guideline 4.8 excludes "education, enterprise, or business apps that require the user to sign in with an existing education or enterprise account."

**TreeQ is multi-tenant SaaS — each user logs in with their company's TreeQ account → does NOT need Sign in with Apple.** Only triggers if you add consumer-style "Sign in with Google/Facebook/Twitter."

If Google login is added later, must add Sign in with Apple or another privacy-compliant equivalent.

### Risk 4: In-app purchases vs Stripe

**TreeQ does not need IAP.** B2B SaaS subscription that the COMPANY pays for, where value is delivered as a tool the salesperson uses in the field, falls under the long-standing exception for services consumed outside the app.

Additional post April 30, 2025 *Epic v. Apple* injunction enforcement: U.S. storefront apps may link to external payment systems with NO commission.

**Decision:** charge tenants through Stripe via web portal. iOS app NEVER has a "buy" button inside the app. User logs in to already-paid account. Cleanest posture.

## 3. Privacy nutrition labels

Required for every submission. TreeQ v0.1 declarations:
- Contact info (name, email, phone for account creation)
- User content (tree photos, audio if voice ships)
- Identifiers (user ID, device ID via analytics)
- Diagnostics (crash logs)
- Location (precise if geocoding job sites)

Required additionally for 2025: **privacy manifest file** (`PrivacyInfo.xcprivacy`) for apps using "required reason" APIs. Capacitor 6+ ships a privacy manifest by default — TreeQ adds entries for its plugins.

**Account deletion functionality is mandatory** if app allows account creation. TreeQ must expose "Delete account" in-app.

## 4. Apple Developer Program — $99/yr

Individual = personal name on Seller field. Organization = TreeQ Inc.

**Recommendation:** enroll as Organization under TreeQ Inc. when the Delaware C-corp is formed. Requirements: legal entity, D-U-N-S Number (free, 1–5 business days from Dun & Bradstreet), Apple manual verification (1–2 weeks). Apple does not accept DBAs.

**Stopgap:** Individual enrollment under Cameron's name now to ship TestFlight to sales team, migrate to TreeQ Inc. later via Apple's account-transfer process. The migration is supported but tedious — wait for incorporation if possible.

## 5. Realistic iOS timeline

- DUNS lookup + Apple Org enrollment: 1–3 weeks
- Initial Xcode project + first TestFlight build: 1–2 days
- Reviewer queue + first review: 24–48 hours average in 2025, first-submission accounts sometimes 3–5 days
- Rejection cycles for 4.2 wrapper concern: budget 1–2 rejections. Most Capacitor first submissions get hit. Fix = more native bridges + written cover note describing native integrations.
- **End-to-end: 4–8 weeks** realistic for first-time submitter. Optimistic 3 weeks.

## 6. Google Play

- **$25 one-time** Play Console fee.
- Tracks: Internal (100 testers, instant), Closed (named tester lists), Open (anyone), Production.
- **12-tester rule** applies ONLY to personal accounts created after Nov 13, 2023 (was 20, relaxed to 12 in Dec 2024). Requires 14 consecutive days of opt-in before promoting to production.
- **Does NOT apply to organization accounts.** Enroll Play Console under TreeQ Inc. (verified business, requires D-U-N-S same as Apple) → skip 12-tester requirement entirely.

**Strongly recommend org enrollment from day one.** Personal enrollment to move fast = corral 12 real users on real Android devices for 14 days before production.

Gotchas:
- Android 14+ targets `compileSdk 34+`. Capacitor 6 already does this.
- **Data Safety form** required before publishing.
- AndroidManifest permissions (location/camera/mic) need Data Safety justification.
- **App Bundle (.aab) only** for new apps. Capacitor's standard Android Studio build produces `.aab` natively.

## 7. Push notifications architecture

Modern stack: **FCM for both platforms**, bridged via `@capacitor-firebase/messaging`.

```
[TreeQ app] -- on first launch -- requestPermissions()
            -- registers with FCM -- receives FCM token
            -- POSTs token to Supabase user_devices table
                                                |
                                                v
[Supabase Edge Function] -- on event (quote viewed, job approved, etc.)
            -- calls FCM HTTP v1 API with target token + payload
            -- FCM routes to APNs (iOS) or Play Services (Android)
            -- device shows notification, deep-links into TreeQ
```

iOS-specific: requires APNs auth key (`.p8`) uploaded to Firebase → requires paid Apple Developer account. Push entitlement in Xcode's Signing & Capabilities.

Android: works out of box once `google-services.json` is in `android/app/`.

## 8. Offline support — the most important architectural decision

TreeQ is a field tool. Trucks parked under tree canopy, rural addresses, dead-zone valleys. **IndexedDB alone is not safe** — iOS can purge it under storage pressure.

**Recommended stack: PowerSync on Capacitor + Supabase.**

PowerSync shipped an official Capacitor SDK in 2025. Pairs natively with Supabase. Gives you:
- **Native SQLite** on iOS/Android (durable, not purgeable)
- **Bidirectional sync** with Postgres via "sync rules" (server-side row filtering — important for multi-tenancy)
- **Persistent upload queue** — writes made offline survive force-quits and replay when back online

**Alternatives ruled out:**
- Replicache — browser-only, no native mobile clients
- Yjs — collaborative editing, not transactional sync
- Plain IndexedDB — fragile on iOS

**Design principle:** treat local SQLite as source of truth; PowerSync reconciles to Postgres in background. Salesperson never sees a "saving..." spinner.

## 9. Voice input

**Critical: Web Speech API does NOT work inside iOS WKWebView**, only in Safari itself (WebKit bug 239816). Returns immediate error without prompting mic access.

**Right approach: native bridge via `@capacitor-community/speech-recognition`** — bridges to native `SFSpeechRecognizer` on iOS and `android.speech.SpeechRecognizer` on Android. On-device, free, low-latency, no API cost.

**Whisper as fallback / higher-accuracy mode:**
- OpenAI Whisper API: $0.006/min for `whisper-1`, $0.003/min for `gpt-4o-mini-transcribe`, ~2.1s median latency for short clips.
- TreeQ typical use ("DBH 24, full removal, two crane picks" — ~10s speech): ~$0.001/dictation. Negligible.

**Pattern:** native speech for live "tap to dictate" UX (instant). Queue audio file to Whisper server-side for higher-accuracy reprocessing if confidence is low. Critical: Whisper crushes Web Speech API in noise — 9.3/10 vs 2.5/10 on noisy benchmarks. Chainsaw-adjacent audio = Whisper.

**WKWebView mic permissions are painful** — "forgets" granted permissions on relaunch, users get re-prompted every launch unless you use native plugin. Use `@capacitor-community/speech-recognition` or `mozartec/capacitor-microphone`.

## 10. OTA updates

**Ionic Appflow shutting down 2026.** Alternative: **Capgo** ($12/mo) or roll your own with `@capacitor/live-updates` (Capacitor's own plugin, but you host the update server).

**Apple rule:** OTA can update JS/CSS/assets, NOT native code. Don't ship fundamentally different feature sets via OTA without resubmission.

**For TreeQ:** pricing methodology lives in Supabase Edge Functions (server-side), LLM prompts are server-side. Don't actually need OTA to update most of TreeQ. Native shell renders whatever Supabase returns.

**Defer Capgo until actually needed.**

## 11. Total dev-side cost (year 1)

- Apple Developer Program (Org): **$99/yr**
- Google Play Console: **$25 one-time**
- D-U-N-S Number: **$0** (free)
- Firebase (FCM only): **$0** Spark plan, well within free tier
- PowerSync: **Free dev tier**, $35/mo when production scale
- Capgo OTA: **$0 deferred**, $12/mo when needed
- Whisper API (10k dictations/mo estimate): **~$10/mo**

**Year-one floor: $124.** Realistic year-one with PowerSync + Whisper at small scale: **~$700**.

## 12. What to do first vs defer

**Do first (before any submission):**
1. Form TreeQ Inc., file for D-U-N-S Number, enroll Apple Developer Program (Org) + Google Play Console (Org) under it
2. Add `@capacitor/camera`, `@capacitor/geolocation`, `@capacitor/push-notifications` to existing static HTML site. Wire to UI buttons. **This is the 4.2 insurance.**
3. Replace any browser-style offline message with branded TreeQ offline screen + retry-queue
4. Set up Firebase project, get APNs key into Firebase, register devices on login
5. Build the privacy manifest + working in-app "Delete account" flow
6. Submit to TestFlight + Play Internal Testing — get the loop tight before touching production tracks

**Defer until after first store approval:**
1. PowerSync migration (Supabase reads can be straight HTTP for v0.1; field reliability is v0.2 problem)
2. Capgo OTA (server-side methodology means rarely needed for shell)
3. Whisper server-side — ship with native speech recognition first
4. IAP — never adopt; stay on Stripe via web checkout
