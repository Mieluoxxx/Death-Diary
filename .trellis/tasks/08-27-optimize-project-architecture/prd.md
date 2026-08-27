# Optimize Project Architecture

## Goal

Improve the Death-Diary project structure and module boundaries so future
changes remain easy to locate, test, and safely evolve, while preserving the
current game behavior and save compatibility.

## Background

The repository is a Phaser 4 + TypeScript client with Bun/Vite tooling and a
Bun/Hono/SQLite storage service. The current high-level layers are already
valid:

```text
scenes -> ui -> systems -> session -> local/cloud persistence
data/assets -> consumed by scenes, ui, and systems
```

The main architectural pressure points found during the initial audit are:

- module-level runtime state in `timeClock`, `survivalLoop`, `battleSystem`,
  and `craftSystem`, which must be reset when a game scene ends;
- the frontend `SessionState` contract and backend cloud-save payload being
  validated independently;
- server APIs for medal progress and entitlements existing before their
  client-side persistence paths are fully connected;
- template-era `Game` / `GameOver` scenes still being registered alongside the
  active route.

## Requirements

1. Audit the complete client, server, asset, build, and test structure before
   moving files or introducing abstractions.
2. Preserve the existing top-level layering unless a concrete dependency or
   lifecycle problem justifies a change.
3. Make ownership of serializable state, transient runtime state, UI state,
   static configuration, and generated assets explicit in code and project
   documentation.
4. Establish one versioned boundary for cloud-save payload validation and
   migration, without breaking existing `schemaVersion=1` saves.
5. Provide explicit lifecycle cleanup for module-level game runtimes and call
   it from the owning Scene lifecycle.
6. Review server-side progress/entitlement capabilities and either connect
   them to the client or document/defer them clearly; do not leave misleading
   half-integrated boundaries.
7. Remove or clearly isolate dead/template entry points only after confirming
   there are no runtime or test references.
8. Keep changes behavior-preserving unless a behavior change is explicitly
   documented and covered by tests.
9. Add focused tests for each changed cross-layer contract or lifecycle rule;
   retain the existing timing, NPC, UI animation, and API coverage.

## Acceptance Criteria

- [x] A written architecture map identifies module ownership and the main
      client/server data flows.
- [x] `SessionState` save payloads have a documented, versioned validation /
      migration owner shared by the relevant frontend and backend code.
- [x] Exiting/restarting `HomeScene` cannot leave duplicate survival ticks,
      timer callbacks, battle state, craft jobs, or bus listeners behind.
- [x] The active Scene/navigation route is distinct from confirmed template or
      dead entry points.
- [x] Existing local saves and schema version 1 cloud saves continue to load;
      conflict and invalid-payload behavior remains explicit.
- [x] `bun run typecheck`, `bun run lint`, `bun run test:server`, relevant
      client tests, and `bun run build` pass after implementation.
- [x] No unrelated working-tree changes are reverted.

## Out Of Scope

- Rewriting the game in another framework or introducing a new state library.
- Splitting every large file into smaller files without a demonstrated
  ownership or testability benefit.
- Redesigning gameplay, UI, monetization, or save semantics.
- Adding cloud functionality solely because a server table already exists;
  each integration must have a concrete client behavior and acceptance test.

## Technical Constraint

This task is behavior-preserving by default. Save/API behavior may change only
when required to preserve compatibility or to close a currently invalid
boundary, and such a change must have an explicit migration and test.
