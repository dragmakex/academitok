/**
 * RPC reader identity: resolves the reader cookie, then the reader that owns
 * the data once an account has claimed that device (SPEC §17.1, §17.5).
 */

import { ReaderStateRepository } from "@/db/reader-state-repository"
import { canonicalReaderId } from "@/features/auth/application"
import { ReaderId, readerIdFromCookieHeader } from "@/lib/reader-id"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Option from "effect/Option"
import * as Headers from "effect/unstable/http/Headers"
import * as RpcMiddleware from "effect/unstable/rpc/RpcMiddleware"

type RpcMiddlewareOptions = Parameters<RpcMiddleware.Any>[1]

/** RPC middleware that supplies `ReaderId` to every handler. */
export class RpcReaderId extends RpcMiddleware.Service<
  RpcReaderId,
  { provides: ReaderId; requires: ReaderStateRepository }
>()("RpcReaderId") {}

const rpcReaderIdMiddleware = <A, E>(
  effect: Effect.Effect<A, E, ReaderId | ReaderStateRepository>,
  opts: RpcMiddlewareOptions,
): Effect.Effect<A, E, ReaderStateRepository> => {
  const claimed = readerIdFromCookieHeader(
    Option.getOrUndefined(Headers.get(opts.headers, "cookie")),
  )
  return Effect.gen(function*() {
    const readerId = yield* canonicalReaderId(claimed)
    return yield* Effect.provideService(effect, ReaderId, readerId)
  })
}

/** Layer providing the RPC reader-identity middleware. */
export const RpcReaderIdLive = Layer.succeed(
  RpcReaderId,
  RpcReaderId.of(rpcReaderIdMiddleware),
)
