import { ESLint } from "eslint"
import { describe, expect, it } from "vitest"

type LintResult = {
  readonly message: string
  readonly ruleId: string | null
}

/**
 * Runs ESLint against an in-memory source sample.
 *
 * Negative samples in this file are deliberately labelled inside their own
 * source text so they cannot be mistaken for production reference code.
 *
 * @param filePath - The virtual file path used for ESLint rule scoping.
 * @param source - The source sample to lint.
 * @returns The lint messages emitted for the sample.
 */
const lintText = async (
  filePath: string,
  source: string,
): Promise<Array<LintResult>> => {
  const eslint = new ESLint({
    cwd: process.cwd(),
    overrideConfigFile: "eslint.config.js",
  })

  const [result] = await eslint.lintText(source, { filePath })

  return result?.messages.map((message) => ({
    message: message.message,
    ruleId: message.ruleId,
  })) ?? []
}

/**
 * Checks whether a lint result set contains a specific rule violation.
 *
 * @param messages - The emitted lint messages.
 * @param ruleId - The rule identifier to search for.
 * @returns True when the rule is present in the result set.
 */
const hasRule = (
  messages: ReadonlyArray<LintResult>,
  ruleId: string,
): boolean => messages.some((message) => message.ruleId === ruleId)

describe("simple made easy lint rules", () => {
  it("rejects ambient wall-clock time in shared library modules", async () => {
    const messages = await lintText(
      "src/lib/example.ts",
      `
/**
 * NEGATIVE EXAMPLE FOR LINT VERIFICATION ONLY.
 * Do not copy this shape into production code.
 */
const dehydrate = () => ({ dehydratedAt: Date.now() })
`,
    )

    expect(hasRule(messages, "local-advanced/no-ambient-time")).toBe(true)
  })

  it("accepts boundary-supplied time as plain data", async () => {
    const messages = await lintText(
      "src/lib/example.ts",
      `
/**
 * Positive reference example.
 * This is the intended production shape.
 */
const dehydrate = (dehydratedAt: number) => ({ dehydratedAt })
`,
    )

    expect(hasRule(messages, "local-advanced/no-ambient-time")).toBe(false)
  })

  it("rejects ambient randomness in repository modules", async () => {
    const messages = await lintText(
      "src/db/example.ts",
      `
/**
 * NEGATIVE EXAMPLE FOR LINT VERIFICATION ONLY.
 * Do not copy this shape into production code.
 */
const createTodo = () => ({ id: crypto.randomUUID() })
`,
    )

    expect(hasRule(messages, "local-advanced/no-ambient-randomness")).toBe(true)
  })

  it("accepts explicit id providers in repository modules", async () => {
    const messages = await lintText(
      "src/db/example.ts",
      `
/**
 * Positive reference example.
 * This is the intended production shape.
 */
const createTodo = (nextId: () => string) => ({ id: nextId() })
`,
    )

    expect(hasRule(messages, "local-advanced/no-ambient-randomness")).toBe(
      false,
    )
  })

  it("rejects exported mutable bindings", async () => {
    const messages = await lintText(
      "src/lib/example.ts",
      `
/**
 * NEGATIVE EXAMPLE FOR LINT VERIFICATION ONLY.
 * Do not copy this shape into production code.
 */
export let initialized = false
`,
    )

    expect(hasRule(messages, "local-advanced/no-exported-mutable-bindings"))
      .toBe(true)
  })

  it("accepts immutable exports", async () => {
    const messages = await lintText(
      "src/lib/example.ts",
      `
/**
 * Positive reference example.
 * This is the intended production shape.
 */
export const initialized = false
`,
    )

    expect(hasRule(messages, "local-advanced/no-exported-mutable-bindings"))
      .toBe(false)
  })

  it("rejects Effect.gen orchestration in route entry modules", async () => {
    const messages = await lintText(
      "src/routes/example.tsx",
      `
/**
 * NEGATIVE EXAMPLE FOR LINT VERIFICATION ONLY.
 * Do not copy this shape into production code.
 */
const loader = Effect.gen(function*() {
  return []
})
`,
    )

    expect(hasRule(messages, "local-advanced/no-effect-gen-in-routes")).toBe(
      true,
    )
  })

  it("accepts route modules that only delegate", async () => {
    const messages = await lintText(
      "src/routes/example.tsx",
      `
/**
 * Positive reference example.
 * This is the intended production shape.
 */
const loader = loadTodosFromService
`,
    )

    expect(hasRule(messages, "local-advanced/no-effect-gen-in-routes")).toBe(
      false,
    )
  })
})
