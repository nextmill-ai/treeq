# Jobber API integration — design notes

**Purpose:** plan the bidirectional Jobber sync that turns TreeQ into the
"side-car" the FMS competitor research recommends. We're not building the whole
thing in this overnight run — this is the design + endpoint inventory that the
next round of implementation tickets can consume.

Companion: `research/fms_competitors.md` § Jobber (positioning), and the
implementation stub at `netlify/functions/jobber-webhook.js`.

---

## 1. API basics

- **Base URL:** `https://api.getjobber.com/api/graphql`
- **Auth:** OAuth 2.0 (authorization code flow). Tokens scoped per Jobber
  account, returned with an `access_token` + `refresh_token`. Access tokens
  expire in 60 min — refresh tokens are durable until revoked.
- **Versioning:** the API requires an `X-JOBBER-GRAPHQL-VERSION` header.
  Use `2024-10-22` (latest stable as of writing); revisit quarterly. Without
  it, requests return `400 Bad Request: missing version header`.
- **Rate limit:** Jobber publishes a 2,500-points-per-minute bucket per app.
  Each query reports cost in `extensions.cost` — read it and back off.

## 2. OAuth flow

1. Register a Jobber app at <https://developer.getjobber.com/> (Cameron's
   account). Set redirect URI to `https://treeqapp.com/.netlify/functions/jobber-oauth-callback`.
2. **Authorize URL** for the tenant's owner:
   ```
   https://api.getjobber.com/api/oauth/authorize
     ?response_type=code
     &client_id=<JOBBER_CLIENT_ID>
     &redirect_uri=<urlencoded callback>
     &scope=read_clients read_jobs read_quotes write_quotes read_invoices read_visits
     &state=<csrf-random>
   ```
3. **Token exchange** at `POST https://api.getjobber.com/api/oauth/token` with
   `{ client_id, client_secret, grant_type: 'authorization_code', code, redirect_uri }`.
4. Persist `access_token`, `refresh_token`, `expires_at`, and the Jobber
   `accountId` in `external_integrations` (kind='jobber', `config_json.jobber_account_id`,
   encrypted token columns).
5. Refresh: `POST /api/oauth/token` with `{ grant_type: 'refresh_token', refresh_token }`.

## 3. Webhook subscription

Jobber webhooks are configured **inside Jobber app settings**, not via API. The
app declares which topics it wants and Jobber POSTs to the registered URL.

- **Endpoint we'll set:** `https://treeqapp.com/.netlify/functions/jobber-webhook`
- **Signature header:** `X-Jobber-Hmac-SHA256` — base64 HMAC-SHA256 of the raw
  request body using the **app secret** (same string registered in Jobber's UI).
- **Topics to subscribe** (per Jobber docs):
  - `CLIENT_CREATE`, `CLIENT_UPDATE`, `CLIENT_DESTROY`
  - `JOB_CREATE`, `JOB_UPDATE`, `JOB_DESTROY`
  - `QUOTE_CREATE`, `QUOTE_UPDATE`, `QUOTE_APPROVED`, `QUOTE_SENT`
  - `INVOICE_SENT`, `INVOICE_PAID`
  - `VISIT_COMPLETE`
- **Retry policy:** Jobber retries 4xx (except 401/410) and 5xx for ~24 hours
  with exponential backoff. Stub returns 202 for "accepted but no local match"
  so Jobber doesn't hammer us.

## 4. Mutations + queries we need

### Read clients (paginated)

```graphql
query Clients($cursor: String) {
  clients(first: 100, after: $cursor) {
    pageInfo { endCursor hasNextPage }
    edges {
      node {
        id
        title
        firstName
        lastName
        companyName
        phoneNumbers { description number }
        emails { description address primary }
        billingAddress { street city province postalCode country }
      }
    }
  }
}
```

→ Upsert into `customers` keyed on `external_ids_json->>jobber_id`.

### Read jobs

```graphql
query Jobs($cursor: String) {
  jobs(first: 100, after: $cursor) {
    pageInfo { endCursor hasNextPage }
    edges {
      node {
        id
        title
        jobStatus
        startAt
        endAt
        total
        client { id title }
        property { id street city province postalCode }
        lineItems { edges { node { name description quantity unitCost totalCost } } }
      }
    }
  }
}
```

→ Upsert into `jobs` + `properties`. Map `jobStatus` to our `job_status` enum
(`requires_invoicing` → `completed`, `complete` → `completed`, etc.).

### Read quotes

```graphql
query Quotes($cursor: String) {
  quotes(first: 100, after: $cursor) {
    pageInfo { endCursor hasNextPage }
    edges {
      node {
        id
        quoteStatus
        quoteNumber
        clientHubUrl
        amounts { subtotal total }
        client { id }
        lineItems { edges { node { name description quantity unitCost totalCost } } }
        sentAt
        approvedAt
      }
    }
  }
}
```

→ Mirror into `quotes` (existing table — add a `jobber_id` to
`structured_inputs_json` or extend `quotes` with `external_ids_json` if
multi-system identifiers stay).

### Push quote

```graphql
mutation CreateQuote($input: QuoteCreateInput!) {
  quoteCreate(input: $input) {
    userErrors { message path }
    quote { id quoteNumber clientHubUrl }
  }
}
```

`QuoteCreateInput` requires `clientId` + at least one line item. After creation,
optionally call `quoteSend(input: { id, deliveryMethod: EMAIL_SMS })` to push it
to the customer.

### Push as draft (don't auto-send)

Same `quoteCreate` but skip `quoteSend`. The salesperson then reviews inside
Jobber and clicks Send. This is the safer default for the side-car positioning —
TreeQ proposes, Jobber sends.

## 5. Conflict + drift policy

Because TreeQ is the side-car, treat Jobber as **source of truth** for fields
Jobber owns (client name, address, job status, invoice state). TreeQ owns:

- The AI-generated estimate (`quotes.line_items_json`, `reasoning`)
- Tree-by-tree breakdown (`job_tree_items`)
- Conversation history (`conversation_turns`)
- Photos taken via TreeQ (`job_events` with event_type='photo')

If Jobber webhook changes a job's status to `cancelled`, set TreeQ
`jobs.status='cancelled'` but DO NOT touch our estimate or tree items —
they remain for the calibration corpus.

## 6. Open questions

1. **Multi-tenant Jobber apps** — does one Jobber developer app authorize many
   tenants, or do we need per-tenant apps? (Reading: one app, many installs.)
2. **Polling cadence for objects without webhooks** — invoices have webhooks
   but `Visits.notes` doesn't. Do we poll every 5 min, or lazy-load on demand?
   Vote: lazy-load until users complain.
3. **Two-way sync of `client.tags`** — TreeQ wants tenant-specific tags (e.g.
   "VIP", "Pay-by-check"); Jobber has its own tag system. Map 1:1 or namespace
   `treeq:vip`? Vote: namespace — avoids accidentally polluting Jobber tags
   the owner cares about.
4. **Rate-limit budget split** — when concurrent requests hit (sync poll +
   user-triggered push quote), who wins? Implement a token-bucket in
   `external_integrations.config_json.rate_limit_bucket` and pause the poll.

## 7. References (read directly)

- <https://developer.getjobber.com/docs> — top-level dev portal
- <https://developer.getjobber.com/docs/getting-started/about-our-api> — about
- <https://developer.getjobber.com/docs/getting-started/getting-started-with-the-jobber-api> — auth flow
- <https://developer.getjobber.com/docs/webhooks/setting-up-webhooks/> — webhooks
- <https://developer.getjobber.com/docs/getting-started/rate-limiting/> — costs
