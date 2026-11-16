import type {
  FeedCursor,
  FeedItem,
  FeedSort,
  Institution,
  Paper,
  ReaderProfile,
  ReaderState,
  Topic,
  TopicFilter,
} from "@/api/paper-schema"

const reactionWeights = {
  view: 1.2,
  like: 4.5,
  bookmark: 3.8,
  hide: -5,
  "open-site": 3.4,
} as const

/**
 * Buckets dwell so brief skips reduce affinity and long reads cannot dominate it.
 * @param dwellMs - Measured visible time.
 * @returns Bounded dwell signal weight.
 */
function dwellWeight(dwellMs: number): number {
  if (dwellMs < 1_500) {
    return -0.6
  }
  if (dwellMs < 4_000) {
    return 1.2
  }
  if (dwellMs < 10_000) {
    return 3.2
  }
  if (dwellMs < 30_000) {
    return 5
  }
  return 6
}

/**
 * Identifies toggle reactions.
 * @param kind - Reaction kind.
 * @returns Whether the reaction toggles.
 */
function isToggleReactionKind(
  kind: ReaderState["reactions"][number]["kind"],
): kind is "like" | "bookmark" | "hide" {
  return kind === "like" || kind === "bookmark" || kind === "hide"
}

/**
 * Scores publication recency.
 * @param year - Publication year.
 * @returns Recency score.
 */
function recencyBoost(year: number): number {
  return Math.max(0, year - 2021) * 0.7
}

/**
 * Dampens citation counts.
 * @param citations - Citation count.
 * @returns Citation score.
 */
function citationBoost(citations: number): number {
  return Math.log10(citations + 1) * 2.4
}

/**
 * Resolves source entitlement.
 * @param institution - Reader institution.
 * @param paper - Candidate paper.
 * @returns Whether access is available.
 */
function institutionCanAccess(
  institution: Institution,
  paper: Paper,
): boolean {
  return paper.access === "open"
    || paper.allowedInstitutions?.includes(institution) === true
}

/**
 * Tokenizes an abstract into normalized terms.
 * @param abstract - Paper abstract.
 * @returns Lowercase word tokens.
 */
function abstractTerms(abstract: string): ReadonlyArray<string> {
  return abstract.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []
}

/**
 * Computes smoothed inverse document frequencies for a paper corpus.
 * @param papers - Corpus papers.
 * @returns IDF by term.
 */
function inverseDocumentFrequencies(
  papers: ReadonlyArray<Paper>,
): ReadonlyMap<string, number> {
  const documentFrequency = new Map<string, number>()
  for (const paper of papers) {
    for (const term of new Set(abstractTerms(paper.abstract))) {
      documentFrequency.set(term, (documentFrequency.get(term) ?? 0) + 1)
    }
  }

  return new Map(
    [...documentFrequency].map(([term, frequency]) => [
      term,
      Math.log((papers.length + 1) / (frequency + 1)) + 1,
    ]),
  )
}

/**
 * Builds a unit-length TF-IDF vector.
 * @param abstract - Paper abstract.
 * @param idf - Corpus inverse document frequencies.
 * @returns Sparse normalized vector.
 */
function abstractVector(
  abstract: string,
  idf: ReadonlyMap<string, number>,
): ReadonlyMap<string, number> {
  const terms = abstractTerms(abstract)
  const counts = new Map<string, number>()
  for (const term of terms) {
    counts.set(term, (counts.get(term) ?? 0) + 1)
  }
  const weighted = new Map(
    [...counts].map(([term, count]) => [
      term,
      count / Math.max(1, terms.length) * (idf.get(term) ?? 0),
    ]),
  )
  const magnitude = vectorMagnitude(weighted)
  return magnitude === 0
    ? weighted
    : new Map([...weighted].map(([term, weight]) => [term, weight / magnitude]))
}

/**
 * Computes a sparse vector's magnitude without an argument-size limit.
 * @param vector - Sparse vector.
 * @returns Euclidean magnitude.
 */
function vectorMagnitude(vector: ReadonlyMap<string, number>): number {
  let squaredSum = 0
  for (const weight of vector.values()) {
    squaredSum += weight * weight
  }
  return Math.sqrt(squaredSum)
}

/**
 * Builds the average TF-IDF vector of liked and saved papers.
 * @param papers - Corpus papers.
 * @param paperIds - Active liked and saved paper IDs.
 * @returns Sparse content centroid.
 */
export function buildContentCentroid(
  papers: ReadonlyArray<Paper>,
  paperIds: ReadonlySet<string>,
): ReadonlyMap<string, number> {
  const sourcePapers = papers.filter((paper) => paperIds.has(paper.id))
  if (sourcePapers.length === 0) {
    return new Map()
  }

  const idf = inverseDocumentFrequencies(papers)
  const centroid = new Map<string, number>()
  for (const paper of sourcePapers) {
    for (const [term, weight] of abstractVector(paper.abstract, idf)) {
      centroid.set(
        term,
        (centroid.get(term) ?? 0) + weight / sourcePapers.length,
      )
    }
  }
  return centroid
}

/**
 * Computes cosine similarity between sparse vectors.
 * @param left - First vector.
 * @param right - Second vector.
 * @returns Similarity from zero to one.
 */
function cosineSimilarity(
  left: ReadonlyMap<string, number>,
  right: ReadonlyMap<string, number>,
): number {
  let dotProduct = 0
  for (const [term, weight] of left) {
    dotProduct += weight * (right.get(term) ?? 0)
  }
  const leftMagnitude = vectorMagnitude(left)
  const rightMagnitude = vectorMagnitude(right)
  return leftMagnitude === 0 || rightMagnitude === 0
    ? 0
    : dotProduct / (leftMagnitude * rightMagnitude)
}

/**
 * Reduces toggle events.
 * @param state - Reader state.
 * @returns Current reaction sets.
 */
function activeState(state: ReaderState) {
  const liked = new Set<string>()
  const bookmarked = new Set<string>()
  const hidden = new Set<string>()
  const resolved = new Set<string>()

  for (const reaction of state.reactions) {
    const target = reaction.kind === "like"
      ? liked
      : reaction.kind === "bookmark"
      ? bookmarked
      : reaction.kind === "hide"
      ? hidden
      : undefined
    const key = `${reaction.kind}:${reaction.paperId}`

    if (target !== undefined && !resolved.has(key)) {
      resolved.add(key)
      if (reaction.active) {
        target.add(reaction.paperId)
      }
    }
  }

  return { bookmarked, hidden, liked }
}

/**
 * Counts engagement signals.
 * @param state - Reader state.
 * @returns Signal counts by paper.
 */
function paperSignals(state: ReaderState) {
  const views = new Map<string, number>()
  const dwells = new Map<string, number>()
  const opens = new Map<string, number>()

  for (const reaction of state.reactions) {
    if (!reaction.active) {
      continue
    }

    const target = reaction.kind === "view"
      ? views
      : reaction.kind === "dwell"
      ? dwells
      : reaction.kind === "open-site"
      ? opens
      : undefined

    if (target !== undefined) {
      target.set(reaction.paperId, (target.get(reaction.paperId) ?? 0) + 1)
    }
  }

  return { dwells, opens, views }
}

/**
 * Computes time-decayed topic affinity.
 * @param state - Reader state.
 * @param papers - Candidate papers.
 * @returns Topic weights.
 */
function topicWeights(
  state: ReaderState,
  papers: ReadonlyArray<Paper>,
): Map<Topic, number> {
  const weights = new Map<Topic, number>()
  const byId = new Map(papers.map((paper) => [paper.id, paper] as const))
  const resolvedToggles = new Set<string>()
  const now = Date.now()

  for (const reaction of state.reactions) {
    if (isToggleReactionKind(reaction.kind)) {
      const key = `${reaction.kind}:${reaction.paperId}`
      if (resolvedToggles.has(key)) {
        continue
      }
      resolvedToggles.add(key)
      if (!reaction.active) {
        continue
      }
    }

    const paper = byId.get(reaction.paperId)
    if (paper === undefined) {
      continue
    }

    const ageDays = Math.max(1, (now - reaction.timestamp) / 86_400_000)
    const decay = 1 / Math.min(12, ageDays)
    const signalWeight = reaction.kind === "dwell"
      ? dwellWeight(reaction.dwellMs ?? 0)
      : reactionWeights[reaction.kind]
    const weight = signalWeight * decay / Math.max(1, paper.topics.length)

    for (const topic of paper.topics) {
      weights.set(topic, (weights.get(topic) ?? 0) + weight)
    }
  }

  return weights
}

/**
 * Computes time-decayed author and venue affinity from active likes and saves.
 * @param state - Reader state.
 * @param papers - Candidate papers.
 * @returns Author and venue weights.
 */
function authorVenueWeights(
  state: ReaderState,
  papers: ReadonlyArray<Paper>,
) {
  const authors = new Map<string, number>()
  const venues = new Map<string, number>()
  const byId = new Map(papers.map((paper) => [paper.id, paper] as const))
  const resolved = new Set<string>()
  const now = Date.now()

  for (const reaction of state.reactions) {
    if (reaction.kind !== "like" && reaction.kind !== "bookmark") {
      continue
    }
    const key = `${reaction.kind}:${reaction.paperId}`
    if (resolved.has(key)) {
      continue
    }
    resolved.add(key)
    if (!reaction.active) {
      continue
    }

    const paper = byId.get(reaction.paperId)
    if (paper === undefined) {
      continue
    }
    const ageDays = Math.max(1, (now - reaction.timestamp) / 86_400_000)
    const weight = reactionWeights[reaction.kind]
      / Math.min(12, ageDays)
    for (const author of paper.authors) {
      authors.set(author, (authors.get(author) ?? 0) + weight)
    }
    venues.set(paper.venue, (venues.get(paper.venue) ?? 0) + weight)
  }

  return { authors, venues }
}

/**
 * Explains the strongest real signals.
 * @param paper - Candidate paper.
 * @param profile - Reader profile.
 * @param accessible - Whether the source is accessible.
 * @param matchedTopics - Explicitly matched beats.
 * @param signals - Prior engagement counts.
 * @param signals.dwellCount - Prior dwell count.
 * @param signals.openCount - Prior source-open count.
 * @returns At most two rationale lines.
 */
function rationaleForPaper(
  paper: Paper,
  profile: ReaderProfile | null,
  accessible: boolean,
  matchedTopics: ReadonlyArray<Topic>,
  signals: {
    readonly dwellCount: number
    readonly openCount: number
  },
): ReadonlyArray<string> {
  const reasons = [
    ...(matchedTopics.length > 0
      ? [`Matches ${matchedTopics.join(", ")}`]
      : []),
    ...(signals.dwellCount > 0 ? ["Held your attention"] : []),
    ...(signals.openCount > 0 ? ["You opened the source"] : []),
    ...(paper.access === "open" ? [`Free via ${paper.site}`] : []),
    ...(paper.access === "institution" && accessible
      ? [`Available through ${profile?.institution ?? "your institution"}`]
      : []),
    ...(paper.year >= 2024 ? ["Recent publication"] : []),
    ...(paper.citations >= 100 ? ["Highly cited"] : []),
  ]

  return (reasons.length > 0 ? reasons : [paper.topics[0] ?? paper.venue])
    .slice(0, 2)
}

/**
 * Scores the candidate pool.
 * @param state - Reader state.
 * @param papers - Candidate papers.
 * @param selectedTopic - Requested beat.
 * @param sort - Requested ordering.
 * @returns Ranked items.
 */
export function buildFeedItems(
  state: ReaderState,
  papers: ReadonlyArray<Paper>,
  selectedTopic: TopicFilter,
  sort: FeedSort,
): ReadonlyArray<FeedItem> {
  const profile = state.profile
  const institution = profile?.institution ?? "Guest"
  const interests = new Set(profile?.interests ?? [])
  const weights = topicWeights(state, papers)
  const authorVenue = authorVenueWeights(state, papers)
  const active = activeState(state)
  const signals = paperSignals(state)
  const idf = inverseDocumentFrequencies(papers)
  const contentCentroid = buildContentCentroid(
    papers,
    new Set([...active.liked, ...active.bookmarked]),
  )

  const items = papers
    .filter((paper) =>
      selectedTopic === "All" || paper.topics.includes(selectedTopic)
    )
    .map((paper) => {
      const accessible = institutionCanAccess(institution, paper)
      const matchedTopics = paper.topics.filter((topic) => interests.has(topic))
      const viewCount = signals.views.get(paper.id) ?? 0
      const dwellCount = signals.dwells.get(paper.id) ?? 0
      const openCount = signals.opens.get(paper.id) ?? 0
      const learnedBoost = paper.topics.reduce(
        (sum, topic) => sum + (weights.get(topic) ?? 0),
        0,
      )
      const contentAffinity = cosineSimilarity(
        contentCentroid,
        abstractVector(paper.abstract, idf),
      )
      const authorAffinity = paper.authors.reduce(
        (sum, author) => sum + (authorVenue.authors.get(author) ?? 0),
        0,
      ) / Math.max(1, paper.authors.length)
      const authorVenueAffinity = (
        authorAffinity + (authorVenue.venues.get(paper.venue) ?? 0)
      ) / 2
      const score = matchedTopics.length * 2.6
        + learnedBoost
        + 0.9 * contentAffinity
        + 0.5 * authorVenueAffinity
        + (paper.access === "open" ? 0.8 : accessible ? 0.3 : -0.6)
        + (active.hidden.has(paper.id) ? -20 : 0)
        + (active.liked.has(paper.id) ? 4 : 0)
        + (active.bookmarked.has(paper.id) ? 3.5 : 0)
        + Math.min(viewCount, 3) * 0.4
        + Math.min(dwellCount, 3) * 1.4
        + Math.min(openCount, 2) * 1.8
        + recencyBoost(paper.year)
        + citationBoost(paper.citations)

      return {
        paper,
        score,
        rationale: rationaleForPaper(
          paper,
          profile,
          accessible,
          matchedTopics,
          {
            dwellCount,
            openCount,
          },
        ),
        accessible,
        liked: active.liked.has(paper.id),
        bookmarked: active.bookmarked.has(paper.id),
        hidden: active.hidden.has(paper.id),
        exploration: false,
      } satisfies FeedItem
    })
    .filter((item) => !item.hidden)

  if (sort === "latest") {
    return [...items].sort(
      (left, right) =>
        right.paper.year - left.paper.year
        || right.paper.citations - left.paper.citations,
    )
  }

  if (sort === "citations") {
    return [...items].sort(
      (left, right) =>
        right.paper.citations - left.paper.citations
        || right.paper.year - left.paper.year,
    )
  }

  return [...items].sort((left, right) => right.score - left.score)
}

/**
 * Normalizes title tokens.
 * @param title - Paper title.
 * @returns Unique normalized words.
 */
function titleWords(title: string): ReadonlySet<string> {
  return new Set(title.toLowerCase().match(/[a-z0-9]+/g) ?? [])
}

/**
 * Computes title Jaccard similarity.
 * @param left - First title.
 * @param right - Second title.
 * @returns Similarity from zero to one.
 */
function titleSimilarity(left: string, right: string): number {
  const leftWords = titleWords(left)
  const rightWords = titleWords(right)
  const union = new Set([...leftWords, ...rightWords])
  if (union.size === 0) {
    return 1
  }
  let intersection = 0
  for (const word of leftWords) {
    if (rightWords.has(word)) {
      intersection++
    }
  }
  return intersection / union.size
}

/**
 * Computes topic-set Jaccard similarity.
 * @param left - First paper's topics.
 * @param right - Second paper's topics.
 * @returns Similarity from zero to one.
 */
function topicSimilarity(
  left: ReadonlyArray<Topic>,
  right: ReadonlyArray<Topic>,
): number {
  const leftTopics = new Set(left)
  const rightTopics = new Set(right)
  const union = new Set([...leftTopics, ...rightTopics])
  if (union.size === 0) {
    return 1
  }
  let intersection = 0
  for (const topic of leftTopics) {
    if (rightTopics.has(topic)) {
      intersection++
    }
  }
  return intersection / union.size
}

/**
 * Decodes the opaque cursor.
 * @param cursor - Encoded cursor.
 * @returns Previously emitted paper IDs.
 */
function decodeCursor(cursor: FeedCursor | null): ReadonlyArray<string> {
  if (cursor === null) {
    return []
  }
  try {
    const value: unknown = JSON.parse(decodeURIComponent(cursor))
    return Array.isArray(value) && value.every((id) => typeof id === "string")
      ? value
      : []
  } catch {
    return []
  }
}

/**
 * Checks page diversity constraints.
 * @param item - Candidate item.
 * @param selected - Current page.
 * @param topicCounts - Primary-topic counts.
 * @returns Whether the candidate can be added.
 */
function canAdd(
  item: FeedItem,
  selected: ReadonlyArray<FeedItem>,
  topicCounts: ReadonlyMap<Topic, number>,
): boolean {
  const primaryTopic = item.paper.topics[0]
  if (primaryTopic !== undefined && (topicCounts.get(primaryTopic) ?? 0) >= 2) {
    return false
  }
  const authors = new Set(selected.flatMap((entry) => entry.paper.authors))
  return !item.paper.authors.some((author) => authors.has(author))
    && !selected.some((entry) =>
      titleSimilarity(entry.paper.title, item.paper.title) > 0.9
    )
}

/**
 * Selects one diverse page.
 * @param items - Ranked candidates.
 * @param cursor - Session cursor.
 * @param limit - Maximum page size.
 * @returns Page items and next cursor.
 */
export function buildFeedPage(
  items: ReadonlyArray<FeedItem>,
  cursor: FeedCursor | null,
  limit = 10,
): {
  readonly items: ReadonlyArray<FeedItem>
  readonly nextCursor: FeedCursor | null
} {
  const priorIds = decodeCursor(cursor)
  const seen = new Set(priorIds)
  const candidates = items.filter((item) => !seen.has(item.paper.id))
  const selected: Array<FeedItem> = []
  const topicCounts = new Map<Topic, number>()
  const explorationStart = Math.ceil(candidates.length * 0.4)
  const explorationCandidate = candidates.slice(explorationStart).find((item) =>
    canAdd(item, selected, topicCounts)
  )
  const exploitationLimit = limit - (explorationCandidate === undefined ? 0 : 1)
  const idf = inverseDocumentFrequencies(
    candidates.map((candidate) => candidate.paper),
  )
  const vectors = new Map(
    candidates.map((candidate) => [
      candidate.paper.id,
      abstractVector(candidate.paper.abstract, idf),
    ]),
  )

  while (selected.length < exploitationLimit) {
    let best: FeedItem | undefined
    let bestMmr = Number.NEGATIVE_INFINITY

    for (const candidate of candidates) {
      if (
        candidate === explorationCandidate
        || selected.includes(candidate)
        || !canAdd(candidate, selected, topicCounts)
      ) {
        continue
      }
      let maxSimilarity = 0
      for (const chosen of selected) {
        const similarity = 0.5 * cosineSimilarity(
              vectors.get(candidate.paper.id) ?? new Map(),
              vectors.get(chosen.paper.id) ?? new Map(),
            ) + 0.5 * topicSimilarity(
              candidate.paper.topics,
              chosen.paper.topics,
            )
        maxSimilarity = Math.max(maxSimilarity, similarity)
      }
      const mmr = 0.7 * candidate.score - 0.3 * maxSimilarity
      if (mmr > bestMmr) {
        best = candidate
        bestMmr = mmr
      }
    }

    if (best === undefined) {
      break
    }
    selected.push(best)
    const topic = best.paper.topics[0]
    if (topic !== undefined) {
      topicCounts.set(topic, (topicCounts.get(topic) ?? 0) + 1)
    }
  }

  if (
    explorationCandidate !== undefined
    && selected.length < limit
    && canAdd(explorationCandidate, selected, topicCounts)
  ) {
    selected.push({ ...explorationCandidate, exploration: true })
  }

  const selectedIds = selected.map((item) => item.paper.id)
  const allSeen = [...priorIds, ...selectedIds]
  const hasMore = candidates.some((item) =>
    !selectedIds.includes(item.paper.id)
  )
  return {
    items: selected,
    nextCursor: hasMore && selected.length > 0
      ? encodeURIComponent(JSON.stringify(allSeen))
      : null,
  }
}

/**
 * Summarizes ranked candidates.
 * @param items - Ranked items.
 * @returns Desk statistics.
 */
export function buildFeedStats(items: ReadonlyArray<FeedItem>) {
  return {
    total: items.length,
    openAccess: items.filter((item) => item.paper.access === "open").length,
    institutionAccess: items.filter((item) => item.accessible).length,
    liked: items.filter((item) => item.liked).length,
    bookmarked: items.filter((item) => item.bookmarked).length,
  }
}
