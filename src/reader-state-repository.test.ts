// @vitest-environment node

import {
  impressionCutoff,
  poolCutoff,
  ReaderStateRepository,
} from "@/db/reader-state-repository"
import { PgliteLockError } from "@/db/reader-state-repository"
import { savedPaperIds } from "@/features/papers/recommendation"
import { defaultReaderId, ReaderId } from "@/lib/reader-id"
import { PGlite } from "@electric-sql/pglite"
import * as Cause from "effect/Cause"
import * as ConfigProvider from "effect/ConfigProvider"
import * as Effect from "effect/Effect"
import * as Exit from "effect/Exit"
import * as Layer from "effect/Layer"
import { spawn } from "node:child_process"
import { mkdir, mkdtemp, readdir, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { basename, dirname, join } from "node:path"
import { afterEach, describe, expect, it } from "vitest"

const directories: Array<string> = []

const provideDatabase = <A>(
  dataDir: string,
  effect: Effect.Effect<A, never, ReaderStateRepository | ReaderId>,
) =>
  effect.pipe(
    Effect.provide([
      ReaderStateRepository.layer,
      Layer.succeed(ReaderId, defaultReaderId),
    ]),
    Effect.provide(
      ConfigProvider.layer(
        ConfigProvider.fromEnv({
          env: { PGLITE_READER_STATE_DIR: dataDir },
        }),
      ),
    ),
    Effect.scoped,
  )

const runWithDatabase = <A>(
  dataDir: string,
  effect: Effect.Effect<A, never, ReaderStateRepository | ReaderId>,
) => Effect.runPromise(provideDatabase(dataDir, effect))

const runWithDatabaseExit = <A>(
  dataDir: string,
  effect: Effect.Effect<A, never, ReaderStateRepository | ReaderId>,
) => Effect.runPromiseExit(provideDatabase(dataDir, effect))

afterEach(async () => {
  await Promise.all(
    directories.splice(0).map((directory) =>
      rm(directory, { force: true, recursive: true })
    ),
  )
})

const inspectRetention = async (dataDir: string) => {
  const inspection = new PGlite(dataDir)
  const impressions = await inspection.query<{ id: string }>(
    "SELECT id FROM impressions ORDER BY id",
  )
  const reactions = await inspection.query<{ id: string }>(
    "SELECT id FROM reactions ORDER BY id",
  )
  await inspection.close()
  return {
    impressions: impressions.rows.map((row) => row.id),
    reactions: reactions.rows.map((row) => row.id),
  }
}

describe("ReaderStateRepository", () => {
  it("persists onboarding picks and accepts an explicit skip", async () => {
    const picksDir = await mkdtemp(join(tmpdir(), "academitok-onboarding-"))
    const skipDir = await mkdtemp(join(tmpdir(), "academitok-onboarding-skip-"))
    directories.push(picksDir, skipDir)

    const fresh = await runWithDatabase(
      picksDir,
      Effect.gen(function*() {
        const repository = yield* ReaderStateRepository
        const state = yield* repository.load
        yield* repository.onboard({
          keptPaperIds: ["1", "2", "3", "4", "5"],
          rejectedPaperIds: ["6", "7"],
          skipped: false,
        })
        return state
      }),
    )
    expect(fresh.profile).toBeNull()

    const onboarded = await runWithDatabase(
      picksDir,
      Effect.gen(function*() {
        const repository = yield* ReaderStateRepository
        return yield* repository.load
      }),
    )
    expect(onboarded.profile).toMatchObject({
      name: "Guest Reader",
      interests: [],
    })
    expect(onboarded.reactions).toEqual(expect.arrayContaining([
      expect.objectContaining({ paperId: "1", kind: "onboard-keep" }),
      expect.objectContaining({ paperId: "6", kind: "onboard-reject" }),
    ]))

    const skipped = await runWithDatabase(
      skipDir,
      Effect.gen(function*() {
        const repository = yield* ReaderStateRepository
        yield* repository.onboard({
          keptPaperIds: [],
          rejectedPaperIds: [],
          skipped: true,
        })
        return yield* repository.load
      }),
    )
    expect(skipped.profile).not.toBeNull()
    expect(skipped.reactions).toEqual([])
    // Three PGlite boots; under coverage instrumentation they outrun the 5s default.
  }, 15_000)

  it("migrates the JSON source once and preserves normalized events across restarts", async () => {
    const dataDir = await mkdtemp(join(tmpdir(), "academitok-reader-state-"))
    directories.push(dataDir)
    const sourceState = {
      profile: {
        name: "Ada",
        institution: "MIT",
        interests: ["AI", "Robotics"],
      },
      reactions: [
        {
          paperId: "paper-1",
          kind: "bookmark",
          active: true,
          timestamp: 2_000,
        },
        {
          paperId: "paper-2",
          kind: "hide",
          active: true,
          timestamp: 1_000,
        },
      ],
    }
    const seed = new PGlite(dataDir)
    await seed.exec(`
      CREATE TABLE reader_state (
        id text PRIMARY KEY,
        state_json text NOT NULL,
        updated_at timestamptz NOT NULL
      )
    `)
    await seed.query(
      "INSERT INTO reader_state VALUES ($1, $2, $3)",
      ["singleton", JSON.stringify(sourceState), new Date()],
    )
    await seed.close()

    const firstLoad = await runWithDatabase(
      dataDir,
      Effect.gen(function*() {
        const repository = yield* ReaderStateRepository
        const state = yield* repository.load
        yield* repository.react({ paperId: "paper-3", kind: "like" })
        yield* repository.track({
          paperId: "paper-3",
          kind: "view",
          dwellMs: 0,
          position: 4,
          exploration: true,
        })
        yield* repository.track({
          paperId: "paper-3",
          kind: "dwell",
          dwellMs: 8_000,
          position: 4,
          exploration: true,
        })
        return state
      }),
    )

    expect(firstLoad.profile?.name).toBe("Ada")
    expect(firstLoad.reactions.map(({ kind }) => kind)).toEqual([
      "bookmark",
      "hide",
    ])

    const restarted = await runWithDatabase(
      dataDir,
      Effect.gen(function*() {
        const repository = yield* ReaderStateRepository
        return yield* repository.load
      }),
    )
    expect(restarted.profile?.interests).toEqual(["AI", "Robotics"])
    expect(restarted.reactions).toEqual(expect.arrayContaining([
      expect.objectContaining({
        paperId: "paper-1",
        kind: "bookmark",
        active: true,
      }),
      expect.objectContaining({
        paperId: "paper-2",
        kind: "hide",
        active: true,
      }),
      expect.objectContaining({
        paperId: "paper-3",
        kind: "like",
        active: true,
      }),
      expect.objectContaining({
        paperId: "paper-3",
        kind: "dwell",
        dwellMs: 8_000,
      }),
    ]))

    const inspection = new PGlite(dataDir)
    const sourceRows = await inspection.query<{ count: number }>(
      "SELECT count(*)::int AS count FROM reader_state",
    )
    const impressionRows = await inspection.query<{
      dwell_ms: number
      exploration: boolean
      position: number
    }>("SELECT dwell_ms, exploration, position FROM impressions")
    await inspection.close()

    expect(sourceRows.rows[0]?.count).toBe(0)
    expect(impressionRows.rows).toEqual([{
      dwell_ms: 8_000,
      exploration: true,
      position: 4,
    }])
  })

  it("persists feed session progress and starts a fresh session clean", async () => {
    const dataDir = await mkdtemp(join(tmpdir(), "academitok-feed-session-"))
    directories.push(dataDir)

    await runWithDatabase(
      dataDir,
      Effect.gen(function*() {
        const repository = yield* ReaderStateRepository
        yield* repository.saveFeedSession(
          "session-a",
          ["paper-1", "paper-2"],
          null,
        )
      }),
    )

    const sessions = await runWithDatabase(
      dataDir,
      Effect.gen(function*() {
        const repository = yield* ReaderStateRepository
        return {
          saved: yield* repository.loadFeedSession("session-a"),
          fresh: yield* repository.loadFeedSession("session-b"),
        }
      }),
    )

    expect(sessions.saved).toEqual(["paper-1", "paper-2"])
    expect(sessions.fresh).toEqual([])
  })

  it("keeps two readers' saves and feed sessions apart", async () => {
    const dataDir = await mkdtemp(join(tmpdir(), "academitok-readers-"))
    directories.push(dataDir)

    const readerA = "0f8c7f4e-1c3e-4f22-9a1a-9b4b1c0a1d11"
    const readerB = "7b2c9d10-4a55-4f8e-8c1f-2d6e3a5b7c99"
    const asReader = <A, E, R>(
      readerId: string,
      effect: Effect.Effect<A, E, ReaderId | R>,
    ): Effect.Effect<A, E, R> =>
      Effect.provideService(effect, ReaderId, readerId)

    const result = await runWithDatabase(
      dataDir,
      Effect.gen(function*() {
        const repository = yield* ReaderStateRepository

        yield* asReader(
          readerA,
          repository.react({ paperId: "paper-1", kind: "bookmark" }),
        )
        yield* asReader(
          readerA,
          repository.saveFeedSession("shared", ["paper-1"], null),
        )
        yield* asReader(
          readerB,
          repository.react({ paperId: "paper-2", kind: "bookmark" }),
        )

        return {
          a: savedPaperIds(yield* asReader(readerA, repository.load)),
          b: savedPaperIds(yield* asReader(readerB, repository.load)),
          aSession: yield* asReader(
            readerA,
            repository.loadFeedSession("shared"),
          ),
          bSession: yield* asReader(
            readerB,
            repository.loadFeedSession("shared"),
          ),
        }
      }),
    )

    expect(result.a).toEqual(["paper-1"])
    expect(result.b).toEqual(["paper-2"])
    expect(result.aSession).toEqual(["paper-1"])
    expect(result.bSession).toEqual([])
  })

  it("counts the readers who filed a clipping and skips undone saves", async () => {
    const dataDir = await mkdtemp(join(tmpdir(), "academitok-audience-"))
    directories.push(dataDir)
    const readerA = "0f8c7f4e-1c3e-4f22-9a1a-9b4b1c0a1d11"
    const readerB = "7b2c9d10-4a55-4f8e-8c1f-2d6e3a5b7c99"
    const readerC = "9d4e5f60-7b88-4c99-8d1e-3f2a4b5c6d77"
    const asReader = <A, E, R>(
      readerId: string,
      effect: Effect.Effect<A, E, ReaderId | R>,
    ): Effect.Effect<A, E, R> =>
      Effect.provideService(effect, ReaderId, readerId)

    const counts = await runWithDatabase(
      dataDir,
      Effect.gen(function*() {
        const repository = yield* ReaderStateRepository
        const file = (readerId: string, paperId: string) =>
          asReader(readerId, repository.react({ paperId, kind: "bookmark" }))

        yield* file(readerA, "paper-1")
        yield* file(readerB, "paper-1")
        const twoReaders = yield* repository.savedByReaders("paper-1")
        yield* file(readerC, "paper-2")
        // The log orders filings by `createdAt`, so the undo must land later.
        yield* Effect.sleep("2 millis")
        yield* file(readerC, "paper-2")

        return {
          twoReaders,
          undone: yield* repository.savedByReaders("paper-2"),
          unfiled: yield* repository.savedByReaders("paper-3"),
        }
      }),
    )

    expect(counts.twoReaders).toBe(2)
    expect(counts.undone).toBe(0)
    expect(counts.unfiled).toBe(0)
  })

  it("counts the readers who opened a clipping's source, once each", async () => {
    const dataDir = await mkdtemp(join(tmpdir(), "academitok-opened-"))
    directories.push(dataDir)
    const readerA = "21b6c8d4-3e2f-4a77-9b55-8c1d0e2f4a66"
    const readerB = "5a3f1e70-9c48-4d26-b8e1-7f0a2c6d9e33"
    const readerC = "c47e2b91-0a63-4f58-9d14-6e8b3a0f7d22"
    const asReader = <A, E, R>(
      readerId: string,
      effect: Effect.Effect<A, E, ReaderId | R>,
    ): Effect.Effect<A, E, R> =>
      Effect.provideService(effect, ReaderId, readerId)

    const counts = await runWithDatabase(
      dataDir,
      Effect.gen(function*() {
        const repository = yield* ReaderStateRepository
        const open = (readerId: string, paperId: string) =>
          asReader(readerId, repository.react({ paperId, kind: "open-site" }))

        yield* open(readerA, "paper-1")
        yield* open(readerB, "paper-1")
        yield* open(readerA, "paper-1")

        return {
          twoReaders: yield* repository.openedByReaders("paper-1"),
          strangerSees: yield* asReader(
            readerC,
            repository.openedByReaders("paper-1"),
          ),
          unopened: yield* asReader(
            readerC,
            repository.openedByReaders("paper-2"),
          ),
        }
      }),
    )

    expect(counts.twoReaders).toBe(2)
    expect(counts.strangerSees).toBe(2)
    expect(counts.unopened).toBe(0)
  })

  it("counts the readers who liked a clipping, once each", async () => {
    const dataDir = await mkdtemp(join(tmpdir(), "academitok-liked-"))
    directories.push(dataDir)
    const readerA = "3e5a7c91-2b04-4d68-8f17-0a9c6e4b2d18"
    const readerB = "6b8d0f23-5c47-4e91-a026-1d3f8b5c7e44"
    const readerC = "8c1e3a65-7d92-4b05-9e38-2f4a6c8d1b07"
    const asReader = <A, E, R>(
      readerId: string,
      effect: Effect.Effect<A, E, ReaderId | R>,
    ): Effect.Effect<A, E, R> =>
      Effect.provideService(effect, ReaderId, readerId)

    const counts = await runWithDatabase(
      dataDir,
      Effect.gen(function*() {
        const repository = yield* ReaderStateRepository
        const like = (readerId: string, paperId: string) =>
          asReader(readerId, repository.react({ paperId, kind: "like" }))

        yield* like(readerA, "paper-1")
        yield* like(readerB, "paper-1")
        const twoReaders = yield* repository.likedByReaders("paper-1")
        yield* like(readerC, "paper-2")
        // The log orders reactions by `createdAt`, so the undo must land later.
        yield* Effect.sleep("2 millis")
        yield* like(readerC, "paper-2")

        return {
          twoReaders,
          strangerSees: yield* asReader(
            readerC,
            repository.likedByReaders("paper-1"),
          ),
          undone: yield* repository.likedByReaders("paper-2"),
          unliked: yield* repository.likedByReaders("paper-3"),
        }
      }),
    )

    expect(counts.twoReaders).toBe(2)
    expect(counts.strangerSees).toBe(2)
    expect(counts.undone).toBe(0)
    expect(counts.unliked).toBe(0)
  })

  it("counts the readers who hid a clipping, once each", async () => {
    const dataDir = await mkdtemp(join(tmpdir(), "academitok-hidden-"))
    directories.push(dataDir)
    const readerA = "0c4d8b17-6e29-4f53-a8d0-31b7e5c9f242"
    const readerB = "7d2f9a40-8b15-4c67-9e02-5a1d3f8b6c94"
    const readerC = "4e9b1c72-3a58-4d06-b7f1-9c2e6a0d8b35"
    const asReader = <A, E, R>(
      readerId: string,
      effect: Effect.Effect<A, E, ReaderId | R>,
    ): Effect.Effect<A, E, R> =>
      Effect.provideService(effect, ReaderId, readerId)

    const counts = await runWithDatabase(
      dataDir,
      Effect.gen(function*() {
        const repository = yield* ReaderStateRepository
        const hide = (readerId: string, paperId: string) =>
          asReader(readerId, repository.react({ paperId, kind: "hide" }))

        yield* hide(readerA, "paper-1")
        yield* hide(readerB, "paper-1")
        const twoReaders = yield* repository.hiddenByReaders("paper-1")
        yield* hide(readerC, "paper-2")
        // The log orders reactions by `createdAt`, so the undo must land later.
        yield* Effect.sleep("2 millis")
        yield* hide(readerC, "paper-2")

        return {
          twoReaders,
          strangerSees: yield* asReader(
            readerC,
            repository.hiddenByReaders("paper-1"),
          ),
          undone: yield* repository.hiddenByReaders("paper-2"),
          unhidden: yield* repository.hiddenByReaders("paper-3"),
        }
      }),
    )

    expect(counts.twoReaders).toBe(2)
    expect(counts.strangerSees).toBe(2)
    expect(counts.undone).toBe(0)
    expect(counts.unhidden).toBe(0)
  })

  it("puts the impression retention boundary 90 days before now", () => {
    const now = new Date("2026-05-01T12:00:00.000Z")
    expect(now.getTime() - impressionCutoff(now).getTime()).toBe(
      90 * 24 * 60 * 60 * 1000,
    )
  })

  it("puts the pool freshness boundary 24 hours before now", () => {
    const now = new Date("2026-05-01T12:00:00.000Z")
    expect(now.getTime() - poolCutoff(now).getTime()).toBe(
      24 * 60 * 60 * 1000,
    )
  })

  it("sweeps impressions older than 90 days and keeps reactions", async () => {
    const dataDir = await mkdtemp(join(tmpdir(), "academitok-retention-"))
    directories.push(dataDir)

    // First pass creates the tables the seed below writes into.
    await runWithDatabase(
      dataDir,
      Effect.gen(function*() {
        const repository = yield* ReaderStateRepository
        yield* repository.saveFeedSession("seed-session", [], null)
      }),
    )

    const seeding = new PGlite(dataDir)
    await seeding.exec(`
      INSERT INTO reader_profiles (id, name, institution, beats, onboarded_at)
      VALUES ('singleton', 'Guest Reader', 'Guest', '[]'::jsonb, now());
      INSERT INTO impressions
        (id, reader_id, paper_id, shown_at, dwell_ms, position, exploration)
      VALUES
        ('old-impression', 'singleton', 'paper-old',
          now() - interval '91 days', 4000, 0, false),
        ('recent-impression', 'singleton', 'paper-recent',
          now() - interval '89 days', 5000, 1, false);
      INSERT INTO reactions
        (id, reader_id, paper_id, kind, active, created_at)
      VALUES ('old-reaction', 'singleton', 'paper-old', 'like', true,
        now() - interval '400 days');
    `)
    await seeding.close()

    const sweep = () =>
      runWithDatabase(
        dataDir,
        Effect.gen(function*() {
          const repository = yield* ReaderStateRepository
          yield* repository.loadFeedSession("sweep-session")
        }),
      )

    await sweep()
    const afterFirst = await inspectRetention(dataDir)
    await sweep()
    const afterSecond = await inspectRetention(dataDir)

    const kept = {
      impressions: ["recent-impression"],
      reactions: ["old-reaction"],
    }
    expect(afterFirst).toEqual(kept)
    expect(afterSecond).toEqual(kept)
  })

  it("keeps a local paper pool so saved papers resolve by id", async () => {
    const dataDir = await mkdtemp(join(tmpdir(), "academitok-pool-"))
    directories.push(dataDir)
    const paper = {
      id: "pool-paper-1",
      title: "A Pooled Paper",
      authors: ["Ada Lovelace"],
      abstract: "A pooled abstract.",
      summary: "A pooled summary.",
      year: 2025,
      venue: "Pool Journal",
      topics: ["AI"],
      access: "institution",
      allowedInstitutions: ["MIT"],
      citations: 7,
      readMinutes: 4,
      site: "OpenAlex",
      source: "openalex",
      externalUrl: "https://example.com/pool-paper-1",
    } as const

    await runWithDatabase(
      dataDir,
      Effect.gen(function*() {
        const repository = yield* ReaderStateRepository
        yield* repository.savePapers([paper])
        yield* repository.savePapers([paper])
      }),
    )

    const pooled = await runWithDatabase(
      dataDir,
      Effect.gen(function*() {
        const repository = yield* ReaderStateRepository
        return {
          single: yield* repository.papersByIds(["pool-paper-1"]),
          missing: yield* repository.papersByIds(["nope"]),
          none: yield* repository.papersByIds([]),
          fresh: yield* repository.recentPapers(new Date()),
          expired: yield* repository.recentPapers(
            new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
          ),
        }
      }),
    )

    expect(pooled.single).toEqual([paper])
    expect(pooled.missing).toEqual([])
    expect(pooled.none).toEqual([])
    expect(pooled.fresh).toEqual([paper])
    expect(pooled.expired).toEqual([])
  })

  it("refuses a second live process on the same data directory", async () => {
    const dataDir = await mkdtemp(join(tmpdir(), "academitok-locked-"))
    directories.push(dataDir)
    const holder = spawn("sleep", ["30"])
    try {
      await mkdir(`${dataDir}.lock`, { recursive: true })
      await writeFile(
        join(`${dataDir}.lock`, "owner"),
        `${holder.pid}\n`,
        "utf8",
      )

      const exit = await runWithDatabaseExit(dataDir, Effect.void)
      if (!Exit.isFailure(exit)) {
        throw new Error("expected the locked data directory to fail")
      }
      const error = Cause.squash(exit.cause)
      if (!(error instanceof PgliteLockError)) {
        throw new Error(`expected PgliteLockError, got ${String(error)}`)
      }
      expect(error.ownerPid).toBe(holder.pid)
    } finally {
      holder.kill()
    }
  })

  it("rebuilds a damaged data directory and keeps the damaged copy aside", async () => {
    const dataDir = await mkdtemp(join(tmpdir(), "academitok-damaged-"))
    directories.push(dataDir)
    await writeFile(join(dataDir, "base"), "not a directory")

    const loaded = await runWithDatabaseExit(
      dataDir,
      Effect.gen(function*() {
        const repository = yield* ReaderStateRepository
        return yield* repository.load
      }),
    )
    expect(Exit.isSuccess(loaded)).toBe(true)

    const siblings = await readdir(dirname(dataDir))
    const damaged = siblings.find((name) =>
      name.startsWith(`${basename(dataDir)}.corrupt-`)
    )
    expect(damaged).toBeDefined()

    const reopened = await runWithDatabaseExit(
      dataDir,
      Effect.gen(function*() {
        const repository = yield* ReaderStateRepository
        return yield* repository.load
      }),
    )
    expect(Exit.isSuccess(reopened)).toBe(true)
  })
})
