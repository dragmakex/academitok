import * as Schema from "effect/Schema"

export const Topic = Schema.Literals([
  "AI",
  "Biology",
  "Climate",
  "Education",
  "Economics",
  "Health",
  "Physics",
  "Psychology",
  "Robotics",
])
export type Topic = typeof Topic.Type

export const TopicFilter = Schema.Union([Topic, Schema.Literal("All")])
export type TopicFilter = typeof TopicFilter.Type

export const FeedSort = Schema.Literals(["recommended", "latest", "citations"])
export type FeedSort = typeof FeedSort.Type

export const Institution = Schema.Literals([
  "Guest",
  "MIT",
  "Oxford",
  "Stanford",
  "Max Planck",
])
export type Institution = typeof Institution.Type

export const PaperSite = Schema.Literals([
  "arXiv",
  "bioRxiv",
  "PubMed Central",
  "DOAJ",
  "OpenAlex",
  "OpenReview",
  "HAL",
])
export type PaperSite = typeof PaperSite.Type

export const PaperAccess = Schema.Literals(["open", "institution"])
export type PaperAccess = typeof PaperAccess.Type

export const PaperSource = Schema.Literals(["curated", "openalex"])
export type PaperSource = typeof PaperSource.Type

export const ReactionKind = Schema.Literals([
  "view",
  "dwell",
  "like",
  "bookmark",
  "hide",
  "open-site",
  "onboard-keep",
  "onboard-reject",
])
export type ReactionKind = typeof ReactionKind.Type

export const Paper = Schema.Struct({
  id: Schema.String,
  title: Schema.NonEmptyString,
  authors: Schema.Array(Schema.NonEmptyString),
  abstract: Schema.NonEmptyString,
  summary: Schema.NonEmptyString,
  year: Schema.Number,
  venue: Schema.NonEmptyString,
  topics: Schema.Array(Topic),
  access: PaperAccess,
  allowedInstitutions: Schema.optional(Schema.Array(Institution)),
  citations: Schema.Number,
  readMinutes: Schema.Number,
  site: PaperSite,
  source: PaperSource,
  externalUrl: Schema.optional(Schema.String),
})
export type Paper = typeof Paper.Type

export const ReaderProfile = Schema.Struct({
  name: Schema.NonEmptyString,
  institution: Institution,
  interests: Schema.Array(Topic),
})
export type ReaderProfile = typeof ReaderProfile.Type

export const PaperReaction = Schema.Struct({
  paperId: Schema.String,
  kind: ReactionKind,
  active: Schema.Boolean,
  timestamp: Schema.Number,
  dwellMs: Schema.optional(Schema.Number),
})
export type PaperReaction = typeof PaperReaction.Type

export const ReaderState = Schema.Struct({
  profile: Schema.NullOr(ReaderProfile),
  reactions: Schema.Array(PaperReaction),
})
export type ReaderState = typeof ReaderState.Type

export const FeedItem = Schema.Struct({
  paper: Paper,
  score: Schema.Number,
  rationale: Schema.Array(Schema.NonEmptyString),
  accessible: Schema.Boolean,
  liked: Schema.Boolean,
  bookmarked: Schema.Boolean,
  hidden: Schema.Boolean,
  exploration: Schema.Boolean,
})
export type FeedItem = typeof FeedItem.Type

export const FeedCursor = Schema.String
export type FeedCursor = typeof FeedCursor.Type

export const FeedStats = Schema.Struct({
  total: Schema.Number,
  openAccess: Schema.Number,
  institutionAccess: Schema.Number,
  liked: Schema.Number,
  bookmarked: Schema.Number,
  medianDwellMs: Schema.NullOr(Schema.Number),
  medianCompletion: Schema.NullOr(Schema.Number),
  hideRate: Schema.NullOr(Schema.Number),
  openSourceRate: Schema.NullOr(Schema.Number),
  savesPerHundred: Schema.NullOr(Schema.Number),
  windowTopicEntropy: Schema.NullOr(Schema.Number),
  windowMedianYear: Schema.NullOr(Schema.Number),
  windowDuplicateRate: Schema.NullOr(Schema.Number),
})
export type FeedStats = typeof FeedStats.Type

export const FeedPage = Schema.Struct({
  items: Schema.Array(FeedItem),
  nextCursor: Schema.NullOr(FeedCursor),
  exploration: Schema.Number,
})
export type FeedPage = typeof FeedPage.Type

/** Where a served edition came from: the stored pool, a fresh fetch or the seed file. */
export const FeedOrigin = Schema.Literals(["pool", "live", "seed"])
export type FeedOrigin = typeof FeedOrigin.Type

export const FeedSnapshot = Schema.Struct({
  origin: FeedOrigin,
  profile: Schema.NullOr(ReaderProfile),
  selectedTopic: TopicFilter,
  selectedSort: FeedSort,
  stats: FeedStats,
  items: Schema.Array(FeedItem),
  nextCursor: Schema.NullOr(FeedCursor),
  exploration: Schema.Number,
})
export type FeedSnapshot = typeof FeedSnapshot.Type

export const FeedQuery = Schema.Struct({
  topic: TopicFilter,
  sort: FeedSort,
})
export type FeedQuery = typeof FeedQuery.Type

export const FeedRequest = Schema.Struct({
  query: FeedQuery,
  cursor: Schema.NullOr(FeedCursor),
  sessionId: Schema.optional(Schema.NonEmptyString),
})
export type FeedRequest = typeof FeedRequest.Type

export const SaveProfileInput = Schema.Struct({
  name: Schema.NonEmptyString,
  institution: Institution,
  interests: Schema.Array(Topic),
})
export type SaveProfileInput = typeof SaveProfileInput.Type

export const ReactToPaperInput = Schema.Struct({
  paperId: Schema.String,
  kind: Schema.Literals(["like", "bookmark", "hide", "open-site"]),
})
export type ReactToPaperInput = typeof ReactToPaperInput.Type

export const ReactionResult = Schema.Struct({
  paperId: Schema.String,
  kind: Schema.Literals(["like", "bookmark", "hide", "open-site"]),
  active: Schema.Boolean,
})
export type ReactionResult = typeof ReactionResult.Type

export const TrackPaperViewInput = Schema.Struct({
  paperId: Schema.String,
  kind: Schema.Literals(["view", "dwell"]),
  dwellMs: Schema.Number,
  position: Schema.Number,
  exploration: Schema.Boolean,
})
export type TrackPaperViewInput = typeof TrackPaperViewInput.Type

export const TrackPaperViewsInput = Schema.Array(TrackPaperViewInput)
export type TrackPaperViewsInput = typeof TrackPaperViewsInput.Type

const OnboardingPaperIds = Schema.Array(Schema.String).check(
  Schema.isMaxLength(15),
  Schema.isUnique(),
)

const OnboardingSelection = Schema
  .Struct({
    keptPaperIds: OnboardingPaperIds.check(Schema.isMinLength(5)),
    rejectedPaperIds: OnboardingPaperIds,
    skipped: Schema.Literal(false),
  })
  .check(
    Schema.makeFilter<{
      readonly keptPaperIds: ReadonlyArray<string>
      readonly rejectedPaperIds: ReadonlyArray<string>
    }>((input) => {
      const selected = [...input.keptPaperIds, ...input.rejectedPaperIds]
      return selected.length === 15 && new Set(selected).size === 15
    }, { expected: "15 distinct onboarding decisions" }),
  )

export const OnboardProfileInput = Schema.Union([
  OnboardingSelection,
  Schema.Struct({
    keptPaperIds: Schema.Tuple([]),
    rejectedPaperIds: Schema.Tuple([]),
    skipped: Schema.Literal(true),
  }),
])
export type OnboardProfileInput = typeof OnboardProfileInput.Type

export const OnboardingResult = Schema.Struct({
  seeded: Schema.Literal(true),
})
export type OnboardingResult = typeof OnboardingResult.Type

export const defaultReaderState: ReaderState = {
  profile: null,
  reactions: [],
}
