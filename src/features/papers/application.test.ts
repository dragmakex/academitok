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

  it("reports the reader's median dwell on the feed snapshot", {
    timeout: 15_000,
  }, async () => {
    const dataDir = await mkdtemp(join(tmpdir(), "academitok-median-dwell-"))
    directories.push(dataDir)
    vi.stubGlobal("fetch", () => Promise.reject(new Error("offline")))

    const [empty, recorded] = await runFeed(
      dataDir,
      Effect.gen(function*() {
        const repository = yield* ReaderStateRepository
        yield* repository.onboard({
          keptPaperIds: [],
          rejectedPaperIds: [],
          skipped: true,
        })
        const before = yield* getPaperFeedSnapshot(requestFor("dwell-a"))
        for (const [index, dwellMs] of [4_000, 6_000, 20_000].entries()) {
          const input = {
            paperId: `dwell-${index}`,
            position: index,
            exploration: false,
          }
          yield* repository.track({ ...input, kind: "view", dwellMs: 0 })
          yield* repository.track({ ...input, kind: "dwell", dwellMs })
        }
        return [
          before,
          yield* getPaperFeedSnapshot(requestFor("dwell-b")),
        ] as const
      }),
    )

    expect(empty.stats.medianDwellMs).toBeNull()
    expect(recorded.stats.medianDwellMs).toBe(6_000)
  })

  it("reports the reader's median reading completion on the feed snapshot", {
    timeout: 15_000,
  }, async () => {
    const dataDir = await mkdtemp(
      join(tmpdir(), "academitok-median-completion-"),
    )
    directories.push(dataDir)
    vi.stubGlobal("fetch", () => Promise.reject(new Error("offline")))
    const [first, second] = curatedPapers
    if (first === undefined || second === undefined) {
      throw new Error("missing curated paper fixture")
    }

    const [empty, recorded] = await runFeed(
      dataDir,
      Effect.gen(function*() {
        const repository = yield* ReaderStateRepository
        yield* repository.onboard({
          keptPaperIds: [],
          rejectedPaperIds: [],
          skipped: true,
        })
        const before = yield* getPaperFeedSnapshot(requestFor("completion-a"))
        // Half the estimated reading time on both clippings; the third is absent
        // from the loaded catalog, so it is dropped rather than counted as 0.
        for (const paper of [first, second]) {
          yield* repository.track({
            paperId: paper.id,
            position: 0,
            exploration: false,
            kind: "dwell",
            dwellMs: paper.readMinutes * 30_000,
          })
        }
        yield* repository.track({
          paperId: "absent-from-catalog",
          position: 0,
          exploration: false,
          kind: "dwell",
          dwellMs: 60_000,
        })
        return [
          before,
          yield* getPaperFeedSnapshot(requestFor("completion-b")),
        ] as const
      }),
    )

    expect(empty.stats.medianCompletion).toBeNull()
    expect(recorded.stats.medianCompletion).toBe(0.5)
  })

  it("reports the reader's hide and open-source rates on the feed snapshot", {
    timeout: 15_000,
  }, async () => {
    const dataDir = await mkdtemp(join(tmpdir(), "academitok-reaction-rates-"))
    directories.push(dataDir)
    vi.stubGlobal("fetch", () => Promise.reject(new Error("offline")))
    const target = curatedPapers[0]
    if (target === undefined) {
      throw new Error("missing curated paper fixture")
    }

    const [empty, recorded] = await runFeed(
      dataDir,
      Effect.gen(function*() {
        const repository = yield* ReaderStateRepository
        yield* repository.onboard({
          keptPaperIds: [],
          rejectedPaperIds: [],
          skipped: true,
        })
        const before = yield* getPaperFeedSnapshot(requestFor("rates-a"))
        for (let index = 0; index < 50; index += 1) {
          yield* repository.track({
            paperId: target.id,
            position: index,
            exploration: false,
            kind: "view",
            dwellMs: 0,
          })
        }
        yield* repository.react({ paperId: target.id, kind: "hide" })
        for (let index = 0; index < 6; index += 1) {
          yield* repository.react({ paperId: target.id, kind: "open-site" })
        }
        return [
          before,
          yield* getPaperFeedSnapshot(requestFor("rates-b")),
        ] as const
      }),
    )

    expect(empty.stats.hideRate).toBeNull()
    expect(empty.stats.openSourceRate).toBeNull()
    expect(empty.stats.savesPerHundred).toBeNull()
    expect(recorded.stats.hideRate).toBeCloseTo(0.02, 5)
    expect(recorded.stats.openSourceRate).toBeCloseTo(0.12, 5)
  })

  it(
    "reports the reader's saves per hundred impressions on the feed snapshot",
    {
      timeout: 15_000,
    },
    async () => {
      const dataDir = await mkdtemp(join(tmpdir(), "academitok-saves-rate-"))
      directories.push(dataDir)
      vi.stubGlobal("fetch", () => Promise.reject(new Error("offline")))
      const target = curatedPapers[0]
      const second = curatedPapers[1]
      if (target === undefined || second === undefined) {
        throw new Error("missing curated paper fixture")
      }

      const [empty, unsaved, saved] = await runFeed(
        dataDir,
        Effect.gen(function*() {
          const repository = yield* ReaderStateRepository
          yield* repository.onboard({
            keptPaperIds: [],
            rejectedPaperIds: [],
            skipped: true,
          })
          const before = yield* getPaperFeedSnapshot(requestFor("saves-a"))
          for (let index = 0; index < 50; index += 1) {
            yield* repository.track({
              paperId: target.id,
              position: index,
              exploration: false,
              kind: "view",
              dwellMs: 0,
            })
          }
          const viewed = yield* getPaperFeedSnapshot(requestFor("saves-b"))
          yield* repository.react({ paperId: target.id, kind: "bookmark" })
          yield* repository.react({ paperId: second.id, kind: "bookmark" })
          return [
            before,
            viewed,
            yield* getPaperFeedSnapshot(requestFor("saves-c")),
          ] as const
        }),
      )

      expect(empty.stats.savesPerHundred).toBeNull()
      expect(unsaved.stats.savesPerHundred).toBe(0)
      expect(saved.stats.savesPerHundred).toBeCloseTo(4, 5)
    },
  )

  it(
    "reports the duplicate rate over the reader's last 50 impressions",
    {
      timeout: 15_000,
    },
    async () => {
      const dataDir = await mkdtemp(
        join(tmpdir(), "academitok-duplicate-rate-"),
      )
      directories.push(dataDir)
      vi.stubGlobal("fetch", () => Promise.reject(new Error("offline")))
      const distinct = Array<number>(48)
        .fill(0)
        .map((_, index) => `viewed-paper-${index}`)

      const [empty, repeated, displaced] = await runFeed(
        dataDir,
        Effect.gen(function*() {
          const repository = yield* ReaderStateRepository
          yield* repository.onboard({
            keptPaperIds: [],
            rejectedPaperIds: [],
            skipped: true,
          })
          const before = yield* getPaperFeedSnapshot(
            requestFor("duplicates-a"),
          )
          const viewed = [...distinct, distinct[0], distinct[1]]
          for (const [position, paperId] of viewed.entries()) {
            yield* repository.track({
              paperId: paperId ?? "",
              position,
              exploration: false,
              kind: "view",
              dwellMs: 0,
            })
          }
          const windowed = yield* getPaperFeedSnapshot(
            requestFor("duplicates-b"),
          )
          // Fifty newer distinct impressions push the repeats out of the window.
          for (let index = 0; index < 50; index += 1) {
            yield* repository.track({
              paperId: `newer-paper-${index}`,
              position: index,
              exploration: false,
              kind: "view",
              dwellMs: 0,
            })
          }
          return [
            before,
            windowed,
            yield* getPaperFeedSnapshot(requestFor("duplicates-c")),
          ] as const
        }),
      )

      expect(empty.stats.windowDuplicateRate).toBeNull()
      expect(repeated.stats.windowDuplicateRate).toBeCloseTo(0.04, 5)
      expect(displaced.stats.windowDuplicateRate).toBe(0)
    },
  )

  it(
    "reports topic entropy over the reader's last 50 impressions",
    {
      timeout: 15_000,
    },
    async () => {
      const dataDir = await mkdtemp(
        join(tmpdir(), "academitok-window-entropy-"),
      )
      directories.push(dataDir)
      vi.stubGlobal("fetch", () => Promise.reject(new Error("offline")))
      const [ai, biology, climate] = curatedPapers
      if (ai === undefined || biology === undefined || climate === undefined) {
        throw new Error("missing curated paper fixture")
      }

      const [empty, spread, single] = await runFeed(
        dataDir,
        Effect.gen(function*() {
          const repository = yield* ReaderStateRepository
          yield* repository.onboard({
            keptPaperIds: [],
            rejectedPaperIds: [],
            skipped: true,
          })
          const before = yield* getPaperFeedSnapshot(requestFor("entropy-a"))
          for (const [position, paper] of [ai, biology, climate].entries()) {
            yield* repository.track({
              paperId: paper.id,
              position,
              exploration: false,
              kind: "view",
              dwellMs: 0,
            })
          }
          const mixed = yield* getPaperFeedSnapshot(requestFor("entropy-b"))
          // Fifty newer impressions push the mixed three out of the §8.4 window.
          for (let index = 0; index < 50; index += 1) {
            yield* repository.track({
              paperId: ai.id,
              position: index,
              exploration: false,
              kind: "view",
              dwellMs: 0,
            })
          }
          return [
            before,
            mixed,
            yield* getPaperFeedSnapshot(requestFor("entropy-c")),
          ] as const
        }),
      )

      expect(empty.stats.windowTopicEntropy).toBeNull()
      expect(empty.stats.windowMedianYear).toBeNull()
      expect(spread.stats.windowTopicEntropy).toBeCloseTo(Math.log(3))
      expect(single.stats.windowTopicEntropy).toBe(0)
    },
  )

  it(
    "reports the median year over the reader's last 50 impressions",
    {
      timeout: 15_000,
    },
    async () => {
      const dataDir = await mkdtemp(
        join(tmpdir(), "academitok-window-year-"),
      )
      directories.push(dataDir)
      vi.stubGlobal("fetch", () => Promise.reject(new Error("offline")))
      const windowed = [
        "hal-2022-open-science-collaboration-markets",
        "arxiv-2023-quantum-sensor-compression",
        "biorxiv-2024-fast-protein-folding-signals",
        "arxiv-2501-attention-maps-science-agents",
      ]
        .map((id) => {
          const paper = curatedPapers.find((candidate) => candidate.id === id)
          if (paper === undefined) {
            throw new Error(`missing curated paper fixture ${id}`)
          }
          return paper
        })
      const newest = windowed[3]
      if (newest === undefined) {
        throw new Error("missing curated paper fixture")
      }

      const [empty, odd, even, displaced] = await runFeed(
        dataDir,
        Effect.gen(function*() {
          const repository = yield* ReaderStateRepository
          yield* repository.onboard({
            keptPaperIds: [],
            rejectedPaperIds: [],
            skipped: true,
          })
          const before = yield* getPaperFeedSnapshot(requestFor("year-a"))
          for (const [position, paper] of windowed.slice(0, 3).entries()) {
            yield* repository.track({
              paperId: paper.id,
              position,
              exploration: false,
              kind: "view",
              dwellMs: 0,
            })
          }
          const threeYears = yield* getPaperFeedSnapshot(
            requestFor("year-b"),
          )
          yield* repository.track({
            paperId: newest.id,
            position: 3,
            exploration: false,
            kind: "view",
            dwellMs: 0,
          })
          const fourYears = yield* getPaperFeedSnapshot(requestFor("year-c"))
          // Fifty newer impressions push the mixed years out of the §8.4 window.
          for (let index = 0; index < 50; index += 1) {
            yield* repository.track({
              paperId: newest.id,
              position: index,
              exploration: false,
              kind: "view",
              dwellMs: 0,
            })
          }
          return [
            before,
            threeYears,
            fourYears,
            yield* getPaperFeedSnapshot(requestFor("year-d")),
          ] as const
        }),
      )

      expect(empty.stats.windowMedianYear).toBeNull()
      expect(odd.stats.windowMedianYear).toBe(2023)
      expect(even.stats.windowMedianYear).toBe(2023.5)
      expect(displaced.stats.windowMedianYear).toBe(newest.year)
    },
  )

  it("reports no windowed entropy for impressions absent from the catalog", async () => {
    const dataDir = await mkdtemp(
      join(tmpdir(), "academitok-window-entropy-none-"),
    )
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
        yield* repository.track({
          paperId: "absent-from-catalog",
          position: 0,
          exploration: false,
          kind: "view",
          dwellMs: 0,
        })
        return yield* getPaperFeedSnapshot(requestFor("entropy-absent"))
      }),
    )

    expect(snapshot.stats.windowTopicEntropy).toBeNull()
    expect(snapshot.stats.windowMedianYear).toBeNull()
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
