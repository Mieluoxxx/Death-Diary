# 死亡日记 (Death-Diary)

末日生存竖屏游戏，基于原版 *Buried Town / Buried-City* 的 Phaser 4 + Bun + TypeScript 重制。

设计分辨率 **640×1136**（`Scale.FIT`）。

![主菜单](screenshot.png)

## 已实现（相对原版）

| 模块 | 说明 |
|------|------|
| 主菜单 / 选角 / 勋章 | 设置、语言、继续/新游戏 |
| 商店 IAP | 永久包 101–109，Web 端免费解锁 |
| 家园与设施 | 升级、工具箱配方制作、床睡觉、椅子咖啡/喝酒 |
| 仓库 / 大门 / 地图 | 物品管理、外出、地点探索、角色专属家园坐标 |
| NPC | 六名原版 NPC、地点解锁、每日拜访、好感请求与价值交换 |
| 夜袭 | 跨日 DayLayer、防御与失物规则 |
| 电台 | 本地作弊终端 `/list` `/get` `/getall`（全物品表） |

## 运行

需要 [Bun](https://bun.sh)。

```bash
bun install
bun run dev
```

开发模式同时启动 Web `http://localhost:8080` 和 SQLite API `http://localhost:3001`，
Vite 会将 `/api` 代理到存储服务。

| 命令 | 说明 |
|------|------|
| `bun install` | 安装依赖 |
| `bun run dev` | 同时启动 Web 热更新与存储 API |
| `bun run build` | 生产构建 → `dist/` |
| `bun run start` | 生产模式提供 `dist/` 和 `/api` |
| `bun run test:server` | 运行存储 API 测试 |
| `bun run gen:frames` | 从 `public/source-art/frames` 生成 multiatlas / `frames.gen.ts` |
| `bun run typecheck` | 检查前后端 TypeScript |

## 服务器部署

推荐使用 Linux VPS，以 systemd 运行 Bun，并由 Caddy/Nginx 反向代理 HTTPS：

```bash
bun install --frozen-lockfile
bun run build

DATABASE_PATH=/var/lib/death-diary/death-diary.sqlite \
HOST=127.0.0.1 PORT=3001 \
bun run start
```

- 将域名的 HTTPS 请求反向代理到 `127.0.0.1:3001`；不要将 3001 端口暴露到公网。
- `DATABASE_PATH` 必须位于持久磁盘并赋予运行用户写权限；不要放在 `dist/` 中。
- 生产 Cookie 使用 `Secure`，线上必须通过 HTTPS 访问。
- 使用 SQLite `.backup` 定期备份数据库，并将备份保存到服务器之外。
- 前后端分域部署时，通过 `ALLOWED_ORIGINS` 配置允许的来源；同域部署无需设置。

## 目录要点

| 路径 | 说明 |
|------|------|
| `src/game/scenes/` | 场景：Boot / Preloader / MainMenu / Shop / Home… |
| `src/game/systems/` | 生存时钟、制作、夜袭、战斗、地图… |
| `src/game/data/` | 配置表（物品、配方、建筑、IAP…） |
| `src/game/ui/` | 底栏导航、面板、弹窗 |
| `public/source-art/frames/` | 单帧原画（加载策略见 `ART.md`） |

美术与图集流水线详见 [ART.md](./ART.md)。

## 与原版的关系

- **Buried-City / Buried-Town**：原版参考实现与资源  
- **Death-Diary**：本仓库，Web 竖屏切片 + 逐步对齐  

部分系统仍为半成品（真支付、部分地图遭遇等），以代码与 `ART.md` 为准。

## License

以仓库内授权文件为准。原作商业资源与 SDK 请自行处理权利与渠道合规。
