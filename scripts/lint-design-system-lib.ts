import { readFileSync } from "node:fs"
import { relative } from "node:path"
import { cwd, exit } from "node:process"

type DesignSystemViolation = {
  readonly file: string
  readonly line: number
  readonly message: string
  readonly snippet: string
}

const targetFilePattern = /^src\/(routes|component)\/.*\.(ts|tsx)$/

/**
 * Matches `className=` or `className={` attribute usage in JSX.
 *
 * Application code must not apply CSS classes directly.
 * All visual styling flows through design-system components that
 * expose typed props instead of className.
 */
const classNamePattern = /\bclassName[={]/

/**
 * Matches `style=` or `style={` attribute usage in JSX.
 */
const stylePattern = /\bstyle[={]/

/**
 * Matches route-local styled native form controls.
 * The pattern catches native elements that receive className or style.
 */
const styledNativeControlPattern =
  /<(button|input|select|textarea)\b[^>]*(?:className|style)=/

const exceptionPattern = /ds-exception:\s+.+/

const toLineNumber = (source: string, offset: number): number =>
  source.slice(0, offset).split("\n").length

const hasDocumentedException = (
  source: string,
  lineNumber: number,
): boolean => {
  const lines = source.split("\n")
  const currentLine = lines[lineNumber - 1] ?? ""
  const previousLine = lines[lineNumber - 2] ?? ""

  return exceptionPattern.test(currentLine)
    || exceptionPattern.test(previousLine)
}

const collectViolationsForPattern = (
  source: string,
  file: string,
  pattern: RegExp,
  message: string,
): Array<DesignSystemViolation> => {
  const violations: Array<DesignSystemViolation> = []
  const matches = source.matchAll(new RegExp(pattern, "g"))

  for (const match of matches) {
    const start = match.index ?? 0
    const lineNumber = toLineNumber(source, start)
    const snippet = source.split("\n")[lineNumber - 1] ?? ""

    if (hasDocumentedException(source, lineNumber)) {
      continue
    }

    violations.push({
      file,
      line: lineNumber,
      message,
      snippet: snippet.trim(),
    })
  }

  return violations
}

/**
 * Lints a set of UI source files against the design-system contract.
 *
 * The contract is simple: application code composes design-system components.
 * It does not use className, style, or raw styled native controls.
 *
 * @param files - Candidate file paths to lint.
 * @returns An array of violations.
 */
export function lintDesignSystem(
  files: ReadonlyArray<string>,
): Array<DesignSystemViolation> {
  const violations: Array<DesignSystemViolation> = []

  for (const file of files) {
    const relativePath = relative(cwd(), file)
    if (!targetFilePattern.test(relativePath)) {
      continue
    }

    const source = readFileSync(file, "utf8")
    const fileViolations = [
      ...collectViolationsForPattern(
        source,
        relativePath,
        classNamePattern,
        "Application code must not use className. Compose design-system components with typed props instead.",
      ),
      ...collectViolationsForPattern(
        source,
        relativePath,
        stylePattern,
        "Application code must not use inline style. Compose design-system components with typed props instead.",
      ),
      ...collectViolationsForPattern(
        source,
        relativePath,
        styledNativeControlPattern,
        "Use design-system control components instead of route-local styled native controls.",
      ),
    ]
    for (const violation of fileViolations) {
      violations.push(violation)
    }
  }

  return violations
}

/**
 * Prints violations and exits with a non-zero code when the contract is broken.
 *
 * @param files - Candidate file paths to lint.
 */
export function runDesignSystemLint(files: ReadonlyArray<string>) {
  const violations = lintDesignSystem(files)

  if (violations.length === 0) {
    console.log("✅ Design-system contract passed")
    return
  }

  console.error("❌ Design-system contract violations detected:\n")
  for (const violation of violations) {
    console.error(`${violation.file}:${violation.line}`)
    console.error(`  ${violation.message}`)
    console.error(`  ${violation.snippet}`)
    console.error("")
  }

  exit(1)
}
