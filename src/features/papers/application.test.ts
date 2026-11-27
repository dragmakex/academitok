// @vitest-environment node

import type { FeedRequest } from "@/api/paper-schema"
import { curatedPapers } from "@/data/papers"
import { ReaderStateRepository } from "@/db/reader-state-repository"
import {
  getPaperById,
  getPaperFeedSnapshot,
  getSavedBibtex,
  getSavedPapers,
} from "@/features/papers/application"
import { recordReaderReaction } from "@/features/papers/reactions"
import { defaultReaderId, ReaderId } from "@/lib/reader-id"
import * as ConfigProvider from "effect/ConfigProvider"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
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
  effect: Effect.Effect<A, never, ReaderStateRepository | ReaderId>,
) =>
  Effect.runPromise(
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
    ),
  )

const paperIds = (page: { items: ReadonlyArray<{ paper: { id: string } }> }) =>
  page.items.map((item) => item.paper.id)

const asReader = (readerId: string) =>
<A, E, R>(
  effect: Effect.Effect<A, E, ReaderId | R>,
): Effect.Effect<A, E, R> => Effect.provideService(effect, ReaderId, readerId)

afterEach(async () => {
  vi.unstubAllGlobals()
  await Promise.all(
    directories.splice(0).map((directory) =>
      rm(directory, { force: true, recursive: true })
    ),
  )
})

describe("papers application", () => {
  // The offline stub walks the source guard's retry ladder (1s + 2s) before the
  // fallback, so this test needs more than the default budget.
  it("does not persist the onboarding candidate page into the feed session", {
    timeout: 15_000,
  }, async () => {
    const dataDir = await mkdtemp(join(tmpdir(), "academitok-onboard-session-"))
    directories.push(dataDir)
    vi.stubGlobal("fetch", () => Promise.reject(new Error("offline")))

    const [candidates, firstEdition] = await runFeed(
      dataDir,
      Effect.gen(function*() {
        const repository = yield* ReaderStateRepository
        const candidates = yield* getPaperFeedSnapshot(
          requestFor("onboard-session"),
        )
        yield* repository.onboard({
          keptPaperIds: [],
          rejectedPaperIds: [],
          skipped: true,
        })
        return [
          candidates,
          yield* getPaperFeedSnapshot(requestFor("onboard-session")),
        ] as const
      }),
    )

    expect(paperIds(candidates).length).toBeGreaterThan(0)
    // The first edition is MMR-ordered and capped, so it must be a non-empty
    // subset of the onboarding candidates rather than the same sequence.
    expect(paperIds(firstEdition).length).toBeGreaterThan(0)
    expect(
      paperIds(firstEdition).every((id) => paperIds(candidates).includes(id)),
    )
      .toBe(true)
  })

  it("keeps a persisted feed session clean across a stale cursor", {
    timeout: 15_000,
  }, async () => {
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

    const firstIds = paperIds(first)
    const secondIds = paperIds(second)

    expect(firstIds.length).toBeGreaterThan(0)
    expect(secondIds.filter((id) => firstIds.includes(id))).toHaveLength(0)
    expect(
      fresh.items.some((item) => firstIds.includes(item.paper.id)),
    )
      .toBe(true)
  })

  it("keeps two readers' feed sessions apart under one session id", {
    timeout: 20_000,
  }, async () => {
    const dataDir = await mkdtemp(join(tmpdir(), "academitok-reader-feed-"))
    directories.push(dataDir)
    vi.stubGlobal("fetch", () => Promise.reject(new Error("offline")))
    const readerA = "0f8c7f4e-1c3e-4f22-9a1a-9b4b1c0a1d11"
    const readerB = "7b2c9d10-4a55-4f8e-8c1f-2d6e3a5b7c99"

    const pages = await runFeed(
      dataDir,
      Effect.gen(function*() {
        const repository = yield* ReaderStateRepository
        const onboard = repository.onboard({
          keptPaperIds: [],
          rejectedPaperIds: [],
          skipped: true,
        })
        const readAs = (readerId: string) =>
          asReader(readerId)(getPaperFeedSnapshot(requestFor("shared")))

        yield* asReader(readerA)(onboard)
        yield* asReader(readerB)(onboard)

        return {
          firstA: yield* readAs(readerA),
          secondA: yield* readAs(readerA),
          firstB: yield* readAs(readerB),
        }
      }),
    )

    expect(paperIds(pages.firstA).length).toBeGreaterThan(0)
    expect(
      paperIds(pages.secondA).filter((id) =>
        paperIds(pages.firstA).includes(id)
      ),
    )
      .toHaveLength(0)
    expect(
      paperIds(pages.firstB).some((id) => paperIds(pages.firstA).includes(id)),
    )
      .toBe(true)
  })

  it("drops a paper read inside the repeat window from the next page", {
    timeout: 20_000,
  }, async () => {
    const dataDir = await mkdtemp(join(tmpdir(), "academitok-repeat-window-"))
    directories.push(dataDir)
    vi.stubGlobal("fetch", () => Promise.reject(new Error("offline")))

    const [before, after, target] = await runFeed(
      dataDir,
      Effect.gen(function*() {
        const repository = yield* ReaderStateRepository
        yield* repository.onboard({
          keptPaperIds: [],
          rejectedPaperIds: [],
          skipped: true,
        })
        const first = yield* getPaperFeedSnapshot(requestFor("repeat-a"))
        const viewed = first.items.at(-1)
        if (viewed === undefined) {
          throw new Error("missing first page")
        }
        yield* repository.track({
          paperId: viewed.paper.id,
          position: first.items.length - 1,
          exploration: false,
          kind: "view",
          dwellMs: 0,
        })
        return [
          first,
          yield* getPaperFeedSnapshot(requestFor("repeat-b")),
          viewed,
        ] as const
      }),
    )

    const beforeIds = paperIds(before)
    expect(beforeIds).toContain(target.paper.id)
    expect(paperIds(after)).not.toContain(target.paper.id)
    expect(
      paperIds(after).some((id) =>
        id !== target.paper.id && beforeIds.includes(id)
      ),
    )
      .toBe(true)
  })

  it(
    "serves a pinned edition in page order without ranking or a session write",
    {
      timeout: 15_000,
    },
    async () => {
      const dataDir = await mkdtemp(join(tmpdir(), "academitok-edition-pin-"))
      directories.push(dataDir)
      vi.stubGlobal("fetch", () => Promise.reject(new Error("offline")))
      const ids = curatedPapers.slice(0, 3).map((paper) => paper.id)

      const [pinned, sessionSeen] = await runFeed(
        dataDir,
        Effect.gen(function*() {
          const repository = yield* ReaderStateRepository
          yield* repository.onboard({
            keptPaperIds: [],
            rejectedPaperIds: [],
            skipped: true,
          })
          const page = yield* getPaperFeedSnapshot({
            query: { topic: "All", sort: "recommended" },
            cursor: null,
            sessionId: "edition-a",
            edition: [...ids, "missing-paper"],
          })
          return [
            page,
            yield* repository.loadFeedSession("edition-a"),
          ] as const
        }),
      )

      expect(paperIds(pinned)).toEqual(ids)
      expect(pinned.pinned).toBe(true)
      expect(pinned.nextCursor).toBeNull()
      expect(pinned.items.every((item) => item.exploration === false)).toBe(
        true,
      )
      expect(sessionSeen).toHaveLength(0)
    },
  )

  it("serves a skipped reader's cold start as all exploration", async () => {
    const dataDir = await mkdtemp(join(tmpdir(), "academitok-exploration-"))
    directories.push(dataDir)
    vi.stubGlobal("fetch", () => Promise.reject(new Error("offline")))

    const snapshot = await runFeed(
      dataDir,
      Effect.gen(function*() {
        const repository = yield* ReaderStateRepository
        yield* repository.onboard({
          keptPaperIds: [],
          rejectedPaperIds: [],
          skipped: true,
        })
        return yield* getPaperFeedSnapshot(requestFor("exploration-share"))
      }),
    )

    expect(snapshot.items.length).toBeGreaterThan(0)
    expect(snapshot.exploration).toBe(snapshot.items.length)
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

    expect(paperIds(afterSave)).toEqual([target.id])
    expect(afterSave.items[0]?.bookmarked).toBe(true)
    expect(afterUnsave.items).toHaveLength(0)
    expect(empty.items).toHaveLength(0)
  })

  it("exports the saved set as stable BibTeX", async () => {
    const dataDir = await mkdtemp(join(tmpdir(), "academitok-bibtex-"))
    directories.push(dataDir)
    vi.stubGlobal("fetch", () => Promise.reject(new Error("offline")))
    const targets = curatedPapers.slice(0, 3)

    const [first, second] = await runFeed(
      dataDir,
      Effect.gen(function*() {
        const repository = yield* ReaderStateRepository
        yield* repository.onboard({
          keptPaperIds: [],
          rejectedPaperIds: [],
          skipped: true,
        })
        yield* getPaperFeedSnapshot(requestFor("bibtex-a"))
        for (const paper of targets) {
          yield* repository.react({ paperId: paper.id, kind: "bookmark" })
        }
        return [yield* getSavedBibtex, yield* getSavedBibtex] as const
      }),
    )

    expect(first.split("\n\n")).toHaveLength(3)
    expect(second).toBe(first)
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
