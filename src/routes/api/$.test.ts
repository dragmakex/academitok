import { curatedPapers } from "@/data/papers"
import { ReaderStateRepository } from "@/db/reader-state-repository"
import {
  getPaperFeedSnapshot,
  PapersApplicationLive,
} from "@/features/papers/application"
import { defaultReaderId, ReaderId, readerIdCookieName } from "@/lib/reader-id"
import { expect, it } from "@effect/vitest"
import * as ConfigProvider from "effect/ConfigProvider"
import * as Effect from "effect/Effect"
import * as Exit from "effect/Exit"
import * as Layer from "effect/Layer"
import * as HttpRouter from "effect/unstable/http/HttpRouter"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { vi } from "vitest"
import {
  AllRoutes,
  createRpcLoggerHandler,
  HealthRoute,
  Route,
  RpcLogger,
  RpcLoggerLive,
  RpcRouter,
  savedBibtexFilename,
  SavedBibtexRoute,
  serverRuntime,
  ServerRuntimeLive,
} from "./$.ts"

/**
 * Tests for the API router module.
 *
 * This module contains layer definitions and router setup for the API.
 * We test the exported functions and verify the layers are correctly constructed.
 */

it.effect("createRpcLoggerHandler - returns success exit on success", () =>
  Effect.gen(function*() {
    const successEffect = Effect.succeed("test-result")
    const result = yield* createRpcLoggerHandler({
      effect: successEffect,
      rpc: { _tag: "test_rpc" },
      client: { id: "test-client-123" },
    })

    expect(Exit.isSuccess(result)).toBe(true)
    if (Exit.isSuccess(result)) {
      expect(result.value).toBe("test-result")
    }
  }))

it.effect("createRpcLoggerHandler - returns failure exit on failure", () =>
  Effect.gen(function*() {
    const failureEffect = Effect.fail("test-error" as const)
    const result = yield* createRpcLoggerHandler({
      effect: failureEffect,
      rpc: { _tag: "failing_rpc" },
      client: { id: "test-client-456" },
    })

    expect(Exit.isFailure(result)).toBe(true)
  }))

it.effect("RpcLogger - is defined", () =>
  Effect.sync(() => {
    expect(RpcLogger).toBeDefined()
  }))

it.effect("RpcLoggerLive - layer is defined", () =>
  Effect.sync(() => {
    expect(RpcLoggerLive).toBeDefined()
  }))

it.effect("RpcRouter - layer is defined", () =>
  Effect.sync(() => {
    expect(RpcRouter).toBeDefined()
  }))

it.effect("HealthRoute - layer is defined", () =>
  Effect.sync(() => {
    expect(HealthRoute).toBeDefined()
  }))

it.effect("AllRoutes - layer is defined", () =>
  Effect.sync(() => {
    expect(AllRoutes).toBeDefined()
  }))

it.effect("SavedBibtexRoute - layer is defined", () =>
  Effect.sync(() => {
    expect(SavedBibtexRoute).toBeDefined()
  }))

it.effect("Route - is defined with handlers", () =>
  Effect.sync(() => {
    expect(Route).toBeDefined()
  }))

it.effect("serverRuntime - is defined", () =>
  Effect.sync(() => {
    expect(serverRuntime).toBeDefined()
  }))

it.effect("ServerRuntimeLive - is defined", () =>
  Effect.sync(() => {
    expect(ServerRuntimeLive).toBeDefined()
  }))

const readerId = "bib-reader-0001"

/**
 * Boots the saved-BibTeX route on a temporary reader database.
 * @param dataDir - PGlite directory for the reader state.
 * @returns Web request handler for the route layer.
 */
const bibHandler = (dataDir: string) =>
  HttpRouter.toWebHandler(
    SavedBibtexRoute.pipe(
      Layer.provideMerge(PapersApplicationLive),
      Layer.provide(
        ConfigProvider.layer(
          ConfigProvider.fromEnv({
            env: { PGLITE_READER_STATE_DIR: dataDir },
          }),
        ),
      ),
    ),
  )

it("serves the saved collection as a BibTeX attachment", async () => {
  const dataDir = await mkdtemp(join(tmpdir(), "academitok-bib-route-"))
  vi.stubGlobal("fetch", () => Promise.reject(new Error("offline")))
  const targets = curatedPapers.slice(0, 3)
  const files = bibHandler(dataDir)

  try {
    await Effect.runPromise(
      Effect
        .gen(function*() {
          const repository = yield* ReaderStateRepository
          yield* repository.onboard({
            keptPaperIds: [],
            rejectedPaperIds: [],
            skipped: true,
          })
          yield* getPaperFeedSnapshot({
            query: { topic: "All", sort: "recommended" },
            cursor: null,
            sessionId: "bib-route",
          })
          for (const paper of targets) {
            yield* repository.react({ paperId: paper.id, kind: "bookmark" })
          }
        })
        .pipe(
          Effect.provideService(ReaderId, readerId),
          Effect.provide(PapersApplicationLive),
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

    const request = (cookie: string | undefined) =>
      files.handler(
        new Request("http://localhost/api/saved.bib", {
          headers: cookie === undefined ? {} : { cookie },
        }),
      )

    const cookie = `${readerIdCookieName}=${readerId}`
    const first = await request(cookie)
    const body = await first.text()
    const second = await request(cookie)
    const anonymous = await request(undefined)

    expect(first.status).toBe(200)
    expect(first.headers.get("content-type")).toBe(
      "application/x-bibtex; charset=utf-8",
    )
    expect(first.headers.get("content-disposition")).toBe(
      `attachment; filename="${savedBibtexFilename}"`,
    )
    expect(body.split("\n\n")).toHaveLength(3)
    expect(body.match(/@article/g)).toHaveLength(3)
    expect(await second.text()).toBe(body)
    expect(anonymous.status).toBe(200)
    expect(await anonymous.text()).toBe("")
    expect(defaultReaderId).toBe("singleton")
  } finally {
    vi.unstubAllGlobals()
    await files.dispose()
    await rm(dataDir, { recursive: true, force: true })
  }
})
