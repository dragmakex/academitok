/**
 * Pattern: RpcGroup API Definition
 * Purpose: Type-safe RPC contract using effect/unstable/rpc
 * See: docs/architecture/effect-simple-made-easy-mapping.md
 */

import * as Schema from "effect/Schema"
import * as Rpc from "effect/unstable/rpc/Rpc"
import * as RpcGroup from "effect/unstable/rpc/RpcGroup"
import {
  FeedRequest,
  FeedSnapshot,
  OnboardingResult,
  OnboardProfileInput,
  ReactionResult,
  ReactToPaperInput,
  SaveProfileInput,
  TrackPaperViewsInput,
} from "./paper-schema"
export class PapersRpc extends RpcGroup
  .make(
    Rpc.make("snapshot", {
      success: FeedSnapshot,
      payload: { request: FeedRequest },
    }),
    Rpc.make("saveProfile", {
      success: FeedSnapshot,
      payload: { input: SaveProfileInput, request: FeedRequest },
    }),
    Rpc.make("react", {
      success: ReactionResult,
      payload: { input: ReactToPaperInput },
    }),
    Rpc.make("trackViews", {
      success: Schema.Void,
      payload: { inputs: TrackPaperViewsInput },
    }),
  )
  .prefix("papers_")
{}

export class ProfileRpc extends RpcGroup
  .make(
    Rpc.make("onboard", {
      success: OnboardingResult,
      payload: { input: OnboardProfileInput },
    }),
  )
  .prefix("profile_")
{}

export class DomainRpc extends PapersRpc.merge(ProfileRpc) {}
