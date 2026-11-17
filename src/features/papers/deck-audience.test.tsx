// @vitest-environment node

import type { FeedRequest } from "@/api/paper-schema"
import { ReaderStateRepository } from "@/db/reader-state-repository"
import { PaperSlide } from "@/design-system/components/PaperSlide"
import { getPaperFeedSnapshot } from "@/features/papers/application"
import { ReaderId } from "@/lib/reader-id"
import * as ConfigProvider from "effect/ConfigProvider"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { renderToStaticMarkup } from "react-dom/server"
import { afterEach, describe, expect, it, vi } from "vitest"

const directories: Array<string> = []

const readerA = "0f8c7f4e-1c3e-4f22-9a1a-9b4b1c0a1d11"
const readerB = "7b2c9d10-4a55-4f8e-8c1f-2d6e3a5b7c99"
const readerC = "9d4e5f60-7b88-4c99-8d1e-3f2a4b5c6d77"

const runAs = <A,>(
  dataDir: string,
  readerId: string,
  effect: Effect.Effect<A, never, ReaderStateRepository | ReaderId>,
) =>
  Effect.runPromise(
    effect.pipe(
      Effect.provide([
        ReaderStateRepository.layer,
        Layer.succeed(ReaderId, readerId),
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

const crashDirectory = async (prefix: string) => {
  const dataDir = await mkdtemp(join(tmpdir(), prefix))
  directories.push(dataDir)
  return dataDir
}

const file = (paperId: string) =>
  Effect.gen(function*() {
    const repository = yield* ReaderStateRepository
    yield* repository.react({ paperId, kind: "bookmark" })
  })

const like = (paperId: string) =>
  Effect.gen(function*() {
    const repository = yield* ReaderStateRepository
    yield* repository.react({ paperId, kind: "like" })
  })

const requestFor = (sessionId: string): FeedRequest => ({
  query: { topic: "All", sort: "recommended" },
  cursor: null,
  sessionId,
})

const actions = {
  onLike: () => {},
  onBookmark: () => {},
  onHide: () => {},
  onOpenSite: () => {},
  onPrevious: () => {},
  onNext: () => {},
}

const renderDeck = (
  alsoKeptBy: number | undefined,
  alsoLikedBy: number | undefined,
) =>
  renderToStaticMarkup(
    <PaperSlide
      id="paper-1"
      title="Notes on the Analytical Engine"
      authors="Ada Lovelace"
      venue="Scientific Memoirs"
      year={1843}
      abstract="A kept abstract supplied by the metadata source."
      accessLabel="Open access"
      siteLabel="OpenAlex"
      citations={9}
      readMinutes={3}
      rationale={["Matches AI"]}
      topics={["AI"]}
      liked={false}
      bookmarked={false}
      externalUrl="https://example.com/notes"
      actions={actions}
      origin="pool"
      pinned={false}
      alsoKeptBy={alsoKeptBy}
      alsoLikedBy={alsoLikedBy}
      again={false}
      position={2}
      total={10}
      skeleton={false}
    />,
  )

afterEach(async () => {
  vi.unstubAllGlobals()
  await Promise.all(
    directories.splice(0).map((directory) =>
      rm(directory, { force: true, recursive: true })
    ),
  )
})

describe("deck audience", () => {
  it("reports other readers' filings on the served page", async () => {
    const dataDir = await crashDirectory("academitok-deck-audience-")
    vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new Error("offline"))))

    const page = await runAs(
      dataDir,
      readerA,
      Effect.gen(function*() {
        const repository = yield* ReaderStateRepository
        yield* repository.onboard({
          keptPaperIds: [],
          rejectedPaperIds: [],
          skipped: true,
        })
        return yield* getPaperFeedSnapshot(requestFor("deck-audience-a"))
      }),
    )
    const paperId = page.items[0]?.paper.id
    if (paperId === undefined) {
      throw new Error("empty feed fixture")
    }

    await runAs(dataDir, readerB, file(paperId))
    await runAs(dataDir, readerC, file(paperId))
    const shared = await runAs(
      dataDir,
      readerA,
      getPaperFeedSnapshot(requestFor("deck-audience-b")),
    )

    expect(shared.alsoKeptBy[paperId]).toBe(2)

    // Reader B undoes their filing; the count drops back to one.
    await runAs(dataDir, readerB, file(paperId))
    const undone = await runAs(
      dataDir,
      readerA,
      getPaperFeedSnapshot(requestFor("deck-audience-c")),
    )

    expect(undone.alsoKeptBy[paperId]).toBe(1)
  }, 30_000)

  it("reports other readers' likes on the served page", async () => {
    const dataDir = await crashDirectory("academitok-deck-likes-")
    vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new Error("offline"))))

    const page = await runAs(
      dataDir,
      readerA,
      Effect.gen(function*() {
        const repository = yield* ReaderStateRepository
        yield* repository.onboard({
          keptPaperIds: [],
          rejectedPaperIds: [],
          skipped: true,
        })
        return yield* getPaperFeedSnapshot(requestFor("deck-likes-a"))
      }),
    )
    const paperId = page.items[0]?.paper.id
    if (paperId === undefined) {
      throw new Error("empty feed fixture")
    }

    // Reader A's own like is not counted, and a filing is not a like.
    await runAs(dataDir, readerA, Effect.all([like(paperId), file(paperId)]))
    await runAs(dataDir, readerB, like(paperId))
    await runAs(dataDir, readerC, file(paperId))
    await runAs(dataDir, readerC, like(paperId))
    const shared = await runAs(
      dataDir,
      readerA,
      getPaperFeedSnapshot(requestFor("deck-likes-b")),
    )

    expect(shared.alsoLikedBy[paperId]).toBe(2)

    // Reader B undoes their like; the count drops back to one.
    await runAs(dataDir, readerB, like(paperId))
    const undone = await runAs(
      dataDir,
      readerA,
      getPaperFeedSnapshot(requestFor("deck-likes-c")),
    )

    expect(undone.alsoLikedBy[paperId]).toBe(1)
  }, 30_000)
})

describe("deck clipping audience line", () => {
  it("prints how many other readers keep the clipping", () => {
    expect(renderDeck(2, undefined)).toContain("Also kept by 2 readers")
    expect(renderDeck(1, undefined)).toContain("Also kept by 1 reader")
  })

  it("omits the clause when nobody else filed it", () => {
    expect(renderDeck(0, undefined)).not.toContain("Also kept by")
    expect(renderDeck(undefined, undefined)).not.toContain("Also kept by")
  })

  it("prints how many other readers liked the clipping", () => {
    expect(renderDeck(undefined, 2)).toContain("Also liked by 2 readers")
    expect(renderDeck(undefined, 1)).toContain("Also liked by 1 reader")
    expect(renderDeck(2, 4)).toContain("Also liked by 4 readers")
  })

  it("omits the like clause when nobody else liked it", () => {
    expect(renderDeck(2, 0)).not.toContain("Also liked by")
    expect(renderDeck(2, undefined)).not.toContain("Also liked by")
  })
})
