---
title: "Integrating Third-Party POS APIs: Per-Merchant OAuth, Idempotency, ID Mapping and Status Sync"
category: "Shipping Software: Docker, Deploys & Integrations"
slug: "integrations-pos-oauth-idempotency"
summary: "Patterns I learned integrating Square and Clover into a restaurant reservation marketplace: one app with OAuth per merchant, idempotency keys, ID-mapping strategies, canonical status enums, fire-and-forget pushes, and how to test against vendor sandboxes with curl."
---

# Integrating Third-Party POS APIs

## What and why

At work I built point-of-sale (POS) integrations for a restaurant reservation marketplace. When a guest's reservation was confirmed and paid, our backend pushed it into the restaurant's POS as an open order (a "check") with the guest attached, and later pulled the check's status back (open, paid, cancelled). I built Square first, then Clover, with Toast and others planned behind the same interface.

The vendor APIs were very different, but the integration patterns were the same. This article covers those patterns.

## Architecture: a canonical layer plus vendor adapters

```
Our core  <->  Canonical POS service  <->  Square adapter  <->  Square API
                                       <->  Clover adapter  <->  Clover API
                                       <->  (future) Toast, ...
```

- The **canonical layer** defines our own shapes: a connection, a pushed check, a status enum. Core code never sees vendor payloads.
- Each **adapter** implements the same functions (`buildAuthorizeUrl`, `exchangeCode`, `upsertCustomer`, `createOrder`, `getOrder`, `isCustomerAlive`) and translates.
- Design principles: idempotent upserts, strict enum validation, ID translation through mapping, raw payloads stored for audit, and timestamp-protected updates so out-of-order events can't overwrite newer state.

Adding a vendor means writing an adapter, not touching core logic.

## Pattern 1: One application, OAuth per merchant

The most common misunderstanding (I had it too) is how many "apps" you need. The answer is **one**:

```
Your developer account
  '-- ONE application (client ID + secret + redirect URL)
        ^ each restaurant authorizes it via OAuth
  Restaurant A's merchant account -> its own token -> locations L1, L2
  Restaurant B's merchant account -> its own token -> location L3
```

Each restaurant runs the **OAuth 2.0 authorization code flow** against your single application and you get a token scoped to *that merchant only*. Creating an app per restaurant is the wrong model, and it doesn't test the real connect flow.

### The flow

1. Restaurant clicks **Connect POS**. Your backend builds the authorize URL with your client ID, redirect URI, requested scopes, and a **`state`** value.
2. The owner signs in at the vendor and approves.
3. The vendor redirects to your callback with a one-time `code` (Square's expires in minutes).
4. Your server exchanges `code` + client ID + **client secret** for an access token and refresh token.
5. Store tokens per restaurant, resolve which **location** to use, and you're connected.

```
GET https://<vendor>/oauth2/authorize
    ?client_id=<APP_ID>
    &response_type=code
    &redirect_uri=https://api.example.com/pos/<vendor>/callback
    &scope=MERCHANT_PROFILE_READ+ORDERS_READ+ORDERS_WRITE+CUSTOMERS_READ+CUSTOMERS_WRITE
    &state=<signed, opaque value identifying the restaurant>
```

Notes:

- **`state` does two jobs**: CSRF protection and telling your callback *which restaurant* is connecting. Make it unguessable and verifiable (sign it, or store a nonce server-side). Don't just put a raw ID in it.
- Use the **code flow** (with the client secret) on a server. PKCE is for clients that can't keep secrets.
- **Request least privilege.** Square uses a scope string in the URL; Clover configures permissions on the app in its developer dashboard instead.
- **Encrypt tokens at rest**, and on disconnect **revoke** the token with the vendor before deleting your row.
- **Plan for expiry.** Square access tokens expire (about 30 days) and must be refreshed. Clover's token behavior differed between environments, and the refresh grant didn't work in its sandbox, so expired tokens surfaced as 401s that prompted a reconnect. Build a clear "reconnect" path regardless.

### Location resolution

Square has `merchant -> many locations`, and every order needs a `location_id`. Clover is flat: each merchant *is* a location. To keep core code vendor-agnostic, I stored a `posLocationId` for both (for Clover it's just the merchant ID).

After OAuth I auto-matched the restaurant's address to the merchant's locations: normalize addresses (lowercase, expand `st` -> `street`, strip punctuation), score street (+2), city (+2), state (+1), and auto-select only if the best score is >= 3 **and** at least 2 points ahead of the runner-up. Otherwise show a ranked list and let the restaurant choose. Auto-match when confident, ask when not.

## Pattern 2: Idempotency keys

Networks retry, webhooks get delivered twice, and someone will double-click. Pushing the same reservation twice must not create two orders.

**Square** supports this natively: every create call takes an `idempotency_key`. I used **our own booking ID** as the key, so retries return the original order:

```json
{
  "idempotency_key": "<our bookingId>",
  "order": {
    "location_id": "<locationId>",
    "customer_id": "<vendor customer id>",
    "reference_id": "<our bookingId>",
    "ticket_name": "Reservation - Guest Name - Table 7",
    "line_items": [{ "name": "Reservation - 2 guests", "quantity": "1",
                     "base_price_money": { "amount": 20000, "currency": "USD" } }],
    "metadata": { "app_booking_id": "<bookingId>", "app_table_number": "7" }
  }
}
```

Deriving the key from a stable business ID beats a random UUID, because a random key generated per attempt doesn't protect against duplicate *triggers*.

**Clover has no idempotency key** on order creation. The fallback is to enforce it yourself: a **unique constraint on `bookingId`** in your table of pushed checks, a check-before-create, and embedding the booking ID in the order's title/note so humans can spot duplicates.

For inbound events: store processed **event IDs** and ignore repeats, and use timestamps so an older event can't overwrite newer state.

## Pattern 3: ID mapping

Every integration is a translation between your IDs and theirs. Three strategies, cheapest first:

1. **Vendor-side reference field.** Square customers and orders have a searchable `reference_id`. Put your ID there and the vendor record *is* the mapping. No table needed.
2. **Your own mapping table.** `(vendor, vendorId) <-> internalId` for locations, tables, and checks. Required when the vendor has no searchable reference field (Clover's `externalId` is stored but not filterable).
3. **Metadata for humans and secondary lookups.** Square's `metadata` is a string-to-string map. It's useful, but every value must be a **non-empty string** (empty values are rejected), so filter out nulls and `String()` numbers first.

My table of pushed checks held `bookingId` (unique), `restaurantId`, `vendor`, `vendorOrderId`, `vendorLocationId`, `vendorCustomerId`, a canonical status, amounts **in cents**, and `lastSyncedAt`, with the same schema for every vendor.

## Pattern 4: Canonical status and sync

Each vendor names order states differently. Map them once:

| Square `state` | Clover `state` | Canonical |
|---|---|---|
| `OPEN` | `open` | `OPEN` |
| `COMPLETED` | `locked` / `paid` | `PAID` |
| `CANCELED` | `deleted` | `CANCELLED` |

Clover's sandbox UI could show an order as paid while its API `state` was still `open`, so I treated the API state as truth and documented the quirk. Also: Clover's order `total` didn't auto-recalculate after adding line items, so I summed line items myself.

Sync started as **manual refresh** (`GET` the order, map state, update the row), with webhooks (`order.updated`) as a planned upgrade. Start simple, but design the row so webhooks can slot in.

## Pattern 5: Never let the integration break the core flow

The push to POS ran **fire-and-forget** after the reservation was created. A POS outage or bad token must never fail a guest's paid booking. Errors were logged with a consistent `[POS]` prefix and recorded for retry. Raw vendor responses went to object storage for debugging.

Other defensive habits:

- **Normalize phone numbers** to E.164 (`+1XXXXXXXXXX`). If normalization fails, **omit** the field. One bad optional field can reject the whole request.
- **Drop unsupported enum values.** Square rejected a `DINE_IN` fulfillment type in sandbox, so I removed it and put the dine time in the ticket name and metadata, formatted in the location's IANA timezone.
- **Check for silent drops.** Clover's create-order endpoint accepted a `customers` field and returned 200 but ignored it. The link only persisted via a follow-up *update* call. Always read back what you wrote.

## Pattern 6: Sandbox testing with curl

Vendor sandboxes are essential and quirky:

- **Sandbox test accounts = simulated merchants**, not simulated apps. One per restaurant you want to model.
- Square's sandbox OAuth page reuses whatever test-merchant session is open in your browser. Log into the merchant you want first.
- Orders created via API **may not appear in the sandbox dashboard**. Verify with the API:

```bash
curl -s https://connect.squareupsandbox.com/v2/orders/$ORDER_ID \
  -H "Square-Version: <api-version>" \
  -H "Authorization: Bearer $SANDBOX_TOKEN" | jq '.order | {id, state, total_money}'
```

- **Simulate payment** with documented test nonces (`cnon:card-nonce-ok`), then complete the order. The pay call needs the order's current `version`, so `GET` first:

```bash
curl -s -X POST https://connect.squareupsandbox.com/v2/payments \
  -H "Square-Version: <api-version>" -H "Authorization: Bearer $SANDBOX_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"idempotency_key\":\"pay-$ORDER_ID\",\"source_id\":\"cnon:card-nonce-ok\",
       \"amount_money\":{\"amount\":20000,\"currency\":\"USD\"},
       \"order_id\":\"$ORDER_ID\",\"location_id\":\"$LOCATION_ID\"}"
```

- Use the right host per environment: Square production is `connect.squareup.com` and sandbox is `connect.squareupsandbox.com`. I lost time to a typo'd production host that just looked like a network failure.
- Expect sandbox-only bugs (a Clover first-install auth code that's immediately invalid, customer filters that return nothing). Handle them, but write them down so nobody "fixes" production behavior based on sandbox lies.

## Key takeaways

- One application, OAuth per merchant; `state` identifies the tenant and prevents CSRF.
- Use stable business IDs as idempotency keys; enforce uniqueness yourself where the vendor doesn't.
- Prefer vendor-side reference fields for ID mapping; fall back to mapping tables.
- Map vendor states to a canonical enum, store money in cents, and keep raw payloads for audit.
- Integrations should be fire-and-forget relative to your core flow, and you should read back what you wrote.
- Treat sandboxes as useful but untrustworthy; verify via API and document every quirk.
