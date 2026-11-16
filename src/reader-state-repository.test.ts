// @vitest-environment node

import { ReaderStateRepository } from "@/db/reader-state-repository"
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

describe("ReaderStateRepository", () => {
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
})
