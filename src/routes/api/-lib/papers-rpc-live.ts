import type {
  FeedRequest,
  OnboardProfileInput,
  ReactToPaperInput,
  SaveProfileInput,
  TrackPaperViewsInput,
} from "@/api/paper-schema"
import {
  getPaperFeedSnapshot,
  onboardReader,
  reactToPaper,
  saveReaderProfile,
  trackPaperViews,
} from "@/features/papers/application"
import * as Effect from "effect/Effect"

export const createPaperRpcHandlers = Effect.succeed({
  papers_snapshot: ({ request }: { request: FeedRequest }) =>
    getPaperFeedSnapshot(request),
  papers_saveProfile: (
    { input, request }: { input: SaveProfileInput; request: FeedRequest },
  ) => saveReaderProfile(input, request),
  papers_react: ({ input }: { input: ReactToPaperInput }) =>
    reactToPaper(input),
  papers_trackViews: ({ inputs }: { inputs: TrackPaperViewsInput }) =>
    trackPaperViews(inputs),
  profile_onboard: ({ input }: { input: OnboardProfileInput }) =>
    onboardReader(input),
})
