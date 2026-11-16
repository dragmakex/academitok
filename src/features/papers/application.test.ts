// @vitest-environment node

import type { FeedRequest } from "@/api/paper-schema"
import { curatedPapers } from "@/data/papers"
import { ReaderStateRepository } from "@/db/reader-state-repository"
import {
  getPaperById,
  getPaperFeedSnapshot,
  getSavedPapers,
} from "@/features/papers/application"
import { recordReaderReaction } from "@/features/papers/reactions"
import * as ConfigProvider from "effect/ConfigProvider"
import * as Effect from "effect/Effect"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, describe, expect, it, vi } from "vitest"

const directories: Array<string> = []

const requestFor = (sessionId: string): FeedRequest => ({
  query: { topic: "All", sort: "recommended" },
  cursor: null,
  sessionId,
})

const runFeed = <A>(
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
  vi.unstubAllGlobals()
  await Promise.all(
    directories.splice(0).map((directory) =>
      rm(directory, { force: true, recursive: true })
    ),
  )
})

describe("papers application", () => {
  it("keeps a persisted feed session clean across a stale cursor", async () => {
    const dataDir = await mkdtemp(join(tmpdir(), "academitok-feed-session-"))
    directories.push(dataDir)
    vi.stubGlobal("fetch", () => Promise.reject(new Error("offline")))

    const [first, second, fresh] = await runFeed(
      dataDir,
      Effect.gen(function*() {
        const repository = yield* ReaderStateRepository
        yield* repository.onboard({
          keptPaperIds: [],
          rejectedPaperIds: [],
          skipped: true,
        })

        return [
          yield* getPaperFeedSnapshot(requestFor("session-a")),
          yield* getPaperFeedSnapshot(requestFor("session-a")),
          yield* getPaperFeedSnapshot(requestFor("session-b")),
        ] as const
      }),
    )

    const firstIds = first.items.map((item) => item.paper.id)
    const secondIds = second.items.map((item) => item.paper.id)

    expect(firstIds.length).toBeGreaterThan(0)
    expect(secondIds.filter((id) => firstIds.includes(id))).toHaveLength(0)
    expect(
      fresh.items.some((item) => firstIds.includes(item.paper.id)),
    )
      .toBe(true)
  })

  it("files bookmarked papers in the saved list and drops them on unsave", async () => {
    const dataDir = await mkdtemp(join(tmpdir(), "academitok-saved-"))
    directories.push(dataDir)
    vi.stubGlobal("fetch", () => Promise.reject(new Error("offline")))
    const target = curatedPapers[0]
    if (target === undefined) {
      throw new Error("missing curated paper fixture")
    }

    const [afterSave, afterUnsave, empty] = await runFeed(
      dataDir,
      Effect.gen(function*() {
        const repository = yield* ReaderStateRepository
        yield* repository.onboard({
          keptPaperIds: [],
          rejectedPaperIds: [],
          skipped: true,
        })
        yield* getPaperFeedSnapshot(requestFor("saved-a"))
        yield* repository.react({ paperId: target.id, kind: "bookmark" })
        const saved = yield* getSavedPapers
        yield* repository.react({ paperId: target.id, kind: "bookmark" })
        const unsaved = yield* getSavedPapers
        return [saved, unsaved, yield* getSavedPapers] as const
      }),
    )

    expect(afterSave.items.map((item) => item.paper.id)).toEqual([target.id])
    expect(afterSave.items[0]?.bookmarked).toBe(true)
    expect(afterUnsave.items).toHaveLength(0)
    expect(empty.items).toHaveLength(0)
  })

  it("resolves a permalink from the pool, the curated catalog, or nothing", async () => {
    const dataDir = await mkdtemp(join(tmpdir(), "academitok-permalink-"))
    directories.push(dataDir)
    vi.stubGlobal("fetch", () => Promise.reject(new Error("offline")))
    const curated = curatedPapers[0]
    if (curated === undefined) {
      throw new Error("missing curated paper fixture")
    }
    const pooled = { ...curated, id: "pooled-only", title: "Pooled Only" }

    const [known, fromPool, missing] = await runFeed(
      dataDir,
      Effect.gen(function*() {
        const repository = yield* ReaderStateRepository
        yield* repository.savePapers([pooled])
        return [
          yield* getPaperById(curated.id),
          yield* getPaperById(pooled.id),
          yield* getPaperById("missing-paper"),
        ] as const
      }),
    )

    expect(known?.title).toBe(curated.title)
    expect(fromPool?.title).toBe("Pooled Only")
    expect(missing).toBeNull()
  })

  it("toggles desk reactions but keeps open-site as an append-only signal", () => {
    const toggledOn = recordReaderReaction([], {
      paperId: "paper-1",
      kind: "like",
    })

    expect(toggledOn[0]).toMatchObject({
      paperId: "paper-1",
      kind: "like",
      active: true,
    })

    const toggledOff = recordReaderReaction(toggledOn, {
      paperId: "paper-1",
      kind: "like",
    })

    expect(toggledOff[0]).toMatchObject({
      paperId: "paper-1",
      kind: "like",
      active: false,
    })

    const toggledOnAgain = recordReaderReaction(toggledOff, {
      paperId: "paper-1",
      kind: "like",
    })

    expect(toggledOnAgain[0]).toMatchObject({
      paperId: "paper-1",
      kind: "like",
      active: true,
    })

    const openedOnce = recordReaderReaction([], {
      paperId: "paper-1",
      kind: "open-site",
    })
    const openedTwice = recordReaderReaction(openedOnce, {
      paperId: "paper-1",
      kind: "open-site",
    })

    expect(openedTwice[0]).toMatchObject({
      paperId: "paper-1",
      kind: "open-site",
      active: true,
    })
    expect(openedTwice[1]).toMatchObject({
      paperId: "paper-1",
      kind: "open-site",
      active: true,
    })

    const dwelled = recordReaderReaction([], {
      paperId: "paper-1",
      kind: "dwell",
      dwellMs: 12_000,
      position: 0,
      exploration: false,
    })
    expect(dwelled[0]).toMatchObject({ kind: "dwell", dwellMs: 12_000 })
  })
})
