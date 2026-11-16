import {
  defaultReaderState,
  ReaderState,
  type SaveProfileInput,
} from "@/api/paper-schema"
import { readerStateTable } from "@/db/schema"
import { PGlite } from "@electric-sql/pglite"
import { eq } from "drizzle-orm"
import { drizzle as drizzlePglite } from "drizzle-orm/pglite"
import { drizzle as drizzlePostgres } from "drizzle-orm/postgres-js"
import * as Config from "effect/Config"
import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Option from "effect/Option"
import * as Schema from "effect/Schema"
import { Buffer } from "node:buffer"
import { mkdir } from "node:fs/promises"
import postgres from "postgres"

type RepositoryDatabaseConfig =
  | {
    readonly kind: "pglite"
    readonly dataDir: string | undefined
  }
  | {
    readonly kind: "postgres"
    readonly databaseUrl: string
  }

type ReaderStateRepositoryShape = {
  readonly load: Effect.Effect<typeof ReaderState.Type>
  readonly save: (
    state: typeof ReaderState.Type,
  ) => Effect.Effect<typeof ReaderState.Type>
}

const decodeReaderState = Schema.decodeUnknownSync(ReaderState)

const createReaderStateTableSql = `
  CREATE TABLE IF NOT EXISTS reader_state (
    id text PRIMARY KEY,
    state_json text NOT NULL,
    updated_at timestamptz NOT NULL
  )
`

const singletonId = "singleton"

const liveDatabaseConfig = Effect.gen(function*() {
  const databaseUrl = yield* Config.option(Config.string("DATABASE_URL"))
  const pgliteDataDir = yield* Config.string("PGLITE_READER_STATE_DIR").pipe(
    Config.orElse(() => Config.succeed("./data/pglite-reader-state")),
  )

  return Option.match(databaseUrl, {
    onNone: () =>
      ({
        kind: "pglite",
        dataDir: pgliteDataDir,
      }) satisfies RepositoryDatabaseConfig,
    onSome: (url) =>
      ({
        kind: "postgres",
        databaseUrl: url,
      }) satisfies RepositoryDatabaseConfig,
  })
})

/**
 * Decodes persisted state and falls back when old data is invalid.
 * @param stateJson - Stored JSON payload.
 * @returns Valid reader state.
 */
function parseState(stateJson: string | undefined) {
  if (stateJson === undefined) {
    return defaultReaderState
  }

  try {
    return decodeReaderState(JSON.parse(stateJson))
  } catch {
    return defaultReaderState
  }
}

/**
 * Normalizes profile values before persistence.
 * @param input - Profile values.
 * @returns Normalized profile.
 */
function normalizeProfileInput(input: SaveProfileInput) {
  return {
    name: input.name.trim(),
    institution: input.institution,
    interests: [...new Set(input.interests)],
  } as const
}

/**
 * Selects the configured database adapter.
 * @param config - Database configuration.
 * @returns Repository construction effect.
 */
function makeRepository(config: RepositoryDatabaseConfig) {
  return config.kind === "postgres"
    ? makePostgresRepository(config.databaseUrl)
    : makePgliteRepository(config.dataDir)
}

/**
 * Ensures the Postgres reader-state table matches the expected shape.
 * @param client - Postgres client.
 * @param client.unsafe - Raw SQL executor.
 */
async function ensurePostgresReaderStateTable(client: {
  unsafe: (query: string) => Promise<unknown>
}) {
  await client.unsafe(createReaderStateTableSql)

  try {
    await client.unsafe("SELECT 1 FROM reader_state LIMIT 1")
  } catch {
    await client.unsafe("DROP TABLE IF EXISTS reader_state")
    await client.unsafe(createReaderStateTableSql)
  }
}

/**
 * Ensures the local PGlite reader-state table matches the expected shape.
 * @param client - PGlite client.
 * @param client.exec - SQL executor.
 * @param client.query - SQL query executor.
 */
async function ensurePgliteReaderStateTable(client: {
  exec: (query: string) => Promise<unknown>
  query: (query: string) => Promise<unknown>
}) {
  await client.exec(createReaderStateTableSql)

  try {
    await client.query("SELECT 1 FROM reader_state LIMIT 1")
  } catch {
    await client.exec("DROP TABLE IF EXISTS reader_state")
    await client.exec(createReaderStateTableSql)
  }
}

/**
 * Builds the Postgres-backed repository service.
 * @param databaseUrl - Postgres connection URL.
 * @returns Repository construction effect.
 */
function makePostgresRepository(databaseUrl: string) {
  return Effect
    .gen(function*() {
      const client = postgres(databaseUrl, { prepare: false })
      yield* Effect.promise(() => ensurePostgresReaderStateTable(client))
      const db = drizzlePostgres(client, {
        schema: { readerStateTable },
      })

      yield* Effect.addFinalizer(() => Effect.promise(() => client.end()))

      return ReaderStateRepository.of(
        {
          load: Effect.promise(async () => {
            const row = await db
              .select()
              .from(readerStateTable)
              .where(eq(readerStateTable.id, singletonId))
              .limit(1)
              .then(([item]) => item)

            return parseState(row?.stateJson)
          }),
          save: (state) =>
            Effect.promise(async () => {
              const payload = JSON.stringify({
                ...state,
                profile: state.profile === null
                  ? null
                  : normalizeProfileInput(state.profile),
              })

              await db
                .insert(readerStateTable)
                .values({
                  id: singletonId,
                  stateJson: payload,
                  updatedAt: new Date(),
                })
                .onConflictDoUpdate({
                  target: readerStateTable.id,
                  set: {
                    stateJson: payload,
                    updatedAt: new Date(),
                  },
                })

              return parseState(payload)
            }),
        } satisfies ReaderStateRepositoryShape,
      )
    })
    .pipe(Effect.orDie)
}

/**
 * Builds the local PGlite-backed repository service.
 * @param dataDir - Optional persistence directory.
 * @returns Repository construction effect.
 */
function makePgliteRepository(dataDir: string | undefined) {
  return Effect
    .gen(function*() {
      if (dataDir !== undefined) {
        yield* Effect.promise(() => mkdir(dataDir, { recursive: true }))
      }

      if (globalThis.Buffer === undefined) {
        globalThis.Buffer = Buffer
      }

      const client = yield* Effect.sync(() =>
        dataDir === undefined ? new PGlite() : new PGlite(dataDir)
      )
      yield* Effect.promise(() => ensurePgliteReaderStateTable(client))
      const db = drizzlePglite({
        client,
        schema: { readerStateTable },
      })

      yield* Effect.addFinalizer(() => Effect.promise(() => client.close()))

      return ReaderStateRepository.of(
        {
          load: Effect.promise(async () => {
            const row = await db
              .select()
              .from(readerStateTable)
              .where(eq(readerStateTable.id, singletonId))
              .limit(1)
              .then(([item]) => item)

            return parseState(row?.stateJson)
          }),
          save: (state) =>
            Effect.promise(async () => {
              const payload = JSON.stringify({
                ...state,
                profile: state.profile === null
                  ? null
                  : normalizeProfileInput(state.profile),
              })

              await db
                .insert(readerStateTable)
                .values({
                  id: singletonId,
                  stateJson: payload,
                  updatedAt: new Date(),
                })
                .onConflictDoUpdate({
                  target: readerStateTable.id,
                  set: {
                    stateJson: payload,
                    updatedAt: new Date(),
                  },
                })

              return parseState(payload)
            }),
        } satisfies ReaderStateRepositoryShape,
      )
    })
    .pipe(Effect.orDie)
}

export class ReaderStateRepository extends Context.Service<
  ReaderStateRepository,
  ReaderStateRepositoryShape
>()("ReaderStateRepository") {
  static readonly layer = Layer.effect(
    this,
    Effect.flatMap(liveDatabaseConfig, makeRepository),
  )
}
