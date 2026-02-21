import { DomainApi } from "@/api/domain-api"
import { DomainRpc } from "@/api/domain-rpc"
import {
  initPyroscopeServer,
  shutdownPyroscopeServer,
} from "@/lib/pyroscope-server"
import { createFileRoute } from "@tanstack/react-router"
import type { Cause } from "effect/Cause"
import * as Effect from "effect/Effect"
import * as Exit from "effect/Exit"
import * as Layer from "effect/Layer"
import * as Logger from "effect/Logger"
import * as ManagedRuntime from "effect/ManagedRuntime"
import * as HttpRouter from "effect/unstable/http/HttpRouter"
import * as HttpServer from "effect/unstable/http/HttpServer"
import * as HttpServerResponse from "effect/unstable/http/HttpServerResponse"
import * as HttpApiBuilder from "effect/unstable/httpapi/HttpApiBuilder"
import * as RpcMiddleware from "effect/unstable/rpc/RpcMiddleware"
import * as RpcSerialization from "effect/unstable/rpc/RpcSerialization"
import * as RpcServer from "effect/unstable/rpc/RpcServer"
import { TodosApiLive } from "./-lib/todos-api-live"
import { TodosRpcLive } from "./-lib/todos-rpc-live"
import { TodosService } from "./-lib/todos-service"

/**
 * RPC logging middleware - logs errors for failed RPC requests.
 * Exported for testing.
 */
export class RpcLogger
  extends RpcMiddleware.Service<RpcLogger>()("RpcLogger")
{}

type RpcMiddlewareOptions = Parameters<RpcMiddleware.Any>[1]

/**
 * RPC logger handler implementation.
 * Exported for testing.
 *
 * @param opts - The options for the RPC logger handler.
 * @param opts.effect - The effect to execute.
 * @param opts.rpc - The RPC request metadata.
 * @param opts.rpc._tag - The RPC method tag.
 * @param opts.clientId - The client identifier.
 * @returns An Effect that yields the Exit result after logging any errors.
 */
export const createRpcLoggerHandler = <A, E>(
  opts: {
    effect: Effect.Effect<A, E>
    rpc: { readonly _tag: string }
    clientId: string
  },
): Effect.Effect<Exit.Exit<A, E>, never, never> =>
  Effect.flatMap(Effect.exit(opts.effect), (exit) =>
    Exit.match(exit, {
      onSuccess: () => Effect.succeed(exit),
      onFailure: (cause: Cause<E>) =>
        Effect.andThen(
          Effect.annotateLogs(
            Effect.logError(`RPC request failed: ${opts.rpc._tag}`, cause),
            {
              "rpc.method": opts.rpc._tag,
              "rpc.clientId": opts.clientId,
            },
          ),
          Effect.succeed(exit),
        ),
    }))

/**
 * RPC logger middleware handler that wraps the next effect with logging.
 * Returns the original result or re-raises the error after logging.
 *
 * @param effect - The effect to execute.
 * @param opts - The options for the RPC logger middleware.
 * @param opts.rpc - The RPC request metadata.
 * @param opts.rpc._tag - The RPC method tag.
 * @param opts.clientId - The client identifier.
 * @returns An Effect that yields the result or fails with the original error.
 */
const rpcLoggerMiddleware = <A, E>(
  effect: Effect.Effect<A, E>,
  opts: RpcMiddlewareOptions,
): Effect.Effect<A, E, never> =>
  Effect.flatMap(Effect.exit(effect), (exit) =>
    Exit.match(exit, {
      onSuccess: (value) => Effect.succeed(value),
      onFailure: (cause: Cause<E>) =>
        Effect.andThen(
          Effect.annotateLogs(
            Effect.logError(`RPC request failed: ${opts.rpc._tag}`, cause),
            {
              "rpc.method": opts.rpc._tag,
              "rpc.clientId": String(opts.clientId),
            },
          ),
          Effect.failCause(cause),
        ),
    }))

export const RpcLoggerLive = Layer.succeed(
  RpcLogger,
  RpcLogger.of(rpcLoggerMiddleware),
)

/**
 * Router layers - exported for testing.
 */
export const RpcRouter = RpcServer
  .layer(DomainRpc.middleware(RpcLogger), {
    spanPrefix: "rpc",
    disableFatalDefects: true,
  })
  .pipe(
    Layer.provide(TodosRpcLive),
    Layer.provide(RpcLoggerLive),
    Layer.provide(
      RpcServer.layerProtocolHttp({ path: "/api/rpc" }).pipe(
        Layer.provide(RpcSerialization.layerNdjson),
      ),
    ),
  )

export const HttpApiRouter = HttpApiBuilder.layer(DomainApi).pipe(
  Layer.provide(TodosApiLive),
  Layer.provide(HttpServer.layerServices),
)

export const HealthRoute = HttpRouter.add(
  "GET",
  "/api/health",
  Effect.succeed(HttpServerResponse.text("OK")),
)

export const AllRoutes = Layer
  .mergeAll(RpcRouter, HttpApiRouter, HealthRoute)
  .pipe(
    Layer.provide(Logger.layer([Logger.consolePretty()])),
  )

const memoMap = Layer.makeMemoMapUnsafe()

const globalHmr = globalThis as unknown as {
  __EFFECT_DISPOSE__?: () => Promise<void>
}
if (globalHmr.__EFFECT_DISPOSE__) {
  await globalHmr.__EFFECT_DISPOSE__()
  delete globalHmr.__EFFECT_DISPOSE__
}

await initPyroscopeServer()

const { dispose, handler } = HttpRouter.toWebHandler(AllRoutes, {
  memoMap,
})
const effectHandler = ({ request }: { request: Request }) => handler(request)

// ManagedRuntime for use in loaders/server functions
export const serverRuntime = ManagedRuntime.make(TodosService.layer, {
  memoMap,
})

globalHmr.__EFFECT_DISPOSE__ = async () => {
  await shutdownPyroscopeServer()
  await dispose()
  await serverRuntime.dispose()
}

export const Route = createFileRoute("/api/$")({
  server: {
    handlers: {
      GET: effectHandler,
      POST: effectHandler,
      PUT: effectHandler,
      PATCH: effectHandler,
      DELETE: effectHandler,
      OPTIONS: effectHandler,
    },
  },
})
