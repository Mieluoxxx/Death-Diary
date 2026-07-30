# `src/game/assets/` — 图集与帧资源

负责把 `public/source-art/` 生成的 multiatlas 接到 Phaser 纹理系统。

## 文件

| 文件 | 职责 |
|------|------|
| `frames.gen.ts` | **生成物**：各 atlas 的 frame 名常量（`bun run gen:frames`） |
| `atlasManifest.ts` | 预加载 / 懒加载 atlas 列表与路径 |
| `loadAtlas.ts` | 运行时按需 `load.multiatlas` / 等待完成 |
| `index.ts` | 对外 re-export |

## 流水线

```
public/source-art/frames/**/*.png
  → tools/gen_frame_multiatlas.mjs
    → public/source-art/multiatlas/*.json
    → src/game/assets/frames.gen.ts
```

- 单帧原画，不真正打包大图；JSON 描述 multi-atlas 布局。
- 改图后跑 `bun run gen:frames`（`dev`/`build` 的 pre 脚本也会跑）。
- 细节见仓库根 [`ART.md`](../../../../ART.md)。

## 使用约定

```ts
// 推荐：先确保 atlas 已加载
await loadAtlas(scene, 'icon');
scene.add.image(x, y, 'icon', 'icon_item_1103083.png');
```

- **preload**：优先加载 `menu` / `ui` / `icon` / `npc`，保证主菜单和选人页即时打开。
- **lazy**：Cissy Liu 故事页后台加载 `HOME_ATLAS_KEYS`；其他场景用 `queuePreloadAtlases` 或 `loadAtlas`。
- Frame 名与原版 plist 一致（含 `.png` 后缀）。
- 不要手改 `frames.gen.ts`。

## 依赖

- 被 `scenes/Preloader`、`scenes/*`、几乎所有 `ui` 使用。
- 不依赖 session / systems。
