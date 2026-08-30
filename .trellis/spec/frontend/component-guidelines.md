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
## Text styling (uiFont)

All Phaser Text styles must go through the shared helpers in `src/game/ui/uiFont.ts` —
never hand-write the `{ fontFamily, resolution, fontSize }` triple inline. The hand-copied
form drifted once already (`radioNode.ts` missing `resolution`, text rendered at DPI 1).

- `uiTextStyle(size, extra)` — base style (bundled CJK `fontFamily` + DPI `resolution` + `fontSize`).
  `size` accepts a `UiFontSizeKey` (`'COMMON_1' | 'COMMON_2' | 'COMMON_3'`) or a raw px number.
- `uiSpriteBtnTextStyle(tier, extra)` — atlas sprite button labels (tier − 4 px parity).
- `uiWordWrap(width)` — CJK-aware advanced wrap.

Preferred call-site form is a leading spread so per-instance fields stay inline:

```ts
scene.add.text(x, y, label, {
    ...uiTextStyle('COMMON_2'),
    color: '#111111',
    wordWrap: uiWordWrap(textWidth),
})
```

---

## Build-panel action rows

`buildPanel.ts` renders facility (bid) and craft rows through two shared helpers —
reuse them for any new action row, do not hand-roll inline copies:

- `addActionHintText` — original `LabelTTF cc.size(268, 0)` semantics: fixed 268px
  width, CJK advanced wrap, top-anchored at the icon's top edge (`setOrigin(0, 0)`).
- `addCostGrid` — original `ItemRichText(items, 268, 3, 0.3)`: 268px grid, 3 columns
  per row, icon left / "xN" right, red when short, empty list renders string 1230.

After any facility mutation that changes a row's visible state, emit
`gameBusEmit('facility_changed', { bid })` (original `_sendUpdageSignal` →
`build_node_update`) so the open panel rebuilds immediately instead of waiting for
the next game-minute `session_updated` tick.

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

### Common Mistake: lazy-tier atlas used without scene registration

**Symptom**: A node/panel renders blank (title chrome only) — every
`textures.exists(atlas) && textures.get(atlas).has(frame)` guard silently
skips, so no error is thrown.

**Cause**: The atlas is listed in `ATLAS_MANIFEST.lazy` (disk-truth coverage)
but no scene ever loads it. Lazy atlases load **only** when a scene passes the
key to `queuePreloadAtlases`/`loadAtlas`; having a key in `frames.gen.ts` does
NOT mean the texture exists at runtime.

**Fix**: Register the atlas in the loading tier of the scene that first needs
it, e.g. add `'new_site'` to `HOME_ATLAS_KEYS` (atlasManifest.ts) when Home's
map hosts the entry point.

**Prevention**: When adding UI that reads a new atlas key, grep
`atlasManifest.ts` for the atlas name — if it is only in `lazy`, add it to the
owning scene's `*_ATLAS_KEYS` list in the same change.
