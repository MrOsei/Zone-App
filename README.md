# ZONE

ZONE is a full-stack social networking application for meeting nearby people through geographical proximity, shared interests, communities, and real-world activities. It preserves the original repository’s Next.js/React visual foundation while replacing the hostel product with a persistent social platform.

No seed accounts, mock APIs, or simulated product interactions are used. A new installation starts empty and is populated through real user activity.

## Implemented product modules

- **Authentication:** registration, login, logout, expiring HTTP-only cookie sessions, route protection, password hashing, and session revocation.
- **Profiles:** names, usernames, bios, cities, interests, and validated PNG/JPEG/WebP avatar uploads.
- **Discovery:** name, username, city, and interest search; genuine browser geolocation; server-side Haversine distances; configurable radius; shared-interest ranking.
- **Privacy:** exact coordinates are never serialized to other users. Profile visibility, nearby visibility, approximate-distance visibility, saved-location removal, blocking, and reporting are real persisted controls.
- **Connections:** send, accept, reject, cancel, incoming/outgoing views, and connection-aware messaging authorization.
- **Feed:** persistent posts, comments, likes, and shares, including community posts.
- **Messaging:** authorized one-to-one conversations, persistent history, authenticated WebSocket delivery, reconnects, heartbeat, and a 15-second refresh fallback.
- **Communities:** create, browse, join, leave, read public member feeds, and post after joining.
- **Events:** create real-world hangouts, search, and manage going/interested RSVPs.
- **Notifications and settings:** persisted activity notifications, mark-all-read, privacy settings, blocked-account management, and account-session controls.
- **Installable UI:** responsive desktop/mobile layouts, keyboard-accessible dialogs, 44px touch targets, safe-area support, manifest, icons, and a production service worker.

Reports are stored for moderation review. This release does not include an administrator moderation dashboard, email verification, password-reset email delivery, or an external backup service.

## Stack

- Next.js 16 App Router, React 19, TypeScript, and Tailwind CSS 4
- Custom Node HTTP server running Next.js and `ws` in one process
- SQLite through `better-sqlite3`, with versioned SQL migrations
- Zod request validation and centralized API errors
- Node `scryptSync` password hashing and random 256-bit session tokens
- Node test runner with real HTTP and WebSocket integration clients

## Requirements

- Node.js 20.9 or newer; Node 22 LTS is recommended
- npm
- A native build environment if a prebuilt `better-sqlite3` binary is unavailable

## Local development

```bash
npm ci
cp .env.example .env.local
npm run dev
```

Open `http://localhost:3000`. Migrations run automatically before the server listens. The default `.data/` directory contains both the database and uploaded avatars and is ignored by Git.

Useful checks:

```bash
npm run typecheck
npm run lint
npm audit --omit=dev
npm run build
npm test
```

`npm test` runs the production server on port 3101 against an isolated `test-data/` database. Build first. The suite covers health/migrations, authentication, profile and avatar updates, coordinate non-disclosure, real nearby filtering, privacy controls, connections, messaging authorization, live WebSocket delivery, persistent history, posts/comments/likes/shares, communities, events, notifications, blocks/reports, logout, and persistence across a production-server restart.

See [docs/VERIFICATION.md](docs/VERIFICATION.md) for the completed browser and production verification record.

## Environment variables

| Variable | Required | Default | Purpose |
| --- | --- | --- | --- |
| `DATA_DIR` | Yes on Render | `.data` | Parent directory for SQLite and uploaded avatars. Render uses `/var/data/zone`. |
| `DATABASE_PATH` | No | `$DATA_DIR/zone.sqlite` | Optional absolute override for only the SQLite file. Keep it on the persistent disk. |
| `PORT` | Render supplies it | `3000` | HTTP and WebSocket port. The server binds to `0.0.0.0`. |
| `NODE_ENV` | Set by scripts/Blueprint | Development for `dev`, production for `start` | Enables production behavior, including Secure cookies and service-worker registration. |

There is no JWT secret or session-secret variable to invent: session tokens are generated per session, and only their SHA-256 hashes are stored. Do not commit `.env.local`, databases, uploads, or credentials.

## Production start

```bash
npm ci
npm run db:migrate
npm run build
npm start
```

The migration command is safe to rerun. `npm start` also applies pending migrations before accepting traffic, so a separate migration command is optional during a normal single-instance startup.

Health check:

```text
GET /api/health
```

A healthy response has HTTP 200 and includes `status: "ok"`, `database: "connected"`, the latest applied migration, and a timestamp. Database or migration failures produce a failed health check rather than a false ready state.

## Container deployment

The multi-stage `Dockerfile` builds the optimized Next.js application and runs it with production-only dependencies as an unprivileged user. Keep the persistent volume and the one-instance limit:

```bash
docker build -t zone-social .
docker run --rm -p 3000:3000 -v zone-data:/var/data zone-social
```

The container defaults to `DATA_DIR=/var/data/zone` and port 3000. Override `PORT` only when the hosting platform requires it. The production-only dependency installation and startup were verified against `/api/health` and the PWA manifest.

## Render deployment

The repository root contains a ready-to-use `render.yaml` Blueprint. It defines:

- A **paid Starter** Node web service (persistent disks are not a free-plan feature).
- Exactly **one application instance**.
- Build: `npm ci && npm run build`.
- Start: `npm start`.
- Health check: `/api/health`.
- A 1 GB persistent disk mounted at `/var/data`.
- `DATA_DIR=/var/data/zone`, placing both `zone.sqlite` and `uploads/` on that disk.

To deploy:

1. Push this complete application directory to a Git repository with `render.yaml` at its root.
2. In Render, choose **New → Blueprint Instance** and connect that repository.
3. Review the Starter plan, region, single instance, environment, and persistent disk. Select a region before the first deployment if Oregon is not appropriate.
4. Apply the Blueprint and wait for the deploy. The startup log should include `ZONE ready on http://0.0.0.0:<port>`.
5. Open `https://<service>.onrender.com/api/health` and confirm HTTP 200 with `status: "ok"`.
6. Register a real account and verify discovery, posting, and messaging over HTTPS. Browser geolocation and installable PWA behavior require a secure context outside localhost.

Saving a Blueprint or a preview version does not deploy or publish anything by itself. The Render service exists only after the repository owner applies it in Render.

For manual dashboard setup instead of a Blueprint, use the same build/start/environment values and attach the disk before starting the service. Do not start with the default `.data` path on Render: that would place live data on ephemeral storage.

## SQLite persistence, concurrency, and scaling limits

These constraints are deliberate and must not be removed during deployment:

- **Run one ZONE application instance.** Do not enable autoscaling, add a second web service, run preview environments against production data, or point another worker at the same live database.
- SQLite allows many readers but only one writer at a time. ZONE enables WAL mode, foreign keys, a 5-second busy timeout, and `synchronous=NORMAL`. Under heavy write contention, requests can wait and eventually fail rather than being queued indefinitely.
- The synchronous better-sqlite3 driver and in-process WebSocket/rate-limit state are designed for this single-process deployment. Multi-instance realtime delivery and distributed rate limiting require external infrastructure.
- A persistent disk protects data across normal Render deploys and restarts; it is not an off-site backup or a multi-instance database. Establish scheduled backups using SQLite’s online backup mechanism, store them outside the live disk, and test restores. Do not treat an arbitrary copy of a live database/WAL pair as a verified backup.
- The disk can be enlarged later, but disk size alone does not increase SQLite write throughput. For high concurrent write volume or horizontal scaling, migrate to a client/server database such as PostgreSQL and add an external realtime/rate-limit layer.
- Do not deploy this custom WebSocket + SQLite server as a serverless/static Next.js application. It needs the long-running Node process supplied by the Render service.

Migrations are forward-only files in `db/migrations/`. Never edit an already applied migration; add a new version instead. Keep the single-instance startup model so schema changes cannot race across application instances.

## Security notes

- Passwords use salted scrypt hashes; plaintext passwords are never stored.
- Session cookies are HTTP-only, SameSite=Lax, and Secure in production. Logout deletes the server-side session.
- Mutation routes validate same-origin requests when an Origin header is present. Authentication and object-level authorization run on the server.
- Login, registration, and messaging have in-memory IP rate limits. These limits reset on restart and are not a substitute for an edge WAF or distributed abuse controls.
- Discovery computes distance privately and returns only rounded approximate distance when permitted. It never returns stored latitude/longitude or raw distance.
- Avatar uploads have a 2 MB limit, MIME/magic-byte checks, random filenames, and storage outside the database.
- WebSocket upgrades use the same session cookie. Clients cannot create messages directly over the socket; messages persist through an authorized REST operation before broadcast.

## Project map

```text
server/index.ts              Next.js + authenticated WebSocket server
src/app/api/                 Validated REST API routes
src/components/zone/         Product screens and shared UI
src/lib/server/              Database, auth, HTTP, posts, realtime helpers
db/migrations/               Versioned SQLite schema
scripts/migrate.ts           Idempotent migration command
tests/integration.test.ts    Production workflow and restart tests
public/                      PWA manifest, service worker, icons
render.yaml                  Single-instance Render + persistent disk
```

## License

Apache-2.0. The original repository license is retained in `LICENSE`.
