import type {
  FeedRequest,
  ReactToPaperInput,
  SaveProfileInput,
  TrackPaperViewInput,
} from "@/api/paper-schema"
import {
  getPaperFeedSnapshot,
  reactToPaper,
  saveReaderProfile,
  trackPaperView,
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
  papers_trackView: ({ input }: { input: TrackPaperViewInput }) =>
    trackPaperView(input),
})
