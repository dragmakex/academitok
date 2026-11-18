import type { Topic } from "@/api/paper-schema"

const additionalTopics = {
  Anthropology: ["anthropology", "ethnography", "ethnographic"],
  Archaeology: ["archaeology", "archaeological", "archaeometry", "potsherd"],
  Astronomy: ["astronomy", "astrophysics", "exoplanet", "cosmology"],
  Chemistry: ["chemistry", "chemical synthesis", "spectroscopy", "catalysis"],
  "Computer Science": [
    "computer science",
    "computer systems",
    "distributed computing",
    "computational complexity",
  ],
  Ecology: ["ecology", "ecological", "biodiversity", "ecosystem"],
  Engineering: ["engineering", "structural design", "fluid dynamics"],
  Geology: [
    "geology",
    "geological",
    "seismology",
    "tectonics",
    "sedimentology",
  ],
  History: [
    "historiography",
    "medieval history",
    "oral history",
    "historical research",
  ],
  Linguistics: [
    "linguistics",
    "linguistic",
    "phonology",
    "syntax",
    "morphosyntax",
  ],
  Mathematics: [
    "mathematics",
    "number theory",
    "graph theory",
    "arithmetic geometry",
    "probability theory",
  ],
  Neuroscience: ["neuroscience", "neurobiology", "hippocampus", "synaptic"],
  Philosophy: ["philosophy", "epistemology", "metaphysics", "moral reasoning"],
  "Political Science": [
    "political science",
    "political economy",
    "international relations",
    "electoral systems",
  ],
  Sociology: [
    "sociology",
    "sociological",
    "social stratification",
    "social mobility",
  ],
} satisfies Partial<Record<Topic, ReadonlyArray<string>>>

const topicKeywords: Record<Topic, ReadonlyArray<string>> = {
  ...additionalTopics,
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

const conceptKeywords: Record<Topic, ReadonlyArray<string>> = {
  ...additionalTopics,
  History: ["history", ...additionalTopics.History],
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
    "microbiology",
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
 * Maps OpenAlex concept names onto research topics (SPEC §17.2), without a
 * fallback so callers can count what the source metadata failed to cover.
 * @param concepts - Concept display names from the source.
 * @returns Up to three topics named by the concepts, empty when none matched.
 */
export function conceptTopics(
  concepts: ReadonlyArray<string>,
): ReadonlyArray<Topic> {
  const haystack = concepts.join(" ").toLowerCase()
  return (Object.entries(conceptKeywords) as ReadonlyArray<
    readonly [Topic, ReadonlyArray<string>]
  >)
    .filter(([, names]) => names.some((name) => haystack.includes(name)))
    .map(([topic]) => topic)
    .slice(0, 3)
}

/**
 * Maps text onto research topics (SPEC §17.2), without a fallback so callers can
 * count what the taxonomy failed to cover.
 * @param title - Paper title.
 * @param abstract - Paper abstract.
 * @returns Up to three topics whose keywords appear in the text, empty when none matched.
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
