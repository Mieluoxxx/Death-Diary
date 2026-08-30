# Implement — 优化游戏加载速度

执行顺序按「先基线、先独立项、后大项」编排；每步验证通过再进下一步。

## 0. 基线（R5a）

- [ ] 本地 Docker 构建 + 启动，记录基线：
  - `docker compose up -d --build` 后，无痕窗口首访到 MainMenu 可交互秒数（DevTools Performance + 网络面板截图）
  - 二访（刷新）秒数；传输字节数与请求数
  - 结果记入本文件「Execution log」

## 1. R1 轻量清理

- [ ] `tools/gen_frame_multiatlas.mjs`：`frame-index.json` 输出路径移到仓库 `tools/.cache/`（或 `public/` 外任意目录），同步更新读取处
- [ ] `bun run gen:frames && bun run gen:frames:check && bun run build`，确认 dist 无 frame-index.json

## 2. R9 真·图集打包（最大项，独立分支推进）

- [ ] `bun add -d free-tex-packer-core`
- [ ] `gen_frame_multiatlas.mjs` 增加 `GEN_PACK=packed` 模式：按 atlas 分组 pack 成 ≤2048 页，输出 `multiatlas/<key>.json`（pages+frames schema）与 `<key>_<n>.png`；`flat` 模式保留旧产物
- [ ] `frames.gen.ts` 模板：新增每 key 页数常量
- [ ] `loadAtlas.ts`：atlas 页加载（`load.atlas`）+ 帧名兼容层 `resolveFrame()`；grep 全量 `setFrame`/`textures.get` 调用点并适配
- [ ] `applyLinearFilter` 按页生效
- [ ] **视觉回归**：Boot→MainMenu→ChooseScene→HomeScene→地图→战斗→商店→设置逐场景截图对比（flat vs packed）
- [ ] 验证：`bun run build`、`bun run typecheck`、`bun test src/game`、`gen:frames:check`
- 回滚点：视觉/性能不合格 → `GEN_PACK=flat` 重新生成，revert loadAtlas

## 3. R6 Brotli 预压缩 + R7 缓存头（服务端一揽子）

- [ ] `tools/compress_dist.mjs`（.br q11 + .gz，仅文本类）+ `postbuild` 挂钩
- [ ] `server/src/app.ts`：预压缩协商中间件（文本类，含 `Vary: Accept-Encoding`）+ 路径级缓存头 + index.html fallback `no-cache`
- [ ] `server/src/app.test.ts` 新用例：br 协商返回 `Content-Encoding: br`、无 br 走原文件、assets immutable 头、index no-cache
- [ ] 验证：`bun run test:server`、`bun run typecheck -p tsconfig.server.json`、手动 `curl -H 'Accept-Encoding: br' -I`
- 回滚点：revert app.ts + 移除 postbuild

## 4. R2 PWA 策略化

- [ ] `vite/config.prod.mjs`：globPatterns 收窄 + runtimeCaching（source-art/audio/fonts，CacheFirst）
- [ ] 验证：`bun run build` 后 `dist/sw.js` manifest 仅含首屏核心；DevTools Application → Cache Storage 检查
- 回滚点：revert vite 配置

## 5. R3 字体并行化

- [ ] `Boot.create` 去掉字体等待，直接进 Preloader；删除 Boot 中 `ensureUiFontLoaded` 调用（main.ts 的重绘兜底保留）
- [ ] e2e-font-consistency.md 补充「首帧 fallback 字体 → 就绪后重绘」预期
- [ ] 验证：`bun test src/game`；游戏内文本无持续 tofu
- 回滚点：revert Boot.ts 单行

## 6. R10 资源 base URL + 回退

- [ ] vite env `VITE_ASSET_BASE`（默认 `''`）；`loadAtlas.ts`/`audioManager.ts` URL 拼装接入
- [ ] `loaderror` 回退链：镜像 URL 失败 → 同源重试一次（模块级 flag 记住本次会话结果）
- [ ] 验证：`VITE_ASSET_BASE=https://fastly.jsdelivr.net/gh/...` 构建，断网模拟镜像 404 → 自动回退源站成功加载
- 回滚点：base 置空

## 7. 收尾（R5b）

- [ ] Docker 重新构建，重复 §0 测量，前后数字对比记入 Execution log
- [ ] 全量回归：`bun run typecheck`、`bun run lint`、`bun test src/game`、`bun run test:server`、`bun run build`、`bun run gen:frames:check`
- [ ] 部署流程文档：GitHub 资源仓库建立 + tag 发布 + 镜像域名清单（jsdelivr 多线路/渺软）+ `VITE_ASSET_BASE` 用法（写入 ARCHITECTURE.md 或 ops note）

## 8. 部署（零代码，主人操作）

- [ ] GitHub 公开仓库：推静态资源 + 打 tag（jsDelivr tag 永久缓存）
- [ ] 前端构建带上 `VITE_ASSET_BASE=https://fastly.jsdelivr.net/gh/<user>/<repo>@<tag>`
- [ ] 源站 Docker 仅承载 index/assets/API；验证小众线路实际加速效果（多地区朋友实测）

## Validation commands（汇总）

```bash
bun run gen:frames && bun run gen:frames:check
bun run typecheck && bun run lint
bun test src/game && bun run test:server
bun run build
ls dist | grep -c 'frame-index' # 期望 0
curl -sI -H 'Accept-Encoding: br' http://localhost:3000/assets/<js> | grep -i 'content-encoding\|cache-control'
```
