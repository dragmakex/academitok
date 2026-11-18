import { detectTopics } from "@/lib/openalex"
import { conceptTopics, matchedTopics } from "@/lib/research-topics"
import { describe, expect, it } from "vitest"

describe("matchedTopics", () => {
  it("reports every topic whose keyword appears in the text", () => {
    expect(
      matchedTopics(
        "Neural network control of a robot arm",
        "A deep model drives an autonomous arm.",
      ),
    )
      .toEqual(["AI", "Robotics"])
  })

  it("reports nothing when the text carries no topic keyword", () => {
    expect(matchedTopics("A small puzzle", "Notes from a walk."))
      .toEqual([])
  })

  it("keeps at most three topics", () => {
    expect(
      matchedTopics(
        "Climate, learning and patient health",
        "Carbon policy meets clinical medicine.",
      ),
    )
      .toHaveLength(3)
  })
})

describe("conceptTopics", () => {
  it("maps a concept name onto its topic", () => {
    expect(conceptTopics(["Quantum mechanics", "Physics"])).toEqual([
      "Physics",
    ])
  })

  it("reports nothing when no concept names a topic", () => {
    expect(conceptTopics(["General knowledge"])).toEqual([])
  })

  it("keeps at most three topics", () => {
    expect(
      conceptTopics([
        "Machine learning",
        "Genetics",
        "Climate change",
        "Robotics",
      ]),
    )
      .toHaveLength(3)
  })
})

describe("detectTopics", () => {
  it("files unmatched text under the Education fallback", () => {
    expect(detectTopics("A small puzzle", "Notes from a walk."))
      .toEqual(["Education"])
  })

  it("keeps the matched topics when anything matched", () => {
    expect(detectTopics("Quantum sensors", "A material study."))
      .toEqual(["Physics"])
  })

  it("falls back to the source concepts when no keyword matched", () => {
    expect(
      detectTopics("Bohmian trajectories", "Pilot waves revisited.", [
        "Quantum mechanics",
      ]),
    )
      .toEqual(["Physics"])
  })

  it("keeps the keyword topic over a conflicting concept", () => {
    expect(
      detectTopics("Robot gripper design", "A manipulator study.", [
        "Quantum mechanics",
      ]),
    )
      .toEqual(["Robotics"])
  })

  it("falls back to Education when text and concepts match nothing", () => {
    expect(
      detectTopics("A small puzzle", "Notes from a walk.", [
        "General knowledge",
      ]),
    )
      .toEqual(["Education"])
  })
})
