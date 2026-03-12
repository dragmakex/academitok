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

type ShellResult = {
  stdout: string
  stderr: string
  exitCode: number
}

type ValidationSection = {
  success: boolean
  errors: Array<string>
}

type ValidationResult = {
  success: boolean
  typecheck: ValidationSection
  lint: ValidationSection
  test: ValidationSection
  build: ValidationSection
}

// ── Shell helpers ──

/**
 * Run a command via Bun shell deterministically. Captures stdout, stderr, exitCode.
 * Never throws — caller decides how to handle non-zero exits.
 * @param command Shell command to execute.
 * @param cwd Working directory for the command.
 * @returns Captured command output and exit metadata.
 */
async function shell(command: string, cwd = repoRoot): Promise<ShellResult> {
  const result = await $`${{ raw: command }}`.cwd(cwd).nothrow().quiet()
  return {
    stdout: result.stdout.toString().trim(),
    stderr: result.stderr.toString().trim(),
    exitCode: result.exitCode,
  }
}

/**
 * Run a shell command, throw on non-zero exit.
 * @param command Shell command to execute.
 * @param cwd Working directory for the command.
 * @returns Captured command output when the command succeeds.
 */
async function shellOrThrow(
  command: string,
  cwd = repoRoot,
): Promise<ShellResult> {
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

/**
 * Extract a bounded error list from a validation command result.
 * @param result Command result to inspect.
 * @param filter Predicate that keeps only relevant error lines.
 * @returns Structured validation status for a single command.
 */
function collectValidationSection(
  result: ShellResult,
  filter: (line: string) => boolean,
): ValidationSection {
  return {
    success: result.exitCode === 0,
    errors: result.exitCode !== 0
      ? (result.stderr || result.stdout).split("\n").filter(filter).slice(0, 50)
      : [],
  }
}

/**
 * Collect validation errors into a structured report.
 * @returns Aggregated validation results for typecheck, lint, test, and build.
 */
async function runValidation(): Promise<ValidationResult> {
  const typecheck = await shell("bun run typecheck")
  const lint = await shell("bun run lint")
  const test = await shell("bun run test:coverage")
  const build = await shell("bun run build")

  const tc = collectValidationSection(
    typecheck,
    (line) => line.includes("error TS"),
  )
  const lt = collectValidationSection(lint, (line) => line.trim().length > 0)
  const ts = collectValidationSection(
    test,
    (line) =>
      line.includes("FAIL") || line.includes("✗") || line
        .includes("×") || line
        .includes("Error"),
  )
  const bd = collectValidationSection(build, (line) => line.trim().length > 0)

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
 * @param validation Structured validation result to render.
 * @returns Human-readable validation errors grouped by check type.
 */
function formatValidationErrors(validation: ValidationResult): string {
  const sections: Array<string> = []
  if (!validation.typecheck.success) {
    sections.push(
      `## TypeScript errors\n${validation.typecheck.errors.join("\n")}`,
    )
  }
  if (!validation.lint.success) {
    sections.push(`## Lint errors\n${validation.lint.errors.join("\n")}`)
  }
  if (!validation.test.success) {
    sections.push(`## Test failures\n${validation.test.errors.join("\n")}`)
  }
  if (!validation.build.success) {
    sections.push(`## Build errors\n${validation.build.errors.join("\n")}`)
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
 * Since nested Ralph is unsupported, review and validate-fix use
 * a single pass per outer iteration. The outer loop retries the full
 * cycle if issues persist, giving convergent behavior.
 */
type WorkflowContext = Parameters<Parameters<typeof smithers>[0]>[0]

const emptyValidationResult: ValidationResult = {
  success: true,
  typecheck: { success: true, errors: [] },
  lint: { success: true, errors: [] },
  test: { success: true, errors: [] },
  build: { success: true, errors: [] },
}

/**
 * Format the optional spec section for the discover prompt.
 * @param spec Inline spec content provided to the workflow.
 * @returns Prompt section that tells Codex where to read the spec.
 */
function buildSpecSection(spec: string | undefined): string {
  return spec
    ? `## Spec\n${spec}`
    : "## Spec\nRead specs/README.md and follow its references to find the full specification."
}

/**
 * Format the list of commits created during the current run.
 * @param ctx Smithers workflow context.
 * @returns Human-readable commit history for the prompt.
 */
function formatPreviousWork(ctx: WorkflowContext): string {
  const commits = ctx.outputs("commit")
  if (!commits || commits.length === 0) {
    return "No commits yet — this is the first iteration."
  }

  return commits
    .map((commit) => `- [${commit.changeId}] ${commit.description}`)
    .join("\n")
}

/**
 * Format the previous discovery state for the discover prompt.
 * @param ctx Smithers workflow context.
 * @returns Summary of the previous discovery step.
 */
function formatPreviousDiscovery(ctx: WorkflowContext): string {
  const previousDiscovery = ctx.latest("discover", "discover")
  if (!previousDiscovery) {
    return "First discovery."
  }

  return `Last ticket: "${previousDiscovery.ticket}" (remaining: ${previousDiscovery.remainingCount})`
}

/**
 * Build the discover prompt for the current loop iteration.
 * @param ctx Smithers workflow context.
 * @param spec Inline spec content provided to the workflow.
 * @returns Prompt instructing Codex to identify the next ticket.
 */
function buildDiscoverPrompt(
  ctx: WorkflowContext,
  spec: string | undefined,
): string {
  return `You are a spec-driven ticket decomposer.

${buildSpecSection(spec)}

## Your job
Read the spec and the current codebase. Identify what remains to be done.
Return the NEXT SINGLE ticket to implement — the smallest meaningful unit of work.

If everything in the spec is already implemented, tested, and passing, set done=true.

## Previous work this run
${formatPreviousWork(ctx)}

## Previous discovery
${formatPreviousDiscovery(ctx)}

Return done=false with a clear ticket description, or done=true if the spec is fully implemented.`
}

/**
 * Build the implement prompt for the current ticket.
 * @param ctx Smithers workflow context.
 * @returns Prompt instructing Codex to implement the selected ticket.
 */
function buildImplementPrompt(ctx: WorkflowContext): string {
  return `Read prompts/reviewers/TIGERSTYLE.md for code quality standards.
Read AGENTS.md for project conventions.

## Ticket
${ctx.latest("discover", "discover")?.ticket ?? "No ticket available."}

## Context
${ctx.latest("discover", "discover")?.context ?? ""}

Implement this ticket. Write tests alongside code. Keep changes minimal and focused.
If already implemented, report a no-op.`
}

/**
 * Build the review prompt for the current ticket implementation.
 * @param ctx Smithers workflow context.
 * @returns Prompt instructing Codex to review the recent implementation.
 */
function buildReviewPrompt(ctx: WorkflowContext): string {
  return `Review the implementation of this ticket against prompts/reviewers/TIGERSTYLE.md and AGENTS.md.

## Ticket
${ctx.latest("discover", "discover")?.ticket ?? ""}

## Implementation summary
${ctx.latest("implement", "implement")?.summary ?? "No implementation summary."}

## Changes
${ctx.latest("implement", "implement")?.changes?.join("\n") ?? "None"}

Return approved=true only if code is consistent, explicit, type-safe.
If issues found, list them — the next iteration's implement step will see them.`
}

/**
 * Build the fix prompt when deterministic validation fails.
 * @param ctx Smithers workflow context.
 * @returns Prompt instructing Codex to resolve validation failures.
 */
function buildFixPrompt(ctx: WorkflowContext): string {
  const validation = ctx.latest("validate", "validate") ?? emptyValidationResult
  return `Validation failed after implementing this ticket. Fix the errors.
Do NOT disable lint rules, skip tests, or use \`any\`. Fix root causes.

## Ticket that was implemented
${ctx.latest("discover", "discover")?.ticket ?? ""}

## Review issues
${ctx.latest("review", "review")?.issues?.join("\n") ?? "None"}

## Validation errors
${formatValidationErrors(validation)}`
}

/**
 * Create the initial branch or bookmark for the workflow run.
 * @param branchName Optional caller-provided branch name.
 * @returns Metadata describing the created branch state.
 */
async function createBranch(branchName: string | undefined) {
  const branch = branchName ?? `codefabrik/${Date.now()}`
  const base = await shellOrThrow("jj log -r @ --no-graph -T change_id")

  await shellOrThrow(`jj new -m ${$.escape(`wip: ${branch}`)}`)

  const bookmark = await shell(`jj bookmark set ${$.escape(branch)} -r @`)
  if (bookmark.exitCode !== 0) {
    console.warn(`jj bookmark set warning: ${bookmark.stderr}`)
  }

  return {
    branch,
    basedOn: base.stdout,
    createdAt: new Date().toISOString(),
  }
}

/**
 * Commit the current work and create a fresh change for the next iteration.
 * @param ctx Smithers workflow context.
 * @returns Change metadata recorded in the workflow outputs.
 */
async function createCommit(ctx: WorkflowContext) {
  const ticket = ctx.latest("discover", "discover")?.ticket ?? "work"
  const description = `feat: ${ticket}`

  await shellOrThrow(`jj describe -m ${$.escape(description)}`)
  const log = await shellOrThrow("jj log -r @ --no-graph -T change_id")
  const changeId = log.stdout

  await shellOrThrow("jj new")

  return { changeId, description }
}

/**
 * Render the Codefabrik workflow body.
 * @param ctx Smithers workflow context.
 * @param branchName Optional caller-provided branch name.
 * @param spec Inline spec content provided to the workflow.
 * @returns Workflow JSX for Smithers.
 */
function renderWorkflow(
  ctx: WorkflowContext,
  branchName: string | undefined,
  spec: string | undefined,
) {
  const done = ctx.latest("discover", "discover")?.done === true
  const validationSucceeded =
    ctx.latest("validate", "validate")?.success === true

  return (
    <Workflow name="codefabrik">
      <Sequence>
        {/* ── Phase 0: Deterministic jj branch setup ── */}
        <Task id="branch" output={outputs.branch}>
          {async () => createBranch(branchName)}
        </Task>

        {/* ── Main loop: discover → implement → review → validate → fix → commit ── */}
        <Ralph
          until={done}
          maxIterations={20}
          onMaxReached="return-last"
        >
          {/* 1. Discover: read spec, identify next work item */}
          <Task id="discover" output={outputs.discover} agent={codex}>
            {buildDiscoverPrompt(ctx, spec)}
          </Task>

          {/* 2. Implement: Codex writes code for the ticket */}
          <Task
            id="implement"
            output={outputs.implement}
            agent={codex}
            skipIf={done}
          >
            {buildImplementPrompt(ctx)}
          </Task>

          {/* 3. Review: Codex reviews against Tigerstyle */}
          <Task
            id="review"
            output={outputs.review}
            agent={codex}
            skipIf={done}
          >
            {buildReviewPrompt(ctx)}
          </Task>

          {/* 4. Validate: deterministic typecheck + lint + test + build */}
          <Task
            id="validate"
            output={outputs.validate}
            skipIf={done}
          >
            {async () => runValidation()}
          </Task>

          {/* 5. Fix: Codex fixes validation errors (only if validation failed) */}
          <Task
            id="fix"
            output={outputs.fix}
            agent={codex}
            skipIf={done || validationSucceeded}
          >
            {buildFixPrompt(ctx)}
          </Task>

          {/* 6. Commit: deterministic jj describe + new change for next iteration */}
          <Task
            id="commit"
            output={outputs.commit}
            skipIf={done}
          >
            {async () => createCommit(ctx)}
          </Task>
        </Ralph>
      </Sequence>
    </Workflow>
  )
}

export default smithers((ctx) => {
  const input = (ctx.input ?? {}) as Record<string, unknown>
  const branchName = input.branch as string | undefined
  const spec = input.spec as string | undefined

  return renderWorkflow(ctx, branchName, spec)
})
