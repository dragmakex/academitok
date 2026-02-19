# Agent Instructions

This is a **TanStack Start** full-stack application built with **Effect-TS**, **Bun**, and **React**. The project uses Effect for functional programming patterns, state management with @effect-atom, and type-safe RPC communication.

---

## 🇩🇪 Engineering Philosophy: German Precision & Minimalism

**YOU MUST EMBODY THESE PRINCIPLES IN EVERY CHANGE:**

### Root Cause, Not Symptoms

- **Fix root causes**, never patch symptoms
- Trace problems to their source, understand the system deeply
- Reject quick fixes that create technical debt
- Question assumptions, verify with evidence

### Minimal Dependencies

- **Use minimal dependencies** - each dependency is a liability
- Prefer standard library and existing project dependencies
- Only add new dependencies when clearly justified and no alternative exists
- Dependencies must be: well-maintained, widely adopted, minimal in scope

### Long-Term Thinking

- **Accept more work now for long-term benefit**
- Write code that will be maintainable in 5 years
- Optimize for clarity and correctness, then performance
- Simple, explicit solutions over clever abstractions

### High Efficiency

- **Every line of code must justify its existence**
- No redundant code, no premature optimization
- Delete more than you add when possible
- Refactor ruthlessly when improving the system

### Precision & Thoroughness

- **Type safety is non-negotiable** - if TypeScript allows `any`, you failed
- **Tests verify behavior** - no untested code paths
- **Documentation explains why** - code shows how, docs explain why
- **Mermaid diagrams for architecture** - visual clarity for complex systems

---

## 📋 Mandatory Workflow - NO EXCEPTIONS

### Before ANY Code Change

1. Version Control Hygiene

   **Branch Workflow:**
   - **Branch naming**: `feature/name`, `fix/name`, `refactor/name`, `docs/name`
   - **Master stays clean** - never commit directly to master
   - **Commit frequently** - step-wise commits document your thought process
   - **Open PR when done** - merge into master via pull request and watch the pipeline for errors

   **Commit Frequency:**
   - ✅ Commit after each logical step (not just when "done")
   - ✅ Each commit should have a clear, single purpose
   - ✅ Commits tell a story - future you will thank you
   - ✅ Step-wise commits make PRs easier to review
   - ❌ Don't wait until everything is perfect to commit
   - ❌ Don't create giant "implement everything" commits

   **Example Workflow:**
   ```bash
   # 1. Create and checkout feature branch
   git checkout -b feature/user-auth

   # 2. Make changes, commit frequently
   git commit -m "feat: add User schema with validation"
   git commit -m "feat: implement JWT token generation"
   git commit -m "test: add user authentication tests"
   git commit -m "docs: document auth flow in docs/app/user-auth/"

   # 3. Push and create PR
   git push -u origin feature/user-auth
   gh pr create --title "Add user authentication" --body "..."

   # 3.5. Watch CI and fix any failures
   ./scripts/ci-watch.sh
   # Shows spinner progress, then final status with logs on failure
   # If CI fails: read the logs, fix the issue, commit, push, run again

   # 4. After PR merged, cleanup
   git checkout master
   git pull
   git branch -d feature/user-auth
   ```

   If we can and don't need to do the work ourselves use handoff documents and the PRDs to handoff tasks to subagents. Let them report back with a handoff themselves so you can work efficiently like a true german 🇩🇪

2. **READ EXISTING DOCUMENTATION**
   - Check `docs/architecture/overview.md` for system architecture
   - Check `docs/guides/` for relevant patterns and workflows
   - Understand how your change fits into the existing system
   - **DO NOT skip this** - you cannot improve what you don't understand

3. **Understand Repository Structure**
   ```
   src/
   ├── api/          # Server-side API handlers
   ├── component/    # React components with tests
   ├── lib/          # Shared utilities and Effect services
   ├── routes/       # TanStack Router routes (file-based routing)
   └── visual/       # Visual regression tests

   docs/
   ├── architecture/ # System architecture and design decisions
   ├── diagrams/     # Mermaid diagram sources
   ├── guides/       # Implementation guides and patterns
   └── app/          # DOCUMENT YOUR WORK HERE (see below)

   tests/            # Integration and E2E tests
   scripts/          # Build and utility scripts
   docker/           # Observability stack (Grafana, Loki, Tempo, Prometheus)
   ```

### During Implementation

4. **Write Code with German Precision**
   - Follow existing patterns in the codebase
   - Maintain type safety - no `any`, no `as` casts without justification
   - Write self-documenting code - clear names, obvious intent
   - Add comments ONLY when "why" is not obvious from code

5. **Create Tests FIRST or ALONGSIDE**
   - Unit tests for utilities and services (`*.test.ts`)
   - Component tests for UI (`*.test.tsx`)
   - Visual tests for visual components (`src/visual/*.test.tsx`)
   - Integration tests when crossing boundaries
   - **Coverage is not a metric** - test behavior, not lines

6. **COMMIT FREQUENTLY (Step-wise Commits)**
   - Commit after each logical unit of work
   - Each commit should pass verification (typecheck, lint, test)
   - Write clear commit messages following conventional commits format
   - Don't wait until feature is "complete" - commit as you go
   - Step-wise commits create documentation of your thought process

### After Implementation

7. **VERIFY - All Must Pass**
   ```bash
   bun run typecheck      # TypeScript must be clean - ZERO errors
   bun run lint           # ESLint must pass - fix, don't disable
   bun run test:coverage  # All tests pass + 100% coverage - NO EXCEPTIONS
   bun run build          # Build must succeed - verify production readiness
   ```

   **Coverage Requirements (German Precision - 100%):**
   - ✅ 100% line coverage
   - ✅ 100% function coverage
   - ✅ 100% branch coverage
   - ✅ 100% statement coverage
   - ❌ No exceptions - every line must be tested
   - ❌ No skipping coverage checks
   - 📊 View coverage report: `bun run test:coverage:ui`

   **IF ANY FAIL**: Fix them. Do not proceed. Do not ask for permission to skip.

8. **Run Full Validation**
   ```bash
   bun run validate   # Runs: typecheck + lint + format + docs + coverage + perf
   ```

   This is your **definition of done**. If this fails, you're not done.

   **Validation includes:**
   - ✅ TypeScript type checking (zero errors)
   - ✅ ESLint + TSDoc completeness
   - ✅ Code formatting (dprint)
   - ✅ Documentation quality (structure, diagrams, implementation match)
   - ✅ Test coverage (100% required)
   - ✅ Performance (bundle size)

### Documentation Requirements

9. **DOCUMENT YOUR WORK in `docs/app/`**

   **For every feature, bug fix, or significant change**, create or update documentation in `docs/app/[feature-name]/`:

   ```
   docs/app/[feature-name]/
   ├── README.md           # Overview, purpose, usage
   ├── architecture.md     # Design decisions, trade-offs
   ├── implementation.md   # Technical details, key files
   └── diagrams/          # Mermaid diagrams
       ├── flow.md        # Data/control flow
       └── structure.md   # Component/module structure
   ```

   **Documentation Standards:**
   - **Precision**: Like a German technical manual - every detail matters
   - **Mermaid diagrams**: System diagrams, flow charts, sequence diagrams
   - **Why over What**: Code shows what, docs explain why
   - **Trade-offs**: Document alternatives considered and why rejected
   - **Future maintainers**: Write for someone who knows nothing about your change

   **Example Mermaid Diagram:**
   ````markdown
   ```mermaid
   sequenceDiagram
       participant Client
       participant Router
       participant Service
       participant Database

       Client->>Router: HTTP Request
       Router->>Service: Validate & Route
       Service->>Database: Query Effect
       Database-->>Service: Result<Data, DbError>
       Service-->>Router: Effect<Response, AppError>
       Router-->>Client: HTTP Response
   ```
   ````

   **TSDoc Requirements (Enforced by ESLint):**
   - ✅ All exported functions must have TSDoc comments
   - ✅ Include function description (what it does and why)
   - ✅ Document all `@param` with types and descriptions
   - ✅ Document `@returns` with type and description
   - ✅ Add `@example` for non-trivial functions
   - ✅ Explain `@throws` for error conditions
   - ❌ No missing documentation - ESLint will fail

   **Documentation Quality Checks:**
   ```bash
   bun run docs:check  # Automated documentation quality verification
   ```

   This checks:
   - ✅ `docs/app/` structure is maintained
   - ✅ Required files exist (README.md, architecture.md, etc.)
   - ✅ Mermaid diagrams are present
   - ✅ Documentation matches implementation
   - ✅ TSDoc completeness (via ESLint)

   **See existing docs** for examples:
   - `docs/architecture/overview.md` - High-level architecture with Mermaid
   - `docs/guides/testing.md` - Testing patterns and practices
   - `docs/guides/code-quality.md` - Quality standards
   - `docs/app/README.md` - Feature documentation standards

### Pull Request & Merge

10. **OPEN PULL REQUEST**

    Once your feature is complete, documented, and validated:

    ```bash
    # Push your branch
    git push -u origin feature/your-feature-name

    # Create pull request (using gh CLI)
    gh pr create \
      --title "feat: clear description of feature" \
      --body "Detailed description with context, changes, and testing notes"
    ```

    **Pull Request Requirements:**
    - ✅ All commits follow conventional commits format
    - ✅ `bun run validate` passes
    - ✅ Documentation in `docs/app/` is complete
    - ✅ PR description explains **why**, not just what
    - ✅ Step-wise commits tell a clear story

    **PR Description Template:**
    ```markdown
    ## Summary

    Brief overview of what and why

    ## Changes

    - List of key changes
    - Reference file paths

    ## Testing

    - How it was tested
    - What scenarios were covered

    ## Documentation

    - Link to docs/app/[feature-name]/
    - Any architectural decisions documented
    ```

    **Merge Strategy:**
    - Use **merge commits** (not squash, not rebase)
    - Preserve step-wise commit history
    - Commits tell the implementation story

11. **CLEANUP AFTER MERGE**

    ```bash
    # Update master
    git checkout master
    git pull

    # Delete local branch (after PR merged)
    git branch -d feature/your-feature-name
    ```

---

## 📚 Required Reading - Study These Before Making Changes

### Effect Best Practices

**Before implementing Effect features**, run `effect-solutions list` and read the relevant guide:

```bash
effect-solutions list                    # See all available topics
effect-solutions show services-and-layers # DI patterns
effect-solutions show data-modeling      # Schema, brands, validation
effect-solutions show error-handling     # TaggedError patterns
effect-solutions show testing            # @effect/vitest integration
```

**Effect Source Reference:** `~/.local/share/effect-solutions/effect`

- Search here for real implementations when docs aren't enough
- Study actual Effect code to understand patterns deeply
- Grep for examples: `cd ~/.local/share/effect-solutions/effect && grep -r "YourPattern"`

### Project Documentation

**READ THESE BEFORE YOU START:**

1. **Architecture**: `docs/architecture/overview.md`
   - Complete system architecture with Mermaid diagrams
   - Technology choices and justifications
   - Data flow and integration points

2. **Code Quality**: `docs/guides/code-quality.md`
   - Code standards and patterns
   - TypeScript configuration rationale
   - Linting and formatting rules

3. **Testing Strategy**: `docs/guides/testing.md`
   - Testing philosophy and patterns
   - Unit, component, visual, and integration tests
   - @effect/vitest usage and TestContext

4. **Performance**: `docs/guides/performance-monitoring.md`
   - Performance budgets and monitoring
   - OpenTelemetry tracing patterns
   - Bundle size constraints

5. **Getting Started**: `docs/guides/getting-started.md`
   - Development setup and workflow
   - Available scripts and tools
   - Local development environment

**These are not optional reading.** You cannot maintain quality without understanding the system.

---

## 🛠️ Tech Stack & Patterns

### Core Technologies

- **Effect-TS** - Functional effect system for type-safe async/sync operations
- **TanStack Start** - Full-stack React framework with SSR and file-based routing
- **Bun** - Runtime and package manager
- **@effect-atom** - Atomic state management (similar to Jotai)
- **@effect/rpc** - Type-safe client-server communication
- **Vitest** - Testing with @effect/vitest integration
- **Playwright** - Browser testing (Chromium, Firefox, WebKit)

### Observability Stack

- **OpenTelemetry** - Distributed tracing with @effect/opentelemetry
- **Grafana Stack** - Loki (logs), Tempo (traces), Prometheus (metrics)
- **Sentry** - Error tracking and monitoring
- **PostHog** - Product analytics and feature flags

### Development Tools

- **TypeScript** - Strict mode, Effect Language Service enabled
- **ESLint** - @effect/eslint-plugin for Effect-specific patterns
- **dprint** - Fast, opinionated code formatting
- **Tailwind CSS 4** - Utility-first styling

---

## 🔍 Finding Things in the Codebase

### Effect Services & Layers

- Search: `grep -r "Context.Tag" src/`
- Search: `grep -r "Layer.effect" src/`
- Pattern: Services in `src/lib/`, layers in same file or `src/lib/layers/`

### Routes & API Handlers

- File-based routing: `src/routes/[route-name]/route.tsx`
- API routes: `src/routes/api/[endpoint]/route.ts`
- Route exports: `createFileRoute()` for pages, handlers for API

### Components

- Components: `src/component/[ComponentName].tsx`
- Tests: `src/component/[ComponentName].test.tsx`
- Visual tests: `src/visual/[ComponentName].test.tsx`

### Configuration

- TypeScript: `tsconfig.json` - Effect Language Service configured
- Vite: `vite.config.ts` - Build configuration
- ESLint: `eslint.config.js` - Linting rules
- Formatting: `dprint.json` - Code formatting

---

## ⚡ Development Workflow

```bash
# Development
bun run dev              # Start dev server (port 3000)

# Quality Checks (run these frequently)
bun run typecheck        # Type checking with Effect diagnostics
bun run lint             # ESLint validation
bun run lint:fix         # Auto-fix linting issues
bun run format           # Format code with dprint
bun run format:check     # Check formatting without fixing

# Testing
bun run test             # Run all tests
bun run test:unit        # Unit tests only
bun run test:component   # Component tests only
bun run test:visual      # Visual regression tests
bun run test:watch       # Watch mode for TDD

# Performance
bun run build            # Production build
bun run size             # Check bundle size
bun run perf:check       # Build + size check

# Full Validation (run before committing)
bun run validate         # typecheck + lint + format + test + perf

# CI Verification (run after pushing PR)
./scripts/ci-watch.sh    # Watch GitHub Actions, show logs on failure
```

---

## 🚫 Anti-Patterns - DO NOT DO THESE

1. **Working directly on master** - "It's a small change" ❌ → **ALWAYS create a feature branch**
2. **One giant commit** - "I'll commit when it's done" ❌ → **Commit step-wise**
3. **Squashing commits** - "Clean history looks better" ❌ → **Preserve step-wise history**
4. **Skipping verification** - "It compiles so it's fine" ❌
5. **Ignoring linting errors** - "I'll fix it later" ❌
6. **Commenting out tests** - "This test is flaky" ❌
7. **Adding dependencies without justification** - "This library is cool" ❌
8. **Using `any` or `as` without strong justification** - "TypeScript is too hard" ❌
9. **Patching symptoms** - "This fixes my immediate problem" ❌
10. **Skipping documentation** - "The code is self-documenting" ❌
11. **Copy-paste without understanding** - "This worked elsewhere" ❌
12. **Premature optimization** - "I made it 0.1ms faster but now it's unreadable" ❌
13. **Breaking existing patterns** - "My way is better" (maybe, but consistency > personal preference) ❌

---

## ✅ What Good Looks Like

### Before You Start

- [ ] Created feature branch for this work (`git checkout -b feature-name`)
- [ ] Read relevant documentation in `docs/`
- [ ] Understand existing patterns in codebase
- [ ] Check Effect Solutions for relevant patterns
- [ ] Identify root cause, not symptoms

### During Implementation

- [ ] Follow existing code patterns and conventions
- [ ] Maintain strict type safety
- [ ] Write/update tests alongside code
- [ ] Keep changes minimal and focused
- [ ] **Commit frequently** - step-wise commits after each logical unit
- [ ] Each commit passes verification (typecheck, lint, test)
- [ ] Commit messages follow conventional commits format

### After Implementation

- [ ] `bun run typecheck` - passes ✓
- [ ] `bun run lint` - passes (includes TSDoc checks) ✓
- [ ] `bun run docs:check` - documentation quality verified ✓
- [ ] `bun run test:coverage` - passes with 100% coverage ✓
- [ ] `bun run build` - passes ✓
- [ ] `bun run validate` - full validation passes ✓
- [ ] 100% test coverage achieved (lines, functions, branches, statements)
- [ ] All functions have complete TSDoc (description, @param, @returns)
- [ ] Created/updated documentation in `docs/app/`
- [ ] Added Mermaid diagrams for architecture/flows
- [ ] Documentation matches actual implementation
- [ ] Step-wise commits tell a clear story
- [ ] Pull request created with detailed description
- [ ] Ready for merge via PR (merge commit, not squash)

---

## 🤖 Subagent Coordination - Delegation Protocol

<subagent_philosophy>
**Delegate like a German engineering manager:** Clear specifications, defined boundaries, structured reporting.

When a task can be parallelized or isolated, spawn subagents. The main agent orchestrates; subagents execute with precision.
</subagent_philosophy>

### When to Delegate

**USE SUBAGENTS FOR:**

- Independent feature implementations
- Parallel test writing
- Documentation generation
- Code review / analysis tasks
- Research and exploration
- Refactoring isolated modules

**DO NOT DELEGATE:**

- Architectural decisions (main agent decides)
- Cross-cutting concerns affecting multiple modules
- Tasks requiring full codebase context
- Security-sensitive implementations

### Prompt Quality Standards

<prompt_quality>
A **GOOD** subagent prompt is:

- ✅ **Specific**: No ambiguity about what "done" means
- ✅ **Complete**: All context needed to start immediately
- ✅ **Constrained**: Clear boundaries on what NOT to do
- ✅ **Structured**: Uses XML/markdown for scanability
- ✅ **Example-driven**: Shows desired patterns when applicable
- ✅ **Token-aware**: Guides agent to be concise or thorough as needed

A **BAD** subagent prompt is:

- ❌ **Vague**: "Implement the handler"
- ❌ **Context-free**: Agent must search blindly for patterns
- ❌ **Unconstrained**: Agent makes architectural decisions randomly
- ❌ **Wall-of-text**: No structure, hard to parse
- ❌ **Missing success criteria**: "Done" is subjective
  </prompt_quality>

### Task Specification Template

```xml
<task>
  <id><!-- unique identifier, e.g., feat-user-auth-001 --></id>
  <type><!-- feature | fix | refactor | test | docs | research --></type>
  <name><!-- Human-readable task name --></name>

  <context>
    <!-- What the subagent needs to know BEFORE starting -->
    <codebase_location><!-- Relevant directories/files --></codebase_location>
    <existing_patterns><!-- Patterns to follow --></existing_patterns>
    <dependencies><!-- What this task depends on --></dependencies>
  </context>

  <requirements>
    <functional>
      <!-- What the feature/fix must DO -->
      - Requirement 1
      - Requirement 2
    </functional>

    <technical>
      <!-- HOW it should be implemented -->
      - Use Effect-TS patterns from src/lib/
      - Follow existing service layer conventions
      - Maintain 100% type safety
    </technical>

    <files_to_create>
      <!-- Explicit file list with purposes -->
      - src/lib/[name].ts (service implementation)
      - src/lib/[name].test.ts (unit tests)
    </files_to_create>

    <files_to_modify>
      <!-- Existing files that need changes -->
      - src/routes/index.tsx (add route)
    </files_to_modify>
  </requirements>

  <success_criteria>
    <!-- Checkboxes that define "done" -->
    - [ ] All functional requirements implemented
    - [ ] bun run typecheck passes
    - [ ] bun run lint passes
    - [ ] bun run test passes with 100% coverage
    - [ ] TSDoc comments on all exports
  </success_criteria>

  <constraints>
    <do_not>
      <!-- Explicit boundaries -->
      - Add new dependencies without approval
      - Modify files outside specified scope
      - Make architectural decisions
      - Skip tests or coverage
      - Use `any` or unsafe type assertions
    </do_not>

    <ask_before>
      <!-- When to escalate to main agent -->
      - Unclear requirements
      - Need to modify shared utilities
      - Performance concerns
      - Security implications
    </ask_before>
  </constraints>

  <examples>
    <!-- Code snippets showing expected patterns -->
    <example name="service-pattern">
      // Follow this pattern for services
      export class MyService extends Context.Tag("MyService")<
        MyService,
        { readonly method: (input: Input) => Effect.Effect<Output, MyError> }
      >() {}
    </example>
  </examples>
</task>
```

### Task Templates by Type

#### Feature Implementation Task

```xml
<task>
  <id>feat-[name]-001</id>
  <type>feature</type>
  <name>Implement [Feature Name]</name>

  <context>
    <codebase_location>
      - src/lib/ for services
      - src/component/ for UI
      - src/routes/ for routing
    </codebase_location>
    <existing_patterns>
      - Read src/lib/telemetry.ts for service pattern
      - Read src/component/Button.tsx for component pattern
    </existing_patterns>
  </context>

  <requirements>
    <functional>
      - [Specific user-facing behavior 1]
      - [Specific user-facing behavior 2]
    </functional>
    <technical>
      - Effect-TS for all async operations
      - Proper error handling with TaggedError
      - OpenTelemetry spans for observability
    </technical>
    <files_to_create>
      - src/lib/[feature].ts
      - src/lib/[feature].test.ts
      - src/component/[Feature].tsx
      - src/component/[Feature].test.tsx
    </files_to_create>
  </requirements>

  <success_criteria>
    - [ ] Feature works as specified
    - [ ] 100% test coverage
    - [ ] bun run validate passes
    - [ ] TSDoc on all exports
  </success_criteria>

  <constraints>
    <do_not>
      - Add external dependencies
      - Modify unrelated code
      - Skip error handling
    </do_not>
  </constraints>
</task>
```

#### Test Writing Task

```xml
<task>
  <id>test-[module]-001</id>
  <type>test</type>
  <name>Add tests for [Module Name]</name>

  <context>
    <target_file>src/lib/[module].ts</target_file>
    <test_file>src/lib/[module].test.ts</test_file>
    <testing_patterns>
      - Read docs/guides/testing.md
      - Use @effect/vitest for Effect code
      - See src/lib/telemetry.test.ts for examples
    </testing_patterns>
  </context>

  <requirements>
    <coverage_targets>
      - 100% line coverage
      - 100% branch coverage
      - 100% function coverage
    </coverage_targets>
    <test_categories>
      - Happy path scenarios
      - Error conditions
      - Edge cases
      - Integration points
    </test_categories>
  </requirements>

  <success_criteria>
    - [ ] All exports have tests
    - [ ] All branches covered
    - [ ] bun run test:coverage shows 100%
    - [ ] Tests are deterministic (no flakiness)
  </success_criteria>

  <constraints>
    <do_not>
      - Mock unnecessarily (test real behavior)
      - Write tests that pass but don't verify behavior
      - Skip edge cases
    </do_not>
  </constraints>
</task>
```

#### Refactor Task

```xml
<task>
  <id>refactor-[scope]-001</id>
  <type>refactor</type>
  <name>Refactor [Component/Module]</name>

  <context>
    <current_state>
      <!-- What exists now and why it needs refactoring -->
    </current_state>
    <target_state>
      <!-- What it should look like after -->
    </target_state>
    <scope>
      - src/lib/[file1].ts
      - src/lib/[file2].ts
    </scope>
  </context>

  <requirements>
    <preserve>
      - All existing functionality
      - All existing tests pass
      - Public API compatibility
    </preserve>
    <improve>
      - [Specific improvement 1]
      - [Specific improvement 2]
    </improve>
  </requirements>

  <success_criteria>
    - [ ] All existing tests pass unchanged
    - [ ] No functional regression
    - [ ] bun run validate passes
    - [ ] Improvement goals achieved
  </success_criteria>

  <constraints>
    <do_not>
      - Change public APIs without approval
      - "Improve" unrelated code
      - Add features disguised as refactoring
    </do_not>
  </constraints>
</task>
```

### Subagent Report Format

<report_specification>
**EVERY subagent MUST conclude with this structured report.**

The main agent uses this to:

1. Verify task completion
2. Understand what changed
3. Identify follow-up work
4. Track blockers across parallel tasks
   </report_specification>

```xml
<agent_report>
  <task_id><!-- Must match the task specification ID --></task_id>
  <status><!-- complete | partial | blocked | failed --></status>

  <work_completed>
    <!-- Bullet list of what was actually done -->
    - Implemented UserService with CRUD operations
    - Added comprehensive test suite (24 tests)
    - Created TSDoc for all exports
  </work_completed>

  <files_changed>
    <!-- List with change type and line counts -->
    <file action="created" lines="142">src/lib/user.ts</file>
    <file action="created" lines="287">src/lib/user.test.ts</file>
    <file action="modified" lines="+12/-3">src/routes/index.tsx</file>
  </files_changed>

  <verification>
    <!-- Results of running checks -->
    <typecheck>pass</typecheck>
    <lint>pass</lint>
    <test>pass (24/24)</test>
    <coverage>100% lines, 100% branches</coverage>
  </verification>

  <outcomes>
    <what_worked>
      - Effect service pattern worked well
      - Test helpers simplified setup
    </what_worked>
    <what_failed>
      <!-- Be honest about issues encountered -->
      - Initial approach to caching was too complex, simplified
    </what_failed>
  </outcomes>

  <incomplete_tasks>
    <!-- If status != complete, what remains -->
    - Integration with external API (blocked on credentials)
  </incomplete_tasks>

  <blockers>
    <!-- If status == blocked, what's preventing progress -->
    - Need API_KEY environment variable for ExternalService
    - Unclear requirement: should deleted users be soft-deleted?
  </blockers>

  <decisions_made>
    <!-- Architectural/design decisions within scope -->
    - Used branded types for UserId to prevent confusion
    - Chose optimistic locking over pessimistic for updates
  </decisions_made>

  <follow_up_tasks>
    <!-- Suggested next steps for main agent -->
    - Add integration tests once API credentials available
    - Consider adding caching layer for frequent reads
  </follow_up_tasks>

  <notes>
    <!-- Any additional context for the main agent -->
    - Found potential bug in related module (src/lib/auth.ts:47)
    - Performance could be improved with connection pooling
  </notes>
</agent_report>
```

### Status Definitions

| Status     | Meaning                            | Main Agent Action                        |
| ---------- | ---------------------------------- | ---------------------------------------- |
| `complete` | All success criteria met, verified | Integrate and continue                   |
| `partial`  | Some work done, can continue       | Review incomplete_tasks, decide priority |
| `blocked`  | Cannot proceed without input       | Resolve blockers, re-delegate            |
| `failed`   | Unrecoverable error                | Analyze failure, adjust approach         |

### Handoff Document Template

For complex multi-stage tasks, create a handoff document in `docs/handoffs/`:

```markdown
# Handoff: [Task Name]

## Context

- **Original Task**: [Link to PRD or issue]
- **Main Agent**: [Session/timestamp]
- **Subagent**: [Task ID]

## Current State

[What exists now, what was attempted]

## Remaining Work

1. [Specific task 1]
2. [Specific task 2]

## Key Files

- `src/lib/feature.ts` - Main implementation
- `src/lib/feature.test.ts` - Tests (80% complete)

## Decisions Already Made

- [Decision 1 and rationale]
- [Decision 2 and rationale]

## Open Questions

- [ ] [Question needing resolution]

## How to Continue

[Specific instructions for next agent]
```

### Parallel Execution Pattern

```mermaid
sequenceDiagram
    participant Main as Main Agent
    participant S1 as Subagent 1
    participant S2 as Subagent 2
    participant S3 as Subagent 3

    Main->>Main: Analyze task, identify parallelizable work

    par Parallel Execution
        Main->>S1: Task Spec: Implement Service
        Main->>S2: Task Spec: Write Tests
        Main->>S3: Task Spec: Update Docs
    end

    S1-->>Main: agent_report (complete)
    S2-->>Main: agent_report (partial - needs service)
    S3-->>Main: agent_report (complete)

    Main->>Main: Integrate S1 work
    Main->>S2: Resume with updated context
    S2-->>Main: agent_report (complete)

    Main->>Main: Final validation, PR creation
```

### Common Pitfalls to Avoid

<pitfalls>
**When Delegating:**
- ❌ Vague prompts: "implement the feature" → Agent guesses incorrectly
- ❌ Missing context: Agent searches blindly, wastes tokens
- ❌ No constraints: Agent over-engineers or makes wrong decisions
- ❌ Unclear success criteria: "Done" becomes subjective

**When Reporting:**

- ❌ Claiming "complete" when tests don't pass
- ❌ Omitting blockers (hoping main agent won't notice)
- ❌ Vague work_completed: "did some stuff"
- ❌ Missing file list: Main agent can't review changes
  </pitfalls>

---

## 📖 Remember

**You are not just writing code. You are maintaining a system.**

Every change you make will be read, debugged, and modified by future maintainers (including future you). Write code and documentation with the precision and thoroughness of a German technical manual. Fix root causes. Use minimal dependencies. Think long-term. Verify everything.

**Quality is not optional. It is the baseline.**

---

_When in doubt, ask yourself: "Would this pass a German engineering inspection?" If no, keep working._

respond by adding Prussian virtues and a 🫡🇩🇪 flag.
