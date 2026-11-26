import {
  defaultReaderState,
  type OnboardProfileInput,
  type Paper,
  type ReactToPaperInput,
  type ReaderProfile,
  ReaderState,
  type SaveProfileInput,
  type TrackPaperViewInput,
} from "@/api/paper-schema"
import {
  feedSessionsTable,
  impressionsTable,
  papersTable,
  reactionsTable,
  readerProfilesTable,
  readerStateTable,
} from "@/db/schema"
import { ReaderId } from "@/lib/reader-id"
import { PGlite } from "@electric-sql/pglite"
import { and, asc, desc, eq, gte, inArray, isNull, lt, ne } from "drizzle-orm"
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
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises"
import { join, resolve } from "node:path"
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
  readonly load: Effect.Effect<typeof ReaderState.Type, never, ReaderId>
  readonly saveProfile: (
    profile: SaveProfileInput,
  ) => Effect.Effect<void, never, ReaderId>
  readonly onboard: (
    input: OnboardProfileInput,
  ) => Effect.Effect<void, never, ReaderId>
  readonly react: (
    input: ReactToPaperInput,
  ) => Effect.Effect<boolean, never, ReaderId>
  readonly track: (
    input: TrackPaperViewInput,
  ) => Effect.Effect<void, never, ReaderId>
  readonly loadFeedSession: (
    sessionId: string,
  ) => Effect.Effect<ReadonlyArray<string>, never, ReaderId>
  readonly saveFeedSession: (
    sessionId: string,
    seenPaperIds: ReadonlyArray<string>,
    cursor: string | null,
  ) => Effect.Effect<void, never, ReaderId>
  readonly savePapers: (papers: ReadonlyArray<Paper>) => Effect.Effect<void>
  readonly papersByIds: (
    ids: ReadonlyArray<string>,
  ) => Effect.Effect<ReadonlyArray<Paper>>
  readonly recentPapers: (
    now: Date,
  ) => Effect.Effect<ReadonlyArray<Paper>>
  readonly savedByReaders: (paperId: string) => Effect.Effect<number>
  readonly openedByReaders: (paperId: string) => Effect.Effect<number>
  readonly likedByReaders: (paperId: string) => Effect.Effect<number>
  readonly hiddenByReaders: (paperId: string) => Effect.Effect<number>
  readonly filedByOthers: (
    paperIds: ReadonlyArray<string>,
    readerId: string,
  ) => Effect.Effect<Record<string, number>>
  readonly likedByOthers: (
    paperIds: ReadonlyArray<string>,
    readerId: string,
  ) => Effect.Effect<Record<string, number>>
  readonly ping: Effect.Effect<void>
}

type StoredState = {
  readonly sourceJson: string | undefined
  readonly profile: typeof readerProfilesTable.$inferSelect | undefined
  readonly reactions: ReadonlyArray<typeof reactionsTable.$inferSelect>
  readonly impressions: ReadonlyArray<typeof impressionsTable.$inferSelect>
}

type StateStorage = {
  readonly load: (readerId: string) => Promise<StoredState>
  readonly migrate: (
    state: typeof ReaderState.Type,
    readerId: string,
  ) => Promise<void>
  readonly saveProfile: (
    profile: ReaderProfile,
    readerId: string,
  ) => Promise<void>
  readonly onboard: (
    input: OnboardProfileInput,
    createdAt: Date,
    readerId: string,
  ) => Promise<void>
  readonly react: (
    input: ReactToPaperInput,
    createdAt: Date,
    readerId: string,
  ) => Promise<boolean>
  readonly track: (
    input: TrackPaperViewInput,
    shownAt: Date,
    readerId: string,
  ) => Promise<void>
  readonly loadFeedSession: (
    sessionId: string,
    now: Date,
    readerId: string,
  ) => Promise<ReadonlyArray<string>>
  readonly saveFeedSession: (
    sessionId: string,
    seenPaperIds: ReadonlyArray<string>,
    cursor: string | null,
    now: Date,
    readerId: string,
  ) => Promise<void>
  readonly savePapers: (
    papers: ReadonlyArray<Paper>,
    fetchedAt: Date,
  ) => Promise<void>
  readonly papersByIds: (
    ids: ReadonlyArray<string>,
  ) => Promise<ReadonlyArray<Paper>>
  readonly recentPapers: (since: Date) => Promise<ReadonlyArray<Paper>>
  readonly savedByReaders: (paperId: string) => Promise<number>
  readonly openedByReaders: (paperId: string) => Promise<number>
  readonly likedByReaders: (paperId: string) => Promise<number>
  readonly hiddenByReaders: (paperId: string) => Promise<number>
  readonly filedByOthers: (
    paperIds: ReadonlyArray<string>,
    readerId: string,
  ) => Promise<Record<string, number>>
  readonly likedByOthers: (
    paperIds: ReadonlyArray<string>,
    readerId: string,
  ) => Promise<Record<string, number>>
  readonly ping: () => Promise<void>
}

const decodeReaderState = Schema.decodeUnknownSync(ReaderState)
const defaultReaderId = "singleton"
/** Sessions idle for longer than this are swept on the next feed request. */
const feedSessionTtlMs = 24 * 60 * 60 * 1000
/** Impressions are retained this long (SPEC §6); reactions are kept forever. */
const impressionTtlMs = 90 * 24 * 60 * 60 * 1000
/** Pool rows older than this are refreshed from the source (SPEC §6). */
const poolTtlMs = 24 * 60 * 60 * 1000

/**
 * Retention boundary for impressions.
 * @param now - Current time.
 * @returns Earliest instant an impression is still worth keeping.
 */
export const impressionCutoff = (now: Date): Date =>
  new Date(now.getTime() - impressionTtlMs)

/**
 * Freshness boundary for the stored paper pool.
 * @param now - Current time.
 * @returns Earliest fetch instant a pooled paper is still fresh enough.
 */
export const poolCutoff = (now: Date): Date =>
  new Date(now.getTime() - poolTtlMs)

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
    summary text NOT NULL DEFAULT '',
    year integer NOT NULL,
    venue text NOT NULL,
    authors jsonb NOT NULL,
    topics jsonb NOT NULL,
    citations integer NOT NULL,
    read_minutes integer NOT NULL DEFAULT 0,
    site text NOT NULL,
    source text NOT NULL DEFAULT 'openalex',
    external_url text,
    is_open_access boolean NOT NULL,
    allowed_institutions jsonb,
    fetched_at timestamptz NOT NULL
  );
  ALTER TABLE papers ADD COLUMN IF NOT EXISTS summary text NOT NULL DEFAULT '';
  ALTER TABLE papers ADD COLUMN IF NOT EXISTS read_minutes integer NOT NULL DEFAULT 0;
  ALTER TABLE papers
    ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'openalex';
  ALTER TABLE papers ADD COLUMN IF NOT EXISTS allowed_institutions jsonb;
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
    seen_paper_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
    cursor text,
    updated_at timestamptz NOT NULL
  );
  ALTER TABLE feed_sessions
    ADD COLUMN IF NOT EXISTS seen_paper_ids jsonb NOT NULL DEFAULT '[]'::jsonb;
  ALTER TABLE feed_sessions
    ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
  -- The unused first shape required these; relax them so older databases accept new rows.
  ALTER TABLE feed_sessions ADD COLUMN IF NOT EXISTS cursor text;
  ALTER TABLE feed_sessions ALTER COLUMN cursor DROP NOT NULL;
  ALTER TABLE feed_sessions ADD COLUMN IF NOT EXISTS started_at timestamptz;
  ALTER TABLE feed_sessions ALTER COLUMN started_at DROP NOT NULL;
  CREATE INDEX IF NOT EXISTS feed_sessions_updated_at_idx
    ON feed_sessions (updated_at);
  CREATE INDEX IF NOT EXISTS impressions_reader_shown_idx
    ON impressions (reader_id, shown_at);
  CREATE INDEX IF NOT EXISTS impressions_shown_at_idx
    ON impressions (shown_at);
  CREATE INDEX IF NOT EXISTS reactions_reader_created_idx
    ON reactions (reader_id, created_at);
  CREATE INDEX IF NOT EXISTS reactions_paper_kind_created_idx
    ON reactions (paper_id, kind, created_at);
  CREATE INDEX IF NOT EXISTS papers_fetched_at_idx
    ON papers (fetched_at)
`

const liveDatabaseConfig = Effect.gen(function*() {
  const nodeEnv = yield* Config.String("NODE_ENV").pipe(
    Config.orElse(() => Config.succeed("development")),
  )
  const rawDatabaseUrl = yield* Config.option(Config.String("DATABASE_URL"))
  const databaseUrl = Option.filter(
    Option.map(rawDatabaseUrl, (url) => url.trim()),
    (url) => url !== "",
  )
  const pgliteDataDir = yield* Config.String("PGLITE_READER_STATE_DIR").pipe(
    Config.orElse(() => Config.succeed("./data/pglite-reader-state")),
  )

  if (Option.isNone(databaseUrl) && nodeEnv === "production") {
    return yield* Effect.die(
      new Error(
        "DATABASE_URL is required when NODE_ENV=production; PGlite fallback is disabled in production.",
      ),
    )
  }

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
 * @param readerId - Reader that owns the migrated rows.
 * @returns Reaction and impression rows for migration.
 */
function stateRows(
  state: typeof ReaderState.Type,
  readerId: string,
) {
  const reactions: Array<typeof reactionsTable.$inferInsert> = []
  const impressions: Array<typeof impressionsTable.$inferInsert> = []

  for (const reaction of [...state.reactions].reverse()) {
    if (reaction.kind === "view") {
      impressions.push({
        id: randomUUID(),
        readerId,
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
          readerId,
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
      readerId,
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
 * @param readerId - Reader that owns the signals.
 * @returns Reaction rows for kept and rejected papers.
 */
function onboardingRows(
  input: OnboardProfileInput,
  createdAt: Date,
  readerId: string,
) {
  if (input.skipped) {
    return []
  }
  return [
    ...input.keptPaperIds.map((paperId) => ({
      id: randomUUID(),
      readerId,
      paperId,
      kind: "onboard-keep",
      active: true,
      createdAt,
    })),
    ...input.rejectedPaperIds.map((paperId) => ({
      id: randomUUID(),
      readerId,
      paperId,
      kind: "onboard-reject",
      active: true,
      createdAt,
    })),
  ]
}

/**
 * Converts papers from the resolved catalog into pool rows.
 * @param papers - Resolved papers.
 * @param fetchedAt - Shared fetch timestamp.
 * @returns Rows for the local pool.
 */
function paperRows(papers: ReadonlyArray<Paper>, fetchedAt: Date) {
  return papers.map((paper) => ({
    id: paper.id,
    title: paper.title,
    abstract: paper.abstract,
    summary: paper.summary,
    year: paper.year,
    venue: paper.venue,
    authors: paper.authors,
    topics: paper.topics,
    citations: paper.citations,
    readMinutes: paper.readMinutes,
    site: paper.site,
    source: paper.source,
    externalUrl: paper.externalUrl ?? null,
    isOpenAccess: paper.access === "open",
    allowedInstitutions: paper.allowedInstitutions ?? null,
    fetchedAt,
  }))
}

/**
 * Rebuilds a paper from its pool row.
 * @param row - Stored pool row.
 * @returns Paper metadata.
 */
function storedPaper(row: typeof papersTable.$inferSelect): Paper {
  return {
    id: row.id,
    title: row.title,
    authors: row.authors,
    abstract: row.abstract,
    summary: row.summary,
    year: row.year,
    venue: row.venue,
    topics: row.topics,
    access: row.isOpenAccess ? "open" : "institution",
    allowedInstitutions: row.allowedInstitutions ?? undefined,
    citations: row.citations,
    readMinutes: row.readMinutes,
    site: row.site,
    source: row.source,
    externalUrl: row.externalUrl ?? undefined,
  }
}

/**
 * Counts readers whose newest filing of a paper is still active.
 * @param rows - Bookmark rows for one paper, newest first.
 * @returns Number of readers holding an active filing.
 */
// shortcut: newest wins by createdAt; a same-millisecond undo is ambiguous until a
// sequence column exists.
const activeFilers = (
  rows: ReadonlyArray<{
    readonly readerId: string
    readonly active: boolean
  }>,
): number => {
  const latest = new Map<string, boolean>()
  for (const row of rows) {
    if (!latest.has(row.readerId)) {
      latest.set(row.readerId, row.active)
    }
  }
  return [...latest.values()].filter((active) => active).length
}

/**
 * Counts live filings per paper for readers other than the current one.
 * @param rows - Bookmark rows by other readers, newest first.
 * @returns Paper id to filer count, omitting papers nobody else keeps.
 */
const otherFilers = (
  rows: ReadonlyArray<{
    readonly paperId: string
    readonly readerId: string
    readonly active: boolean
  }>,
): Record<string, number> => {
  const byPaper = new Map<
    string,
    Array<{ readonly readerId: string; readonly active: boolean }>
  >()
  for (const row of rows) {
    const filings = byPaper.get(row.paperId) ?? []
    filings.push({ readerId: row.readerId, active: row.active })
    byPaper.set(row.paperId, filings)
  }

  const counts: Record<string, number> = {}
  for (const [paperId, filings] of byPaper) {
    const active = activeFilers(filings)
    if (active > 0) {
      counts[paperId] = active
    }
  }
  return counts
}

/**
 * Builds the repository service over adapter-specific storage.
 * @param storage - Database adapter operations.
 * @returns Reader-state repository service.
 */
function makeRepositoryService(storage: StateStorage) {
  let ready: Promise<void> | undefined

  const ensureMigrated = (readerId: string = defaultReaderId) => {
    ready ??= (async () => {
      const stored = await storage.load(readerId)
      const hasNormalizedState = stored.profile !== undefined
        || stored.reactions.length > 0
        || stored.impressions.length > 0

      if (stored.sourceJson !== undefined) {
        await storage.migrate(parseSourceState(stored.sourceJson), readerId)
      } else if (!hasNormalizedState) {
        await storage.migrate(defaultReaderState, readerId)
      }
    })()
    // A transient failure must not poison the memo: clear it so the next
    // request retries the migration instead of dying forever.
    ready.catch(() => {
      ready = undefined
    })
    return ready
  }

  // Every reader-scoped operation resolves the request's identity first.
  const withReader = <A>(
    run: (readerId: string) => Promise<A>,
  ): Effect.Effect<A, never, ReaderId> =>
    Effect.gen(function*() {
      const readerId = yield* ReaderId
      yield* Effect.promise(() => ensureMigrated(readerId))
      return yield* Effect.promise(() => run(readerId))
    })

  return ReaderStateRepository.of(
    {
      load: withReader(async (readerId) =>
        storedStateToReaderState(await storage.load(readerId))
      ),
      saveProfile: (input) =>
        withReader((readerId) =>
          storage.saveProfile(normalizeProfileInput(input), readerId)
        ),
      onboard: (input) =>
        withReader((readerId) => storage.onboard(input, new Date(), readerId)),
      react: (input) =>
        withReader((readerId) => storage.react(input, new Date(), readerId)),
      track: (input) =>
        withReader((readerId) => storage.track(input, new Date(), readerId)),
      loadFeedSession: (sessionId) =>
        withReader((readerId) =>
          storage.loadFeedSession(sessionId, new Date(), readerId)
        ),
      saveFeedSession: (sessionId, seenPaperIds, cursor) =>
        withReader((readerId) =>
          storage.saveFeedSession(
            sessionId,
            seenPaperIds,
            cursor,
            new Date(),
            readerId,
          )
        ),
      savePapers: (papers) =>
        Effect.promise(async () => {
          await ensureMigrated()
          await storage.savePapers(papers, new Date())
        }),
      papersByIds: (ids) =>
        Effect.promise(async () => {
          await ensureMigrated()
          return storage.papersByIds(ids)
        }),
      recentPapers: (now) =>
        Effect.promise(async () => {
          await ensureMigrated()
          return storage.recentPapers(poolCutoff(now))
        }),
      // Deliberately not reader-scoped: the count spans every reader's filings.
      savedByReaders: (paperId) =>
        Effect.promise(async () => {
          await ensureMigrated()
          return storage.savedByReaders(paperId)
        }),
      // Deliberately not reader-scoped: the count spans every reader's opens.
      openedByReaders: (paperId) =>
        Effect.promise(async () => {
          await ensureMigrated()
          return storage.openedByReaders(paperId)
        }),
      // Deliberately not reader-scoped: the count spans every reader's likes.
      likedByReaders: (paperId) =>
        Effect.promise(async () => {
          await ensureMigrated()
          return storage.likedByReaders(paperId)
        }),
      // Deliberately not reader-scoped: the count spans every reader's hides.
      hiddenByReaders: (paperId) =>
        Effect.promise(async () => {
          await ensureMigrated()
          return storage.hiddenByReaders(paperId)
        }),
      filedByOthers: (paperIds, readerId) =>
        Effect.promise(async () => {
          await ensureMigrated()
          return storage.filedByOthers(paperIds, readerId)
        }),
      likedByOthers: (paperIds, readerId) =>
        Effect.promise(async () => {
          await ensureMigrated()
          return storage.likedByOthers(paperIds, readerId)
        }),
      ping: Effect.promise(() => storage.ping()),
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

const delay = async (ms: number): Promise<void> => {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms)
}

/**
 * Retries the boot-time schema migration so a brief database restart or
 * failover does not brick the process; waits ≈23s in total before giving up.
 * @param run - Migration to run.
 * @returns Migration completion.
 */
const migrateWithRetry = async (run: () => Promise<unknown>): Promise<void> => {
  const delays = [1_000, 2_000, 4_000, 8_000, 8_000]
  for (let attempt = 0;; attempt++) {
    try {
      await run()
      return
    } catch (error) {
      if (attempt >= delays.length) {
        throw error
      }
      await delay(delays[attempt])
    }
  }
}

/**
 * Builds the Postgres-backed reader-state repository.
 * @param databaseUrl - PostgreSQL connection URL.
 * @returns Scoped repository construction effect.
 */
function makePostgresRepository(databaseUrl: string) {
  return Effect
    .gen(function*() {
      const client = postgres(databaseUrl, {
        prepare: false,
        max: 20,
        idle_timeout: 30,
        connect_timeout: 10,
      })
      yield* Effect.promise(() =>
        migrateWithRetry(() => client.unsafe(createReaderStateTablesSql))
      )
      const db = drizzlePostgres(client, {
        schema: {
          impressionsTable,
          papersTable,
          reactionsTable,
          readerProfilesTable,
          readerStateTable,
        },
      })
      yield* Effect.addFinalizer(() => Effect.promise(() => client.end()))

      /**
       * Sweeps expired sessions and impressions; reactions are never swept.
       * @param now - Current time.
       * @returns Sweep completion.
       */
      const sweepExpired = async (now: Date) => {
        await db
          .delete(feedSessionsTable)
          .where(
            lt(
              feedSessionsTable.updatedAt,
              new Date(now.getTime() - feedSessionTtlMs),
            ),
          )
        await db
          .delete(impressionsTable)
          .where(lt(impressionsTable.shownAt, impressionCutoff(now)))
      }

      const feedSessionStorage: Pick<
        StateStorage,
        "loadFeedSession" | "saveFeedSession"
      > = {
        loadFeedSession: async (sessionId, now, readerId) => {
          await sweepExpired(now)
          const row = await db
            .select()
            .from(feedSessionsTable)
            .where(and(
              eq(feedSessionsTable.id, sessionId),
              eq(feedSessionsTable.readerId, readerId),
            ))
            .limit(1)
            .then(([found]) => found)
          return row?.seenPaperIds ?? []
        },
        saveFeedSession: async (
          sessionId,
          seenPaperIds,
          cursor,
          now,
          readerId,
        ) => {
          await db
            .insert(feedSessionsTable)
            .values({
              id: sessionId,
              readerId,
              seenPaperIds,
              cursor,
              updatedAt: now,
            })
            .onConflictDoUpdate({
              target: feedSessionsTable.id,
              set: { readerId, seenPaperIds, cursor, updatedAt: now },
              setWhere: eq(feedSessionsTable.readerId, readerId),
            })
          await sweepExpired(now)
        },
      }

      const postgresStorage: StateStorage = {
        ...feedSessionStorage,
        ping: async () => {
          await client`SELECT 1`
        },
        savePapers: async (papers, fetchedAt) => {
          if (papers.length === 0) {
            return
          }
          const rows = paperRows(papers, fetchedAt)
          await db.transaction(async (tx) => {
            await tx
              .delete(papersTable)
              .where(inArray(papersTable.id, rows.map((row) => row.id)))
            await tx.insert(papersTable).values(rows)
          })
        },
        papersByIds: async (ids) => {
          if (ids.length === 0) {
            return []
          }
          const rows = await db
            .select()
            .from(papersTable)
            .where(inArray(papersTable.id, ids))
          return rows.map(storedPaper)
        },
        recentPapers: async (since) => {
          const rows = await db
            .select()
            .from(papersTable)
            .where(gte(papersTable.fetchedAt, since))
            .orderBy(desc(papersTable.fetchedAt), asc(papersTable.id))
          return rows.map(storedPaper)
        },
        onboard: async (input, createdAt, readerId) => {
          await db.transaction(async (tx) => {
            await tx
              .insert(readerProfilesTable)
              .values({
                id: readerId,
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
              eq(reactionsTable.readerId, readerId),
              inArray(reactionsTable.kind, [
                "onboard-keep",
                "onboard-reject",
              ]),
            ))
            const rows = onboardingRows(input, createdAt, readerId)
            if (rows.length > 0) {
              await tx.insert(reactionsTable).values(rows)
            }
          })
        },
        load: async (readerId) => {
          const source = await db
            .select()
            .from(readerStateTable)
            .where(eq(readerStateTable.id, defaultReaderId))
            .limit(1)
            .then(([row]) => row)
          const profile = await db
            .select()
            .from(readerProfilesTable)
            .where(eq(readerProfilesTable.id, readerId))
            .limit(1)
            .then(([row]) => row)
          const reactions = await db
            .select()
            .from(reactionsTable)
            .where(eq(reactionsTable.readerId, readerId))
            .orderBy(desc(reactionsTable.createdAt))
          const impressions = await db
            .select()
            .from(impressionsTable)
            .where(eq(impressionsTable.readerId, readerId))
            .orderBy(desc(impressionsTable.shownAt))
          return {
            sourceJson: source?.stateJson,
            profile,
            reactions,
            impressions,
          }
        },
        migrate: async (state, readerId) => {
          const rows = stateRows(state, readerId)
          await db.transaction(async (tx) => {
            await tx.delete(reactionsTable).where(
              eq(reactionsTable.readerId, readerId),
            )
            await tx.delete(impressionsTable).where(
              eq(impressionsTable.readerId, readerId),
            )
            await tx.delete(readerProfilesTable).where(
              eq(readerProfilesTable.id, readerId),
            )
            if (state.profile !== null) {
              await tx.insert(readerProfilesTable).values({
                id: readerId,
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
              eq(readerStateTable.id, defaultReaderId),
            )
          })
        },
        saveProfile: async (profile, readerId) => {
          await db
            .insert(readerProfilesTable)
            .values({
              id: readerId,
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
        react: async (input, createdAt, readerId) => {
          const current = input.kind === "open-site"
            ? undefined
            : await db
              .select()
              .from(reactionsTable)
              .where(and(
                eq(reactionsTable.readerId, readerId),
                eq(reactionsTable.paperId, input.paperId),
                eq(reactionsTable.kind, input.kind),
              ))
              .orderBy(desc(reactionsTable.createdAt))
              .limit(1)
              .then(([row]) => row)
          const active = input.kind === "open-site" || current?.active !== true
          await db.insert(reactionsTable).values({
            id: randomUUID(),
            readerId,
            paperId: input.paperId,
            kind: input.kind,
            active,
            createdAt,
          })
          return active
        },
        track: async (input, shownAt, readerId) => {
          if (input.kind === "view") {
            await db.insert(impressionsTable).values({
              id: randomUUID(),
              readerId,
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
              eq(impressionsTable.readerId, readerId),
              eq(impressionsTable.paperId, input.paperId),
              isNull(impressionsTable.dwellMs),
            ))
            .orderBy(desc(impressionsTable.shownAt))
            .limit(1)
            .then(([row]) => row)
          if (impression === undefined) {
            await db.insert(impressionsTable).values({
              id: randomUUID(),
              readerId,
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
        savedByReaders: async (paperId) =>
          activeFilers(
            await db
              .select({
                readerId: reactionsTable.readerId,
                active: reactionsTable.active,
              })
              .from(reactionsTable)
              .where(and(
                eq(reactionsTable.paperId, paperId),
                eq(reactionsTable.kind, "bookmark"),
                ne(reactionsTable.readerId, defaultReaderId),
              ))
              .orderBy(desc(reactionsTable.createdAt)),
          ),
        filedByOthers: async (paperIds, readerId) => {
          if (paperIds.length === 0) {
            return {}
          }
          return otherFilers(
            await db
              .select({
                paperId: reactionsTable.paperId,
                readerId: reactionsTable.readerId,
                active: reactionsTable.active,
              })
              .from(reactionsTable)
              .where(and(
                inArray(reactionsTable.paperId, paperIds),
                eq(reactionsTable.kind, "bookmark"),
                ne(reactionsTable.readerId, readerId),
                ne(reactionsTable.readerId, defaultReaderId),
              ))
              .orderBy(desc(reactionsTable.createdAt)),
          )
        },
        likedByOthers: async (paperIds, readerId) => {
          if (paperIds.length === 0) {
            return {}
          }
          return otherFilers(
            await db
              .select({
                paperId: reactionsTable.paperId,
                readerId: reactionsTable.readerId,
                active: reactionsTable.active,
              })
              .from(reactionsTable)
              .where(and(
                inArray(reactionsTable.paperId, paperIds),
                eq(reactionsTable.kind, "like"),
                ne(reactionsTable.readerId, readerId),
                ne(reactionsTable.readerId, defaultReaderId),
              ))
              .orderBy(desc(reactionsTable.createdAt)),
          )
        },
        openedByReaders: async (paperId) =>
          activeFilers(
            await db
              .select({
                readerId: reactionsTable.readerId,
                active: reactionsTable.active,
              })
              .from(reactionsTable)
              .where(and(
                eq(reactionsTable.paperId, paperId),
                eq(reactionsTable.kind, "open-site"),
                ne(reactionsTable.readerId, defaultReaderId),
              ))
              .orderBy(desc(reactionsTable.createdAt)),
          ),
        likedByReaders: async (paperId) =>
          activeFilers(
            await db
              .select({
                readerId: reactionsTable.readerId,
                active: reactionsTable.active,
              })
              .from(reactionsTable)
              .where(and(
                eq(reactionsTable.paperId, paperId),
                eq(reactionsTable.kind, "like"),
              ))
              .orderBy(desc(reactionsTable.createdAt)),
          ),
        hiddenByReaders: async (paperId) =>
          activeFilers(
            await db
              .select({
                readerId: reactionsTable.readerId,
                active: reactionsTable.active,
              })
              .from(reactionsTable)
              .where(and(
                eq(reactionsTable.paperId, paperId),
                eq(reactionsTable.kind, "hide"),
                ne(reactionsTable.readerId, defaultReaderId),
              ))
              .orderBy(desc(reactionsTable.createdAt)),
          ),
      }

      return makeRepositoryService(postgresStorage)
    })
    .pipe(Effect.orDie)
}

/**
 * Refusal to open a PGlite data directory another live process already owns.
 */
export class PgliteLockError extends Error {
  readonly dataDir: string
  readonly ownerPid: number

  /**
   * Builds the cross-process refusal.
   * @param dataDir - Directory the other process owns.
   * @param ownerPid - Live process currently using it.
   */
  constructor(dataDir: string, ownerPid: number) {
    super(
      `Another AcademiTok server (pid ${ownerPid}) is already using ${dataDir}. Stop that server, or point PGLITE_READER_STATE_DIR at a different directory.`,
    )
    this.name = "PgliteLockError"
    this.dataDir = dataDir
    this.ownerPid = ownerPid
  }
}

/** Lock paths this process already holds, so re-entry in one process is a no-op. */
const pgliteLocks = new Set<string>()

const processIsAlive = (pid: number): boolean => {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

/**
 * Claims the exclusive lock beside one PGlite data directory. PGlite corrupts
 * a directory that two processes open at once, so a second live server is
 * refused with a clear message instead of being allowed to break the store.
 * @param dataDir - Directory about to be opened.
 * @returns Lock acquisition.
 */
const acquirePgliteLock = async (dataDir: string): Promise<void> => {
  const key = resolve(dataDir)
  const lockPath = `${key}.lock`
  if (pgliteLocks.has(key)) {
    return
  }
  const claim = async (): Promise<void> => {
    await mkdir(lockPath, { recursive: false })
    await writeFile(join(lockPath, "owner"), `${process.pid}\n`, "utf8")
    pgliteLocks.add(key)
  }
  try {
    await claim()
    return
  } catch {
    const owner = Number.parseInt(
      (await readFile(join(lockPath, "owner"), "utf8").catch(() => "")).trim(),
      10,
    )
    if (
      Number.isInteger(owner)
      && owner > 0
      && owner !== process.pid
      && processIsAlive(owner)
    ) {
      throw new PgliteLockError(key, owner)
    }
    await rm(lockPath, { force: true, recursive: true })
    await claim()
  }
}

/**
 * Releases the lock this process holds on one PGlite data directory.
 * @param dataDir - Directory previously claimed.
 * @returns Lock release.
 */
const releasePgliteLock = async (dataDir: string): Promise<void> => {
  const key = resolve(dataDir)
  if (!pgliteLocks.delete(key)) {
    return
  }
  await rm(`${key}.lock`, { force: true, recursive: true })
}

/**
 * Opens PGlite, migrating the schema; if the data directory is damaged beyond
 * opening (a concurrent launch once shared it), the directory is moved aside
 * untouched and a fresh store starts in its place.
 * @param dataDir - Persistent directory, or undefined for memory storage.
 * @returns Client plus the path the damaged state was moved to, when recovery ran.
 */
const openPgliteState = async (
  dataDir: string | undefined,
): Promise<{
  readonly client: PGlite
  readonly recoveredFrom: string | undefined
}> => {
  const open = async (): Promise<PGlite> => {
    const client = dataDir === undefined
      ? new PGlite()
      : new PGlite(dataDir)
    await client.exec(createReaderStateTablesSql)
    return client
  }
  if (dataDir === undefined) {
    return { client: await open(), recoveredFrom: undefined }
  }
  try {
    return { client: await open(), recoveredFrom: undefined }
  } catch {
    const recoveredFrom = `${dataDir.replaceAll(/[/\\]+$/g, "")}.corrupt-${
      new Date().toISOString().replaceAll(/[:.]/g, "-")
    }`
    await rename(dataDir, recoveredFrom).catch(() => undefined)
    return { client: await open(), recoveredFrom }
  }
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
        yield* Effect.promise(() => acquirePgliteLock(dataDir))
        yield* Effect.addFinalizer(() =>
          Effect.promise(() => releasePgliteLock(dataDir))
        )
      }
      if (globalThis.Buffer === undefined) {
        globalThis.Buffer = Buffer
      }

      const opened = yield* Effect.promise(() => openPgliteState(dataDir))
      const client = opened.client
      if (opened.recoveredFrom !== undefined) {
        yield* Effect.logWarning(
          `PGlite state at ${dataDir} failed to open; moved to ${opened.recoveredFrom} and started a fresh store.`,
        )
      }
      const db = drizzlePglite({
        client,
        schema: {
          impressionsTable,
          papersTable,
          reactionsTable,
          readerProfilesTable,
          readerStateTable,
        },
      })
      yield* Effect.addFinalizer(() => Effect.promise(() => client.close()))

      /**
       * Sweeps expired sessions and impressions; reactions are never swept.
       * @param now - Current time.
       * @returns Sweep completion.
       */
      const sweepExpired = async (now: Date) => {
        await db
          .delete(feedSessionsTable)
          .where(
            lt(
              feedSessionsTable.updatedAt,
              new Date(now.getTime() - feedSessionTtlMs),
            ),
          )
        await db
          .delete(impressionsTable)
          .where(lt(impressionsTable.shownAt, impressionCutoff(now)))
      }

      const feedSessionStorage: Pick<
        StateStorage,
        "loadFeedSession" | "saveFeedSession"
      > = {
        loadFeedSession: async (sessionId, now, readerId) => {
          await sweepExpired(now)
          const row = await db
            .select()
            .from(feedSessionsTable)
            .where(and(
              eq(feedSessionsTable.id, sessionId),
              eq(feedSessionsTable.readerId, readerId),
            ))
            .limit(1)
            .then(([found]) => found)
          return row?.seenPaperIds ?? []
        },
        saveFeedSession: async (
          sessionId,
          seenPaperIds,
          cursor,
          now,
          readerId,
        ) => {
          await db
            .insert(feedSessionsTable)
            .values({
              id: sessionId,
              readerId,
              seenPaperIds,
              cursor,
              updatedAt: now,
            })
            .onConflictDoUpdate({
              target: feedSessionsTable.id,
              set: { readerId, seenPaperIds, cursor, updatedAt: now },
              setWhere: eq(feedSessionsTable.readerId, readerId),
            })
          await sweepExpired(now)
        },
      }

      const storage: StateStorage = {
        ...feedSessionStorage,
        ping: async () => {
          await client.query("SELECT 1")
        },
        savePapers: async (papers, fetchedAt) => {
          if (papers.length === 0) {
            return
          }
          const rows = paperRows(papers, fetchedAt)
          await db.transaction(async (tx) => {
            await tx
              .delete(papersTable)
              .where(inArray(papersTable.id, rows.map((row) => row.id)))
            await tx.insert(papersTable).values(rows)
          })
        },
        papersByIds: async (ids) => {
          if (ids.length === 0) {
            return []
          }
          const rows = await db
            .select()
            .from(papersTable)
            .where(inArray(papersTable.id, ids))
          return rows.map(storedPaper)
        },
        recentPapers: async (since) => {
          const rows = await db
            .select()
            .from(papersTable)
            .where(gte(papersTable.fetchedAt, since))
            .orderBy(desc(papersTable.fetchedAt), asc(papersTable.id))
          return rows.map(storedPaper)
        },
        onboard: async (input, createdAt, readerId) => {
          await db.transaction(async (tx) => {
            await tx
              .insert(readerProfilesTable)
              .values({
                id: readerId,
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
              eq(reactionsTable.readerId, readerId),
              inArray(reactionsTable.kind, [
                "onboard-keep",
                "onboard-reject",
              ]),
            ))
            const rows = onboardingRows(input, createdAt, readerId)
            if (rows.length > 0) {
              await tx.insert(reactionsTable).values(rows)
            }
          })
        },
        load: async (readerId) => {
          const source = await db
            .select()
            .from(readerStateTable)
            .where(eq(readerStateTable.id, defaultReaderId))
            .limit(1)
            .then(([row]) => row)
          const profile = await db
            .select()
            .from(readerProfilesTable)
            .where(eq(readerProfilesTable.id, readerId))
            .limit(1)
            .then(([row]) => row)
          const reactions = await db
            .select()
            .from(reactionsTable)
            .where(eq(reactionsTable.readerId, readerId))
            .orderBy(desc(reactionsTable.createdAt))
          const impressions = await db
            .select()
            .from(impressionsTable)
            .where(eq(impressionsTable.readerId, readerId))
            .orderBy(desc(impressionsTable.shownAt))
          return {
            sourceJson: source?.stateJson,
            profile,
            reactions,
            impressions,
          }
        },
        migrate: async (state, readerId) => {
          const rows = stateRows(state, readerId)
          await db.transaction(async (tx) => {
            await tx.delete(reactionsTable).where(
              eq(reactionsTable.readerId, readerId),
            )
            await tx.delete(impressionsTable).where(
              eq(impressionsTable.readerId, readerId),
            )
            await tx.delete(readerProfilesTable).where(
              eq(readerProfilesTable.id, readerId),
            )
            if (state.profile !== null) {
              await tx.insert(readerProfilesTable).values({
                id: readerId,
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
              eq(readerStateTable.id, defaultReaderId),
            )
          })
        },
        saveProfile: async (profile, readerId) => {
          await db
            .insert(readerProfilesTable)
            .values({
              id: readerId,
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
        react: async (input, createdAt, readerId) => {
          const current = input.kind === "open-site"
            ? undefined
            : await db
              .select()
              .from(reactionsTable)
              .where(and(
                eq(reactionsTable.readerId, readerId),
                eq(reactionsTable.paperId, input.paperId),
                eq(reactionsTable.kind, input.kind),
              ))
              .orderBy(desc(reactionsTable.createdAt))
              .limit(1)
              .then(([row]) => row)
          const active = input.kind === "open-site" || current?.active !== true
          await db.insert(reactionsTable).values({
            id: randomUUID(),
            readerId,
            paperId: input.paperId,
            kind: input.kind,
            active,
            createdAt,
          })
          return active
        },
        track: async (input, shownAt, readerId) => {
          if (input.kind === "view") {
            await db.insert(impressionsTable).values({
              id: randomUUID(),
              readerId,
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
              eq(impressionsTable.readerId, readerId),
              eq(impressionsTable.paperId, input.paperId),
              isNull(impressionsTable.dwellMs),
            ))
            .orderBy(desc(impressionsTable.shownAt))
            .limit(1)
            .then(([row]) => row)
          if (impression === undefined) {
            await db.insert(impressionsTable).values({
              id: randomUUID(),
              readerId,
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
        savedByReaders: async (paperId) =>
          activeFilers(
            await db
              .select({
                readerId: reactionsTable.readerId,
                active: reactionsTable.active,
              })
              .from(reactionsTable)
              .where(and(
                eq(reactionsTable.paperId, paperId),
                eq(reactionsTable.kind, "bookmark"),
                ne(reactionsTable.readerId, defaultReaderId),
              ))
              .orderBy(desc(reactionsTable.createdAt)),
          ),
        filedByOthers: async (paperIds, readerId) => {
          if (paperIds.length === 0) {
            return {}
          }
          return otherFilers(
            await db
              .select({
                paperId: reactionsTable.paperId,
                readerId: reactionsTable.readerId,
                active: reactionsTable.active,
              })
              .from(reactionsTable)
              .where(and(
                inArray(reactionsTable.paperId, paperIds),
                eq(reactionsTable.kind, "bookmark"),
                ne(reactionsTable.readerId, readerId),
                ne(reactionsTable.readerId, defaultReaderId),
              ))
              .orderBy(desc(reactionsTable.createdAt)),
          )
        },
        likedByOthers: async (paperIds, readerId) => {
          if (paperIds.length === 0) {
            return {}
          }
          return otherFilers(
            await db
              .select({
                paperId: reactionsTable.paperId,
                readerId: reactionsTable.readerId,
                active: reactionsTable.active,
              })
              .from(reactionsTable)
              .where(and(
                inArray(reactionsTable.paperId, paperIds),
                eq(reactionsTable.kind, "like"),
                ne(reactionsTable.readerId, readerId),
                ne(reactionsTable.readerId, defaultReaderId),
              ))
              .orderBy(desc(reactionsTable.createdAt)),
          )
        },
        openedByReaders: async (paperId) =>
          activeFilers(
            await db
              .select({
                readerId: reactionsTable.readerId,
                active: reactionsTable.active,
              })
              .from(reactionsTable)
              .where(and(
                eq(reactionsTable.paperId, paperId),
                eq(reactionsTable.kind, "open-site"),
                ne(reactionsTable.readerId, defaultReaderId),
              ))
              .orderBy(desc(reactionsTable.createdAt)),
          ),
        likedByReaders: async (paperId) =>
          activeFilers(
            await db
              .select({
                readerId: reactionsTable.readerId,
                active: reactionsTable.active,
              })
              .from(reactionsTable)
              .where(and(
                eq(reactionsTable.paperId, paperId),
                eq(reactionsTable.kind, "like"),
              ))
              .orderBy(desc(reactionsTable.createdAt)),
          ),
        hiddenByReaders: async (paperId) =>
          activeFilers(
            await db
              .select({
                readerId: reactionsTable.readerId,
                active: reactionsTable.active,
              })
              .from(reactionsTable)
              .where(and(
                eq(reactionsTable.paperId, paperId),
                eq(reactionsTable.kind, "hide"),
                ne(reactionsTable.readerId, defaultReaderId),
              ))
              .orderBy(desc(reactionsTable.createdAt)),
          ),
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

/**
 * Verifies live database connectivity for readiness probes.
 * @returns Effect completing once the configured database answers `SELECT 1`.
 */
export const pingReaderStateRepository = Effect.flatMap(
  ReaderStateRepository,
  (repository) => repository.ping,
)
