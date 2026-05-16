# R4 — Apple Developer + Google Play Enrollment Walk-throughs

> Two click-by-click walk-throughs for getting NMC LLC into the Apple Developer Program and Google Play Console as an organization, plus pre-flight checklists and known rejection patterns for tree-service apps.
> Cameron has applied for D-U-N-S under the "I'm an Apple developer" path; Apple Developer enrollment is queued for when the DUNS lands. Google Play Console is queued at $25 one-time.
> Prepared 2026-05-10 overnight session #2.

---

## TL;DR

- **Apple:** $99/year. D-U-N-S required (already in flight per chat dump). Verification phone call with a real Apple employee — Cameron must answer, confirm the D-U-N-S details, and have the LLC's website public. End-to-end enrollment timeline: D-U-N-S (5 days) + Apple review (24 hrs to 5 days). Renewals are auto.
- **Google Play:** $25 one-time. D-U-N-S also required for organization accounts as of 2024+. Government-issued photo ID + business documents required. Phone verification + email verification. Timeline: 1–7 days post-submission, sometimes longer if documents need re-upload.
- **Common-rejection patterns to avoid:** placeholder/dev-mode UI, missing demo credentials, unclear privacy disclosure (especially around GPS in P3+), wrong category, screenshots that don't reflect the live app.
- **Pre-flight checklist** at the bottom — don't start either enrollment before everything in the checklist is true.

---

## 1. Apple Developer Program — click-by-click for an LLC

### Pre-flight (do these first)

- [ ] Apple ID created with `cameron@spartantreeny.com` (NOT `cameronemiller3@gmail.com` — keep personal vs business separate). Use 2FA.
- [ ] D-U-N-S Number for **NMC LLC** assigned by D&B.
  - Lookup: <https://developer.apple.com/enroll/duns-lookup/>
  - If not yet assigned, request via the Apple D-U-N-S form (free, 5 business days).
  - **Critical:** the legal entity name on the D&B record must match exactly what you'll put in Apple's enrollment form. "NMC LLC" vs "NMC, LLC" vs "Next Million Co LLC" — pick the one D&B has and use that everywhere. Subsplash help docs note this is the #1 enrollment failure cause.
- [ ] LLC website is **public** with your business name, address, phone visible. Apple's verification call will ask Cameron to navigate to it during the call. nextmillion.co or treeqapp.com both work as long as they show "NMC LLC" somewhere obvious (footer is fine).
- [ ] Cameron's phone number reachable during business hours.
- [ ] Tax ID (EIN) ready — Apple's tax onboarding asks.

### Steps

1. Go to <https://developer.apple.com/programs/enroll/>.
2. Sign in with the Apple ID from pre-flight.
3. Choose **"Company / Organization"** (not Individual). Individual lets you ship under your personal name; for the LLC IP-protection story, organization is the right move.
4. Apple presents legal terms and the enrollment form. Fill in:
   - Legal entity name: **NMC LLC** (or whatever exact form D&B has)
   - D-U-N-S Number: 9 digits
   - Headquarters address: matches D&B exactly
   - Website URL: nextmillion.co or treeqapp.com
   - Apple ID phone: Cameron's mobile
   - Role: **Owner** (Cameron has signing authority for NMC LLC)
5. Submit. Apple emails an "enrollment in progress" confirmation.
6. Within 1–5 business days, Apple calls. You can also speed this up by visiting the [enrollment account page](https://developer.apple.com/account/membership/) → "Phone" → "Call Me" to request the call now.
7. **The verification call.** Apple asks:
   - Confirm legal name + D-U-N-S
   - Confirm Cameron is authorized to bind NMC LLC to the agreement
   - Sometimes asks Cameron to navigate to the LLC website live during the call to confirm public listing
   - Total call: usually 5–10 minutes
8. After the call, Apple emails a "Welcome to the Apple Developer Program" with a payment link. Pay $99 (annual). 
9. Account is live. Cameron can now create App IDs, certificates, provisioning profiles, and submit apps to App Store Connect.

### Renewals

Auto-renewal at $99/year unless cancelled. Apple emails 30 days before. If renewal fails (expired card), enrolled apps are delisted from the App Store within 30 days.

---

## 2. Google Play Console — click-by-click for an LLC

### Pre-flight

- [ ] Google account with `cameron@spartantreeny.com` (NOT personal Gmail). Use 2FA.
- [ ] D-U-N-S Number — required for new organization-account creation since 2024 ([Required information to create a Play Console developer account](https://support.google.com/googleplay/android-developer/answer/13628312)).
- [ ] Government-issued photo ID for Cameron (driver's license, passport).
- [ ] Business documents: NMC LLC Certificate of Formation OR EIN letter from IRS OR business license.
- [ ] Phone number (different from Apple's? same is OK; will be public on the Play store listing per Google's transparency policy).
- [ ] Public-facing email address (same caveat — appears on the Play listing).
- [ ] $25 USD for the one-time fee.

### Steps

1. Go to <https://play.google.com/console/signup>.
2. Sign in with the Google account from pre-flight.
3. Choose **"Organization"** (not Personal).
4. Fill in organization details:
   - Organization name: **NMC LLC** (match D&B + Apple)
   - Address: matches D&B exactly
   - D-U-N-S Number
   - Public website
   - Public phone
   - Public email
5. Pay the $25 one-time fee.
6. Within 24–48 hours, Google emails about identity verification. Two paths:
   - **Identity verification:** upload Cameron's government-issued ID via the secure upload link
   - **Organization verification:** upload Certificate of Formation / EIN letter / business license
7. Google may also send a verification SMS/call to the phone number. Answer.
8. **Wait 1–7 days** for Google's review. Some accounts get approved same-day; others sit for a week. If a document is rejected, Google emails — re-upload the requested clearer or more recent version.
9. Once approved, account is live. Cameron can create the TreeQ app listing, upload signed APKs, and submit for Play review.

### Notable in 2026

- Google Play **requires testing** before production: 12 internal testers + 14-day closed testing period (per current Play policy as of 2024; still in force May 2026). This adds calendar time the first time you ship — plan for it.
- Personal-account → organization migration is **not supported.** If Cameron starts with a personal account, he'd have to make a new organization account from scratch (with D-U-N-S etc.). Start org-only.

### What's different from a personal account

- Personal: $25, no D-U-N-S, less verification, faster approval.
- Organization: $25, D-U-N-S required, more verification, can list a company name on the Play store, supports multi-user team access. **For NMC LLC + the IP-protection story, organization is the right choice.** Your customers see "NMC LLC" as the developer, not "Cameron Miller."

---

## 3. Common rejection reasons (and how to avoid them)

### Apple App Store

Per [App Store Review Guidelines](https://developer.apple.com/app-store/review/guidelines/) and 2026 reviewer-experience writeups:

| # | Reason | TreeQ-specific mitigation |
|---|---|---|
| 1 | Crashes / placeholder content / "Coming soon" screens (§2.1) | Submit only when v1 is feature-complete and stable. Don't ship with the SMS-fallback button if SMS isn't working. |
| 2 | Missing demo credentials for review (§4.0) | Provide a test account in the Apple Reviewer Notes field: anonymous-mode is fine for v1, but if v2 has auth, give reviewer a `reviewer@treeqapp.com` test login. |
| 3 | Unclear app purpose (§2.3) | TreeQ's purpose is clear from the picker UI on first launch. Add a 1-line tagline ("Tree dismantling time + cost calculator") in the App Store description. |
| 4 | Privacy disclosure mismatch (§5.1) | Privacy nutrition labels must match what the app actually does. v1 collects nothing (no auth, no GPS). v2 collects email + GPS — declare both. |
| 5 | Sign in with Apple missing (§4.8) | When Google login lands (P2), Apple Sign-In must also be present on iOS. Don't ship Google-only on iOS. |
| 6 | Web-view-only apps (§4.2) | Pure WebView apps can be rejected as "not native enough." TreeQ's saving grace: it works offline, has native plugins (geolocation in P3, push later), and the picker is highly interactive. Mention native plugins in reviewer notes. |
| 7 | In-app purchase bypass (§3.1.1) | Not relevant for v1 (no payments). Becomes relevant when monetization flips per `treeq_pricing_strategy`. Plan for IAP integration alongside Stripe. |

### Google Play

Per [Play Console policy](https://play.google.com/about/developer-content-policy/):

| # | Reason | TreeQ-specific mitigation |
|---|---|---|
| 1 | Permission overreach | Don't request permissions until needed. v1 needs only `INTERNET`. P3 adds `ACCESS_FINE_LOCATION` for GPS-stamp. Request at the moment of use, not at install. |
| 2 | Targeted SDK out of date | Target SDK 35 minimum as of late 2024. Capacitor 7 default already targets 35. Just don't downgrade. |
| 3 | Missing privacy policy | Mandatory for ALL apps regardless of data collection. Even v1 with zero collection needs a privacy policy URL. Host as `treeqapp.com/privacy`. |
| 4 | Misleading store listing | Screenshots must match the actual app. No mocked screens, no compositing of features that don't ship. |
| 5 | Account verification incomplete | Common for organizations — Google rejects fuzzy ID photos, expired licenses. Use a clean recent ID upload. |
| 6 | Tree-service / contractor apps with payment | If TreeQ later takes payments and offers them outside Google Play's billing, Google rejects (or strips the app of in-app payment). v1 has no payment; flag for monetization phase. |

### Industry-specific (tree service / contractor apps)

There's no Apple/Google rejection bucket called "tree service." But contractor-style apps tend to draw scrutiny on:
- **Location permissions** — reviewer asks "why does this app need GPS?" Answer ready: "to stamp the location of saved trees on a property for crew dispatch." Have it documented in the description.
- **SMS/communications integration** — Apple sometimes asks about server-side SMS (R6's Quo handler). Reviewer not blocked by this; the app itself doesn't send SMS, the server does. The `sms:` URI just opens the user's Messages app, which is allowed.
- **Pricing claims in marketing** — "$1,425 estimate" type screenshots are fine as long as the app description says these are estimates, not contractually-binding quotes.

---

## 4. Pre-flight master checklist (both stores)

Don't start either enrollment until **all** of these are true:

- [ ] **NMC LLC** is the legal entity name; verify EXACT spelling on (a) state filing, (b) D&B record, (c) tax records. All three must agree.
- [ ] D-U-N-S Number issued and confirmed in Apple's lookup tool.
- [ ] Public website at a domain you control (nextmillion.co or treeqapp.com), live, showing the LLC name + address + phone.
- [ ] Privacy policy at `<domain>/privacy` (mandatory for both stores). Even for v1 with zero data collection — the page can say "TreeQ does not collect any personal data in v1.0" and that satisfies the requirement.
- [ ] Support URL at `<domain>/support` or a contact email.
- [ ] App icon (1024×1024 master, no alpha, no rounded corners — Apple/Google round automatically).
- [ ] Splash screen assets (Capacitor's `@capacitor/assets` plugin generates).
- [ ] Screenshots of the working app on real-device sizes (6.7" + 6.5" iPhone, 5.5" iPhone, plus iPad if Cameron wants iPad listing).
- [ ] App description text (~200 words) + 30-char tagline.
- [ ] Test build runs end-to-end on iOS simulator AND Android emulator.
- [ ] Test build runs on Cameron's actual iPhone AND Android device (Apple needs you to ad-hoc install for review prep).
- [ ] **Test against R6's reviewer items:** picker works, calculator works, no console errors, no placeholder text anywhere.

---

## 5. Recommended timeline

For a real launch, work backwards from the desired launch date. Both enrollments + reviews can chain.

| Time before launch | Action |
|---|---|
| T-8 weeks | Apply for D-U-N-S (if not already); start writing privacy policy |
| T-7 weeks | D-U-N-S arrives; start Apple Developer + Google Play enrollments in parallel |
| T-6 weeks | Phone verifications complete; both accounts active |
| T-5 weeks | Build v1 with Capacitor (per R3); ad-hoc install on devices |
| T-4 weeks | Final QA; submit to TestFlight (Apple) + Google Play Closed Testing |
| T-3 weeks | TestFlight beta + Google's 14-day closed-testing window starts |
| T-2 weeks | Submit to Apple App Store review (24 hr median); submit to Google Play production review (1–7 days) |
| T-1 week | Address any rejection feedback; resubmit |
| T-0 | Launch. Both apps go live. |

---

## 6. Open questions for Cameron

1. **Email for the developer accounts.** Recommend `cameron@spartantreeny.com`. Avoid personal Gmail. Ensure 2FA is on.
2. **Public phone for the listings.** Per Google's transparency policy, this number is on the Play store listing. If Cameron doesn't want his personal cell shown, use the Quo number (which is already business-public).
3. **Tax forms.** Apple and Google both want W-9 (US) for tax reporting on app sales. v1 is free, so no tax flows yet — but the form upload is part of enrollment. Cameron's CPA can handle.
4. **Multiple developers under the LLC.** Both Apple and Google support multi-user accounts. If the LLC ever has a co-founder or hires, add them; don't share Cameron's personal Apple ID.
5. **Apple Developer renewal date.** Mark the calendar 30 days before expiry. If Cameron lapses, the apps drop from the store.

---

## Sources

- [Apple Developer enrollment](https://developer.apple.com/programs/enroll/)
- [Apple Developer membership help](https://developer.apple.com/help/account/membership/program-enrollment/)
- [Apple D-U-N-S help](https://developer.apple.com/help/account/membership/D-U-N-S/)
- [Apple D-U-N-S lookup tool guide](https://ptwired.zendesk.com/hc/en-us/articles/360045915814-Apple-Developer-Enrollment-How-to-get-a-D-U-N-S-Number-using-Apples-D-U-N-S-Number-Look-up-tool)
- [Apple App Store Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
- [App Store rejection reasons (2026 OpenSpace blog)](https://www.openspaceservices.com/blog/mobile-app-development/apple-app-store-rejection-guide-2026-the-15-most-common-reasons-and-how-to-fix-each)
- [Google Play organization account requirements](https://support.google.com/googleplay/android-developer/answer/13628312)
- [Verify your developer identity (Google Play)](https://support.google.com/googleplay/android-developer/answer/10841920)
- [Verifying Play Console for organizations PDF](https://play.google.com/console/about/static/pdf/Verifying_your_Play_Console_developer_account_for_organizations.pdf)
- [Google Play developer content policy](https://play.google.com/about/developer-content-policy/)
- [DUNS Apple registration walkthrough](https://globallinkconsulting.sg/en/article/duns-registration/duns-for-apple-developer)
- [Subsplash legal entity errors guide](https://support.subsplash.com/en/articles/9021116-legal-entity-errors-with-your-duns-number)
- Cross-references: R3 (Capacitor wrap requires these accounts to ship), R5 (Apple Sign-In is mandated when Google login is offered)
