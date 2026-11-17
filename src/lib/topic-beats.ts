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

const conceptBeats: Record<Topic, ReadonlyArray<string>> = {
  AI: [
    "artificial intelligence",
    "machine learning",
    "deep learning",
    "computer vision",
    "natural language processing",
    "data science",
  ],
  Biology: [
    "biology",
    "genetics",
    "genomics",
    "ecology",
    "microbiology",
    "neuroscience",
  ],
  Climate: [
    "climate",
    "environmental science",
    "sustainability",
    "atmospheric science",
    "oceanography",
  ],
  Education: ["education", "pedagogy", "curriculum", "didactics"],
  Economics: [
    "economics",
    "econometrics",
    "finance",
    "management",
    "political science",
  ],
  Health: [
    "medicine",
    "public health",
    "epidemiology",
    "nursing",
    "pharmacology",
  ],
  Physics: [
    "physics",
    "quantum",
    "materials science",
    "astronomy",
    "optics",
    "thermodynamics",
  ],
  Psychology: [
    "psychology",
    "psychiatry",
    "cognitive science",
    "behavioral science",
  ],
  Robotics: [
    "robotics",
    "automation",
    "control engineering",
    "mechatronics",
  ],
}

/**
 * Maps OpenAlex concept names onto the fixed beats (SPEC §17.2), without a
 * fallback so callers can count what the source metadata failed to cover.
 * @param concepts - Concept display names from the source.
 * @returns Up to three beats named by the concepts, empty when none matched.
 */
export function conceptTopics(
  concepts: ReadonlyArray<string>,
): ReadonlyArray<Topic> {
  const haystack = concepts.join(" ").toLowerCase()
  return (Object.entries(conceptBeats) as ReadonlyArray<
    readonly [Topic, ReadonlyArray<string>]
  >)
    .filter(([, names]) => names.some((name) => haystack.includes(name)))
    .map(([topic]) => topic)
    .slice(0, 3)
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
