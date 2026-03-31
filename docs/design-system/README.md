# Design System

## Intent

This design system is a **contract** for application UI work in this repository.
It is not optional guidance.

The enforcement model is simple: **components are the boundary**.
Application code composes design-system components with typed props.
It never uses `className`, `style`, or raw HTML elements with styling.

Tailwind CSS is an internal implementation detail of the design-system layer.
Application code does not touch it.

## When implementing or changing UI

1. Read the design-system docs in this directory.
2. Inspect the source of truth under `src/design-system/**`.
3. Compose from design-system primitives and components.
4. Run `bun run lint:design-system` to verify the contract.

## Document map

- `docs/design-system/rules.md` — hard DO / NEVER policy
- `docs/design-system/tokens.md` — semantic visual language and token roles
- `docs/design-system/patterns.md` — interaction and layout patterns
- `docs/design-system/enforcement.md` — local, staged, and CI enforcement contract

## Source of truth

The implementation source of truth lives in:

- `src/design-system/foundation/**` — utility functions and token maps
- `src/design-system/primitives/**` — layout primitives (Stack, Inline, Surface)
- `src/design-system/components/**` — all UI components
- `src/styles.css` — Tailwind `@theme` tokens and base resets

## Architecture

```
┌─────────────────────────────────────────────┐
│  Application code (routes, features)        │
│  Composes DS components with typed props    │
│  No className, no style, no raw elements    │
├─────────────────────────────────────────────┤
│  Design-system components                   │
│  Typed props → Tailwind utilities internally│
│  Components do NOT expose className         │
├─────────────────────────────────────────────┤
│  Tailwind CSS + @theme tokens               │
│  Semantic values: bg-bg-surface, gap-m, etc │
│  Only used inside src/design-system/**      │
├─────────────────────────────────────────────┤
│  styles.css                                 │
│  @theme block, base resets, dark mode       │
└─────────────────────────────────────────────┘
```

## Scope

The design-system contract applies to product UI in:

- `src/routes/**`
- `src/component/**`

Design-system internals under `src/design-system/**` use Tailwind utilities freely.
Application code outside that layer must not.
