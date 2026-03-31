# Application Documentation

This directory contains **detailed documentation for all features and significant changes** made to the application.

## Purpose & Structure

When AI agents or developers implement features, fix bugs, or make significant changes to the system, they **must document their work here** with the precision and thoroughness of a German technical manual. For Bugs that means writing a clear commit description that includes the big and reasoning using conventional commits and the reasoning for the fix/change. We can therefore save on documentation scope because version control extends it with the details of why something changed. Documentation therefore does not need to document every single small thing. It needs to be available to serve as reference, guide and overarching map to the system.

Each feature, bug fix, or significant change only gets its own file if it is not better suited in a comprehensive document that aligns well.
We want to minimize cognitive overhead and increase density of our documentation. That is most paramount. Striking the balance between just enough so context is explicitly clear and not too much so it's overwhelming. Code for example documents it self with TSDoc and the actual code, so we merely need to document decisions, assumptions and how the code ties together in data flows and on the architectural level.

```
docs/app/[functional-unit]/<document>.md 
├── # Overview, purpose, usage examples
├── # Design decisions, trade-offs, alternatives considered
├── # Technical details, key files, integration points
├── # Mermaid diagrams for visual clarity
├── # Data flow, control flow, sequence diagrams
└── # Component structure, module dependencies
```

Be aware to not just write what is already in code, if that's the case we can just mention the codefile/function.

## Documentation Standards

### Precision

- Every detail matters - write like a German technical manual
- Be explicit, not implicit - future maintainers don't know your context
- Document the **why**, not just the **what** (code shows what, docs explain why)

### Visual Clarity

- **Always include Mermaid diagrams** for architecture and flow
- System diagrams for component relationships
- Sequence diagrams for interactions
- Flow charts for decision logic

### Trade-offs

- Document **alternatives considered** and why they were rejected
- Explain **design decisions** and their implications
- Note **limitations** and potential future improvements

### Maintainability

- Write for someone who knows nothing about your change
- Link to related documentation in `docs/guides/` and `docs/architecture/`
- Reference specific file paths and line numbers where relevant

## Examples

### Good Feature Documentation

docs/app/

```
user-authentication.md
├── # What: JWT-based auth with refresh tokens
│   # Why: Stateless, scalable, works with SSR
│   # Usage: Login, logout, protected routes
│
├── # Decision: JWT over sessions (why?)
│   # Trade-off: Token size vs database queries
│   # Security: HTTPS-only, HttpOnly cookies
│
├── # Files: src/lib/auth.ts, src/routes/api/auth/
│   # Integration: Effect services, middleware
│   # Testing: Auth flow tests, token validation
│
├── # diagrams/  (mermaid for complex diagrams, ascii for illustrations)
│   # Flow:      # Sequence: Login → Token → Refresh → Logout
│   # Structure: # Components: AuthService, TokenValidator, etc.
```

### Mermaid Diagram Example

````markdown
# Authentication Flow

```mermaid
sequenceDiagram
    participant Client
    participant API
    participant AuthService
    participant Database

    Client->>API: POST /api/auth/login
    API->>AuthService: validateCredentials(email, password)
    AuthService->>Database: findUser(email)
    Database-->>AuthService: User | null
    AuthService->>AuthService: verifyPassword(password, hash)
    AuthService-->>API: Effect<Tokens, AuthError>
    API-->>Client: Set-Cookie + { accessToken, refreshToken }

    Note over Client,API: Access token expires in 15m
    Note over Client,API: Refresh token expires in 7d

    Client->>API: GET /api/protected (with token)
    API->>AuthService: verifyToken(accessToken)
    AuthService-->>API: Effect<User, TokenError>
    API-->>Client: Protected Resource
```
````

## When to Document

### Always Document

- ✅ New features (authentication, payments, API integrations)
- ✅ Significant refactors (state management changes, architecture shifts)
- ✅ Complex bug fixes (root cause analysis, solution explanation) -> if not well suited in docs then append to general LEARNINGS.md
- ✅ Performance optimizations (before/after, trade-offs) -> if not well suited in docs then append to general LEARNINGS.md
- ✅ Integration with external services (APIs, databases, analytics)

### Optional (but encouraged)

- Minor bug fixes with interesting root causes
- Utility functions with non-obvious behavior
- Configuration changes with important implications

### Skip

- Trivial changes (typos, formatting)
- Self-explanatory code additions
- Changes already covered in existing docs

## Current Feature Documents

- `docs/app/todo-dashboard.md` — richer todo sample, snapshot data flow, and dashboard invariants

## Related Documentation

- **System Architecture**: `docs/architecture/overview.md`
- **Code Quality Standards**: `docs/guides/code-quality.md`
- **Testing Patterns**: `docs/guides/testing.md`
- **Performance Guidelines**: `docs/guides/performance-monitoring.md`

---

**Remember**: You are not just writing code. You are maintaining a system. Document with the precision of a German engineering manual.
If we don't need to update docs or write new ones we are good too. Don't overcomplicate things. Keep it simple. For simple learnings we have LEARNINGS.md
