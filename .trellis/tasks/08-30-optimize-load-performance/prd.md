# 优化游戏加载速度

## Goal

缩短游戏从打开页面到 MainMenu 可交互的时间（尤其首次访问），通过削减部署体积、修正 PWA 预缓存范围、消除启动阻塞三方面入手。用户价值：玩家点开页面更快进入游戏，降低流失。

## Background（代码证据）

启动链路：`DOMContentLoaded → initializeApplication → await initializeSessionStore() → StartGame → Boot(等字体) → Preloader(图集+启动音频) → MainMenu`。

实测与代码证据：

1. **dist 22M，其中 `dist/source-art` 13M（59%）是构建输入而非运行时资源**。源帧美术放在 `public/source-art/`（13M，数千张 png + frame-index.json 44K），vite 把 public 原样拷进 dist。运行时实际读取的是 `source-art/multiatlas/` 的图集 json+png（合计 ~232K）。
2. **PWA precache 全量 glob**：`vite/config.prod.mjs:54-58` 的 `globPatterns: '**/*.{html,js,css,json,png,jpg,...,mp3,ttf,...}'` 匹配 dist 下全部文件 → Service Worker 首次安装时把 ~22M 再完整下载一遍写入 Cache Storage，precache manifest 膨胀（数千条目）。
3. **Boot 阻塞等字体**：`Boot.ts:16` `ensureUiFontLoaded().finally(() => start Preloader)`——2.2M 的 `fzdh.ttf` 下载（最长等 4s）完成后才开始加载图集，串行浪费。而 `main.ts:24` 的 `scheduleTextRedrawOnFontReady` 已实现「字体就绪后重绘全部 Text」的兜底，Boot 阻塞是历史保守做法。
4. 部署为 Docker + Bun 静态直出 dist（`Dockerfile` / `docker-compose.yml`），无 CDN、无边缘缓存；普通带宽（10Mbps）下 22M 首访下载约 18s，其中 13M 无用。
5. 已经处于优化状态、无需改动的部分：启动音频只载 `mainpage.mp3 + CLICK`（`audioManager.queueStartupAudio`）；图集分波（`PRELOAD_ATLAS_KEYS` 4 张预载 + 17 张懒加载，multiatlas 总量 ~232K）；`initializeSessionStore` 只读 IndexedDB 无网络阻塞；云存档初始化在非阻塞链路。

用户补充约束：**可以适当增加服务器负担换取用户速度**——据此将「服务端压缩与缓存策略」纳入范围，优先选择把负担放在构建期（一次性）而非服务期的形态。

## Requirements

- R1（P0，重定义）轻量清理：`frame-index.json`（44K，构建期专用，gen 脚本自产自销）移出 public 输出；确认 dist 中无其他非运行时文件。（原「源帧移出部署」方案经实测证伪：598 张散图全部被运行时引用，予以废弃）
- R2（P0）PWA precache 策略化：workbox 改为「precache 首屏核心（index/assets/字体/menu 图集）+ runtimeCaching 缓存其余图集与音频（CacheFirst）」，SW 安装不再强制预取全站 22M。
- R9（P1，新增主项）真·图集打包：将 598 张散图（每图一 texture 的伪 multiatlas）按 atlas 分组合并打包成传统 sprite sheet 页（预计 <30 个页面），请求数 600+ → 预计 <30，体积 11.4M → 预计 7~8M；`frames.gen.ts`/`loadAtlas.ts` 帧坐标重生成，需逐场景视觉回归。
- R3（P1）字体并行化：Boot 不再 await 字体加载，Preloader 立即启动；`scheduleTextRedrawOnFontReady` 作为晚到字体重绘兜底，无 tofu 回归。
- R10（P1，新增）静态资源 base URL 可配置 + 加载失败回退：图集/字体/音频的 URL 前缀从环境变量注入（构建期 `VITE_ASSET_BASE`，默认同源）；Phaser loader 的 `loaderror` 处理器追加「镜像失败 → 回退源站 URL 重试」链。这是小众镜像路线的地基：CDN 抽卡时玩家不会卡死。
- R6（P1，服务端）Brotli 预压缩 + 协商：构建期生成 `.br`（brotli q11）与 `.gz` 兜底文件，`server/src/app.ts` 静态服务按 `Accept-Encoding` 协商返回预压缩文件。收益集中在文本类：bundle 1.6M → ~0.4M、multiatlas json 232K → ~40K、ttf 2.2M → ~1.1M（png/mp3 已压缩格式跳过）。压缩 CPU 成本全部发生在构建期，服务期零压缩开销。
- R7（P1，服务端）强缓存策略：带 hash 的静态资源返回 `Cache-Control: public, max-age=31536000, immutable`；`index.html` 返回 `no-cache`（保证发版即时生效）。回访请求直接命中浏览器缓存，服务器请求数下降。
- R4（P2，本轮 defer）字体子集化：按代码+数据实际字符集裁剪 fzdh.ttf（2.2M → 预计 <500KB）；需全量字符扫描与漏字验证，风险较高。
- R8（P2，本轮 defer）音频转码 mp3→m4a/aac（4.9M → ~1.5M）：一次性处理而非持续服务负担，但涉及音质权衡与验证，defer。
- R5 测量基线：改动前后用同一环境记录「首访到 MainMenu 可交互」「二访 SW 命中打开」两组数字，证明收益。

## Acceptance Criteria

- `bun run build` 后 dist 中不含 `frame-index.json`（构建期索引不再部署）。
- `dist/sw.js` 的 precache manifest 只含首屏核心资源（音频大文件走 runtimeCaching）。
- Boot 场景不等待字体即进入 Preloader（代码路径验证）；游戏内菜单/场景无 tofu（scheduleTextRedrawOnFontReady 兜底）。
- 服务端：支持 `Accept-Encoding: br` 时文本资源返回 brotli 压缩体（实测 `Content-Encoding: br`）；带 hash 资源响应含 `immutable` 长缓存头，`index.html` 为 `no-cache`。
- 服务端回归：`bun run test:server` 全绿（新增压缩协商与缓存头的用例）。
- 本地 Docker 部署实测：首访（清缓存+无痕）到 MainMenu 可交互的时间较基线有可量化下降（记录前后值）；二访 SW 命中后打开 < 2s。
- 回归全绿：`bun run typecheck`、`bun run lint`、`bun test src/game`、`bun run test:server`、`bun run build`、`bun run gen:frames:check`。

## Out of Scope

- 音频转码（mp3→m4a/opus，4.9M→~1.5M）：涉及兼容性与音质权衡，defer。
- CDN / 压缩中间件 / Bun 静态服务 gzip 配置：部署侧另议。
- 图集合并、代码分包等既有已优化项的再加工。

## 部署建议（CDN 路线已由用户选定：小众镜像，2025-08-30）

### 用户决策与落地形态

游戏面向小众群体，接受不稳定，「能加速多少是多少」。落地：**GitHub 公开仓库 + 多镜像域名**（小众游戏圈标准玩法）：

1. 构建产物中的静态资源（图集 png/json、字体、音频）推到 GitHub 公开仓库（资源将可被公众下载，美术裸奔；单文件 ≤100MB 硬限，本项目最大音频 ~1M 无虞）。
2. 前端静态资源 base URL 指向镜像链：`fastly.jsdelivr.net/gh/<user>/<repo>@<tag>/` 主选，`gcore.jsdelivr.net`、`testingcf.jsdelivr.net`、渺软公益 CDN（jsd.onmicrosoft.cn）备选，全部失败自动回退源站（R10 兜底）。
3. jsDelivr 对 gh **tag** 引用永久缓存：发版打新 tag 即全量刷新；分支引用 12h。
4. jsDelivr 主域名在国内已受污染，官方多线路域名时好时坏——正是「能加速多少是多少」，回退链保底。
5. 云存档 API 始终直连源站；`ALLOWED_ORIGINS` 已支持跨域白名单。

### 未来升级路径（备案后/商业化后）

CDN 选型调研明细（2025-08，备查）：

- **公益/社区 CDN（渺软公益 CDN cdn.onmicrosoft.cn 等）：调研结论为结构性不可用。** 该类项目定位是加速 jsDelivr/UNPKG/cdnjs 的开源公共库镜像（React/Vue 等全网统一文件，缓存命中率极高，公益带宽才烧得起）；不支持自定义源站回源，无法加速私有源站的独占资源。且个人公益项目生存状态脆弱（渺软项目 2024-2025 间多次迁移赞助平台），jsDelivr 自身在国内也已受阻多年（DNS 污染/ICP 变动）。
- **EdgeOne Pages（Makers）免费托管——「公益级免费」的可行现代形态：** 把 dist 直接部署为边缘静态站（免备案、腾讯边缘节点），免费配额宽松（40 项目、500 构建次/月，官方声明超限优先保障业务、可工单提额）。云存档 API 留在源站，前端走完整 API URL；`docker-compose.yml` 已有 `ALLOWED_ORIGINS` 跨域白名单，正好适配。风险预案：商业化后配额可能调整，静态资源 base URL 与 API 跨域白名单保持可配置，随时可切回自建源站。

- **腾讯云 EdgeOne 个人免费版**（首选，需已备案域名）：0 元长期套餐，安全加速流量与请求数均不限量、无超额付费；大陆可用区/全球可用区要求工信部备案。免费版关闭 HTTP/3、智能加速等高级功能，不承诺 SLA。
- **EdgeOne.ai 国际版免费计划**（无备案首选）：$0/月，约 50GB/月流量 + 2000 万请求，全球 CDN（腾讯亚太节点：香港/新加坡/日本），免备案。按单次首访 ~13M 计算约可服务 3800 次首访/月，回访命中边缘与 SW 后不计入，个人项目足够。
- **Cloudflare Free**（无备案备选，仅电信线路用户可考虑）：流量不限，但 2025 实测国内平均响应 5.2s——电信 0.97s 尚可，**移动/联通 ~7.3s 明显劣化**，纯国内玩家场景不推荐。
- **七牛云**：实名用户每月国内+海外各 10GB 静态 HTTP 流量免费（长期）。按本游戏单次首访 ~13M 计算，约 700 次首访即超额，不适合游戏类资源。
- **又拍云联盟**：免费流量+存储+SSL，条件为页脚展示又拍云 LOGO；额度与门槛对游戏场景不如 EdgeOne。

接入方式：静态资源走 CDN 回源源站（Docker/Bun），`/api/*` 直连源站不缓存；R7 的 immutable 缓存头是 CDN 边缘命中率的地基（发版前边缘缓存永不过期），二者叠加收益最大。

## Open Questions
- Q1（范围决策）已解决：本轮范围 = R1+R2+R9+R6+R7+R3+R10；CDN 走用户选定的小众镜像路线（GitHub 仓库 + jsDelivr 多镜像 + 源站回退，见部署建议节）；R4 字体子集化与 R8 音频转码 defer。
