# PGlite Local Database

This app now uses one Postgres-shaped database model:

- local development without `DATABASE_URL`: PGlite persisted at `./data/pglite`
- shared or deployed environments with `DATABASE_URL`: PostgreSQL via `postgres`

## Configuration

Use PostgreSQL when `DATABASE_URL` is set:

```bash
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/myapp"
```

Use PGlite for a local embedded database by omitting `DATABASE_URL`. Optionally
override the local data directory:

```bash
PGLITE_DATA_DIR="./data/pglite"
```

## Notes

- The app schema is defined once with `drizzle-orm/pg-core`.
- Local PGlite storage uses the same Postgres-oriented schema and query path as
  the networked PostgreSQL adapter.
- The todo table is created automatically on startup for now; migration tooling
  can be added later once the schema grows beyond this baseline.
