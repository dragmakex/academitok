// @vitest-environment node

import { ReaderStateRepository } from "@/db/reader-state-repository"
import { PaperSlide } from "@/design-system/components/PaperSlide"
import { getSavedAudience } from "@/features/papers/application"
import { ReaderId } from "@/lib/reader-id"
import * as ConfigProvider from "effect/ConfigProvider"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { renderToStaticMarkup } from "react-dom/server"
import { afterEach, describe, expect, it } from "vitest"

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

afterEach(async () => {
  await Promise.all(
    directories.splice(0).map((directory) =>
      rm(directory, { force: true, recursive: true })
    ),
  )
})

const file = (paperId: string) =>
  Effect.gen(function*() {
    const repository = yield* ReaderStateRepository
    yield* repository.react({ paperId, kind: "bookmark" })
  })

const renderCompact = (filedByOthers: number | undefined) =>
  renderToStaticMarkup(
    <PaperSlide
      variant="compact"
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
      topics={["AI"]}
      externalUrl="https://example.com/notes"
      filedByOthers={filedByOthers}
      onUnsave={() => {}}
    />,
  )

describe("saved audience", () => {
  it("counts other readers' live filings and drops the reader's own", async () => {
    const dataDir = await crashDirectory("academitok-morgue-audience-")

    await runAs(dataDir, readerA, file("paper-1"))
    const ownOnly = await runAs(
      dataDir,
      readerA,
      Effect.gen(function*() {
        const repository = yield* ReaderStateRepository
        return yield* repository.filedByOthers(["paper-1"], readerA)
      }),
    )

    // Reader B files paper-2 and undoes it before anyone can count it.
    await runAs(dataDir, readerB, file("paper-2"))
    await runAs(dataDir, readerB, file("paper-2"))
    await runAs(dataDir, readerB, file("paper-1"))
    await runAs(dataDir, readerC, file("paper-1"))

    const tally = await runAs(
      dataDir,
      readerA,
      Effect.gen(function*() {
        const repository = yield* ReaderStateRepository
        return {
          counts: yield* repository.filedByOthers(
            ["paper-1", "paper-2", "paper-3"],
            readerA,
          ),
          none: yield* repository.filedByOthers([], readerA),
        }
      }),
    )

    expect(ownOnly).toEqual({})
    expect(tally.counts).toEqual({ "paper-1": 2 })
    expect(tally.none).toEqual({})
  })

  it("reports the audience of the reader's own saved set", async () => {
    const dataDir = await crashDirectory("academitok-morgue-set-")

    await runAs(dataDir, readerA, file("paper-1"))
    await runAs(dataDir, readerB, file("paper-1"))
    await runAs(dataDir, readerC, file("paper-1"))
    await runAs(dataDir, readerB, file("paper-9"))

    const audience = await runAs(dataDir, readerA, getSavedAudience)
    const otherReader = await runAs(dataDir, readerB, getSavedAudience)

    expect(audience).toEqual({ "paper-1": 2 })
    // Reader B keeps paper-9 alone, so that id is absent from its record.
    expect(otherReader).toEqual({ "paper-1": 2 })
  })
})

describe("compact clipping audience line", () => {
  it("prints how many other readers keep the clipping", () => {
    expect(renderCompact(2)).toContain("Also saved by 2 readers")
    expect(renderCompact(1)).toContain("Also saved by 1 reader")
  })

  it("omits the clause when nobody else filed it", () => {
    expect(renderCompact(0)).not.toContain("Also saved by")
    expect(renderCompact(undefined)).not.toContain("Also saved by")
  })
})
