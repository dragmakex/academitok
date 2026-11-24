import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import { FetchHttpClient } from "effect/http"
import * as Layer from "effect/Layer"
import { RpcClient, RpcSerialization } from "effect/rpc"
import * as Stream from "effect/Stream"
import { DomainRpc } from "./domain-rpc"

export const addRpcErrorLogging = <Client>(client: Client): Client => {
  const isStream = (
    u: unknown,
  ): u is Stream.Stream<unknown, unknown, unknown> => Stream.isStream(u)

  const wrapCall = <F extends (...args: Array<unknown>) => unknown>(
    fn: F,
    path: ReadonlyArray<string>,
  ): F => {
    const rpcId = path.join(".")
    const logCause = (cause: unknown) =>
      Effect.logError(`[API] ${rpcId} failed`, cause)

    return function(
      this: ThisParameterType<F>,
      ...args: Parameters<F>
    ): ReturnType<F> {
      const result = fn.apply(this, args)
      if (Effect.isEffect(result)) {
        return result.pipe(Effect.tapCause(logCause)) as ReturnType<F>
      }
      if (isStream(result)) {
        return result.pipe(Stream.tapCause(logCause)) as ReturnType<F>
      }
      return result as ReturnType<F>
    } as F
  }

  const visit = (node: unknown, path: ReadonlyArray<string>) => {
    if (node && typeof node === "object") {
      for (const [key, value] of Object.entries(node)) {
        const nextPath = [...path, key]
        if (typeof value === "function") {
          ;(node as Record<string, unknown>)[key] = wrapCall(value, nextPath)
          continue
        }
        visit(value, nextPath)
      }
    }
    return node
  }

  return visit(client, []) as Client
}

type BaseWindow = {
  readonly location: {
    readonly origin: string
  }
}

export const getBaseUrl = (
  baseWindow: BaseWindow | null | undefined = typeof window === "undefined"
    ? null
    : window,
): string => baseWindow ? baseWindow.location.origin : "http://localhost:3000"

const RpcConfigLive = RpcClient
  .layerProtocolHttp({
    url: `${getBaseUrl()}/api/rpc`,
  })
  .pipe(Layer.provide([FetchHttpClient.layer, RpcSerialization.layerNdjson]))

export class ApiClient extends Context.Service<ApiClient>()(
  "ApiClient",
  {
    make: Effect.gen(function*() {
      const rpcClient = yield* RpcClient.make(DomainRpc)

      return {
        rpc: addRpcErrorLogging(rpcClient),
      }
    }),
  },
) {
  static readonly layer = Layer.effect(this, this.make).pipe(
    Layer.provide([RpcConfigLive, FetchHttpClient.layer]),
  )
}
