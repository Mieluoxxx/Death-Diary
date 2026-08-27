# Architecture Optimization Design

## Approach

Keep the existing top-level layers and improve ownership at their boundaries.
The work is organized as an audit followed by narrow refactors:

```text
static data/assets
       ↓
scenes + ui/nodes ── events ── systems
       ↑                         ↓
       └──────── session state ──┴─ local IndexedDB
                                      ↓
                                cloudSave API
                                      ↓
                                   SQLite
```

No new state library, dependency injection container, or generic repository
layer is needed.

## Boundaries

### Session and Save Contract

`SessionState` remains the canonical client model. Add a small versioned
save-contract owner at the frontend/backend boundary that:

- validates the envelope and the `session` payload needed by the current build;
- accepts existing schema version 1;
- provides a single migration point for future versions;
- keeps server responses typed at the boundary instead of returning arbitrary
  JSON to callers.

Use existing TypeScript type guards and standard JSON APIs; do not add a schema
dependency unless the current shape proves too complex for local guards.

### Runtime Lifecycle

Audit every module-level runtime map/state. Reuse existing APIs such as
`clearTimerCallbacks()`, `stopSurvivalLoop()`, and `clearCraftRuntime()`.
Add only the missing explicit cleanup functions, then call them from the
owning Scene shutdown path. Cleanup must be idempotent and must not mutate a
persisted session except where the current behavior already does so.

### Progress and Entitlements

Keep the server endpoints and tables unchanged unless an implementation finds
an actual client requirement. The implementation must choose one of:

1. connect a concrete client flow with tests; or
2. document the capability as deferred and keep the current local behavior.

The default is option 2 for this behavior-preserving task.

### Scene Registration

Trace references to `Game` and `GameOver`. Remove them only if they are
confirmed dead; otherwise document them as compatibility placeholders and
leave registration unchanged.

## Compatibility and Rollback

- Existing IndexedDB exports and cloud `schemaVersion=1` payloads must load.
- Optimistic revision and conflict behavior must remain unchanged.
- Each refactor should be isolated enough to revert by module.
- Generated atlas files and unrelated dirty files must not be rewritten.

## Verification Strategy

Use focused unit tests for save parsing/migration and runtime cleanup, then
run the repository typecheck, lint, server tests, client tests, and production
build. Browser/E2E verification is required for any Scene lifecycle or save
entry behavior change.
