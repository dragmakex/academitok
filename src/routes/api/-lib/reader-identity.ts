/**
 * RPC reader identity: resolves the reader cookie, then the reader that owns
 * the data once an account has claimed that device (SPEC §17.1, §17.5).
 * A cookie-less or forged-cookie writer never lands on the shared fallback
 * identity: it gets an orphan id so unauthenticated requests cannot poison
 * the cross-reader counts every visitor sees.
 */

import { ReaderStateRepository } from "@/db/reader-state-repository"
import { canonicalReaderId } from "@/features/auth/application"
import {
  defaultReaderId,
  newReaderId,
  ReaderId,
  readerIdFromCookieHeader,
} from "@/lib/reader-id"
import * as Effect from "effect/Effect"
import { Headers } from "effect/http"
import * as Layer from "effect/Layer"
import * as Option from "effect/Option"
import { RpcMiddleware } from "effect/rpc"

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
    const canonical = yield* canonicalReaderId(claimed)
    const readerId =
      canonical === defaultReaderId && claimed === defaultReaderId
        ? newReaderId()
        : canonical
    return yield* Effect.provideService(effect, ReaderId, readerId)
  })
}

/** Layer providing the RPC reader-identity middleware. */
export const RpcReaderIdLive = Layer.succeed(
  RpcReaderId,
  RpcReaderId.of(rpcReaderIdMiddleware),
)
