// @vitest-environment node

import type { FeedRequest } from "@/api/paper-schema"
import { curatedPapers } from "@/data/papers"
import { ReaderStateRepository } from "@/db/reader-state-repository"
import { PaperSlide } from "@/design-system/components/PaperSlide"
import { getPaperFeedSnapshot } from "@/features/papers/application"
import { defaultReaderId, ReaderId } from "@/lib/reader-id"
import * as ConfigProvider from "effect/ConfigProvider"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { renderToStaticMarkup } from "react-dom/server"
import { afterEach, describe, expect, it, vi } from "vitest"

const directories: Array<string> = []

const requestFor = (sessionId: string): FeedRequest => ({
  query: { topic: "All", sort: "recommended" },
  cursor: null,
  sessionId,
})

const runFeed = <A,>(
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

const crashDirectory = async (prefix: string) => {
  const dataDir = await mkdtemp(join(tmpdir(), prefix))
  directories.push(dataDir)
  return dataDir
}

const actions = {
  onLike: () => {},
  onBookmark: () => {},
  onHide: () => {},
  onOpenSite: () => {},
  onPrevious: () => {},
  onNext: () => {},
}

const renderDeckSlide = (origin: "pool" | "live" | "seed") =>
  renderToStaticMarkup(
    <PaperSlide
      id="paper-1"
      title="Transparent Scientific Discovery"
      authors="Ada Lovelace"
      venue="Journal of Useful Results"
      year={2026}
      abstract="A real abstract supplied by the metadata source."
      accessLabel="Open access"
      siteLabel="OpenAlex"
      citations={42}
      readMinutes={6}
      rationale={["Matches AI"]}
      topics={["AI"]}
      liked={false}
      bookmarked={false}
      externalUrl="https://example.com/paper"
      actions={actions}
      origin={origin}
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

describe("edition origin", () => {
  it("names the frozen seed file as the offline edition", async () => {
    const dataDir = await crashDirectory("academitok-origin-seed-")
    vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new Error("offline"))))

    const page = await runFeed(
      dataDir,
      Effect.gen(function*() {
        const repository = yield* ReaderStateRepository
        yield* repository.onboard({
          keptPaperIds: [],
          rejectedPaperIds: [],
          skipped: true,
        })
        return yield* getPaperFeedSnapshot(requestFor("seed-a"))
      }),
    )

    expect(page.origin).toBe("seed")
    const seedIds = new Set(curatedPapers.map((paper) => paper.id))
    expect(page.items.length).toBeGreaterThan(0)
    expect(page.items.every((item) => seedIds.has(item.paper.id))).toBe(true)
  }, 20_000)

  it("prints the offline edition strip for seed clippings only", () => {
    expect(renderDeckSlide("seed")).toContain("Offline Edition · No. 002")
    expect(renderDeckSlide("pool")).toContain("Evening Edition · No. 002")
    expect(renderDeckSlide("live")).toContain("Evening Edition · No. 002")
  })
})
