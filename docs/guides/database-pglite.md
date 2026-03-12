# PGlite with Drizzle and Effect

Minimal guide for a local embedded Postgres setup using:

- `drizzle-orm/pglite` for queries
- `@electric-sql/pglite` for a single-file local database
- `effect` for dependency injection

Use this for local development and deterministic repository tests when you want
Postgres semantics without running a separate server.

## Install

```bash
bun add drizzle-orm @electric-sql/pglite effect
```

## Why PGlite

- same Postgres-oriented Drizzle schema as remote PostgreSQL
- file-backed local persistence
- good fit for seeded invariant tests in node mode

## Minimal Schema

Use `pg-core`, not SQLite schema types:

```ts
import { boolean, pgTable, text, timestamp } from "drizzle-orm/pg-core"

export const todosTable = pgTable("todos", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  completed: boolean("completed").notNull().default(false),
  createdAt: timestamp("created_at", {
    mode: "date",
    withTimezone: true,
  }).notNull(),
})
```

## Minimal Effect Layer

```ts
import { PGlite } from "@electric-sql/pglite"
import { drizzle } from "drizzle-orm/pglite"
import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"

export class Db extends Context.Tag("Db")<Db, ReturnType<typeof makeDb>>() {}

const makeDb = async () => {
  const client = new PGlite("./data/pglite")
  return drizzle({ client })
}

export const DbLive = Layer.scoped(
  Db,
  Effect.acquireRelease(
    Effect.promise(makeDb),
    (db) => Effect.promise(() => db.$client.close()),
  ),
)
```

## Testing Pattern

Prefer seeded PGlite instances for repository and service tests:

- one isolated DB per test or suite
- explicit named seeds
- node-mode tests, not browser-mode tests

This proves invariants against persisted state instead of mocks.

## Practical Rules

- keep the schema in Drizzle `pg-core`
- inject the DB through an Effect service
- do not introduce a separate SQLite path
- use PGlite for local and test, PostgreSQL for shared environments

## Related

- [PostgreSQL Guide](./database-postgresql.md)
- [Testing Guide](./testing.md)
