# GigCampus

A compact full-stack micro-gig marketplace MVP for students. It starts with memory-backed mock data, so no database setup is required to explore the UI.

## Run locally

```bash
cd gigcampus
npm install
npm install --prefix client
npm install --prefix server
npm run dev
```

Open `http://localhost:5173`. The API is served at `http://localhost:4000`.

Demo login: `student@gigcampus.test` or `client@gigcampus.test`, password `password123`.

## Database

Create a PostgreSQL database and run `server/schema.sql`. Set `DATABASE_URL` and a strong `JWT_SECRET` in `server/.env` (copy from `.env.example`). The supplied REST layer deliberately uses in-memory data first; replace its arrays with PostgreSQL queries when the database is available.

## API highlights

- `POST /api/auth/register`, `POST /api/auth/login`
- `GET/POST /api/gigs`, `GET /api/gigs/recommended`
- `POST /api/gigs/:id/applications`, `GET /api/gigs/:id/applications`
- `PATCH /api/applications/:id`, `PATCH /api/gigs/:id/status`
- `GET/POST /api/messages/:gigId`, `GET /api/notifications`
- `GET /api/admin/metrics`
