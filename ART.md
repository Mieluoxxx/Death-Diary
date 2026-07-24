# Art sources — Death-Diary

## Runtime: single-frame original art

Phaser loads **one PNG per frame** (not packed atlas sheets). Call sites stay:

```ts
this.add.image(x, y, 'ui', 'btn_back.png')
// optional typed helper (generated):
import { Frame } from './assets';
this.add.image(x, y, 'ui', Frame.ui.btn_back)
```

| What | Path | Role |
|---|---|---|
| Original frames | `public/source-art/frames/<atlas>/*.png` | **Art truth** (rsync from Town) |
| Load policy | `src/game/assets/atlasManifest.ts` | **Policy truth** (preload vs lazy) |
| Multi-atlas JSON | `public/source-art/multiatlas/<atlas>.json` | Derived (gitignored) |
| Frame path index | `public/source-art/frame-index.json` | Derived (gitignored) |
| Typed keys / Frame map | `src/game/assets/frames.gen.ts` | Derived (**committed**) |
| Optional native font | `public/fonts/fzdh.ttf` | Manual |

Canonical **upstream** archive:

`../Buried-Town/archive/source-art/frames/` (+ `frames.zip`)

`Buried-City/source-art/` is only the Cocos H5 working copy — not the Phaser source of truth.

## How loading works

1. Edit `atlasManifest.ts` → `preload` (cold start) or `lazy` (on demand).
2. `bun run gen:frames` (also `predev` / `prebuild` / Vite plugin) writes multiatlas JSON + `frames.gen.ts`.
3. `Preloader` queues `PRELOAD_ATLAS_KEYS` via `queuePreloadAtlases`.
4. Scene code may `await loadAtlas(scene, 'rank')` for lazy keys.

JSON path: `source-art/multiatlas/<key>.json`  
Image path: `source-art/frames/<key>/`

## Loaded atlases

### Preload (vertical slice)

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
| `dig_item` | Dig item frames |
| `dig_work` | Work-room scavenge dig |
| `weather` | Map weather overlay |

### Lazy (generated, not cold-started)

`day`, `day2`, `end`, `guide`, `new_site`, `rank` — load with `loadAtlas(scene, key)` when a scene needs them.

## Refresh after changing frames

```bash
rsync -a --delete ../Buried-Town/archive/source-art/frames/ public/source-art/frames/
bun run gen:frames
# or just bun run dev / build (predev/prebuild + Vite plugin)
```

New atlas:

1. Drop PNGs under `public/source-art/frames/<name>/`
2. Add `'name'` to `atlasManifest` `preload` or `lazy`
3. Run gen (or start dev)

## Scripts

| Script | Purpose |
|---|---|
| `bun run gen:frames` | Write multiatlas + frames.gen.ts + frame-index |
| `bun run gen:frames:check` | CI: fail if derived outputs are stale/missing |

## Notes

- Packed `public/atlases/*` sheets removed; default path is single-frame multi-atlas.
- Frame basenames are unique across all frames (generator **fails** on collision).
- Filtering stays LINEAR (hand-painted art), set in Preloader / `loadAtlas`.
- Unknown dirs under `frames/` (not in manifest) are **warned** and skipped.
- Empty **preload** atlas is a hard error; empty **lazy** is a warning skip.
