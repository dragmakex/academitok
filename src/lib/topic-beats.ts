import type { Topic } from "@/api/paper-schema"

const topicKeywords: Record<Topic, ReadonlyArray<string>> = {
  AI: ["artificial intelligence", "machine learning", "neural", "llm"],
  Biology: ["biology", "protein", "genome", "cell"],
  Climate: ["climate", "carbon", "energy", "emissions"],
  Education: ["education", "learning", "pedagogy", "student"],
  Economics: ["economics", "market", "policy", "finance"],
  Health: ["health", "clinical", "medicine", "patient"],
  Physics: ["physics", "quantum", "material", "sensor"],
  Psychology: ["psychology", "behavior", "cognitive", "mental"],
  Robotics: ["robot", "robotics", "autonomous", "control"],
}

/**
 * Maps text onto the fixed beats (SPEC §17.2), without a fallback so callers can
 * count what the taxonomy failed to cover.
 * @param title - Paper title.
 * @param abstract - Paper abstract.
 * @returns Up to three beats whose keywords appear in the text, empty when none matched.
 */
export function matchedTopics(
  title: string,
  abstract: string,
): ReadonlyArray<Topic> {
  const haystack = `${title} ${abstract}`.toLowerCase()
  return (Object.entries(topicKeywords) as ReadonlyArray<
    readonly [Topic, ReadonlyArray<string>]
  >)
    .filter(([, keywords]) =>
      keywords.some((keyword) => haystack.includes(keyword))
    )
    .map(([topic]) => topic)
    .slice(0, 3)
}
