/* @jsxImportSource smithers-orchestrator */
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

const assessSchema = z.object({
  summary: z.string(),
  targets: z.array(z.string()).min(1),
  risks: z.array(z.string()),
})

const implementSchema = z.object({
  summary: z.string(),
  changes: z.array(z.string()).min(1),
  tests: z.array(z.string()),
})

const reviewSchema = z.object({
  approved: z.boolean(),
  issues: z.array(z.string()),
  nextSteps: z.array(z.string()),
})

const { outputs, smithers } = createSmithers(
  {
    assess: assessSchema,
    implement: implementSchema,
    review: reviewSchema,
  },
  { dbPath: "./workflows/effect-v4-upgrade.db" },
)

const codex = new CodexAgent({
  cd: repoRoot,
  sandbox: "workspace-write",
  config: ["mcp_servers.playwright.env.NPM_CONFIG_CACHE=/tmp/npm-cache"],
})

/**
 * Smithers workflow: upgrade Effect to v4 beta with a Codex-driven loop.
 *
 * @remarks
 * This workflow is a demo scaffold intended for repeated, resumable runs.
 */
export default smithers((ctx) => (
  <Workflow name="effect-v4-upgrade">
    <Sequence>
      <Task id="assess" output={outputs.assess} agent={codex}>
        {`Read prompts/workflows/effect-v4-upgrade.md and prompts/reviewers/TIGERSTYLE.md.
Review effect-smol MIGRATION.md and migration guides.
Inspect this repo for Effect v3 usage and outline a precise upgrade plan.
Input: ${JSON.stringify(ctx.input ?? {})}`}
      </Task>

      <Ralph
        until={ctx.latest("review", "review")?.approved === true}
        maxIterations={3}
      >
        <Task id="implement" output={outputs.implement} agent={codex}>
          {`Follow prompts/workflows/effect-v4-upgrade.md.
Apply the upgrade plan: update dependencies, replace v3 APIs with v4 equivalents, update docs, and keep changes minimal.
If the repo already matches the plan, do not modify files and report a no-op.
Summarize edits and list any tests you ran.`}
        </Task>

        <Task id="review" output={outputs.review} agent={codex}>
          {`Review the changes using prompts/reviewers/TIGERSTYLE.md.
Return approved=true only if code is consistent, explicit, and type-safe. List issues otherwise.`}
        </Task>
      </Ralph>
    </Sequence>
  </Workflow>
))
