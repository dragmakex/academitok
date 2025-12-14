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

1. **CREATE A GIT WORKTREE - ALWAYS**

   **This project uses git worktrees for ALL development work.** Never work directly on master.

   ```bash
   # Create a new worktree for your feature/fix
   git worktree add .worktrees/feature-name -b feature-name

   # Navigate to the worktree
   cd .worktrees/feature-name
   ```

   **Worktree Workflow:**
   - **One worktree per feature/fix** - keeps work isolated
   - **Branch naming**: `feature/name`, `fix/name`, `refactor/name`, `docs/name`
   - **Master stays clean** - never commit directly to master
   - **Commit frequently** - step-wise commits document your thought process
   - **Open PR when done** - merge into master via pull request

   **Why Worktrees?**
   - Work on multiple features simultaneously without stashing
   - Keep master clean and deployable at all times
   - Easy context switching without losing work
   - Each worktree is a complete working directory

   **Commit Frequency:**
   - ✅ Commit after each logical step (not just when "done")
   - ✅ Each commit should have a clear, single purpose
   - ✅ Commits tell a story - future you will thank you
   - ✅ Step-wise commits make PRs easier to review
   - ❌ Don't wait until everything is perfect to commit
   - ❌ Don't create giant "implement everything" commits

   **Example Workflow:**
   ```bash
   # 1. Create worktree
   git worktree add .worktrees/feature-user-auth -b feature/user-auth
   cd .worktrees/feature-user-auth

   # 2. Make changes, commit frequently
   git commit -m "feat: add User schema with validation"
   git commit -m "feat: implement JWT token generation"
   git commit -m "test: add user authentication tests"
   git commit -m "docs: document auth flow in docs/app/user-auth/"

   # 3. Push and create PR
   git push -u origin feature/user-auth
   gh pr create --title "Add user authentication" --body "..."

   # 4. After PR merged, cleanup
   cd ../..
   git worktree remove .worktrees/feature-user-auth
   git branch -d feature/user-auth
   ```

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
   bun run typecheck  # TypeScript must be clean - ZERO errors
   bun run lint       # ESLint must pass - fix, don't disable
   bun run test       # All tests must pass - fix failures
   bun run build      # Build must succeed - verify production readiness
   ```

   **IF ANY FAIL**: Fix them. Do not proceed. Do not ask for permission to skip.

8. **Run Full Validation**
   ```bash
   bun run validate   # Runs: typecheck + lint + format + test + perf
   ```

   This is your **definition of done**. If this fails, you're not done.

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

   **See existing docs** for examples:
   - `docs/architecture/overview.md` - High-level architecture with Mermaid
   - `docs/guides/testing.md` - Testing patterns and practices
   - `docs/guides/code-quality.md` - Quality standards

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
    # Return to main repository
    cd ../..

    # Update master
    git checkout master
    git pull

    # Remove worktree
    git worktree remove .worktrees/feature-your-feature-name

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
```

---

## 🚫 Anti-Patterns - DO NOT DO THESE

1. **Working directly on master** - "It's a small change" ❌ → **ALWAYS use git worktrees**
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

- [ ] Created git worktree for this work (`git worktree add .worktrees/feature-name -b feature-name`)
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
- [ ] `bun run lint` - passes ✓
- [ ] `bun run test` - passes ✓
- [ ] `bun run build` - passes ✓
- [ ] `bun run validate` - passes ✓
- [ ] Created/updated documentation in `docs/app/`
- [ ] Added Mermaid diagrams where appropriate
- [ ] Step-wise commits tell a clear story
- [ ] Pull request created with detailed description
- [ ] Ready for merge via PR (merge commit, not squash)

---

## 📖 Remember

**You are not just writing code. You are maintaining a system.**

Every change you make will be read, debugged, and modified by future maintainers (including future you). Write code and documentation with the precision and thoroughness of a German technical manual. Fix root causes. Use minimal dependencies. Think long-term. Verify everything.

**Quality is not optional. It is the baseline.**

---

_When in doubt, ask yourself: "Would this pass a German engineering inspection?" If no, keep working._
