---
title: "Local S3 with MinIO, and Testing APIs with curl"
category: "Shipping Software: Docker, Deploys & Integrations"
slug: "shipping-local-s3-minio-and-curl-testing"
summary: "How to run MinIO in Docker as a drop-in S3 for local development using the same AWS SDK code as production, and a practical curl toolkit for testing JSON APIs, bearer-token auth, and multi-turn chat endpoints."
---

# Local S3 with MinIO, and Testing APIs with curl

## What and why

Two small tools made a big difference in how fast I could iterate on backend work:

1. **MinIO**, an S3-compatible object store that runs in one Docker container. My code talks to it with the normal AWS SDK, and in production the same code talks to real S3 with zero changes, only different environment variables.
2. **curl**, for hitting endpoints directly instead of clicking through a UI. It's reproducible, scriptable, and easy to paste into docs and bug reports.

## Part 1: MinIO as local S3

### Why store blobs in object storage at all

On a POS integration project, every order we pushed to or synced from a vendor came back as a large, vendor-specific JSON payload. At first it was stored in a `rawPayload` column in MySQL. I moved it to object storage because:

- JSON blobs on every row bloat `SELECT *`, backups, and the buffer pool.
- Vendor payload shapes differ and change without notice. They're audit/debug data, not query data.
- Object storage is far cheaper per GB than managed database storage.
- Analytics tools (e.g. Athena) can query S3 directly without touching the transactional DB.

The pattern: **extract the structured fields you query on into SQL columns, and write the full raw payload to object storage** keyed by your own IDs:

```
vendor API response
   |-- extract fields --> MySQL row (status, totals, payment method, timestamps)
   '-- full raw JSON  --> s3://<bucket>/pos-raw/{tenantId}/{recordId}.json
```

Prefixing by tenant ID gives you a natural partition for later analytics.

### Run MinIO

```bash
docker run -d \
  --name minio \
  --restart unless-stopped \
  -p 9000:9000 -p 9001:9001 \
  -e MINIO_ROOT_USER=localdev \
  -e MINIO_ROOT_PASSWORD=localdev-password \
  -v ~/minio-data:/data \
  quay.io/minio/minio server /data --console-address ":9001"
```

- Port **9000** is the S3 API (what your SDK talks to).
- Port **9001** is the web console (browse buckets and objects).
- The `-v` mount keeps data across container restarts and removals.

Or in Compose:

```yaml
services:
  minio:
    image: quay.io/minio/minio
    restart: unless-stopped
    ports: ["9000:9000", "9001:9001"]
    environment:
      MINIO_ROOT_USER: localdev
      MINIO_ROOT_PASSWORD: localdev-password
    volumes: ["~/minio-data:/data"]
    command: server /data --console-address ":9001"
```

### Create a bucket

Through the console at `http://localhost:9001`, or with the `mc` client:

```bash
mc alias set local http://localhost:9000 localdev localdev-password
mc mb local/my-app-dev
mc ls --recursive local/my-app-dev/
mc cp local/my-app-dev/pos-raw/<tenant>/<record>.json /tmp/x.json && jq . /tmp/x.json
```

### One client, two environments

```typescript
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

const endpoint = process.env.S3_ENDPOINT;               // set only for MinIO
const forcePathStyle = process.env.S3_FORCE_PATH_STYLE === "true";

export const s3 = new S3Client({
  region: process.env.AWS_REGION ?? "us-east-1",
  ...(endpoint ? { endpoint, forcePathStyle } : {}),
  ...(process.env.OBJ_STORE_ACCESS_KEY_ID
    ? { credentials: {
          accessKeyId: process.env.OBJ_STORE_ACCESS_KEY_ID!,
          secretAccessKey: process.env.OBJ_STORE_SECRET_ACCESS_KEY!,
        } }
    : {}),                                               // prod: use the IAM role
});

export async function putRawPayload(tenantId: string, recordId: string, payload: unknown) {
  try {
    await s3.send(new PutObjectCommand({
      Bucket: process.env.RAW_BUCKET!,
      Key: `pos-raw/${tenantId}/${recordId}.json`,
      Body: JSON.stringify(payload),
      ContentType: "application/json",
    }));
  } catch (err) {
    console.warn("[S3] failed to store raw payload", err);   // never block the main flow
  }
}
```

```bash
# Local (.env)
S3_ENDPOINT=http://localhost:9000
S3_FORCE_PATH_STYLE=true
OBJ_STORE_ACCESS_KEY_ID=localdev
OBJ_STORE_SECRET_ACCESS_KEY=localdev-password
RAW_BUCKET=my-app-dev

# Production: only the bucket; credentials come from the instance/task role
RAW_BUCKET=my-app-prod
```

### Gotchas

- **`forcePathStyle: true` is required for MinIO.** The SDK defaults to virtual-host style (`bucket.host`), which doesn't resolve for `localhost`.
- **Use dedicated env var names** for object-storage credentials. If you reuse `AWS_ACCESS_KEY_ID`, your MinIO keys can collide with real AWS keys used by other SDK clients in the same process (auth, search, etc.).
- **In production, don't put keys in env at all.** Attach a least-privilege IAM role (`s3:PutObject`, `s3:GetObject` on `arn:aws:s3:::bucket/prefix/*`) and let the SDK pick it up.
- Make blob writes **fire-and-forget** with logging. The database row is the source of truth for the UI; a storage hiccup shouldn't fail the request.
- `NoSuchBucket` means you forgot to create the bucket. `InvalidAccessKeyId` usually means real AWS keys are being sent to MinIO.

## Part 2: Testing APIs with curl

### The basic JSON POST

```bash
BASE_URL="http://localhost:8001"

curl -s -X POST "$BASE_URL/query" \
  -H "Content-Type: application/json" \
  -d '{"query": "What does this service do?", "top_k": 5}' | jq .
```

- `-s` hides the progress meter; `| jq .` pretty-prints.
- `-i` shows response headers; `-v` shows the whole exchange (great for CORS and auth debugging).
- `-w '%{http_code} %{time_total}s\n' -o /dev/null` prints just the status code and latency.

### Bearer-token auth

```bash
export TOKEN="<paste token here>"     # never commit it, never paste it in docs
curl -s -H "Authorization: Bearer $TOKEN" "$API_BASE/profile" | jq .
```

Most identity-provider tokens expire in about an hour; a 401 that started "suddenly" is usually expiry. For local testing I keep a small script that logs in and prints a fresh token.

### Multi-turn (stateful) chat endpoints

For a chatbot that keeps history server-side, the first call returns a `session_id` and follow-ups send it back. Capture it with `jq`:

```bash
RESP=$(curl -s -X POST "$BASE_URL/chat" -H "Content-Type: application/json" \
  -d '{"query": "First question"}')
SID=$(echo "$RESP" | jq -r '.session_id')

curl -s -X POST "$BASE_URL/chat" -H "Content-Type: application/json" \
  -d "{\"query\": \"Follow-up\", \"session_id\": \"$SID\"}" | jq '.answer, .conversation_history | length'
```

Note the quoting: single quotes for static JSON, double quotes with escaped inner quotes when you need shell variables. For anything bigger, `jq -n --arg q "$Q" --arg s "$SID" '{query:$q, session_id:$s}'` builds the body safely.

### Habits that pay off

- Put the base URL and token in shell variables so the same commands work against local, staging, and production.
- Save working curl commands next to the feature's docs. They become your regression tests and onboarding material.
- When a UI says "something went wrong," reproduce the exact request with curl first. It separates frontend bugs from backend bugs in seconds.

## Key takeaways

- MinIO gives you a real S3 API locally; the same SDK code works in production with only env var changes.
- Set `forcePathStyle` for MinIO, use dedicated credential variable names, and use IAM roles (no keys) in production.
- Keep queryable fields in SQL and raw vendor payloads in object storage.
- curl + jq is the fastest way to test, script, and document an API.
