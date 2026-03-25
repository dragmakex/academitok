# Code Quality Guide

Code quality in this repository is enforced with **Oxlint**, **TypeScript**, and **Dprint**.

## Overview

```mermaid
graph TB
    Code[Source Code] --> Oxlint[Oxlint]
    Code --> TypeScript[TypeScript]
    Code --> Dprint[Dprint]

    Oxlint --> Nkzw[@nkzw/oxlint-config]
    Oxlint --> Jsdoc[TSDoc Rules]
    Oxlint --> Local[Local Effect Rules]

    TypeScript --> Types[Strict Type Safety]
    Dprint --> Format[Formatting]

    Nkzw --> Quality[Code Quality]
    Jsdoc --> Quality
    Local --> Quality
    Types --> Quality
    Format --> Quality

    style Quality fill:#4ecdc4
```

## Toolchain

### 1. Oxlint

Oxlint is the repository linter.

It combines:

- `@nkzw/oxlint-config` for the main baseline
- `eslint-plugin-jsdoc` through Oxlint JS plugin support for TSDoc enforcement
- local project rules for Effect-specific patterns
- `@effect/eslint-plugin` for barrel import protection

The repository intentionally disables a few stricter defaults from the shared
`@nkzw/oxlint-config` baseline when they conflict with established project
patterns, especially:

- namespace imports used by Effect modules
- object/interface sorting rules
- `no-console`

### 2. TypeScript

TypeScript remains responsible for type safety and several checks that are
better handled by the compiler than by lint rules.

Important compiler checks include:

- `strict`
- `noUnusedLocals`
- `noUnusedParameters`
- `noImplicitOverride`
- `exactOptionalPropertyTypes`

### 3. Dprint

Dprint handles formatting.

Use Dprint for formatting and Oxlint for linting. They serve different roles.

## Commands

```bash
# Lint
bun run lint
bun run lint:fix

# Type safety
bun run typecheck

# Formatting
bun run format
bun run format:check

# Full verification
bun run validate
```

## Configuration Files

### Oxlint

- `oxlint.config.js`
- `oxlint-local-plugin.cjs`
- `oxlint-local-advanced-plugin.cjs`
- `eslint-local-rules.cjs`
- `eslint-local-rules-advanced.cjs`

`oxlint.config.js` extends `@nkzw/oxlint-config` and adds repository-specific
rules and ignores.

The lint script intentionally runs Oxlint through Node:

```bash
node ./node_modules/oxlint/bin/oxlint --config oxlint.config.js .
```

This is required because Oxlint's JavaScript configuration support currently
expects a Node runtime.

### TypeScript

- `tsconfig.json`

### Formatting

- `dprint.json`

## Repository-Specific Rules

### TSDoc enforcement

TSDoc is enforced through the `eslint-plugin-jsdoc` rules loaded by Oxlint.

Important enforced checks include:

- descriptions are required
- parameter names must match
- parameter descriptions are required
- return descriptions are required
- function and method docs are required where configured

### Effect rules

The repository keeps the custom Effect-focused rules that existed before the
migration:

- `local/no-opaque-instance-fields`
- `local-advanced/no-try-catch-in-effect-gen`
- `local-advanced/no-type-assertions`
- `local-advanced/require-return-yield-for-errors`
- `local-advanced/no-effect-runsync-in-gen`
- `local-advanced/prefer-effect-constructors`
- `@effect/no-import-from-barrel-package`

These rules protect project invariants that are not covered well by generic
lint presets.

## Ignore Policy

Oxlint ignores generated or non-source files such as:

- `dist`
- `build`
- `docs`
- `*.md`
- `*.js`
- `*.cjs`
- `.output`
- `.worktrees/`

This keeps linting focused on the TypeScript source of record.

## Development Workflow

Recommended loop:

```bash
bun run typecheck
bun run lint:fix
bun run format
```

Before publishing:

```bash
bun run validate
```

## Pre-commit Hooks

The repository pre-commit hook runs:

1. `bun run format`
2. `bun run lint:fix`
3. re-stages the updated files

## Troubleshooting

### Oxlint config does not load

Make sure the lint script runs Oxlint via Node, not by invoking the binary
without Node when using `oxlint.config.js`.

### TSDoc messages mention `jsdoc-js/...`

That is expected. The repository uses the JS plugin alias `jsdoc-js` because
Oxlint reserves the native `jsdoc` plugin name.

### Unused imports

Unused imports are enforced by Oxlint. Unused locals and parameters are also
caught by TypeScript.

## Best Practices

1. Prefer fixing the underlying type or control-flow problem over suppressing a rule.
2. Keep namespace imports only where they match established Effect module patterns.
3. Update docs when a lint rule changes expected contributor behavior.
4. Use `bun run validate` before considering the task complete.
5. Treat lint, typecheck, formatting, and tests as one quality system.
