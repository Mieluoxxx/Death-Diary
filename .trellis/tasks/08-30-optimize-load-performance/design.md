# Design — 优化游戏加载速度

## 0. 总原则

- 帧名兼容是 R9 的设计锚点：游戏代码全部以 `'<atlas>/<file>.png'` 形式引用帧（如 `ui/frame_line.png`），打包后必须保持帧名不变，游戏代码零改动。
- CDN 路线按用户决策走「小众镜像 + 源站回退」：不稳定是预期内的，回退链是稳定性下限。
- 服务端负担放构建期（预压缩），服务期只做字节级协商。

## 1. 资源 URL 架构（R10）

```
图集/音频:  {ASSET_BASE}/source-art/multiatlas/*.json | *.png | /audio/*
字体:       同源 /fonts/fzdh.ttf（本轮不进 CDN，与 R4 子集化一起做更顺，见 §7 取舍）
入口/代码:  同源（index.html、/assets/*、/api/*）
```

- 构建期注入 `VITE_ASSET_BASE`（vite `define`/env，默认 `''` = 同源，行为与现状一致）。
- 回退链：`loadAtlas.ts` 已监听 `loaderror` → 追加「镜像失败 → 改用同源 URL 重试一次」；`audioManager` 同理（Phaser `load.addFile` 的 error 事件）。回退成功后本次会话记住（模块级 flag），避免重复撞镜像。
- 字体本轮不走 CDN 的取舍：`@font-face` 在 style.css 中且 CSS 同源加载，改走 CDN 需换 JS FontFace 加载并处理 FOUT 双加载问题；收益/风险比不如留到 R4（子集化后字体只剩 ~0.4M，走不走 CDN 都快）。记录为已知取舍。

## 2. 真·图集打包（R9，最大改动项）

**现状**：`tools/gen_frame_multiatlas.mjs` 为每张源帧生成 single-texture 描述（伪 multiatlas），运行时 598 个独立 png 请求。

**目标**：每个 atlas key（ui/icon/npc/menu…共 21 个）打包成 1~N 张 ≤2048×2048 的 sprite sheet 页；运行时每 key 只加载「1 个 json + N 张页图」。

**选型**：`free-tex-packer-core`（纯 JS、无 canvas 依赖、支持 maxrects，bun 兼容）作为 devDependency；备选自写 shelf-packer（若兼容性翻车，工作量 +1 天）。

**输出契约**（gen 脚本重写 `outDir` 产物）：
- `public/source-art/multiatlas/<key>.json`：自定义 schema `{ pages: [{ image: "<key>_0.png", size: [w,h] }], frames: { "<原文件名>": { page: n, frame: [x,y,w,h], ... } } }`
- `public/source-art/multiatlas/<key>_<n>.png`：打包页
- `frames.gen.ts`：保持现有导出面（PRELOAD/LAZY key 列表不变），新增每 key 的页数常量

**loadAtlas.ts 改造**：
- `queuePreloadAtlases`/懒加载路径：从 `load.multiatlas` 改为按页 `scene.load.atlas(key_n, pageUrl, jsonUrl)`（Phaser atlas 支持同 json 多纹理；若版本行为不符，则每页注册为独立 texture key `key_n`，帧查找封装进现有 helper）
- 帧名兼容层：游戏代码用 `frame.setTexture('ui')` 类调用处改为经 `resolveFrame('ui/frame_bg_bottom.png')` helper 查页号；grep 全量调用点评估改动面（预计集中在 `setFrame`/`textures.get('ui')` 两类模式）
- `applyLinearFilter` 对每张页图生效（现状逻辑按 key 列表遍历，改为按页）

**回滚开关**：gen 脚本支持 `GEN_PACK=flat|packed`（默认 packed），`flat` 走旧产物路径；配合 `gen:frames:check` 双模式校验。视觉回归不合格时 `bun run gen:frames -- --flat` 秒退回。

**风险**：2048 页边界上跨页帧（Phaser 无跨页帧问题，packer 保证不跨界）；Pages 纹理过暗/过亮的 PNG 量化不做（保持无损，避免视觉回归复杂化）。

## 3. Brotli 预压缩 + 协商（R6）

- `tools/compress_dist.mjs`（build 后处理，package.json `postbuild`）：遍历 dist，对 `.js/.css/.json/.ttf/.html` 生成 `.br`（`Bun.brotliCompressSync` q11）与 `.gz`；跳过 `.png/.mp3`。输出清单写 `dist/.compress-manifest.json`（供测试断言）。
- `server/src/app.ts`：在 `serveStatic` **之前**插入协商中间件（仅匹配文本类扩展名）：
  - `Accept-Encoding: br` 且存在 `<path>.br` → 返回预压缩体 + `Content-Encoding: br` + `Vary: Accept-Encoding` + R7 缓存头
  - `Accept-Encoding: gzip` 且存在 `.gz` → 同理
  - 未命中 → `next()` 落到原 `serveStatic`（png/mp3/ttf 无 .br 时路径完全不变）
- Range 请求不受影响：音频/图集 png 走原 `serveStatic`。

## 4. 缓存头策略（R7）

中间件内按路径下发（同时供 `serveStatic` 的 `onFound` 使用，hono 4.12 支持）：

| 路径 | Cache-Control |
|---|---|
| `/assets/*`（vite hash 产物） | `public, max-age=31536000, immutable` |
| `/source-art/multiatlas/*` | `public, max-age=604800`（无 hash，1 周折中；SW runtimeCaching 另有一层） |
| `/audio/*` | `public, max-age=604800` |
| `/fonts/*` | `public, max-age=604800` |
| `index.html`（含 SPA fallback 分支） | `no-cache` |
| `/api/*` | 不经静态层，不受影响 |

## 5. PWA 策略化（R2）

`vite/config.prod.mjs` workbox 配置：

- `globPatterns` 收窄为 `['index.html', 'assets/*.{js,css}', 'style.css', 'favicon.png']`（首屏核心，~2M）
- `runtimeCaching`：
  - `urlPattern: /\/source-art\//` → `CacheFirst`（`maxAgeSeconds: 30d`, `maxEntries: 120`）
  - `urlPattern: /\/audio\//` → `CacheFirst`（`maxAgeSeconds: 30d`, `maxEntries: 24`）
  - `urlPattern: /\/fonts\//` → `CacheFirst`
- SW 更新仍靠 `cleanupOutdatedCaches` + manifest 版本变化。若 ASSET_BASE 指向外部镜像，SW 对 `/source-art/` 的 runtimeCaching 自动失效（请求不经过源站域），无需特判。

## 6. 字体并行化（R3）

`Boot.create` 删除 `ensureUiFontLoaded` 等待，直接 `scene.start('Preloader')`；字体加载由 `main.ts` 现有 `scheduleTextRedrawOnFontReady` 重绘兜底。桌面无 CJK 系统字体的 Linux/WSL 首帧可能短暂 tofu 后自愈——已在 e2e-font-consistency.md 记录的钩子（`__deathDiaryGame` + `document.fonts.check`）用于回归验证。e2e 文档补充「首帧允许 fallback 字体、字体就绪后重绘」的预期说明。

## 7. 数据与兼容

- 无存档结构变更（saveContract 不动）。
- `frames.gen.ts` 为生成文件（biome 已排除），重新生成不产生 lint 噪音。
- Docker 镜像体积随 dist 同步下降（COPY dist 层）。

## 8. 回滚点

| 项 | 回滚方式 |
|---|---|
| R9 打包 | `GEN_PACK=flat` 重新生成 + revert loadAtlas 改动（开关在产物层面，代码可留） |
| R6/R7 | revert app.ts 中间件 + 删 postbuild 挂钩；.br/.gz 是多余文件不影响正确性 |
| R2 | revert vite 配置 |
| R3 | revert Boot.ts（单行） |
| R10 | `VITE_ASSET_BASE=''` 即同源现状 |
