# PHC Rx App — Technical Teardown & Strategic Takeaways for TreeQ

**Source:** https://go.phcrx.app/
**Operator:** Mobile Tree Spa LLC ("Mobile Tree Spa™")
**Tagline:** "Diagnose • Prescribe • Treat" — professional plant health care diagnostics
**Investigation date:** 2026-05-09
**Method:** Public-surface only — HTML, manifest, network shape, library fingerprints, computed styles. No authenticated/proprietary content was extracted. All findings are derivable from the unauthenticated landing page.

---

## 1. Front-end stack (definitive)

| Layer | Technology | Evidence |
|---|---|---|
| Framework | **Next.js (App Router)** | `self.__next_f.push(...)` RSC streaming payload; `[slug]` catch-all route; build ID `C2dLaLtmdc85P0id36OMr` |
| Bundler | **Turbopack** | Chunk filename `chunks/turbopack-1a3126e4f08878c2.js` |
| Rendering | **React Server Components + client hydration** | RSC payload format with `$Sreact.fragment`, `I[20446,...]` lazy refs |
| CSS | **Tailwind CSS** with arbitrary-value syntax | Classes like `z-[100]`, `max-w-[420px]`, `flex-col-reverse p-4 sm:bottom-0` |
| Component library | **shadcn/ui (Radix primitives)** | Tokens `bg-background`, `text-muted-foreground`, `border-border`, `bg-primary/10`; `data-radix-scroll-area-viewport`; `data-state` attrs |
| Icons | **Lucide React** | Classes `lucide lucide-scale`, `lucide lucide-shield`, `lucide lucide-triangle-alert` etc. |
| Toasts | **Sonner** | `[data-sonner-toaster]` selector in inline CSS |
| Calendar | **FullCalendar.io** | `--fc-*` CSS vars, `.fc` classes, `data-fullcalendar` attribute |
| Onboarding tour | Custom or react-joyride/driver.js style | `data-tour="add-plant|nav-home|nav-learn|nav-profile"` anchors |
| PWA | **Standalone, custom install prompt** | `manifest.json`, `mobile-web-app-capable`, `apple-mobile-web-app-title`; `pwa-install-dismissed` localStorage key with timestamp |
| Mobile keyboard | iOS-friendly viewport | `interactive-widget=resizes-content` |

### Theme tokens (HSL, shadcn-style)
- `--primary: 160 45% 22%` → `#1F5C43` forest green
- `--background: 30 15% 97%` → warm off-white `#f7f5f2`
- `--accent: 38 92% 50%` → amber/orange (alerts, CTAs)
- `--radius: 0.75rem` (12px)

### Performance
- DOMContentLoaded **107 ms**, load **142 ms**, initial transfer **2.8 KB**, total **~5 KB** for the shell — heavy code-splitting (22+ chunk scripts loaded on demand).
- Scripts cached `public,max-age=31536000,immutable` with build hash in URL — textbook Next.js immutable-asset pattern.

---

## 2. Hosting / Build / Delivery

- **Vercel** — `Server: Vercel`, `x-vercel-cache: HIT`, `x-vercel-id: cle1::...` (Cleveland edge POP). Deploy hash visible in every chunk URL: `?dpl=dpl_DDv2W4jkmHWPomMxmxErpNUxAuZB`.
- robots.txt allows all bots — no SEO blocking.
- OG/Twitter card metadata properly set (1200x630 image, summary_large_image).

---

## 3. Backend

- **Supabase** at `api.phcrx.app` — custom subdomain pointed at a Supabase project. PostgREST URL pattern is unmistakable: `/rest/v1/<table>?select=col1,col2&filter=eq.uuid&order=col.asc`.
- **Auth:** Supabase Auth with **ES256 JWT** (newer asymmetric key format), stored client-side as `sb-api-auth-token` in localStorage.
- **No proprietary REST gateway** — clients hit PostgREST directly with row-level-security in Postgres doing the heavy lifting. Standard modern Supabase pattern.
- **No third-party analytics or error monitoring detected** in window globals (no GA, no Sentry, no Mixpanel/Amplitude/PostHog/Hotjar/Intercom). They may use Vercel Analytics (loaded via headers, not window globals).

### Tables observed in network traffic
| Table | Notable columns |
|---|---|
| `profiles` | `jobber_auto_sync` (bool), `working_days`, `max_jobs_per_day` |
| `clients` | name (sortable) — likely the standard CRM block |
| `plants` | referenced via `treatment_applications.plant_id` |
| `treatment_applications` | `treatment_name`, `treatment_category`, `application_date`, `application_method`, `notes` |
| `scheduled_events` | `scheduled_date` |
| `user_holidays` | `date` |

This is a classic **field-services CRM data model**: User → Clients → Plants → Treatments + a scheduling layer (events, working days, holidays).

### Integrations
- **Jobber** (`jobber_auto_sync` profile flag). Jobber is the dominant field-services CRM for tree-care companies — by integrating, they slot directly into the workflow of established arborist businesses.

---

## 4. Product structure (visible without auth)

### Bottom-nav (5 tabs)
1. **Home** (`data-tour="nav-home"`)
2. **Clients**
3. **Risk** ← interesting; likely hazard-tree / pest risk assessment
4. **Learn** (`data-tour="nav-learn"`) — built-in education content
5. **Account** (`data-tour="nav-profile"`)

### Primary CTA
- **"Add New Plant"** (`data-tour="add-plant"`) — the verb the whole product orbits.

### Dashboard widgets seen
- KPI counters: **Total Plants**, **Diagnosed**
- **Treatment Calendar** (FullCalendar, week view) with day-of-week mini bar
- Empty-state CTA: "Add Your First Plant"

### Other UX patterns
- **Terms & Conditions gate** before any app access — 12 sections (Nature of Service, User Responsibilities, Disclaimer of Warranties, Limitation of Liability, Indemnification, Professional Standards, Product Information, Modifications, Governing Law, Contact, Acknowledgment, plus opt-in checkbox). Strong liability shield for a product giving treatment recommendations.
- **"Subscribe Now"** button visible — paid subscription model.
- **Feedback widget** — "Report bugs or request features" prominently in the header.
- **Onboarding tour** with `data-tour` anchors hooked to key UI elements.
- **PWA install prompt** with dismissal-tracking (`pwa-install-dismissed` timestamp in localStorage).

---

## 5. What we should adopt for TreeQ (IP-clean)

Each of these is either an industry-standard architectural pattern, a public open-source library, or a UX convention. None of them require copying PHC Rx's code, copy, brand, or proprietary content (treatment recommendations, plant taxonomy, education materials).

### Architecture
1. **Next.js App Router on Vercel** — if we're not already there, this is the obvious modern stack. Free Vercel tier handles early traffic.
2. **Supabase as the backend, PostgREST direct from client + RLS** — eliminates the custom-API layer. Lets a one-person team move fast. Auth, storage, realtime, and edge-functions all in one. Use Supabase's ES256 JWT format from the start.
3. **Per-deploy immutable static assets** — `?dpl=...` query-string busting + `Cache-Control: immutable` so updates roll out cleanly without stale caches.

### UI / UX system
4. **Tailwind + shadcn/ui + Radix** — gives us a high-quality, accessible component baseline without building from scratch. Use HSL CSS variables for theming so we can swap palettes (e.g., light/dark) cheaply.
5. **Lucide for icons** — large, consistent, free, tree-shakable.
6. **Sonner for toasts** — lightweight, accessible, looks right out of the box.
7. **FullCalendar.io for any scheduling view** — battle-tested, customizable. Heavier than a homegrown grid but worth it.
8. **HSL theme tokens** — `--primary`, `--background`, `--card`, `--accent`, `--ring`, `--radius` — easy to re-skin and matches the shadcn ecosystem. (Our TreeQ palette will obviously differ from their forest green / amber.)

### Mobile / PWA
9. **PWA manifest + standalone display + iOS web-app meta tags** — installs to phone home screen, full-screen, splash color. Critical for an in-the-field arborist app where users hate switching apps and may have spotty signal.
10. **Custom install prompt with dismissal tracking** in localStorage so we don't nag users who said no.
11. **`interactive-widget=resizes-content` viewport** — fixes the iOS keyboard-overlap bug for native-feeling forms.

### Product / commercial
12. **T&C gate with checkbox + "I agree" before anything else** — for any app that gives diagnosis or treatment guidance, this is essential liability protection. Mirror their 10-section legal scaffold structurally (Nature of Service, User Responsibilities, Disclaimer of Warranties, Limitation of Liability, Indemnification, Professional Standards, Product Information, Modifications, Governing Law, Contact) — but the wording must be drafted by our own attorney. Make the agreement explicit: app is a diagnostic *aid*, not an absolute decision-maker; users verify results, follow product labels, comply with regs, hold required licenses.
13. **Subscription paywall (Stripe via Supabase)** — mirror the "Subscribe Now" gate. Don't ship a perpetual free tier we can't sunset later. Could be freemium-with-limits ("3 free estimates" — analogous to their "0 plants" empty state).
14. **Feedback widget** baked into the chrome — even a single `<a href="mailto:...">` or a Tally/Notion form button in the header. We ship faster when feedback is one tap away.
15. **Onboarding tour** — `data-tour` anchors on the key first-use elements + Joyride/driver.js. The path: do-the-core-action → see-the-result → discover-secondary-features.
16. **Education tab ("Learn")** — pulls double-duty: SEO surface, value-add content marketing, and supports the "educational resource" framing in the T&C. For TreeQ this is where care guides, species ID, hazard signs, etc., live.
17. **Data model template:** User → Clients → Plants/Trees → Treatments (or Estimates), plus a scheduling layer (events, working_days, max_jobs_per_day, holidays). Even if TreeQ's primary verb is "estimate" not "treat," the same shape works. Worth building toward.
18. **Field-CRM integration as a moat** — they integrate with Jobber. We should plan a Jobber export/integration *day one* (or at minimum CSV export to it). Tree-care companies who already use Jobber will not switch CRMs for a single estimating tool — meeting them where they are is the wedge.

### What NOT to copy (IP / brand line)
- Their **logo, color palette, copy, T&C wording, treatment names, education content, plant taxonomy, product recommendations, screenshots, layout pixel-for-pixel**.
- Their **brand voice and naming** — "PHC Rx," "Mobile Tree Spa™," "Diagnose • Prescribe • Treat."
- Their **specific feature taxonomy** if it's distinctive (the "Risk" tab is a *category* we can have, but not a clone of their UI/data).

We are taking architectural ideas, library choices, and industry-standard UX patterns — all freely available — and applying them to TreeQ's distinct problem (aerial cut estimating in Rochester, with our own data model and UX).

---

## 6. Open questions / next probes (when useful)

- Do they expose a public marketing site separately (`phcrx.app` vs `go.phcrx.app`)? Worth checking for pricing, positioning, target persona.
- What's behind the "Risk" tab — diagnostic decision tree, ML model, or rule-based scoring? Affects how moaty their core IP is.
- Education tab content depth — user-generated, curated, or AI-generated?
- Any iOS/Android wrapper (Capacitor/React Native) or pure PWA? Standalone PWA suggests pure web for now.
