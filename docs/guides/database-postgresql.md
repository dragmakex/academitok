# PostgreSQL with Drizzle and Effect

Minimal guide for a networked PostgreSQL setup using:

- `drizzle-orm` for schema and queries
- `postgres` for the runtime client
- `effect` for dependency injection

## Use This When

- you want PostgreSQL in shared, staging, or production environments
- you want one injected database service instead of ad hoc clients
- you want Drizzle schema to remain the SQL source of truth

## Install

```bash
bun add drizzle-orm postgres effect
bun add -d drizzle-kit
```

## Source Of Truth

Keep the layers separate:

- Drizzle schema defines tables, columns, indexes, and migrations
- Effect provides the service boundary and lifecycle
- domain validation can live elsewhere and map to the DB shape explicitly

## Minimal Schema

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
import { drizzle } from "drizzle-orm/postgres-js"
import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import postgres from "postgres"

export class Db extends Context.Tag("Db")<Db, ReturnType<typeof makeDb>>() {}

const makeDb = () => {
  const client = postgres(process.env.DATABASE_URL!, { prepare: false })
  return drizzle(client)
}

export const DbLive = Layer.scoped(
  Db,
  Effect.acquireRelease(
    Effect.sync(makeDb),
    (db) => Effect.promise(() => db.$client.end()),
  ),
)
```

## Migrations

Use Drizzle Kit from the Drizzle schema, not from Effect types:

```ts
import type { Config } from "drizzle-kit"

export default {
  schema: "./src/db/schema.ts",
  out: "./src/db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
} satisfies Config
```

## Practical Rules

- inject the DB through an Effect service
- keep SQL structure in Drizzle `pg-core`
- keep migrations generated from Drizzle schema
- keep tests above this boundary, or run repository tests against a real DB

## Related

- [PGlite Guide](./database-pglite.md)
- [Testing Guide](./testing.md)
