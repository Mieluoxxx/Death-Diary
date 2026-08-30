# Architecture Optimization Implementation Plan

1. **Baseline and dependency inventory**
   - Record current `git status` and existing test/build results.
   - Build a module ownership map and trace all callers of the runtime cleanup
     APIs and save payload readers.
   - Confirm references to `Game` / `GameOver`, `user_progress`, and
     `entitlements`.

2. **Save-contract boundary**
   - Define the smallest shared/versioned envelope and session validation
     surface compatible with schema version 1.
   - Route frontend cloud reads and backend save writes through that boundary.
   - Add focused tests for valid v1, malformed state, unsupported version, and
     round-trip compatibility.

3. **Runtime lifecycle cleanup**
   - Audit `timeClock`, `survivalLoop`, `battleSystem`, `craftSystem`, and
     `timedProgress` for state that can survive a Scene restart.
   - Reuse existing clear/stop functions; add only missing idempotent cleanup.
   - Wire cleanup into `HomeScene` and relevant battle/death transitions.
   - Add a regression test proving a restart does not duplicate callbacks or
     retain an active battle/craft job.

4. **Deferred boundary review**
   - Verify whether medal progress and IAP entitlements have real client
     consumers.
   - If not, document them as deferred in the architecture docs/task notes;
     do not add speculative synchronization.

5. **Dead-entry review**
   - Confirm runtime/test references to `Game.ts` and `GameOver.ts`.
   - Remove only confirmed dead registrations/files, otherwise add a short
     compatibility note.

6. **Quality gate**
   - Run `bun run typecheck`.
   - Run `bun run lint`.
   - Run `bun test src/game/**/*.test.ts` (or the repository-supported client
     test command) and `bun run test:server`.
   - Run `bun run build` and `bun run gen:frames:check`.
   - Run browser/E2E checks for any changed rendered route or save flow.
   - Review the diff for unrelated changes and generated-file churn.

Rollback points: after save-contract changes, after lifecycle changes, and
after any dead-entry cleanup. Revert the last isolated module if a validation
step exposes behavior drift.

## Execution log

### 2026-08-30 — unify UI text styles via `uiTextStyle` (ponytail-audit follow-up)

- Codemod replaced all 163 hand-copied `{ fontFamily, resolution, fontSize }` triples
  across 40 files with `...uiTextStyle(...)` spreads (106 const-key + 50 px-literal
  + 6 expression + 1 missing-resolution variant in `radioNode.ts`, fixing the DPI-1
  drift bug there as part of the same change).
- Import lines patched in the same pass; unused `UI_FONT_*` constants removed;
  `biome check --write` normalized formatting. Reverted incidental formatting of
  4 out-of-scope files (`tsconfig.json`, `vite/frameAtlasPlugin.mjs`,
  `server/src/app.ts`, `tools/gen_frame_multiatlas.mjs`).
- Validation: `biome lint` clean, `tsc --noEmit` (client + server) clean,
  `bun run build` OK, client tests 24 pass, server tests 5 pass.
- Net: 55 files, +286/−590 (−304 lines). Spec: added "Text styling (uiFont)"
  section to `.trellis/spec/frontend/component-guidelines.md`.
