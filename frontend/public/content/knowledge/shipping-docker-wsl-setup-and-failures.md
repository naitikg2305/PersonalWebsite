---
title: "Docker on WSL2: Setup and the Failures I Actually Hit"
category: "Shipping Software: Docker, Deploys & Integrations"
slug: "shipping-docker-wsl-setup-and-failures"
summary: "How to get Docker working inside WSL2 (Docker Desktop or native Engine), plus a troubleshooting guide for the real failures: missing docker command, dead daemon, blocked Docker Hub pulls, networking to the host, and lost data."
---

# Docker on WSL2: Setup and the Failures I Actually Hit

## What and why

Most of my day-to-day development on Windows happens inside **WSL2** (a real Linux kernel running in a lightweight VM). Getting Docker to work there is usually easy, but when it fails, the error messages are not helpful. This article covers the two setup options and a troubleshooting table built from problems I really ran into while setting up local stacks (a backend, a frontend, a MySQL/MariaDB container, and MinIO for S3).

For the concepts (images, containers, Compose), see the companion article on the Docker mental model.

## Option A: Docker Desktop (recommended for most people)

Docker Desktop runs the engine on Windows and exposes the `docker` CLI inside your WSL distro.

1. Install Docker Desktop and keep **"Use WSL 2 instead of Hyper-V"** checked.
2. Launch it and wait for the whale icon to stop animating (the engine is up).
3. **Settings -> Resources -> WSL Integration**: enable integration for your default distro *and* toggle your specific distro (e.g. Ubuntu). **Apply & Restart**.
4. Open a **new** WSL terminal and verify:

```bash
docker --version
docker run hello-world     # should print "Hello from Docker!"
docker compose version     # v2 plugin, note: space, not hyphen
```

## Option B: Docker Engine directly inside WSL (no Desktop)

Good if you want a headless, pure-Linux setup.

```bash
# 1. Remove old/conflicting packages
sudo apt-get remove docker docker-engine docker.io containerd runc 2>/dev/null

# 2. Prerequisites
sudo apt-get update
sudo apt-get install -y ca-certificates curl gnupg lsb-release

# 3. Docker's GPG key and apt repo
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | \
  sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
  https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# 4. Engine + CLI + Compose plugin
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io \
  docker-buildx-plugin docker-compose-plugin
```

**Starting the daemon.** Older WSL setups do not run systemd, so start Docker manually:

```bash
sudo service docker start
```

To auto-start it, add this to `~/.bashrc`:

```bash
if ! pgrep -x "dockerd" > /dev/null 2>&1; then
  sudo service docker start > /dev/null 2>&1
fi
```

If your distro has systemd enabled (`[boot] systemd=true` in `/etc/wsl.conf`), use `sudo systemctl enable --now docker` instead.

**Run without sudo:**

```bash
sudo groupadd docker 2>/dev/null
sudo usermod -aG docker $USER
newgrp docker      # or log out and back in
```

## Troubleshooting: failures and fixes

| Symptom | Cause | Fix |
|---|---|---|
| `docker: command not found` in WSL | Desktop's WSL integration not enabled for this distro, or an old shell session | Toggle the distro under WSL Integration, Apply & Restart, then open a **new** terminal |
| `Cannot connect to the Docker daemon` | Engine not running (Option B), or Desktop not started | `sudo service docker start`, or launch Docker Desktop |
| `permission denied ... docker.sock` | User not in `docker` group | `usermod -aG docker $USER` and re-login |
| `docker-compose: command not found` | Old Compose v1 binary expected | Use `docker compose` (v2 plugin, space not hyphen) |
| `port is already allocated` | Another process or container holds the host port | `sudo lsof -i :9000` to find it, or remap: `-p 19000:9000` |
| Data vanished after `docker rm` | No volume mounted | Always mount data dirs: `-v ~/minio-data:/data` |
| App in a container can't reach a DB on the host via `localhost` | `localhost` inside a container is the container | Use `host.docker.internal` (add `extra_hosts: ["host.docker.internal:host-gateway"]` on native Linux engines) |
| `failed to fetch anonymous token` / `EOF` on pull | Docker Hub (`auth.docker.io`) blocked by VPN, proxy, or DNS | See next section |

## When Docker can't pull images from Docker Hub

This one cost me real time. `docker compose up --build` failed before building anything, with errors like `failed to fetch anonymous token` or a bare `EOF`. The build itself was fine; Docker simply could not reach Docker Hub to pull base images (`node:20-alpine`, `nginx:alpine`, `mariadb`). Work through these in order:

1. **Prove it's the network.** Run `docker pull hello-world`. If it fails, nothing else will work.
2. **Turn off the VPN** or try another network (a phone hotspot is a quick test). Corporate and campus VPNs often block or intercept Docker Hub.
3. **Fix DNS.** Docker Desktop -> Settings -> Resources -> Network: set DNS to `8.8.8.8` (or `8.8.8.8,8.8.4.4`), Apply & Restart, then retry in a new terminal.
4. **Configure the proxy** if you're behind a corporate one: Settings -> Resources -> Proxies -> manual HTTP/HTTPS proxy.
5. **Air-gap workaround.** On a machine that *can* pull, save the images to a tarball and load them where you need them:

```bash
# On a machine with Docker Hub access
docker pull mariadb:11.2 node:20-alpine nginx:alpine
docker save mariadb:11.2 node:20-alpine nginx:alpine -o base-images.tar

# On the restricted machine (no internet needed)
docker load -i base-images.tar
```

Once the base images exist locally, `docker build` uses them from the cache and never needs Docker Hub.

### The partial-stack fallback

A useful pattern: if only the database image is the problem, or I already have MySQL installed natively, I run **only the backend and frontend in Docker** and point the backend at the host database:

```yaml
services:
  backend:
    build: ./backend
    env_file: ./backend/.env
    environment:
      DATABASE_HOST: host.docker.internal
    extra_hosts:
      - "host.docker.internal:host-gateway"
    ports:
      - "5000:5000"
  frontend:
    build: ./frontend
    ports:
      - "3000:80"
```

Wrapping both variants in a Makefile (`make up-build` for the full stack, `make up-no-db` for the host-DB version) means teammates don't need to remember which compose file to use.

## Know what is built vs pulled

When a stack fails to start, it helps to know where each piece comes from:

| Service | Source |
|---|---|
| Database | **Pulled** as-is (e.g. `mariadb:11.2`) |
| Backend | **Built** from your Dockerfile, on top of a pulled base (`node:20-alpine`) |
| Frontend | **Built** with a multi-stage Dockerfile: build on `node`, serve on `nginx:alpine` |

If a pull fails, everything that depends on that base image fails too, even though the error mentions your build.

## Quality-of-life aliases

```bash
alias dc='docker compose'
alias dps='docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"'
alias dlogs='docker logs -f'
```

## Key takeaways

- Docker Desktop + WSL Integration is the easy path; native Engine in WSL works too but you manage the daemon yourself.
- After changing integration settings or group membership, **open a new terminal**.
- `docker compose` (v2) is the current command; `docker-compose` is legacy.
- Pull failures (`anonymous token`, `EOF`) are network problems: VPN, DNS, proxy. `docker save` / `docker load` is the escape hatch.
- Inside a container, `localhost` is the container; use the compose service name or `host.docker.internal`.
- Mount volumes for anything you want to keep.
