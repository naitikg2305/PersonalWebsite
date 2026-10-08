---
title: "Git-Push Deploys on Vercel and Render: How They Work and How to Debug Them"
category: "Shipping Software: Docker, Deploys & Integrations"
slug: "shipping-vercel-render-git-deploys"
summary: "How 'push to GitHub and the site updates' really works on Vercel and Render (GitHub Apps, webhooks, build pipelines), plus environment variables, CORS for split frontend/backend apps, custom domains including the GoDaddy parked-record trap, and a debugging checklist."
---

# Git-Push Deploys on Vercel and Render

## What and why

My personal site uses the common split: a **Next.js frontend on Vercel** and a **Python (FastAPI) backend on Render**. I push to GitHub and both update. It feels like magic until something breaks, and then you realize you don't know where the magic lives. This article explains the machinery so you can set it up from scratch and debug it.

## The core concept: PaaS + GitHub App + webhook

Vercel and Render are **PaaS** (Platform as a Service): you hand them code and they handle servers, builds, HTTPS, and scaling. The link to GitHub has three parts:

1. **A GitHub App installation.** Clicking "Connect GitHub" installs the platform's GitHub App on your account (all repos or selected ones). It can clone code, receive events, and write back commit statuses and PR comments. GitHub Apps are scoped per repo and use short-lived tokens, unlike a personal access token. You manage them at GitHub -> Settings -> Applications -> Installed GitHub Apps.
2. **A webhook.** On every push, GitHub POSTs an event ("repo X, branch Y, commit Z") to the platform.
3. **A build pipeline on the platform.** It clones that commit, installs dependencies, runs your build, and switches traffic to the new version.

```
git push -> GitHub --webhook--> Vercel / Render
                                  clone commit
                                  install deps
                                  build
                                  deploy, swap traffic
                                  report status back (check mark / X on the commit)
```

**Nothing in your repo makes this happen.** No workflow files. The connection lives in the platform dashboard plus the App install. Compare that with **GitHub Actions**, where you write `.github/workflows/*.yml` and GitHub's runners build and deploy. PaaS git-deploys are zero-config but the settings are hidden in a dashboard; Actions are explicit and version-controlled but you maintain them.

## Vercel: built for frontends

### Setup

1. Sign up with GitHub -> **Add New -> Project -> Import Git Repository**. If the repo isn't listed, adjust the GitHub App's repo permissions.
2. Configure:
   - **Framework preset**: auto-detected (Next.js, Vite...).
   - **Root Directory**: set it if the app lives in a subfolder like `frontend/`. This is the setting people miss most.
   - Build/output/install commands: usually defaults.
   - **Environment variables** (see below).
3. Deploy. You get `project-name.vercel.app`.

Gotcha: clicking **Import** again on the same repo creates a **second, separate project** with a random suffix, and now every push builds twice. Fix settings under Project -> Settings instead of re-importing.

### What happens per push

- Push to the **production branch** (usually `main`) -> **Production** deployment; your production domains point at it.
- Push to any other branch or open a PR -> **Preview** deployment with its own URL, commented on the PR.
- Deployments are **atomic and immutable**. Traffic only switches when the build succeeds. A failed build leaves the old version live, so the site doesn't go down, but it also silently stays stale.
- **Rollback**: Deployments tab -> pick an older deployment -> Promote / Instant Rollback.

### How Vercel runs code

Static assets come from a global CDN. Server code (API routes, server components) runs as **serverless functions** with short time limits and a bundle size cap. So Vercel is a poor fit for long-running servers, websockets, background jobs, or large ML dependencies. That's what Render is for.

### Useful controls

- **Ignored Build Step**: skip builds when nothing relevant changed, e.g. `git diff --quiet HEAD^ HEAD ./`.
- **Deploy Hooks**: a secret URL you `curl -X POST` to trigger a deploy without a push.
- **CLI**: `vercel` (preview from your machine), `vercel --prod`, `vercel env pull`, `vercel logs`, `vercel inspect <deployment> --logs`.
- **Hobby plan gotcha**: on private repos, deploys can be blocked when the **commit author email** isn't the account owner. Check `git config user.email`; mixing work/school and personal identities causes this.

## Render: built for backends

### Setup

1. Connect GitHub (installs Render's App) -> **New -> Web Service** -> pick the repo.
2. Configure:
   - **Runtime**: Python, Node, Docker...
   - **Root Directory**: e.g. `backend/`.
   - **Build command**: `pip install -r requirements.txt`
   - **Start command**: `uvicorn app:app --host 0.0.0.0 --port $PORT`
   - **Env vars** for API keys.

The start command must bind to **`0.0.0.0`** (not `127.0.0.1`) and to **`$PORT`**, which Render provides. Getting this wrong is the top reason a deploy "succeeds" but never responds.

### What happens per push

- **Auto-Deploy**: On Commit, After CI Checks Pass, or Off.
- In a monorepo, *any* push redeploys the backend, even frontend-only changes. Use **Build Filters** (include paths like `backend/**`).
- A **health check path** (e.g. `/health`) must return 200 before traffic switches.
- Deploy history and logs live in the Render dashboard; unlike Vercel, it may not post statuses back to GitHub.

### How Render runs code

A **long-running container**, like a real server, which suits an API that loads an embedding model once. Two things to plan for:

- **Free tier sleeps** after roughly 15 minutes idle. The next request is a **cold start** of 30-60+ seconds (longer if loading ML models).
- **The filesystem is ephemeral.** Runtime writes vanish on redeploy. Persist data in the repo (read-only), a paid disk, or a database.

Optionally, a `render.yaml` **Blueprint** puts the service definition in version control.

## Environment variables and secrets

- **Never commit `.env`.** Set secrets in the dashboard; the platform injects them at build and/or run time.
- `.gitignore` only affects **untracked** files. If `.env` was ever committed, run `git rm --cached .env`, commit, and **rotate the key**. It's in history forever, and on a public repo bots scrape it within minutes.
- **Build-time vs runtime**: in Next.js, `NEXT_PUBLIC_*` variables are **inlined into browser JavaScript at build time**. They are public (visible in devtools), and changing one requires a **redeploy**. Use them only for non-secrets like the backend URL. Unprefixed variables stay server-side.
- Vercel scopes variables per environment (Production / Preview / Development), so previews can point at a staging backend.
- The same rule applies to any server: env vars are read at process start, so editing them requires a restart or redeploy.

## Connecting a split frontend and backend

1. Deploy the backend first and note its URL.
2. Set `NEXT_PUBLIC_API_URL=https://<service>.onrender.com` in Vercel, then redeploy.
3. Configure **CORS** on the backend. Browsers block cross-origin requests unless the server allows the origin. List your real domains instead of `"*"`, otherwise any website can call your API and spend your LLM credits:

```python
from fastapi.middleware.cors import CORSMiddleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://www.example.com", "https://example.com",
                   "https://my-project.vercel.app"],
    allow_methods=["POST", "GET"],
    allow_headers=["Content-Type"],
)
```

4. Handle cold starts in the UI: show a "waking up..." message or ping `/health` on page load.

## Custom domains

The **registrar** (GoDaddy, Namecheap, Cloudflare) is where you buy the domain and usually host its DNS. The **host** (Vercel) serves the site. Two ways to connect them:

1. **Keep DNS at the registrar** and add records:
   - apex `@` -> `A 76.76.21.21` (an apex can't be a CNAME; that's a DNS rule)
   - `www` -> `CNAME cname.vercel-dns.com`
2. **Delegate DNS** by switching nameservers to Vercel. Simpler, but you must recreate any email (MX) records there.

Then add **both** `example.com` and `www.example.com` in Vercel -> Domains and set one to redirect to the other. Vercel issues HTTPS certificates per hostname, so if only `www` is added, the apex will fail TLS even when DNS is right.

**The GoDaddy trap:** new GoDaddy domains come with **parked `A` records** pointing at GoDaddy's parking page. If you add Vercel's `A` record without deleting them, the apex has multiple A records and browsers pick one at random. Some visitors get your site, others get a parking page or an HTTPS error. Delete the parked records and turn off any domain forwarding that recreates them.

Verify after the TTL expires (often 10-60 minutes):

```bash
curl -s "https://dns.google/resolve?name=example.com&type=A"  # expect only Vercel's IP
curl -sI https://example.com | head -3                         # expect 200 or a 308 to www
```

Render custom domains work the same way (a CNAME like `api.example.com` -> `xxx.onrender.com`).

## Debugging checklist: "I pushed but nothing changed"

1. **Did the build fail?** Check the status next to the commit on GitHub or the platform's Deployments tab. A failed build leaves the old version live.
2. Right **root directory** and right **production branch**?
3. Did a **build filter** or **ignored build step** skip it?
4. Is the **commit author** allowed (Vercel Hobby)?
5. Did you change an env var **without redeploying**?
6. Are there **duplicate projects** connected to the same repo?
7. **Cache**: hard refresh, or open the deployment's unique URL.
8. **Reproduce the production build locally** (`npx next build`). Dev mode is more forgiving: production builds type-check, lint, and pre-render, which breaks browser-only code running during SSR or `useSearchParams` without a `<Suspense>` boundary.

## When to use what

| Need | Use |
|---|---|
| Static site, React/Next.js frontend | Vercel (or Netlify, Cloudflare Pages) |
| Long-running API, Python/ML, websockets, workers | Render (or Railway, Fly.io) |
| Custom pipeline, tests before deploy | GitHub Actions -> any host |
| Production-scale infra | AWS/GCP/Azure |

## Key takeaways

- Git-push deploys = a GitHub App + a webhook + the platform's build pipeline. The config lives in dashboards, not the repo.
- Failed builds keep the old version live, so "nothing changed" often means "the build failed."
- Bind Render services to `0.0.0.0:$PORT`; expect cold starts and an ephemeral disk on free tiers.
- `NEXT_PUBLIC_*` values are public and baked in at build time. Secrets go in server-only vars, never in git.
- Lock CORS to your real domains.
- For custom domains, add both apex and `www`, and delete GoDaddy's parked A records.
