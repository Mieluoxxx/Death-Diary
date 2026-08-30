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

### 2026-08-30 — dead-export purge (ponytail-audit round 2, advisor-approved)

- Deleted 30 confirmed-dead exports (~272 lines) across 16 files; scan covered src,
  server, e2e, tools, tests, and string-form references. Verdict for the
  `changeInfect`/`changeInjury`/`changeTemperature` trio and `debugForceNightRaid`:
  ported-early-never-wired speculative surface, recoverable via git if ever needed.
- Orphan sweep after deletion: removed `NpcCopy` type (npcConfig) and 6 orphaned
  imports (craftSystem, iapStore ×2, mapSystem ×2, playerAttrs).
- Caught and fixed a deletion-script bug: 6 surviving functions had their JSDoc
  swallowed (`transferItems`, `applyBuffItem`, `mutateSession`, `accelerateTime`,
  `ensureDogHouseBuilt`, `startSurvivalLoop`); restored from HEAD and re-verified
  with a JSDoc-integrity pass over all 16 files.
- Dynamic-dispatch insurance grep (`globalThis.`, `window as any`, `require(`): clean.
- Validation: `biome lint` clean (0 warnings), both tsc configs exit 0, client tests
  24 pass, server tests 5 pass, `bun run build` OK.
- Net: 16 files, +3/−268 (−265 lines). Deferred: dialog-skeleton extraction
  (`LEFT_EDGE`×6, `DIALOG_WIDTH`×5 duplicated across 5 dialog files) — revisit when
  a 6th dialog is written or a bug is traced to the duplication; values must be
  verified identical across sites before hoisting. gameBus hand-rolled pub/sub
  kernel intentionally kept (type-safe map + emit-snapshot semantics).

### 2026-08-30 — npcVisitDialog alignment with original showNpcSendGiftDialog

Source-level diff vs Buried-City `uiUtil.showNpcSendGiftDialog` + `NpcDialog`/
`DialogBig` + `ItemRichText`. Applied, ranked:

1. Title bar: replaced the `好感度 N/10` text with the existing `addNpcHearts`
   strip pinned to the right edge (original `createHeartNode` placement); helps
   the help-visit variant too (original NpcDialog always shows hearts).
2. Added the original 1069 `你得到` label above the gift list.
3. Gift rows rebuilt as the original `ItemRichText` form: 3-column grid of
   `icon_item_{id}.png` (scale 0.5, left) + `x{num}` count text (right-aligned),
   replacing the plain `名字 xN` single-column rows.
4. Site rewards now use the original separate batch body: 1070 + per-site 1221
   `（新地点%s解锁）` instead of a mixed row under 1068.
5. Batching: item batch and site batch are separate dialogs chained on 知道了
   (original `npc.sendGift()` recursion). Clock pause/resume is ref-counted
   (`pausedRef`), so pause happens once at dialog open and resume only on the
   final batch dismiss — verified no leak across both single and dual batches.
6. Dialog open sound: `playPopup` → `Sound.NPC_KNOCK` (sfx asset already registered).

Validation: `biome lint` clean, both tsc configs exit 0, client tests 35 pass,
`bun run build` OK. Only `src/game/ui/npcVisitDialog.ts` touched (parallel
bonfire-alignment work in progress untouched).

### 2026-08-30 — npcVisitDialog help branch: same ItemRichText grid as gifts

Original help list (`showNpcNeedHelpDialog`) is the **same** `ItemRichText` grid
as the gift list: icon + "xN", 3 columns, icon scale 0.5, items the player lacks
render RED; the original has **no** inventory row. Ported accordingly:

- `addItemGrid` generalized (`readonly {itemId, num}[]` + optional `colorOf`
  callback); the help branch now feeds it `visit.need` with a
  `have >= num ? black : red` color callback.
- Removed the port's home-grown icon/name/inventory-row layout (incl. the
  non-original `你的库存：N` line); grid replaces it.

Known data-layer divergence (reported, NOT changed here): original help demand
is a multi-item bundle — `npc.js getNeedHelpItems()` draws weighted wildcard ids
from `npcGiftConfig.produceList` until total `itemConfig.value` reaches
`produceValue: 4` (1-4 distinct items, duplicates summed) — while the port's
`NpcVisit.need` is a single item from `npcConfig.needItems[reputation level]`.
Porting the random multi-item draw would touch npcSystem data flow; awaiting
owner decision.

Validation: `biome lint` clean, both tsc configs exit 0, client tests 35 pass,
`bun run build` OK.
