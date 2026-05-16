# TreeQ — SMS Fallback Estimate Spec

> **Status:** Design draft, 2026-05-09. Not yet implemented.
> **Audience:** Cowork (Cameron) for design alignment; Claude Code for implementation tickets.
> **Related:** `ROADMAP.md` (where this becomes a phase), `CONTEXT.md` (architecture),
> `HANDOFF.md` (where individual implementation tickets get cut).

---

## 1. Why this exists

Tree work happens in field conditions where data signal is unreliable. A crew lead
in a wooded driveway, a homeowner standing under canopy, an estimator on a back
lot — any of them can have **two bars of cell voice/SMS but zero LTE/5G data**.
SMS punches through where HTTPS doesn't.

The SMS-fallback flow gives users a price even when the live app can't talk to the
server. It also doubles as a referral surface: a homeowner who can't open the web
app but *can* text our number gets an instant quote and our number lands in their
iMessage history.

### User stories

1. **The crew lead in a dead zone.** Cameron is standing in front of a 36" silver
   maple in Honeoye Falls. App says *"No internet."* He taps a "Text estimate"
   button. iMessage opens with the inputs pre-filled to TreeQ's number. Send.
   Within ~10 seconds he gets a reply text with the dismantling time and price.

2. **The homeowner who can't find the app.** Pop a yard sign or door hanger that
   says *"Text PINE 36 to (585) 555-…"* and they get a rough quote without ever
   installing anything. (Phase 2 — not in MVP.)

3. **The reconnecting app.** When the crew lead's data comes back, the app sees
   the SMS conversation in the cloud (because the account is linked to that
   phone number) and pulls the quote into the crew lead's tree history.

---

## 2. Architecture decision

**The current `index.html` v1.8 has no backend.** It's served as a static file
from Netlify. SMS handling requires a server because:

- A phone number can't deliver SMS to a static site.
- The pricing math (per memory: must stay server-side as a trade secret) can't run
  in an SMS reply that's authored client-side.
- The SMS provider (Quo) needs an HTTPS webhook URL to POST inbound messages to.

### Where the server lives — three options

| Option | Pros | Cons |
|---|---|---|
| **A. Activate parked `deploy/` v2.3 (Cloudflare Worker)** | Already scaffolded; `wrangler.toml` exists; matches the long-term IP-protection plan; co-locates SMS handler with the pricing engine | Pulls forward Cloudflare Access setup and the v2.3 migration; bigger change |
| **B. Standalone tiny worker just for SMS** | Smallest possible change to current architecture; can ship in days | Duplicates the pricing math (or makes a fetch back to itself); two deploys to maintain |
| **C. Supabase Edge Functions (per memory's stated plan)** | Aligns with the "TreeQ — methodology stays server-side" memory direction; one auth/RLS surface for everything | Adds a new vendor before we've adopted Supabase for anything else; bigger commitment |

**Recommendation: Option A.** Activating the v2.3 path now is the right move
because (a) it's already designed, (b) the pricing math is already extracted into
`deploy/functions/lib/math.js`, and (c) the moment we put pricing math behind an
SMS endpoint, we want the calibration coefficients off the client anyway — that's
exactly what v2.3 does. SMS-fallback becomes the trigger that makes us actually
ship v2.3.

If Cameron wants to defer the v2.3 migration, Option B is the fast lane. The
spec below assumes Option A; the SMS-specific code is identical either way.

### Why Quo, not Twilio

Per the chat-dump update: Cameron is already a Quo (formerly OpenPhone) user. Quo's
business-line API supports programmatic inbound webhooks and outbound SMS at
per-segment pricing already inside Cameron's plan. SMS-quote conversations land
in the same Quo inbox as Cameron's human customer calls — that's an informal CRM
win we don't want to forfeit by routing to a separate Twilio number. Twilio is
fine technically but adds a vendor and bifurcates the conversation history.

**Implication:** the server speaks Quo's API, not Twilio's. The webhook payload
shape and outbound message endpoint are Quo-specific. If we ever need
Twilio for international or for higher throughput, the abstraction is small —
one adapter module — but we're not building it day one.

---

## 3. Packet format

The user can't type out a multi-field tree spec by hand on a flaky connection.
The app encodes their inputs into a short, prefix-tagged string that the server
parses deterministically.

### Format

```
TQ#<v>#<acct>#<species>#<dbh>#<height>#<crown>#<trim>#<over48>#<flags>#<zip>
```

- **`TQ`** — fixed magic prefix. Lets the server distinguish TreeQ packets from
  noise. Lets us recognize accidentally-typed packets from regulars.
- **`<v>`** — packet schema version, single character. `1` for now. Bump when
  fields change.
- **`<acct>`** — account/device short ID. 6-character base32 (Crockford).
  Server resolves to user account; binds the quote to the right history.
  Falls back to `anon` for unauthenticated or first-use cases.
- **`<species>`** — 3-character species code (see §3.2 below).
- **`<dbh>`** — diameter at breast height in inches, integer 1–90.
- **`<height>`** — total tree height in feet, integer 5–200.
- **`<crown>`** — crown radius in feet, integer 1–80 (trunk-to-farthest-tip).
- **`<trim>`** — trim percentage bucket, integer 0–4 (0=0–10%, 1=10–25%,
  2=25–50%, 3=50–75%, 4=75–100%; matches v1.8 segmented control).
- **`<over48>`** — `Y` or `N`. If `Y`, the DBH slider was extended to 49–90".
- **`<flags>`** — single character. `_` = none. `S` = storm/hazardous.
  `R` = roping required (close to structure). `C` = crane access needed.
  Multiple flags get bitwise-coded into one character (a-z = bitmap).
- **`<zip>`** — 5-digit ZIP code. Drives regional cost lookup.

Maximum length: ~46 chars. Well under SMS 160-char single-segment limit, leaving
~110 chars for human commentary the user might add ("homeowner says hurry").

### Example

```
TQ#1#3RKQ7P#ACR#36#65#22#1#N#S#14624
```

- v1, account `3RKQ7P`, **maple** (`ACR` = Acer), **36"** DBH, **65 ft** tall,
  **22 ft** crown radius, trim bucket **1** (10–25%), **not** over-48,
  flag **S** (storm/hazardous), Rochester ZIP **14624**.

### Species codes

3-character codes derived from the genus Latin name. Curated table in
`deploy/functions/lib/species-codes.js`. Examples:

| Code | Genus / species |
|---|---|
| `ACR` | Acer (maples) — generic |
| `ACR_R` | Acer rubrum (red maple) — extended form when the user picked a specific species |
| `QRC` | Quercus (oaks) — generic |
| `FRX` | Fraxinus (ashes) |
| `PIN` | Pinus (pines) |
| `PCA` | Picea (spruces) |
| `TSG` | Tsuga (hemlocks) |
| `JUG` | Juglans (walnuts) |
| `LIR` | Liriodendron (tulip tree) |
| `PLT` | Platanus (sycamore / planetree) |
| `OTH` | Other / unknown |

Species-level specificity is optional — the server can price from genus alone
using calibration averages and respond with a flag noting "generic-genus
estimate, ±15%".

### Generation rules (client side)

The packet must be **stable** — the same inputs produce the same string. Sort
key order is fixed. Empty optional fields are `_`, never omitted. Any string
the client produces should round-trip through the server's parser unchanged.

### Validation

Server rejects packets that:
- Don't start with `TQ#`
- Have wrong field count
- Have a version it doesn't recognize (replies with "Update your app")
- Have out-of-range numerics (replies with "Bad input: <field>")
- Have an unknown species code (replies with "Unknown species, defaulting to
  genus average; reply with `Y` to confirm or pick another")

---

## 4. Server flow (Quo webhook handler)

```
Inbound SMS hits Quo number
  ↓
Quo POST → /api/sms/inbound  (HMAC-signed, verify signature)
  ↓
Parse body → extract `from`, `text`, `messageId`, `conversationId`
  ↓
Match TQ#1#... regex on `text`
  ├── No match → human message → forward to Cameron's inbox (no auto-reply)
  └── Match → continue
  ↓
Decode packet → validate
  ├── Invalid → reply with specific error message; log
  └── Valid → continue
  ↓
Resolve account: lookup `<acct>` in Supabase
  ├── Not found → treat as anon, no history binding
  └── Found → load user's calibration deltas, region, currency
  ↓
Call pricing engine: priceTree({species, dbh, height, crown, trim, over48, flags, zip})
  ↓
Format reply:
  "TreeQ — Red Maple 36"x65', trim 10–25%, hazardous
   Estimate: 2h 35m crew time, $1,425
   Reply YES to save to your history, or send another tree."
  ↓
Send via Quo outbound API
  ↓
Persist to `sms_quotes` table:
  {id, from_phone, account_id, packet, parsed_inputs, result_price,
   result_minutes, sent_at, conversation_id, status}
  ↓
Return 200 OK to Quo within 3 seconds
```

### File layout

```
deploy/
├── functions/
│   ├── api/
│   │   └── sms/
│   │       ├── inbound.js          # Quo webhook handler
│   │       └── confirm.js          # YES/save handler
│   └── lib/
│       ├── packet.js               # encode/decode TQ packets
│       ├── species-codes.js        # 3-char ↔ full species map
│       ├── quo-client.js           # Quo API wrapper (auth, send-sms)
│       └── math.js                 # existing pricing engine (re-used)
└── wrangler.toml                   # add SMS routes + Quo secrets
```

---

## 5. Client flow

### Trigger

A "Text estimate" button appears on the input screen when:
- The browser reports `navigator.onLine === false`, OR
- The last successful API ping was >30s ago, OR
- The user manually opens an "I'm offline" toggle in settings.

### Encoding

```js
// deploy/public/lib/packet-encode.js  (mirrors lib/packet.js on server)
function encodePacket({account, species, dbh, height, crown, trim, over48, flags, zip}) {
  return [
    'TQ', '1', account || 'anon',
    species, dbh, height, crown, trim,
    over48 ? 'Y' : 'N',
    flags || '_',
    zip || '00000'
  ].join('#');
}
```

### Opening Messages

```js
const TREEQ_NUMBER = '+15855551234'; // Cameron's Quo number
const packet = encodePacket(inputs);
const smsBody = encodeURIComponent(packet);
// `?body=` works on iOS and Android Chrome
window.location.href = `sms:${TREEQ_NUMBER}?body=${smsBody}`;
```

iOS and Android both honor the `sms:` URI scheme. The user sees the Messages app
open with our number in the To field and the packet pre-filled. They tap Send.

The app then:
1. Stores the packet locally in IndexedDB with a `pending: true` flag.
2. Shows a "Sent — waiting for reply" state.
3. Returns to normal flow.

### Reconnect sync

When data comes back (`window.addEventListener('online', …)`):
1. App fetches `/api/sms/quotes?since=<lastSync>` for this account.
2. Server returns recent SMS quotes for that account (matched by phone number
   via the account-to-phone linking, §6).
3. App matches them against pending packets in IndexedDB by packet hash.
4. Quote pulled into the user's tree history; pending flag cleared.

If there are SMS quotes the app didn't expect (e.g. from a different device on
the same account, or from a homeowner-facing flow), they show up as "Other
quotes from this account" in history.

---

## 6. Account-to-phone linking

The server has to know which user account a phone number belongs to. Otherwise
every SMS quote is an anonymous orphan.

### Linking flow

In Settings → Account, a "Link this phone for offline SMS" section:
1. User taps "Link phone."
2. App POST `/api/account/link-phone-start` with their account ID.
3. Server generates a 6-digit code, stores `{account_id, code, expires_at}`,
   replies with `{linkPhoneSmsBody: "TQLINK 384192"}`.
4. App opens `sms:<TreeQ number>?body=TQLINK%20384192`.
5. User sends the SMS from their phone.
6. Quo webhook sees `TQLINK 384192`, looks up the code, links the
   sender's `from` phone number to the account.
7. Server replies "Phone linked. SMS quotes will save to your history."
8. App polls or websocket-listens for the link confirmation; updates UI.

Why have the user text us instead of us texting them: this proves the user
controls the phone, not just enters its number. Same security idea as a TOTP
out-of-band confirmation.

### Multiple phones per account

Allowed. Crew leads share an account; each links their own phone. The
`account_phones` join table tracks `{account_id, phone_e164, label, linked_at}`.

### Unlink

User can unlink in Settings; phone-to-account mapping is deleted; future SMS
from that phone falls back to anon mode.

---

## 7. Rate limiting

SMS costs Cameron real money (~$0.0075 per outbound segment in Quo's plan). An
abuse loop or a typo could rack up bills.

### Limits

| Scope | Limit | Action on hit |
|---|---|---|
| Per linked-phone account | 60 quotes / hour, 300 / day | Reply: "Too many quotes today; try again at <time>." |
| Per anon `from` number | 10 quotes / day | Reply: "Daily anonymous limit reached. Link your number for higher limits." |
| Per packet content (dedupe) | Same exact packet, same `from`, within 60s | Reply with cached previous result, no recompute |
| Global service ceiling | 1000 quotes / hour | Operations alert; new requests get "Service busy, try again in a few minutes." |

Counters live in Cloudflare Workers KV (or equivalent) with TTL.

### Spam/abuse

- Phone numbers blocked in Quo are rejected before reaching our handler.
- Numbers that send >10 unparseable messages in 24h get auto-blocked at the Quo
  level via Quo API (and Cameron gets a notification).
- Numbers that send valid packets but with absurd values (200" DBH) are
  rate-limited at 1 quote/hour.

---

## 8. Error states

| Condition | User sees | Server does |
|---|---|---|
| Packet doesn't match `TQ#` regex at all | Forwarded to Cameron's Quo inbox as a normal customer text — no auto-reply | Logs as `non_packet_message` |
| Schema version unrecognized | "Update your app: send 'help' for a link." | Logs version mismatch |
| Field count wrong | "Couldn't read that — try again from the app." | Logs as parse error |
| Numeric out of range | "Bad input: DBH 200" out of range. Try again." | Logs validation fail |
| Unknown species code | "Unknown species — pricing as generic <genus>. Reply Y to confirm." | Generates quote with genus average; flags as "generic-genus" |
| Pricing engine error | "Estimator hit a snag. Cameron will text you back manually." | Pages Cameron; logs full input |
| Quo outbound send fails | (User sees nothing — they sent the SMS but never got a reply) | Retry queue with exponential backoff; alert on 3rd failure |
| Account not found, packet has acct ID | Treats as anon; logs orphan packet | |
| Same packet sent twice within 60s | Cached previous reply re-sent | No recompute |
| User sends `STOP` or `UNSUBSCRIBE` | Quo handles; we suppress all outbound to that number going forward | Quo flag honored |

### Help command

Plain text `HELP` or `?` from any number replies:
```
TreeQ SMS:
- Send a packet from the app for an instant estimate
- Reply YES to save your last quote to history
- LINK to connect this phone to your account
- Or just text us a question — Cameron will reply.
```

---

## 9. Empty / edge cases

- **First-ever message from a number:** treat as `anon`; reply with quote and a
  "Reply LINK to save these to a TreeQ account."
- **App offline AND no SMS signal:** "Text estimate" button shows a warning
  "No signal detected — write inputs down or wait for data." (Detect via no SMS
  capability — limited; iOS/Android don't expose SMS reachability cleanly. May
  need to just always show the button and let the user discover the failure.)
- **User on iPad without cellular:** `sms:` URI does nothing on Wi-Fi-only iPads.
  Hide button if `navigator.userAgent` matches iPad-no-cellular heuristic.
- **Group MMS / iMessage thread:** Quo number receives normal SMS even when
  recipient uses iMessage. No special handling needed.
- **Carrier strips the `#` characters:** unlikely in 2026 (all major US carriers
  pass arbitrary printable ASCII), but guard with a fallback decode that accepts
  `|` as separator if `#` parse fails.
- **User edits the pre-filled message before sending:** as long as the `TQ#1#…`
  prefix and field count remain intact, parse normally. Trailing text is
  preserved as `note` on the quote record.
- **User's phone changes carrier:** number stays the same (via porting); link
  persists. If number changes, link breaks and they re-link.
- **Estimate older than 30 days in pending state:** drop from local pending
  store; treat as a normal SMS conversation only.

---

## 10. Test plan

### Unit (server)

- `lib/packet.js`: encode → decode round-trip for 100 random valid inputs.
- `lib/packet.js`: invalid packets in 12 specific failure modes return the right
  error code.
- `lib/species-codes.js`: every code maps to a genus the math layer recognizes.
- `lib/quo-client.js`: HMAC verification accepts known-good payloads, rejects
  tampered ones.

### Integration (server)

- Stand up wrangler dev locally with mocked Quo webhook payloads.
- Send 20 representative packets (full Rochester species set, edge DBH/height
  values, all four flags); assert each generates a price within ±2% of the
  in-app calculation for the same inputs.
- Send 5 deliberately broken packets; assert each gets the expected error reply.
- Send a `LINK` flow end-to-end against a test account; assert join row created.

### End-to-end (real device)

- Cameron's phone, airplane-mode-WIFI-on (data off, SMS via cellular).
- Open app → fill inputs → tap "Text estimate" → confirm Messages opens with
  correct pre-fill → send → receive reply within 15 seconds.
- Reply `YES` → confirm quote saved to history when data is restored.
- Open app on a second device with same account → confirm the SMS quote shows
  in history there too (server-of-record).

### Load

- Synthetic test: 100 simultaneous SMS packets to the dev webhook. Assert all
  process under 3-second Quo timeout. Assert KV rate-limit counters update.

### Failure injection

- Drop the pricing engine response (force timeout) → assert user gets the
  "Cameron will text you back manually" message and Cameron is paged.
- Quo outbound returns 500 → assert retry queue picks it up and delivers within
  60 seconds.

---

## 11. Open questions for Cameron

1. **Quo number to use for SMS-fallback.** Same as Cameron's main customer line
   or a separate dedicated number? Recommendation: same line, so the inbox stays
   unified — but tag SMS-quote conversations with a Quo "Auto-replied" label so
   they don't clutter human-attention triage.
2. **Anonymous quotes — feature or footgun?** Allowing `from` numbers without an
   account is the homeowner-facing onramp story (yard sign, door hanger). It
   also opens us up to spam. Ship MVP without anon (require linked account),
   add anon in Phase 2 once we have monitoring?
3. **Reply commands beyond YES/LINK/STOP/HELP.** Worth supporting `MORE` to get
   a more detailed breakdown? `CALL` to request Cameron call them back? These
   are easy adds; want to enumerate now or wait for usage signal?
4. **Pricing disclaimer in every reply.** Legal — every reply should probably
   say "Estimate only; on-site assessment may adjust." Adds ~50 chars and
   sometimes pushes to 2 segments. Ship with disclaimer or without?
5. **TCPA / carrier registration.** Quo has done A2P 10DLC registration for
   Cameron's existing line; adding programmatic outbound to that line should
   inherit the existing brand registration, but worth confirming with Quo
   support before launch.

---

## 12. Implementation phasing

| Phase | Ships | Estimated tickets |
|---|---|---|
| **SMS-1** | Activate `deploy/` v2.3 path; existing pricing engine reachable via Cloudflare Worker | 1 ticket: `HANDOFF.md` "Activate v2.3 deploy" |
| **SMS-2** | `lib/packet.js` encode/decode + species-codes + unit tests | 1 ticket |
| **SMS-3** | Quo webhook handler `inbound.js` + outbound replier; manual end-to-end test against Cameron's Quo number | 1 ticket |
| **SMS-4** | Account-to-phone linking flow + `account_phones` table + UI in Settings | 1 ticket |
| **SMS-5** | Client-side: "Text estimate" button, packet encoder, IndexedDB pending store, reconnect sync | 1 ticket |
| **SMS-6** | Rate limiting, abuse handling, monitoring/alerting | 1 ticket |
| **SMS-7** | Anon-mode + homeowner onramp (yard-sign flow); only after live usage on linked-account flow proves the loop works | 1 ticket |

SMS-1 through SMS-3 is the minimum to demo the loop with Cameron sending packets
from his own phone. Adding SMS-4 makes it a real product. SMS-5–6 hardens it.
SMS-7 is the growth move.

---

## 13. Memory / decisions captured here

The following are now decided as of this spec — worth promoting to memory if
not already there:

- **SMS provider: Quo, not Twilio.** (Already in memory: `treeq_sms_fallback.md`.)
- **SMS-fallback is the trigger to ship v2.3.** The IP-protection migration was
  parked; SMS-fallback un-parks it. Update `CONTEXT.md` to reflect.
- **Packet schema is versioned (`TQ#1#…`).** Future schema changes bump the
  digit. Server keeps decoders for old versions until corresponding app
  versions are fully sunset.
- **First MVP requires linked accounts, not anon.** Anon mode is Phase 2.

---

*End of spec. Next step: cut a HANDOFF ticket for SMS-1 (activate v2.3 deploy)
when Cameron is ready to start the implementation arc.*
