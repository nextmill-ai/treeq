# R6 — Quo API Surface

> Per `treeq_sms_fallback` memory: SMS provider is **Quo** (formerly OpenPhone), not Twilio. This R-doc maps the Quo API surface that the SMS-1 → SMS-3 implementation tickets will hit.
>
> Note: Quo rebranded from OpenPhone but the API host is still `api.openphone.com` and several headers still carry the `openphone-` prefix. References to "OpenPhone" in code/docs are still active and correct.
> Prepared 2026-05-10 overnight session #2.

---

## TL;DR

- **Auth:** API-key in `Authorization` header, **no Bearer prefix**. Generated per-workspace.
- **Outbound SMS endpoint:** `POST https://api.openphone.com/v1/messages` with `{from, to, content}` JSON body.
- **Inbound webhook payload:** event-shaped envelope with `type: 'message.received'` and a nested `data.object` carrying the message. Signature verification via `openphone-signature` header (HMAC-SHA256 over `timestamp.payload`).
- **Rate limit:** **10 requests/second per API key.** Exceeding returns HTTP 429.
- **A2P 10DLC:** Cameron's existing Quo brand registration **likely** covers programmatic outbound on the same number, but **must be confirmed with Quo support** before launch — the public docs don't say either way.
- **Useful features Cameron may not be using yet:** call recording / voicemail-to-text, contact API, the Webhooks management API for programmatic webhook setup.

---

## 1. Authentication

Per [Quo Authentication docs](https://www.quo.com/docs/mdx/api-reference/authentication):

```
Authorization: <YOUR_API_KEY>
```

**Important:** No `Bearer` prefix. Just the raw API key. (This trips up everyone who's used Twilio or Stripe first.)

API keys are generated in Workspace Settings → API tab → "Generate API key." Each key has full account privileges. **Treat as a service-role secret — never commit to git, never ship to client.**

For our use case: store the key as a Cloudflare Worker secret:

```bash
cd deploy
npx wrangler secret put QUO_API_KEY
# paste the key when prompted
```

Then in `functions/lib/quo-client.js`:

```js
export async function quoFetch(env, path, init = {}) {
  return fetch(`https://api.openphone.com/v1${path}`, {
    ...init,
    headers: {
      'Authorization': env.QUO_API_KEY,
      'Content-Type': 'application/json',
      ...(init.headers || {})
    }
  });
}
```

---

## 2. Outbound SMS — `POST /v1/messages`

Per [Send a text message](https://www.quo.com/docs/mdx/api-reference/messages/send-a-text-message.md):

### Request

```bash
curl -X POST https://api.openphone.com/v1/messages \
  -H "Authorization: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "content": "TreeQ — 36\" Silver Maple, trim 10–25%. Estimate: 2h 35m crew time, $1,425. Reply YES to save.",
    "from": "+15855551234",
    "to": ["+15859876543"],
    "setInboxStatus": "done"
  }'
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `content` | string | yes | 1–1600 chars. Long messages are silently segmented (each 160 chars = 1 segment ≈ $0.0075). |
| `from` | string | yes | E.164 of one of your Quo numbers, OR a phone-number-id (`PN...`). Use E.164 for clarity. |
| `to` | array of string | yes | Single recipient in our case — Quo accepts an array but rejects multi-recipient for trial; current API behavior: 1 element. |
| `setInboxStatus` | `'done'` | no | If sent, conversation auto-marks Done in the Quo inbox. **Recommend `'done'` for SMS-fallback replies** so Cameron's human inbox doesn't fill up with bot conversations. |
| `userId` | string | no | Identifies the sending Quo user. If omitted, Quo picks a default. Useful to attribute outbound bot replies to a service account if Cameron creates one. |

### Response (HTTP 202)

```json
{
  "data": {
    "id": "AC123abc",
    "to": ["+15859876543"],
    "from": "+15855551234",
    "text": "TreeQ — 36\" Silver Maple, ...",
    "phoneNumberId": "PN123abc",
    "direction": "outgoing",
    "userId": "US123abc",
    "status": "sent",
    "createdAt": "2022-01-01T00:00:00Z",
    "updatedAt": "2022-01-01T00:00:00Z"
  }
}
```

The `data.id` is the message ID — store it in our `messages.provider_message_id` column (per R8 §"Layer 5") so we can reconcile delivery status later.

### Failure modes (per `SMS_FALLBACK_SPEC.md` §8)

- HTTP 429 → rate limit (≥10 req/s). Implement client-side backoff. Quo doesn't return rate-limit headers per the docs, so use exponential backoff starting at 1s.
- HTTP 4xx (other) → bad payload (e.g., invalid `from` number). Log and alert; do not retry.
- HTTP 5xx → Quo outage. Retry queue with exponential backoff; alert on third failure (per spec §8).

---

## 3. Inbound webhook — `POST /api/sms/inbound` (your endpoint)

### Setup

In Quo dashboard → Settings → Integrations → Webhooks → "Add webhook." Or programmatically via `POST /v1/webhooks/messages` ([Create a new webhook for messages](https://www.quo.com/docs/mdx/api-reference/webhooks/create-a-new-webhook-for-messages.md)).

**Webhook URL** (after Cloudflare Pages deploy): `https://treeqapp.com/api/sms/inbound` (or `*.pages.dev` URL if no custom domain yet).

**Subscribed event:** `message.received` (this is the inbound-SMS event).

### Payload shape (verbatim from Quo docs)

```json
{
  "id": "EVc67ec998b35c41d388af50799aeeba3e",
  "object": "event",
  "apiVersion": "v4",
  "createdAt": "2022-01-23T16:55:52.557Z",
  "type": "message.received",
  "data": {
    "object": {
      "id": "AC24a8b8321c4f4cf2be110f4250793d51",
      "object": "message",
      "from": "+19876543210",
      "to": ["+15555555555"],
      "direction": "incoming",
      "text": "Hello, world!",
      "status": "delivered",
      "createdAt": "2022-01-23T16:55:52.420Z",
      "userId": "USu5AsEHuQ",
      "phoneNumberId": "PNtoDbDhuz",
      "contactIds": ["6824dfb69aee85c132b7dg65"]
    }
  }
}
```

For our SMS-fallback handler, the fields we care about:

- `data.object.text` — the packet (`TQ#1#3RKQ7P#ACR#36#65#22#1#N#S#14624` or `TQLINK 384192` etc.)
- `data.object.from` — the user's E.164. Lookup → `account_phones.phone_e164` to resolve `account_id`.
- `data.object.id` — the Quo message id; store as `provider_message_id` and as `sms_quotes.conversation_id` (de-dupe key).
- `data.object.createdAt` — for our `received_at` column.

### Signature verification

Per [Quo webhooks support docs](https://support.openphone.com/core-concepts/integrations/webhooks):

- **Header:** `openphone-signature`
- **Format:** `<scheme>;<version>;<timestamp>;<signature>`
  - Example: `hmac;1;1639710054089;mw1K4fvh5m9XzsGon4C5N3KvL0bkmPZSAy b/9Vms2Qo=`
- **Algorithm:** HMAC-SHA256 over `timestamp + '.' + raw_payload_with_no_whitespace`
- **Key:** base64-decoded signing secret from the webhook details page (Quo dashboard → Webhook → ⋯ → "Reveal signing secret")
- **Comparison:** raw byte equality of computed HMAC vs the `signature` segment

Verification skeleton (Workers / Web Crypto API):

```js
// functions/lib/quo-client.js
export async function verifyQuoSignature(request, signingSecret) {
  const sigHeader = request.headers.get('openphone-signature');
  if (!sigHeader) return false;

  const parts = sigHeader.split(';');
  if (parts.length !== 4 || parts[0] !== 'hmac' || parts[1] !== '1') return false;
  const [_, __, timestamp, signatureB64] = parts;

  const rawBody = await request.text(); // must be raw, no JSON.parse round-trip
  const signedData = `${timestamp}.${rawBody}`;

  const keyBytes = Uint8Array.from(atob(signingSecret), c => c.charCodeAt(0));
  const cryptoKey = await crypto.subtle.importKey(
    'raw', keyBytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']
  );
  const sigBytes = Uint8Array.from(atob(signatureB64), c => c.charCodeAt(0));
  const dataBytes = new TextEncoder().encode(signedData);

  return crypto.subtle.verify('HMAC', cryptoKey, sigBytes, dataBytes);
}
```

**Important:** the request body must be the raw bytes Quo sent. Don't `JSON.parse()` then re-stringify — whitespace differences will break the signature match. Read `request.text()` first, verify, then parse.

**Replay-attack guard:** check that `timestamp` is within ~5 minutes of now. Reject older. (Spec §8 doesn't mandate this but it's standard practice.)

---

## 4. Rate limits

Per [Quo Rate Limits](https://www.quo.com/docs/mdx/api-reference/rate-limits.md):

> "Each API key may make up to **10 requests per second.** Exceeding this limit may result in `429` status code errors."

Headers returned: not documented (no `x-rate-limit-*`). Use a fixed-window or token-bucket limiter on our side to stay under 10/s.

For SMS-fallback: 10/s = 600/min. The spec §7 ceiling is 1000/hour ≈ 17/min, well under the limit. Bursty replies (Cameron testing the loop, sending 50 packets in a minute) wouldn't exceed it either.

---

## 5. A2P 10DLC compliance

Per [Quo A2P 10DLC blog](https://www.quo.com/blog/what-is-a2p-10dlc/) and the [registration walkthrough](https://www.quo.com/blog/10dlc-compliance/):

- **Brand registration** (legal entity: NMC LLC) is required to send programmatic SMS to US carriers. Cameron may have already done this for Quo's standard texting use.
- **Campaign registration** is per-use-case. The brand registration covers the legal entity; each "campaign" describes the type of SMS being sent (customer service, marketing, 2FA, etc.).
- **TreeQ's SMS-fallback estimates fall under "customer service" or "informational"** — not marketing, not 2FA. A new campaign for this use case may be needed even if the brand is registered.
- Quo's typical campaign approval is **2–5 business days**.

### What to confirm with Quo support before launching SMS-1

> "I'm running an existing brand registration on my Quo line `+1 585 ...`. I want to add programmatic outbound SMS for an automated estimate-reply use case (the user texts in a packet, our server texts back a calculated estimate). Does this require a new campaign registration under my existing brand, or does my existing campaign cover it?"

Get an answer in writing before going live. **Don't launch the SMS handler if there's even a chance of a 10DLC violation** — carriers can suspend the number, and re-registering takes weeks.

### What docs leave unclear

- Whether Quo handles the campaign filing on Cameron's behalf or whether he files via TCR (The Campaign Registry) directly.
- Whether the per-segment cost ($0.0075 in spec §7) inherits from his current plan or is separately metered.
- Whether opt-out (`STOP`) keywords inherit suppression across campaigns — e.g., if a customer says STOP to a non-TreeQ Quo conversation, do they automatically suppress TreeQ replies too?

These are worth a single clarification ticket with Quo support.

---

## 6. Useful Quo features Cameron may not be using

These came up in the API surface scan; they're orthogonal to SMS-fallback but worth flagging:

| Feature | What it does | Why TreeQ might want it |
|---|---|---|
| Call recording + transcripts | Quo records calls and produces transcripts | When the FMS phase lands (R8 layer 5 `messages`), pulling Quo call transcripts into the same customer thread = unified record. ROADMAP open question for P9 PHCRx integration. |
| Voicemail-to-text | Inbound voicemails get transcribed | Same — feeds the customer thread automatically. |
| Contacts API | CRUD on Quo contacts | When an SMS quote comes in from a number that isn't yet a Quo contact, we could auto-create one. Gives Cameron's regular human use of Quo a head start. |
| Webhooks management API | Programmatic webhook config | For staging vs prod — we can spin up a webhook pointing at a `*.pages.dev` preview URL programmatically rather than clicking through the dashboard. |
| Multi-user / team membership | Multi-Quo-user attribution on outbound | If multiple foremen send SMS via the same number, they're attributable. Roadmap for FMS-style team feature. |

None of these are blocking for SMS-1. Flag for after the basic loop ships.

---

## 7. Concrete checklist for SMS-1

When the SMS-1 ticket is cut, this is the runbook:

- [ ] Confirm A2P 10DLC campaign coverage with Quo support (see §5)
- [ ] Generate Quo API key from Workspace Settings → API
- [ ] `cd deploy && npx wrangler secret put QUO_API_KEY`
- [ ] Generate Quo webhook signing secret + add as Worker secret: `QUO_WEBHOOK_SECRET`
- [ ] Deploy parked v2.3 stack (per `deploy/DEPLOY.md`); confirm `/api/estimate` works
- [ ] Configure webhook in Quo dashboard pointing at `https://<treeq-deploy>/api/sms/inbound`, subscribe to `message.received`
- [ ] Implement `functions/lib/quo-client.js` (auth + verifySignature + sendSms)
- [ ] Implement `functions/lib/packet.js` (encode/decode TQ packets)
- [ ] Implement `functions/lib/species-codes.js` (3-char ↔ species key map)
- [ ] Implement `functions/api/sms/inbound.js` (verify → parse → compute → reply → persist)
- [ ] Cameron sends a test packet from his own phone; loop should round-trip in <15s
- [ ] Set up Workers KV bindings for rate-limit counters (`SMS_RL` namespace)

---

## Sources

- [Quo Authentication](https://www.quo.com/docs/mdx/api-reference/authentication)
- [Send a text message](https://www.quo.com/docs/mdx/api-reference/messages/send-a-text-message.md)
- [Webhooks guide](https://www.quo.com/docs/mdx/guides/webhooks.md)
- [Webhooks support article (signature format)](https://support.openphone.com/core-concepts/integrations/webhooks)
- [Rate limits](https://www.quo.com/docs/mdx/api-reference/rate-limits.md)
- [A2P 10DLC explainer](https://www.quo.com/blog/what-is-a2p-10dlc/)
- [A2P 10DLC compliance walkthrough](https://www.quo.com/blog/10dlc-compliance/)
- [OpenAPI spec download](https://openphone-public-api-prod.s3.us-west-2.amazonaws.com/public/openphone-public-api-v1-prod.json) — for full schema reference
- Project files referenced: `SMS_FALLBACK_SPEC.md` §4 (server flow), §7 (rate limits), §8 (error states); `deploy/DEPLOY.md`
