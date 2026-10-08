---
title: "Docker Mental Model: Dockerfiles, Images, Containers and Compose"
category: "Shipping Software: Docker, Deploys & Integrations"
slug: "shipping-docker-mental-model"
summary: "A practical mental model of Docker: how a Dockerfile becomes an image and then a container, why that replaces most virtual-environment juggling, and how Compose runs a whole app stack locally."
---

# Docker Mental Model: Dockerfiles, Images, Containers and Compose

## What and why

Without Docker, my laptop *is* the environment. Node, Python, a virtualenv, `node_modules`, a local database, and whatever versions I happened to install all have to line up before `npm run dev` works. When a teammate has a different Python or MySQL version, we get the classic "works on my machine" bug.

Docker packages the **environment together with the application**. Instead of writing a setup doc ("install Node 20, then MySQL 8, then..."), you describe the environment in code and anyone can run it with one command. I think of Docker as **infrastructure as code for development environments**.

```
Without Docker:  laptop  -> runs the app
With Docker:     laptop  -> Docker Engine -> containers -> app
```

## The three core concepts

```
Dockerfile  --(docker build)-->  Image  --(docker run)-->  Container
  recipe                         baked cake                 a running copy
```

### Dockerfile: the recipe

A text file describing how to build the environment: the base runtime, the dependencies to install, the code to copy, and the start command.

```dockerfile
FROM python:3.11
WORKDIR /app

# Copy only the dependency manifest first (see "layer caching" below)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Then copy the rest of the code
COPY . .

CMD ["python", "app.py"]
```

The same idea for a Node/TypeScript backend:

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["node", "dist/index.js"]
```

### Image: the built package

`docker build -t backend .` runs the recipe and produces an **image**: a read-only bundle containing a Linux filesystem, the runtime, installed dependencies, your code, and the startup command. Images are stored locally and can be pushed to a registry (Docker Hub, ECR, GHCR).

### Container: a running instance

`docker run backend` starts a **container**, a running process with its own isolated filesystem and network, created from the image. You can run many containers from one image. Each one behaves like a small, disposable computer.

## Images are layers, and layers are cached

Each instruction in a Dockerfile creates a **layer**:

```
Layer 1: base OS
Layer 2: language runtime
Layer 3: dependency install   (pip install / npm ci)
Layer 4: application code
Layer 5: start command
```

Docker caches layers and only rebuilds from the first one that changed. That is why the best-practice ordering is **copy dependency files, install, then copy code**. If you only edit source code, the slow `npm ci` / `pip install` layer is reused and rebuilds take seconds instead of minutes. If you `COPY . .` first, every code change invalidates the install layer.

A `.dockerignore` file (like `.gitignore`) keeps `node_modules`, `.env`, `.git`, and build output out of the build context. That makes builds faster and avoids baking secrets into images.

## Container lifecycle

```bash
docker build -t backend .          # build image
docker run -d --name api backend   # start container in background (-d = detached)
docker ps                          # running containers
docker ps -a                       # including stopped ones
docker logs -f api                 # follow logs
docker exec -it api sh             # shell inside the running container
docker stop api                    # stop the process (container still exists)
docker start api                   # start it again
docker rm api                      # delete the container (image remains)
docker rmi backend                 # delete the image
```

The key distinction: **stopping** a container pauses its existence, **removing** it deletes the container and anything written inside it, and the **image** is untouched by both.

Useful `docker run` flags:

```bash
-p 8080:8080            # port mapping, host:container
-v ~/data:/data         # bind mount, host-path:container-path
-e KEY=value            # environment variable
--env-file .env         # load many env vars from a file
--restart unless-stopped  # come back after reboots unless I stopped it myself
```

## Why this replaces virtual environments (mostly)

A Python venv isolates *Python packages*. A container isolates the *whole runtime*: OS libraries, interpreter version, packages, and code. So one container can run Python 3.11 + FastAPI while another runs Python 3.8 + Django on the same laptop with no conflicts. I still use venvs for quick scripts, but for anything with services (a DB, a cache, object storage) containers win.

## Persistent data: volumes

Containers are **ephemeral**. Delete the container and every file written inside it is gone. That is fine for app code (it lives in the image) but disastrous for a database.

The fix is to store data outside the container:

- **Named volumes** managed by Docker: `-v pgdata:/var/lib/postgresql/data`
- **Bind mounts** to a host folder: `-v ~/minio-data:/data`

The volume survives `docker rm`, so a recreated container picks up the same data.

## Docker Compose: running a whole stack

Real apps are several services: frontend, backend, database, cache, object storage. Compose describes them all in one `docker-compose.yml`:

```yaml
services:
  backend:
    build: ./backend
    ports:
      - "8080:8080"
    env_file: ./backend/.env
    environment:
      DATABASE_HOST: db        # service name = hostname on the compose network
    depends_on:
      - db

  frontend:
    build: ./frontend
    ports:
      - "3000:3000"

  db:
    image: postgres:15
    environment:
      POSTGRES_PASSWORD: localdev
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data

volumes:
  pgdata:
```

```bash
docker compose up -d --build   # build images, create network + containers, start all
docker compose logs -f backend # logs for one service
docker compose restart backend
docker compose down            # stop and remove containers (named volumes survive)
docker compose down -v         # ...and delete volumes too (fresh database)
```

Compose puts every service on a shared network where **the service name is the hostname**. Inside the backend container, the database is `db:5432`, not `localhost:5432`. `localhost` inside a container means *that container itself*. This trips up almost everyone once.

A typical layout:

```
project/
  docker-compose.yml
  Makefile            # make up / make down / make logs shortcuts
  backend/
    Dockerfile
  frontend/
    Dockerfile
```

## Mapping cloud architecture to local containers

Docker does not run AWS locally. It runs **local equivalents** so the app sees the same shape of infrastructure:

| Cloud service | Local container |
|---|---|
| App hosting (Elastic Beanstalk, ECS) | backend container |
| Static/frontend hosting (Amplify, Vercel) | frontend container (nginx or dev server) |
| RDS (MySQL/Postgres) | `mysql` / `mariadb` / `postgres` container |
| S3 | MinIO container (S3-compatible API) |
| Managed auth | a mock or a dev bypass flag |

Same code, different environment variables. That is the goal.

## Gotcha: production-style images are not your dev server

The first time I containerized an existing app, it felt "broken" because nothing hot-reloaded. The reason: the Dockerfiles were written **production-style**.

| | Running locally | In the production-style container |
|---|---|---|
| Backend | `npm run dev` (nodemon, restarts on change) | `npm run build` then `node dist/index.js` |
| React frontend | `npm start` (dev server, hot reload) | `npm run build` then nginx serves static files |

So with that setup, every code change means rebuild + restart. That is great for "does it actually build and run like prod?" and bad for day-to-day editing. If you want hot reload in Docker, write a separate dev target or compose override that bind-mounts your source (`-v ./src:/app/src`) and runs the dev command.

## Recommended workflow for dockerizing an app

1. **Inventory the app:** runtime versions, env vars, start commands, external services (DB, cache, storage, auth).
2. **One Dockerfile per service**, dependency-install layer before the code copy.
3. **A `docker-compose.yml`** wiring the services, ports, env files, and volumes.
4. **`docker compose up`** and fix what breaks: usually hostnames (`localhost` vs service name), missing env vars, and DB connection settings like SSL.
5. Optionally a **Makefile** so teammates only need `make up`.

## Key takeaways

- **Dockerfile -> image -> container**: recipe, built artifact, running instance.
- Order Dockerfile steps so dependency installs are cached; use `.dockerignore`.
- Containers are disposable; anything that must persist goes in a **volume**.
- **Compose** runs multi-service stacks; service names are hostnames, and `localhost` inside a container is the container itself.
- Production-style images do not hot-reload; use a dev override if you want that.
- Docker gives you local stand-ins for cloud services so the same code runs everywhere with different env vars.
