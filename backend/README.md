<div align="center">

<img src="https://img.shields.io/badge/TypeScript-3178C6?style=flat&logo=typescript&logoColor=white" />
<img src="https://img.shields.io/badge/Node.js-339933?style=flat&logo=node.js&logoColor=white" />
<img src="https://img.shields.io/badge/Express%205-000000?style=flat&logo=express&logoColor=white" />
<img src="https://img.shields.io/badge/Supabase-3ECF8E?style=flat&logo=supabase&logoColor=white" />
<img src="https://img.shields.io/badge/MongoDB%20Atlas-47A248?style=flat&logo=mongodb&logoColor=white" />
<img src="https://img.shields.io/badge/Redis%20Cloud-DC382D?style=flat&logo=redis&logoColor=white" />
<img src="https://img.shields.io/badge/Zod%20v4-3E67B1?style=flat&logo=zod&logoColor=white" />
<img src="https://img.shields.io/badge/Pino-7B42BC?style=flat&logo=pino&logoColor=white" />
<img src="https://img.shields.io/badge/Helmet-8A2BE2?style=flat" />

# PulseGym — Backend

Express + TypeScript API for PulseGym: member registration and auth, workout
tracking, member dashboards, an admin console, and printable/QR member
reports.

[PulseGym API / Test Console](https://moamen-tamer.github.io/gym-system/GYM_TESTING.html)

</div>

**Backend ownership:** the entire backend — architecture, API, database
schema across Supabase/MongoDB/Redis, auth, caching, and reporting — was
designed and built independently by
[Mo'men Tamer](https://github.com/Moamen-Tamer)
([LinkedIn](https://www.linkedin.com/in/mo-men-tamer-2005mt)). This is a
7-person team project; the other six members are building the frontend
against this API.

<a href="https://github.com/Moamen-Tamer"><img src="https://img.shields.io/badge/GitHub-Moamen--Tamer-181717?style=flat&logo=github&logoColor=white" /></a>
<a href="https://www.linkedin.com/in/mo-men-tamer-2005mt"><img src="https://img.shields.io/badge/LinkedIn-mo--men--tamer-0A66C2?style=flat&logo=linkedin&logoColor=white" /></a>
<a href="../LICENSE"><img src="https://img.shields.io/badge/License-MIT-red.svg?style=flat" /></a>

For a full endpoint-by-endpoint walkthrough with live request/response
samples, see [`GYM_TESTING.html`](../GYM_TESTING.html) at the repo root.

## Stack

| Layer | Tech |
|---|---|
| Runtime | Node.js, Express 5, TypeScript |
| Relational data | Supabase (PostgreSQL) — `members` table + auth |
| Document data | MongoDB Atlas (via Mongoose) — `workouts` collection |
| Cache | Redis Cloud (via ioredis) |
| Validation | Zod, applied per-route via a `validate` middleware |
| Logging | pino / pino-http |

Every route validates `body`/`query`/`params` against a Zod schema before it
reaches a controller, and every thrown error is normalized to a single JSON
shape: `{ "message": "..." }`.

## Getting started

1. **Copy the environment file** and fill in real values:

   ```bash
   cp .env.example .env
   ```

   You'll need a Supabase project (URL + anon key + service role key), a
   MongoDB Atlas connection string, and a Redis Cloud connection string. All
   three are required — `src/config/env.ts` validates them at startup with
   Zod and the process exits immediately if any are missing or malformed.

2. **Install dependencies:**

   ```bash
   npm install
   ```

3. **Push the Postgres schema to Supabase:**

   ```bash
   npm run supabase:push
   ```

4. **Run the MongoDB migration:**

   ```bash
   npm run migrate:mongodb:up
   ```

5. **Seed the database** (creates the admin account, ~250 members, and
   months of realistic workout history):

   ```bash
   npm run seed
   ```

   Useful flags: `-- --members=500` (seed a different member count),
   `-- --skip-clean` (append instead of wiping first), `-- --dry-run`
   (validate everything, write nothing), `-- --help`.

6. **Start the dev server** (watches for changes):

   ```bash
   npm run dev
   ```

   The server also verifies all three connections (Mongo, Redis, Supabase)
   before it starts listening — if any of them are unreachable, it logs why
   and exits rather than starting in a half-working state.

Other scripts: `npm run build` / `npm start` for a production build,
`npm run check` for a type-check with no output, and the
`migrate:mongodb:*` / `supabase:*` family for individual migration and
Supabase CLI operations.

## Architecture

```
src/
  config/         env parsing, cookie options, logger
  connections/    Mongo, Redis, Supabase client setup
  controllers/    request/response handling — no business logic
  services/       business logic, one file per domain
  repositories/   direct data access (Supabase queries, Mongo queries, cache)
  routes/         Express routers, wire validation + middleware + controller
  schemas/        Zod schemas for every route's body/query/params
  middlewares/    auth, authorization, rate limiting, validation, error handling
  models/         Mongoose schema for workouts
  types/          shared TypeScript types
  server/         app.ts (Express app + route mounting), bootstrap.ts (startup/shutdown)
```

Controllers stay thin on purpose — they call a service, then shape the HTTP
response. Anything that touches Supabase, MongoDB, or Redis directly lives
in `repositories/`, not in a controller or service.

## Auth model

Two independent sessions, on two different cookies:

- **Members** authenticate through Supabase (`POST /api/auth/login`), which
  sets an `accessToken` (short-lived) and `refreshToken` (30-day) cookie.
  `authenticateToken` middleware verifies the access token against Supabase
  on every request to `/api/members`, `/api/workouts`, and `/api/dashboard`.
- **The admin** authenticates separately (`POST /api/admin/login`) against
  the single account defined by `ADMIN_EMAIL` / `ADMIN_PASSWORD`, which sets
  an `adminAccessToken` cookie — a JWT signed with those same env values.
  `authenticateAdmin` middleware guards `/api/reports` in addition to
  everything under `/api/admin`.

Both cookies are `httpOnly`, `sameSite: strict`, and `secure` in production.

## Caching

Three routes are cached transparently through Redis — a cache hit returns
without touching Postgres or Mongo at all:

| Cache key | Backing route | TTL |
|---|---|---|
| `dashboard:{memberId}` | `GET /api/dashboard/` | 10 min |
| `report:{memberId}` | `GET /api/reports/:memberId` (and `/qr`, `/print`, which build on it) | 30 min |
| `gym:stats` | `GET /api/admin/statistics` | 5 min |

There's no cache-busting endpoint — data written through the API (a new
workout, a subscription change) will lag behind on these three routes for up
to their TTL. Keep that in mind when writing tests that write then
immediately read back.

## Notable validation rules

- Passwords: 6–255 characters.
- Full names: 3–100 characters.
- Phone numbers: must match `01XXXXXXXXX` (Egyptian mobile format).
- `subscriptionPlan`: `basic` | `standard` | `premium` — each maps to a
  fixed set of `allowed_workout_days` (3 / 5 / 7 days respectively), applied
  automatically whenever a plan is set or changed.
- `workoutType`: `strength` | `cardio` | `flexibility` | `hiit` | `crossfit`
  | `yoga` | `other`.
- Pagination (`page`/`limit`) is accepted wherever a route returns a list;
  `limit` is capped at 100.

## Reports

`GET /api/reports/:memberId` returns a member's profile, their most recent
100 workouts, and the same stats/chart shape as the dashboard, all in one
payload. The `/qr` variant encodes a JSON summary of those stats directly
into the QR code (not a link), and `/print` returns a fully self-contained
dark-mode HTML document — open it directly in a browser rather than parsing
it as JSON.

## Testing

The Postman collection at `GYM.postman_collection.json` (this folder) has 37
saved requests covering every endpoint, including expected validation
failures. `GYM_TESTING.html` at the repo root turns that same collection
into a browsable manual — a setup guide, a checklist for member and admin
flows, a screen-by-endpoint map for the frontend team, and the full
request/response log.