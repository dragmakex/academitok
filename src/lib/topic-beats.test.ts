import { detectTopics } from "@/lib/openalex"
import { conceptTopics, matchedTopics } from "@/lib/topic-beats"
import { describe, expect, it } from "vitest"

describe("matchedTopics", () => {
  it("reports every beat whose keyword appears in the text", () => {
    expect(
      matchedTopics(
        "Neural network control of a robot arm",
        "A deep model drives an autonomous arm.",
      ),
    )
      .toEqual(["AI", "Robotics"])
  })

  it("reports nothing when the text carries no beat keyword", () => {
    expect(matchedTopics("Potsherd stratigraphy", "Field notes from a dig."))
      .toEqual([])
  })

  it("keeps at most three beats", () => {
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
  it("maps a concept name onto its beat", () => {
    expect(conceptTopics(["Quantum mechanics", "Physics"])).toEqual([
      "Physics",
    ])
  })

  it("reports nothing when no concept names a beat", () => {
    expect(conceptTopics(["Sociology", "History"])).toEqual([])
  })

  it("keeps at most three beats", () => {
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
    expect(detectTopics("Potsherd stratigraphy", "Field notes from a dig."))
      .toEqual(["Education"])
  })

  it("keeps the matched beats when anything matched", () => {
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

  it("keeps the keyword beat over a conflicting concept", () => {
    expect(
      detectTopics("Robot gripper design", "A manipulator study.", [
        "Quantum mechanics",
      ]),
    )
      .toEqual(["Robotics"])
  })

  it("falls back to Education when text and concepts match nothing", () => {
    expect(
      detectTopics("Potsherd stratigraphy", "Field notes from a dig.", [
        "Sociology",
      ]),
    )
      .toEqual(["Education"])
  })
})
