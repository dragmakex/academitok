# Agent Instructions

Before doing any work, consult `specs/README.md` when it exists to confirm the relevant specs.

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

   Follow `docs/guides/versioncontrol.md` for all version control work.
   That guide defines the required branch strategy, commit structure, publication flow, and history hygiene for this repository.

   If we can and do not need to do the work ourselves, use handoff documents and PRDs to hand work to subagents and have them report back with a written handoff.

2. **READ EXISTING DOCUMENTATION**
   - Check `docs/` if you want to learn anything.
   - Check `docs/guides/` for relevant patterns and workflows
   - Understand how your change fits into the existing system
   - **DO NOT skip this** if there's bugs we encounter and fix document these learnings in LEARNINGS.md

### During Implementation

4. **Write Code with German Precision**
   - Follow existing patterns in the codebase
   - Maintain type safety - no `any`, no `as` casts without justification
   - Write self-documenting code - clear names, obvious intent
   - Add comments ONLY when "why" is not obvious from code

5. **Create Tests FIRST or ALONGSIDE**
   - Unit tests, Property Tests, Integration Tests. Decide what's the most sturdy solution.
   - Component tests for UI
   - Integration tests when crossing boundaries
   - **Coverage is not a metric** - test behavior, not lines

6. **COMMIT FREQUENTLY (Step-wise Commits)**
   - Commit after each logical unit of work
   - Each commit should pass verification (typecheck, lint, test)
   - Follow `docs/guides/versioncontrol.md` for commit message structure and history hygiene
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

Additionally ensure you've read docs/architecture/GUARANTEES.md in case you want to touch code!

### Documentation Requirements

For documentation adhere to best practices in docs/app/README.md

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

If there's no repo clone `https://github.com/Effect-TS/effect/` (you can also just look into node_modules)

- Search here for real implementations when docs aren't enough
- Study actual Effect code to understand patterns deeply

---

## ⚡ Development Workflow

Check package.json for available scripts and ensure you use them to the best of your abilities for verification, utility and checking that everything works.
Don't assume it works, always verify your work.

When multiple code paths and functions do similar things with slight variations, create a shared function or interface/service with so that logic can be properly shared and tested so each function can call in and doesn't have to reimlement.

---

## 🚫 Anti-Patterns - DO NOT DO THESE

1. **Working directly on master** - "It's a small change" ❌ → **ALWAYS create a feature branch and follow `docs/guides/versioncontrol.md`**
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

- [ ] Created feature branch for this work following `docs/guides/versioncontrol.md`
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
- [ ] Commit messages follow the standard in `docs/guides/versioncontrol.md`

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
- [ ] Ready for merge via PR according to `docs/guides/versioncontrol.md`

---

## 📖 Remember

**You are not just writing code. You are maintaining a system.**

Every change you make will be read, debugged, and modified by future maintainers (including future you). Write code and documentation with the precision and thoroughness of a German technical manual. Fix root causes. Use minimal dependencies. Think long-term. Verify everything.

**Quality is not optional. It is the baseline.**

---

_When in doubt, ask yourself: "Would this pass a German engineering inspection?" If no, keep working._

respond by adding Prussian virtues and a 🫡🇩🇪 flag.
