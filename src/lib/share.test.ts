import { shareTargets } from "@/lib/share"
import { describe, expect, it } from "vitest"

const payload = {
  title: "AcademiTok — Evening Edition",
  text:
    "AcademiTok · Evening Edition · Folio 001\nAI — A paper & a title — Author (2024)",
  url: "https://academitok.example/?edition=a,b",
}

describe("share targets", () => {
  it("sends every platform the headline, the copy and the link", () => {
    const targets = shareTargets(payload)

    expect(targets.map((target) => target.label)).toEqual([
      "X",
      "Bluesky",
      "Facebook",
      "LinkedIn",
      "Reddit",
      "WhatsApp",
      "Telegram",
      "Email",
    ])
    for (const target of targets) {
      expect(decodeURIComponent(target.href)).toContain(payload.url)
    }
    // Only the destinations that print a title get one.
    for (const label of ["Reddit", "Email"]) {
      const target = targets.find((candidate) => candidate.label === label)
      expect(decodeURIComponent(target?.href ?? "")).toContain(payload.title)
    }
  })

  it("escapes an ampersand so the link survives the platform", () => {
    const [x] = shareTargets(payload)

    expect(x?.href).toContain("%20%26%20")
    expect(new URL(x?.href ?? "").searchParams.get("text")).toBe(payload.text)
  })

  it("falls back to the bare link when there is no copy to send", () => {
    const [, bluesky] = shareTargets({ ...payload, text: "   " })

    expect(new URL(bluesky?.href ?? "").searchParams.get("text")).toBe(
      payload.url,
    )
  })
})
