# PHCrx Technical Stack Analysis
**Date:** 2026-05-16  
**Source:** Live inspection of go.phcrx.app via Chrome DevTools MCP  
**Purpose:** Inform TreeQ feature development — map, GPS, client selector, calendar, camera

---

## 1. Map — Mapbox GL JS (satellite-streets-v12)

### Library
**Mapbox GL JS**, bundled into the Next.js chunk (tree-shaken — no `window.mapboxgl` global, but DOM confirms it):
- Canvas class: `mapboxgl-canvas`
- Control classes: `mapboxgl-ctrl-zoom-in/out`, `mapboxgl-marker`, `mapboxgl-ctrl-logo`
- WebGL canvas present, Mapbox logo visible bottom-left

### Map style
```
mapbox://styles/mapbox/satellite-streets-v12
```
Satellite imagery with street label overlay. Tiles served as `.webp` from `api.mapbox.com/v4/mapbox.satellite/[z]/[x]/[y].webp`.

### Token security pattern (critical)
PHCrx **never exposes the Mapbox access token in the client bundle**. Instead:
1. On map init, client calls their own Supabase Edge Function: `api.phcrx.app/functions/v1/get-mapbox-token`
2. Edge function returns a scoped token
3. Mapbox GL JS uses that token for all tile/style requests

**TreeQ should do the same** — store `MAPBOX_SECRET_KEY` as a Supabase secret, serve via edge function.

### Address search (geocoding)
Address autocomplete is also proxied server-side:
- Client → `api.phcrx.app/functions/v1/mapbox-geocoding` (their edge function)
- Edge function → Mapbox Geocoding API → returns suggestions
- Results appear as combobox dropdown below the address field
- The Mapbox token never touches the browser

### Map interaction UX
- **"Search address to center map…"**: flies map to geocoded result
- **Draggable marker**: green tree-icon marker, drag to fine-tune position
- **Tap-to-reposition**: tapping the map moves the marker
- **"Recenter" button**: re-centers on current marker position
- **"Done" button**: commits the GPS coordinate

---

## 2. GPS Tagging — Browser Geolocation API

### How it works
The GPS icon next to the address field and the "Recenter" button both call:
```js
navigator.geolocation.getCurrentPosition(successCallback, errorCallback, options)
```
Browser-native Web Geolocation API — no third-party library. On mobile, prompts for permission, then returns lat/lng + accuracy.

### Flow
1. User taps GPS icon → browser requests permission
2. `getCurrentPosition` fires → lat/lng returned
3. Map flies to coordinates
4. Marker drops at position
5. User drags marker to refine (e.g., to exact tree, not street address)

### Accuracy tip shown to user
> "For best accuracy: Stand directly next to the plant when tagging. GPS accuracy improves outdoors with clear sky visibility."

Yellow warning banner — good UX copy for TreeQ to adapt.

### Property Address vs GPS Location (two separate fields)
- **Property Address** (top of form): text autocomplete via geocoding proxy → used for notifications
- **GPS Location** (below): precise lat/lng from `navigator.geolocation` → used for map pin

**TreeQ implication**: keep these separate. Address is human-readable for routing/notifications; GPS coordinate is for the map pin.

---

## 3. Client Selector — Pre-loaded Supabase Combobox

### Data loading
Clients fetched on page load from Supabase PostgREST:
```
GET api.phcrx.app/rest/v1/clients
```
All clients loaded upfront (no lazy load). Stored in React state.

### UI pattern
- shadcn/ui `<Combobox>` (same pattern as species picker)
- "Search clients…" field filters client-side against pre-loaded list
- Highlighted current selection in orange
- "+ Add New Client" CTA at bottom of dropdown

### Fields shown per client
Name, email, phone number

### Implication for TreeQ
- Load all customers on mount via single Supabase query, filter client-side
- Same combobox component as species picker = consistent UI
- Customer is optional on the Add Plant form (same as PHCrx)

---

## 4. Treatment Calendar — FullCalendar

### Library
**FullCalendar** (v5/v6), confirmed by DOM classes:
- `fc fc-media-screen fc-direction-ltr fc-theme-standard`
- `fc-timeGridWeek-view fc-view fc-timegrid`
- `fc-scrollgrid`, `fc-col-header-cell`, `fc-timegrid-axis`

### Views
Three-way toggle: **Day | Week | Month**  
Default: `timeGridWeek` (week view with hourly slots).

### Data sources (Supabase PostgREST)
```
GET api.phcrx.app/rest/v1/scheduled_events
GET api.phcrx.app/rest/v1/treatment_applications
```
Both fetched on calendar load and merged onto the same grid.

### Placement
- **Dashboard (/)**: embedded mini week view, read-only, limited height
- **Full page (/calendar)**: full FullCalendar with Today, nav arrows, view toggle

### Implication for TreeQ
- Install: `@fullcalendar/react`, `@fullcalendar/daygrid`, `@fullcalendar/timegrid`
- Feed from Supabase: jobs + scheduled treatments on one grid
- Embed mini week view on TreeQ dashboard, link to full calendar page

---

## 5. Camera / Photo Upload — HTML5 File Input

### Implementation (no third-party library)
Two hidden `<input type="file">` elements per defect, triggered by visible buttons:

```html
<!-- Camera button — opens back camera directly -->
<input type="file" accept="image/*" capture="environment" class="hidden" />

<!-- Gallery button — opens photo library -->
<input type="file" accept="image/*" class="hidden" />
```

Visible buttons call `.click()` on the hidden inputs programmatically.

### UI (bottom of each Defect card, Step 6 of risk assessment)
```
🖼  Defect Photos
[📷 Camera]  [⬆ Gallery]
```

- **Camera** → `capture="environment"` → back camera opens directly
- **Gallery** → no `capture` → photo library picker

### How `capture` works on mobile

| Platform | `capture="environment"` | No capture |
|---|---|---|
| iOS Safari | Opens Camera, back lens | "Take Photo / Photo Library" sheet |
| Android Chrome | Opens camera, back lens | File picker with camera option |

Note: `capture="user"` = front camera. `capture="environment"` = back camera (correct for tree photos).

### Upload flow (inferred)
1. User selects/captures photo
2. File read client-side
3. Uploaded to Supabase Storage
4. Storage URL stored in defect record in Postgres

### Critical Capacitor caveat
`capture="environment"` does **not** work inside iOS WKWebView (Capacitor). Must use the native plugin:

```ts
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';

// Camera (back lens)
const photo = await Camera.getPhoto({
  resultType: CameraResultType.Uri,
  source: CameraSource.Camera,
  quality: 85
});

// Gallery / photo library
const photo = await Camera.getPhoto({
  resultType: CameraResultType.Uri,
  source: CameraSource.Photos
});
```

For web/PWA (no Capacitor): plain HTML5 `<input capture>` works fine in mobile browsers.

---

## 6. Full API Surface Observed

| Endpoint | Purpose |
|---|---|
| `rest/v1/clients` | Client list (pre-loaded on page mount) |
| `rest/v1/plants` | Plant records |
| `rest/v1/scheduled_events` | Calendar events |
| `rest/v1/treatment_applications` | Treatment log for calendar |
| `functions/v1/get-mapbox-token` | Secure token vend (Supabase edge function) |
| `functions/v1/mapbox-geocoding` | Geocoding proxy (Supabase edge function) |
| `functions/v1/check-subscription` | Trial/subscription guard |

---

## 7. TreeQ Implementation Checklist

### Map
- [ ] Mapbox GL JS — `satellite-streets-v12` style
- [ ] Token served via Supabase Edge Function (never in client bundle)
- [ ] Geocoding proxied through edge function
- [ ] Draggable marker + tap-to-reposition
- [ ] Separate "Property Address" field (geocoded text) from "GPS Location" field (lat/lng)

### GPS
- [ ] `navigator.geolocation` for web/PWA path
- [ ] `@capacitor/geolocation` for native iOS/Android (required for App Store build)
- [ ] "Stand next to the tree" accuracy tip shown to user

### Client selector
- [ ] Load all customers on mount, filter client-side
- [ ] shadcn/ui Combobox with search + "Add New Customer" CTA at bottom

### Calendar
- [ ] `@fullcalendar/react` with timeGrid + dayGrid plugins
- [ ] Feed jobs table + treatment windows into one grid
- [ ] Mini embedded week view on dashboard, full page at /calendar

### Photos
- [ ] Web: `<input type="file" accept="image/*" capture="environment">` for camera
- [ ] Web: `<input type="file" accept="image/*">` for gallery (no capture attr)
- [ ] Native (Capacitor): `@capacitor/camera` plugin — mandatory for iOS App Store
- [ ] Upload to Supabase Storage, store URL in job/tree record
- [ ] Show thumbnails inline in job detail view
