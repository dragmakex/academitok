import { detectTopics } from "@/lib/openalex"
import { matchedTopics } from "@/lib/topic-beats"
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

describe("detectTopics", () => {
  it("files unmatched text under the Education fallback", () => {
    expect(detectTopics("Potsherd stratigraphy", "Field notes from a dig."))
      .toEqual(["Education"])
  })

  it("keeps the matched beats when anything matched", () => {
    expect(detectTopics("Quantum sensors", "A material study."))
      .toEqual(["Physics"])
  })
})
