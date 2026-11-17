// @vitest-environment node

import {
  impressionCutoff,
  ReaderStateRepository,
} from "@/db/reader-state-repository"
import { PGlite } from "@electric-sql/pglite"
import * as ConfigProvider from "effect/ConfigProvider"
import * as Effect from "effect/Effect"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, describe, expect, it } from "vitest"

const directories: Array<string> = []

const runWithDatabase = <A>(
  dataDir: string,
  effect: Effect.Effect<A, never, ReaderStateRepository>,
) =>
  Effect.runPromise(
    effect.pipe(
      Effect.provide(ReaderStateRepository.layer),
      Effect.provide(
        ConfigProvider.layer(
          ConfigProvider.fromEnv({
            env: { PGLITE_READER_STATE_DIR: dataDir },
          }),
        ),
      ),
      Effect.scoped,
    ),
  )

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
  })

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

  it("puts the impression retention boundary 90 days before now", () => {
    const now = new Date("2026-05-01T12:00:00.000Z")
    expect(now.getTime() - impressionCutoff(now).getTime()).toBe(
      90 * 24 * 60 * 60 * 1000,
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
        }
      }),
    )

    expect(pooled.single).toEqual([paper])
    expect(pooled.missing).toEqual([])
    expect(pooled.none).toEqual([])
  })
})
