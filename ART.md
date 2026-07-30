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

1. Edit `atlasManifest.ts` → first-wave `preload` or scene-owned `lazy`.
2. `bun run gen:frames` (also `predev` / `prebuild` / Vite plugin) writes multiatlas JSON + `frames.gen.ts`.
3. `Preloader` queues `menu` / `ui` / `icon` / `npc`, covering MainMenu and ChooseScene.
4. After role confirmation, `StoryScene` remains on the Cissy Liu page while it loads `HOME_ATLAS_KEYS` and game audio, then starts Home automatically.

JSON path: `source-art/multiatlas/<key>.json`  
Image path: `source-art/frames/<key>/`

## Loaded atlases

### Cold-start preload

| Atlas | Used by |
|---|---|
| `menu` / `ui` | Main menu, shared chrome and story loading UI |
| `icon` / `npc` | Role picker, shop and shared icons |

### Scene-owned lazy loads

| Entry point | Atlases |
|---|---|
| `StoryScene` → `HomeScene` | `home`, `dig_build`, `build`, `gate`, `map`, `site`, `dig_monster`, `dig_item`, `dig_work`, `weather` |
| `MedalScene` | `medal` |
| Day overlay | `day`, `day2` |
| `EndScene` | `end` |

`guide`, `new_site`, and `rank` remain generated lazy keys for future scenes. Startup audio is `mainpage` + `click`; the Cissy Liu page loads the remaining game audio before Home. `HomeScene.preload()` repeats the same idempotent queue only as a direct-continue fallback.

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
