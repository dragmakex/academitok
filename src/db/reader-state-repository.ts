import {
  defaultReaderState,
  type OnboardProfileInput,
  type ReactToPaperInput,
  type ReaderProfile,
  ReaderState,
  type SaveProfileInput,
  type TrackPaperViewInput,
} from "@/api/paper-schema"
import {
  impressionsTable,
  reactionsTable,
  readerProfilesTable,
  readerStateTable,
} from "@/db/schema"
import { PGlite } from "@electric-sql/pglite"
import { and, desc, eq, inArray, isNull } from "drizzle-orm"
import { drizzle as drizzlePglite } from "drizzle-orm/pglite"
import { drizzle as drizzlePostgres } from "drizzle-orm/postgres-js"
import * as Config from "effect/Config"
import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Option from "effect/Option"
import * as Schema from "effect/Schema"
import { Buffer } from "node:buffer"
import { randomUUID } from "node:crypto"
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
  readonly saveProfile: (profile: SaveProfileInput) => Effect.Effect<void>
  readonly onboard: (input: OnboardProfileInput) => Effect.Effect<void>
  readonly react: (input: ReactToPaperInput) => Effect.Effect<boolean>
  readonly track: (input: TrackPaperViewInput) => Effect.Effect<void>
}

type StoredState = {
  readonly sourceJson: string | undefined
  readonly profile: typeof readerProfilesTable.$inferSelect | undefined
  readonly reactions: ReadonlyArray<typeof reactionsTable.$inferSelect>
  readonly impressions: ReadonlyArray<typeof impressionsTable.$inferSelect>
}

type StateStorage = {
  readonly load: () => Promise<StoredState>
  readonly migrate: (state: typeof ReaderState.Type) => Promise<void>
  readonly saveProfile: (profile: ReaderProfile) => Promise<void>
  readonly onboard: (
    input: OnboardProfileInput,
    createdAt: Date,
  ) => Promise<void>
  readonly react: (
    input: ReactToPaperInput,
    createdAt: Date,
  ) => Promise<boolean>
  readonly track: (
    input: TrackPaperViewInput,
    shownAt: Date,
  ) => Promise<void>
}

const decodeReaderState = Schema.decodeUnknownSync(ReaderState)
const singletonId = "singleton"

const createReaderStateTablesSql = `
  CREATE TABLE IF NOT EXISTS reader_state (
    id text PRIMARY KEY,
    state_json text NOT NULL,
    updated_at timestamptz NOT NULL
  );
  CREATE TABLE IF NOT EXISTS papers (
    id text PRIMARY KEY,
    title text NOT NULL,
    abstract text NOT NULL,
    year integer NOT NULL,
    venue text NOT NULL,
    authors jsonb NOT NULL,
    topics jsonb NOT NULL,
    citations integer NOT NULL,
    site text NOT NULL,
    external_url text,
    is_open_access boolean NOT NULL,
    fetched_at timestamptz NOT NULL
  );
  CREATE TABLE IF NOT EXISTS impressions (
    id text PRIMARY KEY,
    reader_id text NOT NULL,
    paper_id text NOT NULL,
    shown_at timestamptz NOT NULL,
    dwell_ms integer,
    position integer NOT NULL,
    exploration boolean NOT NULL DEFAULT false
  );
  CREATE TABLE IF NOT EXISTS reactions (
    id text PRIMARY KEY,
    reader_id text NOT NULL,
    paper_id text NOT NULL,
    kind text NOT NULL,
    active boolean NOT NULL,
    created_at timestamptz NOT NULL
  );
  CREATE TABLE IF NOT EXISTS reader_profiles (
    id text PRIMARY KEY,
    name text NOT NULL,
    institution text NOT NULL,
    beats jsonb NOT NULL,
    onboarded_at timestamptz NOT NULL
  );
  CREATE TABLE IF NOT EXISTS feed_sessions (
    id text PRIMARY KEY,
    reader_id text NOT NULL,
    cursor text NOT NULL,
    started_at timestamptz NOT NULL
  )
`

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
 * Decodes the legacy JSON migration source.
 * @param stateJson - Stored JSON, when the migration source exists.
 * @returns Valid reader state or the default for invalid legacy data.
 */
function parseSourceState(stateJson: string | undefined) {
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
 * Normalizes user-entered profile values for storage.
 * @param input - Profile submitted through the API.
 * @returns Trimmed, deduplicated profile data.
 */
function normalizeProfileInput(input: SaveProfileInput): ReaderProfile {
  return {
    name: input.name.trim(),
    institution: input.institution,
    interests: [...new Set(input.interests)],
  }
}

/**
 * Converts legacy state events into normalized inserts.
 * @param state - Decoded legacy reader state.
 * @returns Reaction and impression rows for migration.
 */
function stateRows(state: typeof ReaderState.Type) {
  const reactions: Array<typeof reactionsTable.$inferInsert> = []
  const impressions: Array<typeof impressionsTable.$inferInsert> = []

  for (const reaction of [...state.reactions].reverse()) {
    if (reaction.kind === "view") {
      impressions.push({
        id: randomUUID(),
        readerId: singletonId,
        paperId: reaction.paperId,
        shownAt: new Date(reaction.timestamp),
        dwellMs: null,
        position: 0,
        exploration: false,
      })
      continue
    }

    if (reaction.kind === "dwell") {
      let impression: typeof impressions[number] | undefined
      for (let index = impressions.length - 1; index >= 0; index -= 1) {
        const candidate = impressions[index]
        if (
          candidate?.paperId === reaction.paperId
          && candidate.dwellMs === null
        ) {
          impression = candidate
          break
        }
      }
      if (impression !== undefined) {
        impression.dwellMs = reaction.dwellMs ?? 0
      } else {
        impressions.push({
          id: randomUUID(),
          readerId: singletonId,
          paperId: reaction.paperId,
          shownAt: new Date(reaction.timestamp),
          dwellMs: reaction.dwellMs ?? 0,
          position: 0,
          exploration: false,
        })
      }
      continue
    }

    reactions.push({
      id: randomUUID(),
      readerId: singletonId,
      paperId: reaction.paperId,
      kind: reaction.kind,
      active: reaction.active,
      createdAt: new Date(reaction.timestamp),
    })
  }

  return { impressions, reactions }
}

/**
 * Reconstructs the ranker's reader state from normalized rows.
 * @param stored - Profile, reaction, and impression rows.
 * @returns Decoded reader state for ranking.
 */
function storedStateToReaderState(stored: StoredState) {
  const profile = stored.profile === undefined
    ? null
    : {
      name: stored.profile.name,
      institution: stored.profile.institution,
      interests: stored.profile.beats,
    }
  const reactions = stored.reactions.map((reaction) => ({
    paperId: reaction.paperId,
    kind: reaction.kind,
    active: reaction.active,
    timestamp: reaction.createdAt.getTime(),
  }))
  const impressions = stored.impressions.flatMap((impression) => [
    ...(impression.dwellMs === null
      ? []
      : [{
        paperId: impression.paperId,
        kind: "dwell",
        active: true,
        timestamp: impression.shownAt.getTime(),
        dwellMs: impression.dwellMs,
      }]),
    {
      paperId: impression.paperId,
      kind: "view",
      active: true,
      timestamp: impression.shownAt.getTime(),
    },
  ])

  return decodeReaderState({
    profile,
    reactions: [...reactions, ...impressions].sort((left, right) =>
      right.timestamp - left.timestamp
    ),
  })
}

/**
 * Converts onboarding picks into persisted affinity signals.
 * @param input - Validated onboarding decision.
 * @param createdAt - Shared signal timestamp.
 * @returns Reaction rows for kept and rejected papers.
 */
function onboardingRows(input: OnboardProfileInput, createdAt: Date) {
  if (input.skipped) {
    return []
  }
  return [
    ...input.keptPaperIds.map((paperId) => ({
      id: randomUUID(),
      readerId: singletonId,
      paperId,
      kind: "onboard-keep",
      active: true,
      createdAt,
    })),
    ...input.rejectedPaperIds.map((paperId) => ({
      id: randomUUID(),
      readerId: singletonId,
      paperId,
      kind: "onboard-reject",
      active: true,
      createdAt,
    })),
  ]
}

/**
 * Builds the repository service over adapter-specific storage.
 * @param storage - Database adapter operations.
 * @returns Reader-state repository service.
 */
function makeRepositoryService(storage: StateStorage) {
  let ready: Promise<void> | undefined

  const ensureMigrated = () => {
    ready ??= (async () => {
      const stored = await storage.load()
      const hasNormalizedState = stored.profile !== undefined
        || stored.reactions.length > 0
        || stored.impressions.length > 0

      if (stored.sourceJson !== undefined) {
        await storage.migrate(parseSourceState(stored.sourceJson))
      } else if (!hasNormalizedState) {
        await storage.migrate(defaultReaderState)
      }
    })()
    return ready
  }

  return ReaderStateRepository.of(
    {
      load: Effect.promise(async () => {
        await ensureMigrated()
        return storedStateToReaderState(await storage.load())
      }),
      saveProfile: (input) =>
        Effect.promise(async () => {
          await ensureMigrated()
          await storage.saveProfile(normalizeProfileInput(input))
        }),
      onboard: (input) =>
        Effect.promise(async () => {
          await ensureMigrated()
          await storage.onboard(input, new Date())
        }),
      react: (input) =>
        Effect.promise(async () => {
          await ensureMigrated()
          return storage.react(input, new Date())
        }),
      track: (input) =>
        Effect.promise(async () => {
          await ensureMigrated()
          await storage.track(input, new Date())
        }),
    } satisfies ReaderStateRepositoryShape,
  )
}

/**
 * Selects the configured database adapter.
 * @param config - Resolved database configuration.
 * @returns Repository construction effect.
 */
function makeRepository(config: RepositoryDatabaseConfig) {
  return config.kind === "postgres"
    ? makePostgresRepository(config.databaseUrl)
    : makePgliteRepository(config.dataDir)
}

/**
 * Builds the PostgreSQL reader-state repository.
 * @param databaseUrl - PostgreSQL connection URL.
 * @returns Scoped repository construction effect.
 */
function makePostgresRepository(databaseUrl: string) {
  return Effect
    .gen(function*() {
      const client = postgres(databaseUrl, { prepare: false })
      yield* Effect.promise(() => client.unsafe(createReaderStateTablesSql))
      const db = drizzlePostgres(client, {
        schema: {
          impressionsTable,
          reactionsTable,
          readerProfilesTable,
          readerStateTable,
        },
      })
      yield* Effect.addFinalizer(() => Effect.promise(() => client.end()))

      const postgresStorage: StateStorage = {
        onboard: async (input, createdAt) => {
          await db.transaction(async (tx) => {
            await tx
              .insert(readerProfilesTable)
              .values({
                id: singletonId,
                name: "Guest Reader",
                institution: "Guest",
                beats: [],
                onboardedAt: createdAt,
              })
              .onConflictDoUpdate({
                target: readerProfilesTable.id,
                set: { onboardedAt: createdAt },
              })
            await tx.delete(reactionsTable).where(and(
              eq(reactionsTable.readerId, singletonId),
              inArray(reactionsTable.kind, [
                "onboard-keep",
                "onboard-reject",
              ]),
            ))
            const rows = onboardingRows(input, createdAt)
            if (rows.length > 0) {
              await tx.insert(reactionsTable).values(rows)
            }
          })
        },
        load: async () => {
          const source = await db
            .select()
            .from(readerStateTable)
            .where(eq(readerStateTable.id, singletonId))
            .limit(1)
            .then(([row]) => row)
          const profile = await db
            .select()
            .from(readerProfilesTable)
            .where(eq(readerProfilesTable.id, singletonId))
            .limit(1)
            .then(([row]) => row)
          const reactions = await db
            .select()
            .from(reactionsTable)
            .where(eq(reactionsTable.readerId, singletonId))
            .orderBy(desc(reactionsTable.createdAt))
          const impressions = await db
            .select()
            .from(impressionsTable)
            .where(eq(impressionsTable.readerId, singletonId))
            .orderBy(desc(impressionsTable.shownAt))
          return {
            sourceJson: source?.stateJson,
            profile,
            reactions,
            impressions,
          }
        },
        migrate: async (state) => {
          const rows = stateRows(state)
          await db.transaction(async (tx) => {
            await tx.delete(reactionsTable).where(
              eq(reactionsTable.readerId, singletonId),
            )
            await tx.delete(impressionsTable).where(
              eq(impressionsTable.readerId, singletonId),
            )
            await tx.delete(readerProfilesTable).where(
              eq(readerProfilesTable.id, singletonId),
            )
            if (state.profile !== null) {
              await tx.insert(readerProfilesTable).values({
                id: singletonId,
                name: state.profile.name,
                institution: state.profile.institution,
                beats: state.profile.interests,
                onboardedAt: new Date(),
              })
            }
            if (rows.reactions.length > 0) {
              await tx.insert(reactionsTable).values(rows.reactions)
            }
            if (rows.impressions.length > 0) {
              await tx.insert(impressionsTable).values(rows.impressions)
            }
            await tx.delete(readerStateTable).where(
              eq(readerStateTable.id, singletonId),
            )
          })
        },
        saveProfile: async (profile) => {
          await db
            .insert(readerProfilesTable)
            .values({
              id: singletonId,
              name: profile.name,
              institution: profile.institution,
              beats: profile.interests,
              onboardedAt: new Date(),
            })
            .onConflictDoUpdate({
              target: readerProfilesTable.id,
              set: {
                name: profile.name,
                institution: profile.institution,
                beats: profile.interests,
              },
            })
        },
        react: async (input, createdAt) => {
          const current = input.kind === "open-site"
            ? undefined
            : await db
              .select()
              .from(reactionsTable)
              .where(and(
                eq(reactionsTable.readerId, singletonId),
                eq(reactionsTable.paperId, input.paperId),
                eq(reactionsTable.kind, input.kind),
              ))
              .orderBy(desc(reactionsTable.createdAt))
              .limit(1)
              .then(([row]) => row)
          const active = input.kind === "open-site" || current?.active !== true
          await db.insert(reactionsTable).values({
            id: randomUUID(),
            readerId: singletonId,
            paperId: input.paperId,
            kind: input.kind,
            active,
            createdAt,
          })
          return active
        },
        track: async (input, shownAt) => {
          if (input.kind === "view") {
            await db.insert(impressionsTable).values({
              id: randomUUID(),
              readerId: singletonId,
              paperId: input.paperId,
              shownAt,
              dwellMs: null,
              position: input.position,
              exploration: input.exploration,
            })
            return
          }
          const impression = await db
            .select()
            .from(impressionsTable)
            .where(and(
              eq(impressionsTable.readerId, singletonId),
              eq(impressionsTable.paperId, input.paperId),
              isNull(impressionsTable.dwellMs),
            ))
            .orderBy(desc(impressionsTable.shownAt))
            .limit(1)
            .then(([row]) => row)
          if (impression === undefined) {
            await db.insert(impressionsTable).values({
              id: randomUUID(),
              readerId: singletonId,
              paperId: input.paperId,
              shownAt,
              dwellMs: input.dwellMs,
              position: input.position,
              exploration: input.exploration,
            })
          } else {
            await db
              .update(impressionsTable)
              .set({ dwellMs: input.dwellMs })
              .where(eq(impressionsTable.id, impression.id))
          }
        },
      }

      return makeRepositoryService(postgresStorage)
    })
    .pipe(Effect.orDie)
}

/**
 * Builds the local PGlite reader-state repository.
 * @param dataDir - Persistent directory, or undefined for memory storage.
 * @returns Scoped repository construction effect.
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
      yield* Effect.promise(() => client.exec(createReaderStateTablesSql))
      const db = drizzlePglite({
        client,
        schema: {
          impressionsTable,
          reactionsTable,
          readerProfilesTable,
          readerStateTable,
        },
      })
      yield* Effect.addFinalizer(() => Effect.promise(() => client.close()))

      const storage: StateStorage = {
        onboard: async (input, createdAt) => {
          await db.transaction(async (tx) => {
            await tx
              .insert(readerProfilesTable)
              .values({
                id: singletonId,
                name: "Guest Reader",
                institution: "Guest",
                beats: [],
                onboardedAt: createdAt,
              })
              .onConflictDoUpdate({
                target: readerProfilesTable.id,
                set: { onboardedAt: createdAt },
              })
            await tx.delete(reactionsTable).where(and(
              eq(reactionsTable.readerId, singletonId),
              inArray(reactionsTable.kind, [
                "onboard-keep",
                "onboard-reject",
              ]),
            ))
            const rows = onboardingRows(input, createdAt)
            if (rows.length > 0) {
              await tx.insert(reactionsTable).values(rows)
            }
          })
        },
        load: async () => {
          const source = await db
            .select()
            .from(readerStateTable)
            .where(eq(readerStateTable.id, singletonId))
            .limit(1)
            .then(([row]) => row)
          const profile = await db
            .select()
            .from(readerProfilesTable)
            .where(eq(readerProfilesTable.id, singletonId))
            .limit(1)
            .then(([row]) => row)
          const reactions = await db
            .select()
            .from(reactionsTable)
            .where(eq(reactionsTable.readerId, singletonId))
            .orderBy(desc(reactionsTable.createdAt))
          const impressions = await db
            .select()
            .from(impressionsTable)
            .where(eq(impressionsTable.readerId, singletonId))
            .orderBy(desc(impressionsTable.shownAt))
          return {
            sourceJson: source?.stateJson,
            profile,
            reactions,
            impressions,
          }
        },
        migrate: async (state) => {
          const rows = stateRows(state)
          await db.transaction(async (tx) => {
            await tx.delete(reactionsTable).where(
              eq(reactionsTable.readerId, singletonId),
            )
            await tx.delete(impressionsTable).where(
              eq(impressionsTable.readerId, singletonId),
            )
            await tx.delete(readerProfilesTable).where(
              eq(readerProfilesTable.id, singletonId),
            )
            if (state.profile !== null) {
              await tx.insert(readerProfilesTable).values({
                id: singletonId,
                name: state.profile.name,
                institution: state.profile.institution,
                beats: state.profile.interests,
                onboardedAt: new Date(),
              })
            }
            if (rows.reactions.length > 0) {
              await tx.insert(reactionsTable).values(rows.reactions)
            }
            if (rows.impressions.length > 0) {
              await tx.insert(impressionsTable).values(rows.impressions)
            }
            await tx.delete(readerStateTable).where(
              eq(readerStateTable.id, singletonId),
            )
          })
        },
        saveProfile: async (profile) => {
          await db
            .insert(readerProfilesTable)
            .values({
              id: singletonId,
              name: profile.name,
              institution: profile.institution,
              beats: profile.interests,
              onboardedAt: new Date(),
            })
            .onConflictDoUpdate({
              target: readerProfilesTable.id,
              set: {
                name: profile.name,
                institution: profile.institution,
                beats: profile.interests,
              },
            })
        },
        react: async (input, createdAt) => {
          const current = input.kind === "open-site"
            ? undefined
            : await db
              .select()
              .from(reactionsTable)
              .where(and(
                eq(reactionsTable.readerId, singletonId),
                eq(reactionsTable.paperId, input.paperId),
                eq(reactionsTable.kind, input.kind),
              ))
              .orderBy(desc(reactionsTable.createdAt))
              .limit(1)
              .then(([row]) => row)
          const active = input.kind === "open-site" || current?.active !== true
          await db.insert(reactionsTable).values({
            id: randomUUID(),
            readerId: singletonId,
            paperId: input.paperId,
            kind: input.kind,
            active,
            createdAt,
          })
          return active
        },
        track: async (input, shownAt) => {
          if (input.kind === "view") {
            await db.insert(impressionsTable).values({
              id: randomUUID(),
              readerId: singletonId,
              paperId: input.paperId,
              shownAt,
              dwellMs: null,
              position: input.position,
              exploration: input.exploration,
            })
            return
          }
          const impression = await db
            .select()
            .from(impressionsTable)
            .where(and(
              eq(impressionsTable.readerId, singletonId),
              eq(impressionsTable.paperId, input.paperId),
              isNull(impressionsTable.dwellMs),
            ))
            .orderBy(desc(impressionsTable.shownAt))
            .limit(1)
            .then(([row]) => row)
          if (impression === undefined) {
            await db.insert(impressionsTable).values({
              id: randomUUID(),
              readerId: singletonId,
              paperId: input.paperId,
              shownAt,
              dwellMs: input.dwellMs,
              position: input.position,
              exploration: input.exploration,
            })
          } else {
            await db
              .update(impressionsTable)
              .set({ dwellMs: input.dwellMs })
              .where(eq(impressionsTable.id, impression.id))
          }
        },
      }

      return makeRepositoryService(storage)
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
