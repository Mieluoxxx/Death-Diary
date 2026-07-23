# Art sources — buried-city-phaser

## Runtime: single-frame original art

Phaser loads **one PNG per frame** (not packed atlas sheets).

| What | Path |
|---|---|
| Original frames (in-repo copy of Town) | `public/source-art/frames/<atlas>/*.png` |
| Multi-atlas JSON (one page per PNG) | `public/source-art/multiatlas/<atlas>.json` |
| Frame path index | `public/source-art/frame-index.json` |
| Optional native font | `public/fonts/fzdh.ttf` |

Canonical **upstream** archive:

`../Buried-Town/archive/source-art/frames/` (+ `frames.zip`)

`Buried-City/source-art/` is only the Cocos H5 working copy — not the Phaser source of truth.

## How loading works

`Preloader` uses Phaser `load.multiatlas` with:

- JSON: `source-art/multiatlas/<key>.json`
- Image path: `source-art/frames/<key>/`

Call sites stay `this.add.image(x, y, 'ui', 'btn_back.png')` — atlas key + frame name unchanged.

## Loaded atlases (vertical slice)

| Atlas | Used by |
|---|---|
| `menu` | Main menu bg / logo |
| `ui` | Chrome, buttons, dialogs, progress bars, dig_start |
| `icon` | TopFrame attrs, item icons |
| `medal` | Medal scene |
| `npc` | Choose portraits, battle dig plate |
| `home` | Home bg + facility icons |
| `dig_build` / `build` | Build panel icons |
| `gate` | Gate equip tabs, gate_out_bg |
| `map` | map_bg / map_actor / map_line |
| `site` | Map markers, site_dig illustrations |
| `dig_monster` | Battle dig art |
| `dig_item` | Dig item frames (ready for loot dig views) |
| `dig_work` | Work-room scavenge dig |
| `weather` | Map weather overlay |

On disk but not preloaded yet (no slice UI): `day`, `day2`, `end`, `guide`, `new_site`, `rank`.

## Refresh after changing frames

```bash
rsync -a --delete ../Buried-Town/archive/source-art/frames/ public/source-art/frames/
bun run gen:frames   # tools/gen_frame_multiatlas.mjs
```

## Notes

- Packed `public/atlases/*` sheets removed; default path is single-frame.
- Frame basenames are unique across all 598 files.
- Filtering stays LINEAR (hand-painted art), set in `Preloader.create`.
