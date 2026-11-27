// @vitest-environment node

import {
  allowedOrigins,
  resolveSignInOrigin,
} from "@/features/auth/application"
import { describe, expect, it } from "vitest"

describe("sign-in origin guard", () => {
  it("reads the allowlist out of configuration", () => {
    expect(allowedOrigins("")).toEqual([])
    expect(allowedOrigins(" https://a.example , https://b.example ,")).toEqual([
      "https://a.example",
      "https://b.example",
    ])
  })

  it("keeps the origin the browser reported when the allowlist is blank", () => {
    expect(resolveSignInOrigin("http://localhost:3000", [])).toBe(
      "http://localhost:3000",
    )
    expect(resolveSignInOrigin("https://academitok.example/", [])).toBeNull()
  })

  it("refuses an origin outside the allowlist", () => {
    const allowed = ["https://academitok.example"]
    expect(resolveSignInOrigin("https://academitok.example", allowed)).toBe(
      "https://academitok.example",
    )
    expect(resolveSignInOrigin("https://phish.example", allowed)).toBeNull()
    expect(resolveSignInOrigin("http://academitok.example", allowed)).toBeNull()
  })

  it("refuses any origin when allowlist is required and blank", () => {
    expect(
      resolveSignInOrigin("https://academitok.example", [], true),
    )
      .toBeNull()
  })

  it("refuses anything that is not a bare origin", () => {
    for (
      const origin of [
        "",
        "javascript:alert(1)",
        "//phish.example",
        "https://phish.example/path",
        "https://phish.example?x=1",
        "https://user:pass@phish.example",
      ]
    ) {
      expect(resolveSignInOrigin(origin, [])).toBeNull()
    }
  })
})
