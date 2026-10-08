---
title: "Customer Deduplication Across POS Vendors: DB Cache + Liveness Check"
category: "Shipping Software: Docker, Deploys & Integrations"
slug: "integrations-customer-dedup-pattern"
summary: "A vendor-agnostic pattern for avoiding duplicate customer records when pushing to third-party systems: cache the vendor customer ID in your own DB, verify it with a cheap liveness check, self-heal when it's stale, and fall back to vendor search only on first contact."
---

# Customer Deduplication Across POS Vendors: DB Cache + Liveness Check

## What and why

When our reservation platform pushed a booking into a restaurant's POS, the POS needed a **customer** record so the order appeared in that guest's history. The obvious approach is "search for the customer, create if not found" on every push. With Square that mostly works. With Clover's sandbox, the search returned nothing even for customers that clearly existed, so **every booking created a duplicate customer**.

Duplicates are a real cost for the restaurant: a cluttered customer list, order history split across several "people," and loyalty or marketing tools attributing data to the wrong record.

The fix I landed on works for any vendor, including ones with broken search: **cache the vendor's customer ID in our own database, verify it is still alive, and only touch the vendor's search/create APIs on first contact.**

## The core idea

```
push(booking):
  1. cachedId = lookup in OUR DB for (userId, restaurantId, vendor)
  2. if cachedId and vendor.isCustomerAlive(cachedId):
         customerId = cachedId                 # zero search/create calls
     else:
         customerId = vendor.upsertCustomer()  # first time, or cache was stale
  3. vendor.createOrder(customerId, ...)
  4. save customerId alongside the order row   # becomes the cache next time
```

### Where the cache lives

I didn't create a separate mapping table. The table that records pushed orders already had one row per booking, so I added a nullable `posCustomerId` column there. The lookup joins to bookings to get the user:

```sql
SELECT po.posCustomerId
FROM pos_orders po
JOIN bookings b ON b.id = po.bookingId
WHERE b.userId = ?
  AND po.restaurantId = ?
  AND po.vendor = ?
  AND po.posCustomerId IS NOT NULL
ORDER BY po.created_at DESC
LIMIT 1;
```

Scoping by **(user, restaurant, vendor)** matters. Each restaurant is a separate merchant account with separate customer IDs, so a customer ID from one restaurant means nothing at another. An index covering `(restaurantId, vendor)` plus the booking join keeps it cheap.

Writing the ID in the **same upsert** as the order row means the cache and the order never disagree.

(Adding that column was itself an adventure. MySQL's 64-index limit on an unrelated table blocked the ORM's schema sync. See the article on local MySQL and schema migrations for the idempotent startup-patch fix.)

## Why the cache must verify: liveness checks

A cache assumes the vendor record still exists. In practice, restaurant staff delete customers directly in their POS. Without verification, we'd keep sending a dangling ID, and Clover in particular **silently accepted it**: the order was created and returned 200, but it wasn't linked to anyone visible.

So every cache hit is verified with a cheap GET before use:

| Vendor | Check | Stale if |
|---|---|---|
| Square | `GET /v2/customers/{id}` | 404, or no `customer.id` in the body |
| Clover | `GET /v3/merchants/{mId}/customers/{id}` | 4xx, **or** 200 with `deletedTime` set (Clover soft-deletes) |

```typescript
async function isCloverCustomerAlive(token: string, merchantId: string, id: string) {
  const res = await fetch(`${CLOVER_BASE}/v3/merchants/${merchantId}/customers/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return false;
  const body = await res.json();
  return Boolean(body?.id) && !body?.deletedTime;   // soft-deleted counts as dead
}
```

If the check fails, treat it as a cache miss, run the first-time flow, and the new ID overwrites the old one in the same push. **The cache self-heals in one cycle**, with no cleanup job.

The cost is one extra GET per push on the happy path. That's still cheaper than a search plus a create, and it's the only way to guarantee correctness. Soft deletes are the subtle part: a 200 response does not mean "alive."

I tested it explicitly: push a booking (cache populated), delete the customer in the vendor dashboard, push another booking for the same guest, and confirm via API that a new customer was created, the new order is linked to it, and the cache now holds the new ID.

## The first-time flow differs by vendor

The cache handles repeats. On first contact, each adapter does the best its API allows.

### Square: search, claim, create

Square has a searchable custom field, `reference_id`, so the flow is three steps:

```
1. POST /v2/customers/search  filter reference_id == ourUserId     -> found? use it
2. POST /v2/customers/search  filter email_address == user.email   -> found? CLAIM it:
       PUT /v2/customers/{id}  { reference_id: ourUserId }
3. POST /v2/customers  { given_name, family_name, email_address,
                         phone_number (E.164), reference_id: ourUserId }
```

Step 2 is the nice part. If the guest was **already** a customer of that restaurant before our platform existed, we don't create a duplicate. We stamp our ID onto their existing record, keeping their history and loyalty intact. Future lookups hit step 1 (or the cache).

### Clover: try the filter, then create

Clover's `externalId` is stored but **not filterable** (`400 Cannot filter on field externalId`). Email and phone filters exist but returned empty results in sandbox. So the flow is: try the email filter (it may work in production), otherwise create. The DB cache then prevents every future duplicate.

Clover schema traps I hit:

- Flat `emailAddress` / `phoneNumber` fields in the create body are **silently ignored**. You must use nested `emailAddresses.elements[].emailAddress` and `phoneNumbers.elements[].phoneNumber`.
- A GET without `?expand=emailAddresses,phoneNumbers` omits those fields, so it looks like nothing was saved.
- Linking a customer to an order only stuck via an **update-order** call after creation; inline-on-create was silently dropped and the dedicated link endpoint returned 405 in sandbox.

## A common adapter interface

Every vendor's `upsertCustomer` returns the same shape, so the push flow is vendor-agnostic:

```typescript
interface UpsertCustomerResult {
  customerId?: string;
  created: boolean;          // true if we made a new record
  mergedExisting?: boolean;  // true if we claimed a pre-existing customer
  errors?: Array<{ code: string; detail?: string }>;
}
```

## Playbook for the next vendor

1. **Is there a searchable custom reference field?** If yes, write your user ID into it on every create and search by it first. If no, plan on the DB cache from day one.
2. **Which fields are actually filterable?** Test with real calls; don't trust the docs alone. Fields can be documented as filterable and still broken in sandbox.
3. **Are contact fields flat or nested?** Match the exact schema, then **read back** to confirm they persisted.
4. **How do deletes work?** Hard delete (404) or soft delete (a `deletedTime` flag)? Your liveness check must handle both.
5. **Always cache first, API second.**

```
Searchable reference field?
  yes -> search by reference -> search by email (claim) -> create
  no  -> email filter if it works -> create
Either way: store the resulting ID; every later booking is one indexed query + one liveness GET.
```

## Gotchas and lessons

- "Search then create" is only as good as the vendor's search. Don't make correctness depend on it.
- A cache of external IDs is only safe with **verification**. External systems change under you.
- Treat soft-deleted records as dead.
- Writing the cache in the same transaction/upsert as the order prevents drift.
- Claiming existing records (stamping your ID onto them) is kinder to the customer's data than creating a fresh one.

## Key takeaways

- Store the vendor customer ID in your own DB, keyed by (user, tenant, vendor).
- Verify cached IDs with a cheap GET; on failure, fall through and overwrite. The cache self-heals.
- Use the vendor's best dedup tool only on first contact: a searchable reference field, then email, then create.
- Hide vendor differences behind one adapter interface so the next integration is a new adapter, not a rewrite.
