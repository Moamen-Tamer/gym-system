<div align="center">

<img src="https://img.shields.io/badge/TypeScript-3178C6?style=flat&logo=typescript&logoColor=white" />
<img src="https://img.shields.io/badge/Node.js-339933?style=flat&logo=node.js&logoColor=white" />
<img src="https://img.shields.io/badge/Express%205-000000?style=flat&logo=express&logoColor=white" />
<img src="https://img.shields.io/badge/Angular%2021-DD0031?style=flat&logo=angular&logoColor=white" />
<img src="https://img.shields.io/badge/Supabase-3ECF8E?style=flat&logo=supabase&logoColor=white" />
<img src="https://img.shields.io/badge/MongoDB%20Atlas-47A248?style=flat&logo=mongodb&logoColor=white" />
<img src="https://img.shields.io/badge/Redis%20Cloud-DC382D?style=flat&logo=redis&logoColor=white" />
<img src="https://img.shields.io/badge/License-MIT-red.svg?style=flat" />

# EliteGym

A full-stack gym management platform: member registration and authentication,
live workout tracking, progress dashboards, printable/QR member reports, and
an admin console for managing members and viewing gym-wide statistics.

[**Open the API / Test Console**](https://moamen-tamer.github.io/gym-system/GYM_TESTING.html)<br>
[**  Open the Presentation**](https://moamen-tamer.github.io/gym-system/Presentation.html)

</div>

---

## What this is

EliteGym is a two-piece system built for a 7-person team project:

- **`backend/`** — a Express + TypeScript REST API, designed and built
  independently by [Mo'men Tamer](https://github.com/Moamen-Tamer)
  ([LinkedIn](https://www.linkedin.com/in/mo-men-tamer-2005mt)). It owns
  every member's account, subscription, workout history, and the admin
  side of the gym.
- **`frontend/Elite_Gym/`** — an Angular 21 application, "Elite Gym", built
  by the other six members of the team against the backend's API.

The two pieces talk over a plain HTTP/JSON API secured with `httpOnly`
cookies, so either side can be run, tested, or replaced independently.

See [`GYM_TESTING.html`](./GYM_TESTING.html) for a full, browsable
walkthrough of every endpoint with live request/response samples — it
doubles as the manual test console the team used while building the
frontend.

## How the pieces fit together

```
┌──────────────────────┐        HTTP/JSON, cookies       ┌──────────────────────┐
│  frontend/Elite_Gym  │  ───────────────────────────►   │       backend        │
│  Angular 21 + Boot-  │  ◄───────────────────────────   │  Express 5 + TS API  │
│  strap, port 4200    │                                 │      port 3000       │
└──────────────────────┘                                 └──────────┬───────────┘
                                                                    │
                                     ┌──────────────────────────────┼──────────────────────────────┐
                                     ▼                              ▼                              ▼
                           ┌───────────────────┐          ┌───────────────────┐           ┌───────────────────┐
                           │Supabase (Postgres)│          │   MongoDB Atlas   │           │    Redis Cloud    │
                           │     members +     |          │                   │           | dashboard/report/ │
                           │   authentication  │          │  workouts history |           |   stats caching   │
                           └───────────────────┘          └───────────────────┘           └───────────────────┘
```

- **Supabase (Postgres)** holds member accounts and drives authentication.
- **MongoDB Atlas** holds workout sessions — start/stop timestamps,
  duration, calories, type, feedback.
- **Redis Cloud** transparently caches three of the more expensive
  read routes (member dashboard, member report, admin statistics) so
  repeated reads skip the database entirely until their TTL expires.

Full detail on the backend's internals — folder structure, auth model,
caching TTLs, and validation rules — lives in
[`backend/README.md`](./backend/README.md).

## Repository layout

```
gym-system/
├── GYM_TESTING.html     interactive API walkthrough / test console (this repo's demo page)
├── LICENSE              MIT
├── backend/             Express + TypeScript API — see backend/README.md
└── frontend/
    └── Elite_Gym/       Angular 21 client — see frontend/Elite_Gym/README.md
```

## Getting the whole stack running locally

Each half of the project has its own dependencies and its own README with
full setup steps. At a glance:

1. **Backend** — copy `backend/.env.example` to `backend/.env`, fill in a
   Supabase project, a MongoDB Atlas URI, and a Redis Cloud URL, then:

   ```bash
   cd backend
   npm install
   npm run supabase:push        # push the Postgres schema
   npm run migrate:mongodb:up   # run the Mongo migration
   npm run seed                 # admin account + ~250 members + workout history
   npm run dev                  # starts on http://localhost:3000
   ```

2. **Frontend** — in a second terminal:

   ```bash
   cd frontend/Elite_Gym
   npm install
   ng serve                     # starts on http://localhost:4200
   ```

   The backend's CORS is configured to accept credentialed requests from
   `http://localhost:4200` by default, so the two dev servers work
   together out of the box.

Full walkthroughs, including every environment variable, migration
command, and seeding flag, are in
[`backend/README.md`](./backend/README.md) and
[`frontend/Elite_Gym/README.md`](./frontend/Elite_Gym/README.md).

## API surface at a glance

24 endpoints across six route groups, every one of them validated with
Zod before it reaches a controller:

| Group | Base path | What it covers |
|---|---|---|
| Auth | `/api/auth` | register, login, logout, refresh |
| Members | `/api/members` | a member's own account, subscription, allowed workout days |
| Workouts | `/api/workouts` | start/stop a session, submit feedback, view history |
| Dashboard | `/api/dashboard` | a member's stats and progress charts |
| Admin | `/api/admin` | admin login, full member CRUD, subscription changes, gym-wide statistics |
| Reports | `/api/reports` | a member's report as JSON, as a QR code, or as a printable HTML page |

Members and admins authenticate separately, on separate cookies, so an
admin session never doubles as member access and vice versa. The full
endpoint list, request/response shapes, and auth rules are documented in
[`backend/README.md`](./backend/README.md) and demonstrated live in
[`GYM_TESTING.html`](./GYM_TESTING.html).

## License

MIT — see [`LICENSE`](./LICENSE).
