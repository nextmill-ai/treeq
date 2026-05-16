# Spartan / Next Million — Mobile Design Principles

A short reference for how to design the Cut Estimator (and downstream pricing app) so it feels as friction-free as Jobber, without crossing legal lines or losing brand identity.

## The legal line, in plain English

Trade dress can protect a *specific, distinctive, non-functional* combination of visual elements that consumers associate with one brand. It does **not** protect generic UI patterns that have become industry standard.

Safe to borrow (these are functional/standard patterns, not protectable):
- Bottom tab bar with 4–5 items
- Floating action button (FAB)
- Status pills with colored dot + text
- Collapsible section rows with `+` or `→` indicators
- Big primary-action button + small secondary icon button beside it
- Tab switcher with underline on active tab
- Card-based line-item lists with thumbnail / title / price
- Large hero title at top of detail screens
- Sticky top app bar with back button + cluster of icons on the right
- Generous whitespace, near-white backgrounds, single accent color for actions

Do NOT lift:
- Jobber's exact green hex codes — use your own (#2D5A3D forest is already differentiated)
- Their custom typeface — use Inter or any free Google font
- Their icon set — use Lucide (ISC), Heroicons (MIT), or Phosphor (MIT). All free, all redistributable
- Their photography, illustrations, or brand marks
- Naming or copy that mimics theirs ("Visits", "Quotes", "Requests" with their exact phrasing)
- Anything that could cause a user to think your app *is* Jobber or is officially affiliated

The risk threshold: a Jobber user opens your app and feels at home navigating it (good — that's reduced friction), but never gets confused about *whose* app it is (essential — that's the trade-dress firewall). Your forest-green-and-gold Spartan brand identity does that work for you.

## The Spartan visual identity

Already established and worth keeping consistent across the cut estimator, the future pricing app, and nextmillion.co:

- **Forest** `#2D5A3D` — primary actions, active states, brand
- **Forest deep** `#1F3F2A` — pressed states
- **Gold** `#E9C466` — accents, brand mark, highlight on dark surfaces
- **Cream BG** `#F4F8F1` — page background; almost-white but distinctly *yours*
- **Pure white** `#FFFFFF` — cards / surfaces (this is what makes Jobber feel airy)
- **Ink** `#14241B` for headings, `#314A3A` body, `#6A7E72` muted

## Layout grammar

1. **One screen, one job.** Detail screens lead with: status pill → big bold title → subtitle → metadata → primary action. Mirror that hierarchy.
2. **Thumb zone first.** Primary actions live at the bottom of the visible area (where the thumb naturally rests), not the top. The bottom tab bar and FAB are non-negotiable on a phone-first app.
3. **48pt minimum tap target.** Everything tappable. Steppers, icon buttons, list rows.
4. **One accent color per screen.** Forest green for primary actions; everything else is neutral. Resist the urge to color every icon.
5. **Sectioned, not crammed.** Long screens are vertical scrolls of distinct rows separated by hairlines, not dense grids. Mirrors how Jobber stays scannable.
6. **No modals for primary flows.** Modals interrupt — push a new screen instead.

## Type scale (mobile)

- Display 28/800 — page hero
- H1 22/800 — section heroes
- H2 18/700 — row titles
- Body 16/400
- Meta 14/400 — secondary info
- Tiny 12/600 all-caps — section labels

Use **Inter** or **SF Pro / Roboto** (the platform default). Inter is free, modern, neutral, and reads well at small sizes.

## Free resources to pull from

- **Material Design 3** Figma kit — Google's official reference for Android patterns
- **Apple Human Interface Guidelines** + iOS UI Kit (Figma) — official iOS patterns
- **Lucide icons** (lucide.dev, ISC license) — clean, consistent line icons. Used in the design pack
- **Heroicons** (heroicons.com, MIT) — alternative
- **Mobbin** (mobbin.com) — searchable library of real app screens for pattern reference
- **shadcn/ui** — for web-side components in nextmillion.co

## What this looks like applied to the Cut Estimator

The current v1.3 file has:
- Forest panels with white text — Jobber inverts this (white panels, dark text). Switching makes it lighter, friendlier, and saves your eyes outdoors in sunlight
- DBH/height/crown sliders — keep them, but borrow the stepper pattern (`−` / value / `+`) for precise control on a phone
- Cut breakdown table — convert to row-list pattern (one cut class per row, with class name, count, time, total)
- Tree profile box — convert to a hero-style summary card at top of results
- Help Me ID quiz — keep the modal, but theme it to white-on-cream rather than green overlay, so it matches the rest

## Decision: when in doubt

If a pattern shows up in 3+ unrelated mainstream apps (Jobber, Stripe, Airbnb, Uber, etc.) it's industry-standard and safe. If it only shows up in Jobber and looks distinctive, treat it as theirs.
