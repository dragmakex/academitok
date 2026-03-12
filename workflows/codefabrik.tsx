/* @jsxImportSource smithers-orchestrator */
import { $ } from "bun"
import {
  CodexAgent,
  createSmithers,
  Ralph,
  Sequence,
  Task,
  Workflow,
} from "smithers-orchestrator"
import { z } from "zod"

const repoRoot = process.cwd()

// ── Shell helpers ──

/**
 * Run a command via Bun shell deterministically. Captures stdout, stderr, exitCode.
 * Never throws — caller decides how to handle non-zero exits.
 * @param command
 * @param cwd
 */
async function shell(command: string, cwd = repoRoot) {
  const result = await $`${{ raw: command }}`.cwd(cwd).nothrow().quiet()
  return {
    stdout: result.stdout.toString().trim(),
    stderr: result.stderr.toString().trim(),
    exitCode: result.exitCode,
  }
}

/**
 * Run a shell command, throw on non-zero exit.
 * @param command
 * @param cwd
 */
async function shellOrThrow(command: string, cwd = repoRoot) {
  const result = await shell(command, cwd)
  if (result.exitCode !== 0) {
    throw new Error(
      `Command failed (exit ${result.exitCode}): ${command}\n${
        result.stderr || result.stdout
      }`,
    )
  }
  return result
}

/** Collect validation errors into a structured report. */
async function runValidation() {
  const typecheck = await shell("bun run typecheck")
  const lint = await shell("bun run lint")
  const test = await shell("bun run test:coverage")
  const build = await shell("bun run build")

  const collect = (
    r: Awaited<ReturnType<typeof shell>>,
    filter: (l: string) => boolean,
  ) => ({
    success: r.exitCode === 0,
    errors: r.exitCode !== 0
      ? (r.stderr || r.stdout).split("\n").filter(filter).slice(0, 50)
      : [],
  })

  const tc = collect(typecheck, (l) => l.includes("error TS"))
  const lt = collect(lint, (l) => l.trim().length > 0)
  const ts = collect(
    test,
    (l) =>
      l.includes("FAIL") || l.includes("✗") || l
        .includes("×") || l
        .includes("Error"),
  )
  const bd = collect(build, (l) => l.trim().length > 0)

  return {
    success: tc.success && lt.success && ts.success && bd.success,
    typecheck: tc,
    lint: lt,
    test: ts,
    build: bd,
  }
}

/**
 * Format validation errors as a prompt section for Codex.
 * @param v
 * @param v.typecheck
 * @param v.typecheck.success
 * @param v.typecheck.errors
 * @param v.lint
 * @param v.lint.success
 * @param v.lint.errors
 * @param v.test
 * @param v.test.success
 * @param v.test.errors
 * @param v.build
 * @param v.build.success
 * @param v.build.errors
 */
function formatValidationErrors(v: {
  typecheck: { success: boolean; errors: Array<string> }
  lint: { success: boolean; errors: Array<string> }
  test: { success: boolean; errors: Array<string> }
  build: { success: boolean; errors: Array<string> }
}): string {
  const sections: Array<string> = []
  if (!v.typecheck.success) {
    sections.push(`## TypeScript errors\n${v.typecheck.errors.join("\n")}`)
  }
  if (!v.lint.success) {
    sections.push(`## Lint errors\n${v.lint.errors.join("\n")}`)
  }
  if (!v.test.success) {
    sections.push(`## Test failures\n${v.test.errors.join("\n")}`)
  }
  if (!v.build.success) {
    sections.push(`## Build errors\n${v.build.errors.join("\n")}`)
  }
  return sections.join("\n\n") || "No errors found."
}

// ── Output schemas ──

const branchSchema = z.object({
  branch: z.string(),
  basedOn: z.string(),
  createdAt: z.string(),
})

const discoverSchema = z.object({
  done: z.boolean(),
  ticket: z.string(),
  context: z.string(),
  remainingCount: z.number(),
})

const implementSchema = z.object({
  summary: z.string(),
  changes: z.array(z.string()).min(1),
  tests: z.array(z.string()),
})

const reviewSchema = z.object({
  approved: z.boolean(),
  issues: z.array(z.string()),
})

const validateSchema = z.object({
  success: z.boolean(),
  typecheck: z.object({ success: z.boolean(), errors: z.array(z.string()) }),
  lint: z.object({ success: z.boolean(), errors: z.array(z.string()) }),
  test: z.object({ success: z.boolean(), errors: z.array(z.string()) }),
  build: z.object({ success: z.boolean(), errors: z.array(z.string()) }),
})

const fixSchema = z.object({
  summary: z.string(),
  fixes: z.array(z.string()),
})

const commitSchema = z.object({
  changeId: z.string(),
  description: z.string(),
})

// ── Smithers setup ──

const { outputs, smithers } = createSmithers(
  {
    branch: branchSchema,
    discover: discoverSchema,
    implement: implementSchema,
    review: reviewSchema,
    validate: validateSchema,
    fix: fixSchema,
    commit: commitSchema,
  },
  { dbPath: "./workflows/codefabrik.db" },
)

const codex = new CodexAgent({
  cd: repoRoot,
  sandbox: "workspace-write",
  config: ["mcp_servers.playwright.env.NPM_CONFIG_CACHE=/tmp/npm-cache"],
})

/**
 * Codefabrik workflow: spec-driven implementation loop.
 *
 * Outer loop (Ralph):
 *   1. discover  — Codex reads spec, finds next ticket (or reports done)
 *   2. implement — Codex implements the ticket
 *   3. review    — Codex reviews against Tigerstyle
 *   4. validate  — deterministic shell (typecheck, lint, test, build)
 *   5. fix       — Codex fixes validation errors (if any, up to 3 retries)
 *   6. commit    — deterministic jj commit
 *   → back to discover until done === true
 *
 * Since nested Ralph is unsupported, review and validate-fix use
 * a single pass per outer iteration. The outer loop retries the full
 * cycle if issues persist, giving convergent behavior.
 */
export default smithers((ctx) => {
  const input = (ctx.input ?? {}) as Record<string, unknown>
  const branchName = input.branch as string | undefined
  const spec = input.spec as string | undefined

  return (
    <Workflow name="codefabrik">
      <Sequence>
        {/* ── Phase 0: Deterministic jj branch setup ── */}
        <Task id="branch" output={outputs.branch}>
          {async () => {
            const branch = branchName ?? `codefabrik/${Date.now()}`
            const base = await shellOrThrow(
              "jj log -r @ --no-graph -T change_id",
            )

            await shellOrThrow(`jj new -m ${$.escape(`wip: ${branch}`)}`)

            const bookmark = await shell(
              `jj bookmark set ${$.escape(branch)} -r @`,
            )
            if (bookmark.exitCode !== 0) {
              console.warn(`jj bookmark set warning: ${bookmark.stderr}`)
            }

            return {
              branch,
              basedOn: base.stdout,
              createdAt: new Date().toISOString(),
            }
          }}
        </Task>

        {/* ── Main loop: discover → implement → review → validate → fix → commit ── */}
        <Ralph
          until={ctx.latest("discover", "discover")?.done === true}
          maxIterations={20}
          onMaxReached="return-last"
        >
          {/* 1. Discover: read spec, identify next work item */}
          <Task id="discover" output={outputs.discover} agent={codex}>
            {`You are a spec-driven ticket decomposer.

${
              spec
                ? `## Spec\n${spec}`
                : "## Spec\nRead specs/README.md and follow its references to find the full specification."
            }

## Your job
Read the spec and the current codebase. Identify what remains to be done.
Return the NEXT SINGLE ticket to implement — the smallest meaningful unit of work.

If everything in the spec is already implemented, tested, and passing, set done=true.

## Previous work this run
${
              (() => {
                const commits = ctx.outputs("commit")
                if (!commits || commits.length === 0) {
                  return "No commits yet — this is the first iteration."
                }
                return commits
                  .map((c) => `- [${c.changeId}] ${c.description}`)
                  .join("\n")
              })()
            }

## Previous discovery
${
              (() => {
                const prev = ctx.latest("discover", "discover")
                if (!prev) {return "First discovery."}
                return `Last ticket: "${prev.ticket}" (remaining: ${prev.remainingCount})`
              })()
            }

Return done=false with a clear ticket description, or done=true if the spec is fully implemented.`}
          </Task>

          {/* 2. Implement: Codex writes code for the ticket */}
          <Task
            id="implement"
            output={outputs.implement}
            agent={codex}
            skipIf={ctx.latest("discover", "discover")?.done === true}
          >
            {`Read prompts/reviewers/TIGERSTYLE.md for code quality standards.
Read AGENTS.md for project conventions.

## Ticket
${ctx.latest("discover", "discover")?.ticket ?? "No ticket available."}

## Context
${ctx.latest("discover", "discover")?.context ?? ""}

Implement this ticket. Write tests alongside code. Keep changes minimal and focused.
If already implemented, report a no-op.`}
          </Task>

          {/* 3. Review: Codex reviews against Tigerstyle */}
          <Task
            id="review"
            output={outputs.review}
            agent={codex}
            skipIf={ctx.latest("discover", "discover")?.done === true}
          >
            {`Review the implementation of this ticket against prompts/reviewers/TIGERSTYLE.md and AGENTS.md.

## Ticket
${ctx.latest("discover", "discover")?.ticket ?? ""}

## Implementation summary
${ctx.latest("implement", "implement")?.summary ?? "No implementation summary."}

## Changes
${ctx.latest("implement", "implement")?.changes?.join("\n") ?? "None"}

Return approved=true only if code is consistent, explicit, type-safe.
If issues found, list them — the next iteration's implement step will see them.`}
          </Task>

          {/* 4. Validate: deterministic typecheck + lint + test + build */}
          <Task
            id="validate"
            output={outputs.validate}
            skipIf={ctx.latest("discover", "discover")?.done === true}
          >
            {async () => runValidation()}
          </Task>

          {/* 5. Fix: Codex fixes validation errors (only if validation failed) */}
          <Task
            id="fix"
            output={outputs.fix}
            agent={codex}
            skipIf={ctx.latest("discover", "discover")?.done === true
              || ctx.latest("validate", "validate")?.success === true}
          >
            {`Validation failed after implementing this ticket. Fix the errors.
Do NOT disable lint rules, skip tests, or use \`any\`. Fix root causes.

## Ticket that was implemented
${ctx.latest("discover", "discover")?.ticket ?? ""}

## Review issues
${ctx.latest("review", "review")?.issues?.join("\n") ?? "None"}

## Validation errors
${
              formatValidationErrors(
                ctx.latest("validate", "validate") ?? {
                  typecheck: { success: true, errors: [] },
                  lint: { success: true, errors: [] },
                  test: { success: true, errors: [] },
                  build: { success: true, errors: [] },
                },
              )
            }`}
          </Task>

          {/* 6. Commit: deterministic jj describe + new change for next iteration */}
          <Task
            id="commit"
            output={outputs.commit}
            skipIf={ctx.latest("discover", "discover")?.done === true}
          >
            {async () => {
              const ticket = ctx.latest("discover", "discover")?.ticket
                ?? "work"
              const description = `feat: ${ticket}`

              await shellOrThrow(`jj describe -m ${$.escape(description)}`)
              const log = await shellOrThrow(
                "jj log -r @ --no-graph -T change_id",
              )
              const changeId = log.stdout

              // Create a fresh change for the next iteration
              await shellOrThrow("jj new")

              return { changeId, description }
            }}
          </Task>
        </Ralph>
      </Sequence>
    </Workflow>
  )
})
