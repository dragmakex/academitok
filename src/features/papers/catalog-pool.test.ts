// @vitest-environment node

import type { FeedRequest } from "@/api/paper-schema"
import { curatedPapers } from "@/data/papers"
import { ReaderStateRepository } from "@/db/reader-state-repository"
import { getPaperFeedSnapshot } from "@/features/papers/application"
import { defaultReaderId, ReaderId } from "@/lib/reader-id"
import * as EffectArray from "effect/Array"
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

const onboard = Effect.gen(function*() {
  const repository = yield* ReaderStateRepository
  yield* repository.onboard({
    keptPaperIds: [],
    rejectedPaperIds: [],
    skipped: true,
  })
})

const upstreamResponse = (count: number) =>
  new Response(
    JSON.stringify({
      results: EffectArray.makeBy(count, (index) => ({
        id: `https://openalex.org/W${index}`,
        title: `Upstream paper ${index}`,
        publication_year: 2024,
        abstract_inverted_index: { abstract: [0], text: [1] },
        cited_by_count: index,
        open_access: { is_oa: true },
        primary_location: {
          landing_page_url: `https://example.com/paper-${index}`,
        },
      })),
    }),
    { headers: { "content-type": "application/json" } },
  )

afterEach(async () => {
  vi.unstubAllGlobals()
  await Promise.all(
    directories.splice(0).map((directory) =>
      rm(directory, { force: true, recursive: true })
    ),
  )
})

describe("catalog pool", () => {
  it("refreshes a pool thinner than three pages", async () => {
    const dataDir = await mkdtemp(join(tmpdir(), "academitok-pool-thin-"))
    directories.push(dataDir)
    const base = curatedPapers[0]
    if (base === undefined) {
      throw new Error("missing curated paper fixture")
    }
    const thin = EffectArray.makeBy(29, (index) => ({
      ...base,
      id: `thin-${index}`,
    }))
    const fetchStub = vi.fn(() => Promise.resolve(upstreamResponse(16)))
    vi.stubGlobal("fetch", fetchStub)

    const page = await runFeed(
      dataDir,
      Effect.gen(function*() {
        yield* onboard
        const repository = yield* ReaderStateRepository
        yield* repository.savePapers(thin)
        return yield* getPaperFeedSnapshot(requestFor("thin-a"))
      }),
    )

    expect(fetchStub).toHaveBeenCalledTimes(1)
    expect(
      page.items.some((item) =>
        item.paper.id.startsWith("https://openalex.org/")
      ),
    )
      .toBe(true)
  })

  it("serves a pool of three pages without touching the source", async () => {
    const dataDir = await mkdtemp(join(tmpdir(), "academitok-pool-fresh-"))
    directories.push(dataDir)
    const base = curatedPapers[0]
    if (base === undefined) {
      throw new Error("missing curated paper fixture")
    }
    const pool = EffectArray.makeBy(30, (index) => ({
      ...base,
      id: `pool-${index}`,
    }))
    const fetchStub = vi.fn(() => Promise.resolve(upstreamResponse(16)))
    vi.stubGlobal("fetch", fetchStub)

    const page = await runFeed(
      dataDir,
      Effect.gen(function*() {
        yield* onboard
        const repository = yield* ReaderStateRepository
        yield* repository.savePapers(pool)
        return yield* getPaperFeedSnapshot(requestFor("pool-a"))
      }),
    )

    expect(fetchStub).not.toHaveBeenCalled()
    expect(page.items.length).toBeGreaterThan(0)
    expect(
      page.items.every((item) => item.paper.id.startsWith("pool-")),
    )
      .toBe(true)
  })
})
