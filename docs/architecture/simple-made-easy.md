# Simple Made Easy

This repository adopts Rich Hickey's distinction from _Simple Made Easy_:

- **simple** means **unentangled**,
- **complex** means **braided together**,
- **easy** means **familiar or nearby**.

The practical consequence for this codebase is that we optimize for
**separation of concerns over short-term familiarity**.

That principle aligns with older software engineering literature as well:

- **Parnas** argued for module boundaries that hide volatile decisions instead
  of organizing code by procedural flow.
- **Brooks** distinguished inherent problem difficulty from accidental
  complexity introduced by the implementation.
- **Hickey** reframed the day-to-day coding version of the same problem as
  avoiding _complecting_ time, state, identity, policy, and execution order.

## Repository interpretation

In this repository, simplicity means:

1. **values over ambient state**,
2. **functions over hidden object state**,
3. **schemas and tagged data over ad hoc wrappers**,
4. **policy separated from transport and persistence**, and
5. **explicit dependencies for time, randomness, and I/O**.

We do not treat these as aesthetic preferences. They are reliability tools.

## The five design questions

Every new module should answer these questions explicitly:

1. **Who** are the entities or values?
2. **What** operations are supported?
3. **How** is the work implemented behind the boundary?
4. **When / Where** does the work happen, and is timing or location coupled?
5. **Why** do the rules exist, and where is policy encoded?

## Codified repository rules

The repository now enforces a small simplicity baseline in lint and docs.
When this document or its companion feature doc shows a negative snippet, that
snippet should be labelled explicitly as a rejected or historical shape so it
cannot be confused with a recommended reference.

The enforced rules are:

- shared library modules must not read **ambient wall-clock time** directly,
- repository modules must not read **ambient randomness** directly,
- modules must not export **mutable bindings**,
- route entry modules must not own **Effect.gen orchestration**.

These rules are intentionally narrow. They do not attempt to solve all design
quality mechanically. They exist to catch common ways in which otherwise small
modules become entangled.

## Boundary model

```mermaid
flowchart LR
    Policy[Domain policy and transformations] --> Services[Effect services and orchestration]
    Services --> Adapters[Persistence and HTTP adapters]
    Adapters --> Routes[Route entry modules]
    Routes --> UI[React UI]

    Time[Time]
    Randomness[Identity / randomness]
    Input[External input]

    Time --> Services
    Randomness --> Services
    Input --> Routes

    style Policy fill:#c7f9cc
    style Services fill:#dbeafe
    style Adapters fill:#fde68a
    style Routes fill:#fecaca
```

### Consequences

- **Routes** decode, delegate, and render.
- **Services** orchestrate effects and dependencies.
- **Adapters** translate to databases and external APIs.
- **Shared utilities** should accept time and identity as arguments instead of
  sampling them implicitly.

## Review checklist

When reviewing a change, ask:

- Did we reduce or increase coupling?
- Is time passed in or sampled implicitly?
- Is randomness injected or read ambiently?
- Does the route file delegate, or did it become a hidden service layer?
- Would a small change in one concern now ripple into unrelated modules?

If the answer suggests a ripple across unrelated concerns, the change likely
increased complexity even if it felt easy to write.

## Related repository documents

- `docs/architecture/GUARANTEES.md`
- `docs/guides/code-quality.md`
- `docs/guides/testing.md`
- `docs/app/simple-made-easy/README.md`

🫡🇩🇪 Prussian virtues: keep policy, data, and execution boundaries explicit.
