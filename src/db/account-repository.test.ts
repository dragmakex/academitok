// @vitest-environment node

import { makeAccountsRepository } from "@/db/account-repository"
import { ReaderStateRepository } from "@/db/reader-state-repository"
import { magicLinkTtlMs, newLinkToken, tokenHash } from "@/lib/magic-link"
import { ReaderId } from "@/lib/reader-id"
import * as ConfigProvider from "effect/ConfigProvider"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, describe, expect, it } from "vitest"

const directories: Array<string> = []

const temporaryDirectory = async () => {
  const directory = await mkdtemp(join(tmpdir(), "academitok-accounts-"))
  directories.push(directory)
  return directory
}

afterEach(async () => {
  await Promise.all(
    directories.splice(0).map((directory) =>
      rm(directory, { force: true, recursive: true })
    ),
  )
})

const runAs = <A>(
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

const accounts = Effect.gen(function*() {
  const repository = yield* ReaderStateRepository
  return repository.accounts
})

const canonicalReader = "reader-canonical-0001"
const secondReader = "reader-second-00000002"
const email = "reader@example.edu"

const requestLink = (
  dataDir: string,
  readerId: string,
  options: { now?: Date; email?: string } = {},
) =>
  Effect
    .gen(function*() {
      const store = yield* accounts
      const now = options.now ?? new Date()
      const token = newLinkToken()
      const recorded = yield* Effect.promise(() =>
        store.requestLink({
          email: options.email ?? email,
          readerId,
          tokenHash: tokenHash(token),
          now,
          expiresAt: new Date(now.getTime() + magicLinkTtlMs),
        })
      )
      return { recorded, token, now }
    })
    .pipe((effect) => runAs(dataDir, readerId, effect))

const consume = (
  dataDir: string,
  readerId: string,
  token: string,
  now?: Date,
) =>
  Effect
    .gen(function*() {
      const store = yield* accounts
      return yield* Effect.promise(() =>
        store.consumeLink({
          tokenHash: tokenHash(token),
          readerId,
          now: now ?? new Date(),
        })
      )
    })
    .pipe((effect) => runAs(dataDir, readerId, effect))

const session = (dataDir: string, readerId: string) =>
  Effect
    .gen(function*() {
      const store = yield* accounts
      return yield* Effect.promise(() => store.session(readerId))
    })
    .pipe((effect) => runAs(dataDir, readerId, effect))

const react = (
  dataDir: string,
  readerId: string,
  paperId: string,
  kind: "bookmark" | "like",
) =>
  runAs(
    dataDir,
    readerId,
    Effect.gen(function*() {
      const repository = yield* ReaderStateRepository
      return yield* repository.react({ paperId, kind })
    }),
  )

const saved = (dataDir: string, readerId: string) =>
  Effect
    .gen(function*() {
      const repository = yield* ReaderStateRepository
      const state = yield* repository.load
      return state
        .reactions
        .filter((reaction) => reaction.kind === "bookmark" && reaction.active)
        .map((reaction) => reaction.paperId)
        .sort()
    })
    .pipe((effect) => runAs(dataDir, readerId, effect))

const canonicalReaderId = (dataDir: string, readerId: string) =>
  Effect
    .gen(function*() {
      const store = yield* accounts
      return yield* Effect.promise(() => store.canonicalReaderId(readerId))
    })
    .pipe((effect) => runAs(dataDir, readerId, effect))

describe("accounts repository", () => {
  it("signs a reader in with a mailed link and reads the session back", async () => {
    const dataDir = await temporaryDirectory()
    const { recorded, token } = await requestLink(dataDir, canonicalReader)
    expect(recorded).toBe(true)
    expect(await session(dataDir, canonicalReader)).toEqual({ email: null })

    expect(await consume(dataDir, canonicalReader, token)).toEqual({ email })
    expect(await session(dataDir, canonicalReader)).toEqual({ email })
  })

  it("spends a link once", async () => {
    const dataDir = await temporaryDirectory()
    const { token } = await requestLink(dataDir, canonicalReader)
    await consume(dataDir, canonicalReader, token)
    expect(await consume(dataDir, secondReader, token)).toBeNull()
  })

  it("refuses an expired link", async () => {
    const dataDir = await temporaryDirectory()
    const past = new Date(Date.now() - 2 * magicLinkTtlMs)
    const { token } = await requestLink(dataDir, canonicalReader, { now: past })
    expect(await consume(dataDir, canonicalReader, token)).toBeNull()
    expect(await session(dataDir, canonicalReader)).toEqual({ email: null })
  })

  it("drops requests past the hourly cap", async () => {
    const dataDir = await temporaryDirectory()
    await requestLink(dataDir, canonicalReader)
    await requestLink(dataDir, canonicalReader)
    await requestLink(dataDir, canonicalReader)
    const fourth = await requestLink(dataDir, canonicalReader)
    expect(fourth.recorded).toBe(false)
  })

  it("folds a second device into the account's own clippings", async () => {
    const dataDir = await temporaryDirectory()
    await react(dataDir, canonicalReader, "paper-canonical", "bookmark")
    await react(dataDir, secondReader, "paper-second", "bookmark")

    const first = await requestLink(dataDir, canonicalReader)
    await consume(dataDir, canonicalReader, first.token)
    const second = await requestLink(dataDir, secondReader)
    expect(await consume(dataDir, secondReader, second.token)).toEqual({
      email,
    })

    expect(await saved(dataDir, canonicalReader)).toEqual([
      "paper-canonical",
      "paper-second",
    ])
    // The claimed id stays an alias: still signed in, and pointing at the
    // account's reader.
    expect(await session(dataDir, secondReader)).toEqual({ email })
    expect(await canonicalReaderId(dataDir, secondReader)).toBe(canonicalReader)
    expect(await canonicalReaderId(dataDir, "reader-stranger-0003")).toBe(
      "reader-stranger-0003",
    )
  })

  it("keeps the newer reaction when both devices touched one paper", async () => {
    const dataDir = await temporaryDirectory()
    const first = await requestLink(dataDir, canonicalReader)
    await consume(dataDir, canonicalReader, first.token)
    // The canonical device files the paper after the second device dropped it,
    // so the newest write has to survive the merge.
    await react(dataDir, secondReader, "paper-shared", "bookmark")
    await react(dataDir, canonicalReader, "paper-shared", "bookmark")

    const second = await requestLink(dataDir, secondReader)
    await consume(dataDir, secondReader, second.token)

    expect(await saved(dataDir, canonicalReader)).toEqual(["paper-shared"])
    // Requests from the second device resolve to the account's reader, which is
    // where its clippings went; the request boundary does that resolution.
    expect(await canonicalReaderId(dataDir, secondReader)).toBe(canonicalReader)
    expect(await saved(dataDir, canonicalReader)).toEqual(["paper-shared"])
  })
})

describe("account store contracts", () => {
  it("rejects a token that never existed", async () => {
    const store = makeAccountsRepository({
      query: async () => [],
    })
    expect(
      await store.consumeLink({
        tokenHash: tokenHash("nope"),
        readerId: canonicalReader,
        now: new Date(),
      }),
    )
      .toBeNull()
  })
})
