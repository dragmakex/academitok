/**
 * RPC reader identity: resolves the anonymous reader from the request cookie
 * (SPEC §17.1). There are no accounts to canonicalise through.
 */

import { ReaderId, readerIdFromCookieHeader } from "@/lib/reader-id"
import * as Effect from "effect/Effect"
import { Headers } from "effect/http"
import * as Layer from "effect/Layer"
import * as Option from "effect/Option"
import { RpcMiddleware } from "effect/rpc"

type RpcMiddlewareOptions = Parameters<RpcMiddleware.Any>[1]

/** RPC middleware that supplies `ReaderId` to every handler. */
export class RpcReaderId extends RpcMiddleware.Service<
  RpcReaderId,
  { provides: ReaderId }
>()("RpcReaderId") {}

const rpcReaderIdMiddleware = <A, E>(
  effect: Effect.Effect<A, E, ReaderId>,
  opts: RpcMiddlewareOptions,
): Effect.Effect<A, E> => {
  const readerId = readerIdFromCookieHeader(
    Option.getOrUndefined(Headers.get(opts.headers, "cookie")),
  )
  return Effect.provideService(effect, ReaderId, readerId)
}

/** Layer providing the RPC reader-identity middleware. */
export const RpcReaderIdLive = Layer.succeed(
  RpcReaderId,
  RpcReaderId.of(rpcReaderIdMiddleware),
)
