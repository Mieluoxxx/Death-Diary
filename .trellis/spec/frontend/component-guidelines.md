# Component Guidelines

> How components are built in this project.

---

## Overview

Phaser UI is built from mountable node modules under `src/game/ui/nodes/` sharing small
factory helpers under `src/game/ui/` (e.g. `mountItemGrid`, `mountEquipStrip`,
`addSectionBar`, `openQuantityDialog`, `addTakeAllButton`). A node module receives a
`NodeMountContext` and returns a `NodeMountResult` (nav callbacks + `destroy`).

### Double-panel transfer contract (original `ItemChangeNode`)

All bag ↔ storage/box/site pages must follow the same interaction contract, sourced from
the original Buried-City `ItemChangeNode.js`:

- single tap on an item → transfer 1 (via `transferItems`/`transferAll` in `systems/inventory`, never direct `SessionState` mutation)
- long press (≥450ms, handled by `mountItemGrid` `onInspect`) → shared `openQuantityDialog`
  (slider fill width scales with `value/max`, left-aligned, POPUP sound — mirrors original `cc.ControlSlider`)
- optional take-all button → shared `addTakeAllButton`; guide highlight stays with the caller

Do NOT re-implement these inline in a node; wire the shared helpers instead. Exception:
home storage (`storageNode.ts`) opens the item detail dialog — the original uses
`showItemDialog` there, which is a different contract, not a deviation.

When porting original UI, derive geometry from Cocos y-up coordinates per container
(anchor + position), not by eyeballing screenshots; record per-item conclusions in the
task's `research/audit.md` with aligned/kept-and-why verdicts.

---

## Component Structure

<!-- Standard structure of a component file -->

(To be filled by the team)

---

## Props Conventions

<!-- How props should be defined and typed -->

(To be filled by the team)

---

## Styling Patterns

<!-- How styles are applied (CSS modules, styled-components, Tailwind, etc.) -->

(To be filled by the team)

---

## Accessibility

<!-- A11y requirements and patterns -->

(To be filled by the team)

---

## Common Mistakes

<!-- Component-related mistakes your team has made -->

(To be filled by the team)
