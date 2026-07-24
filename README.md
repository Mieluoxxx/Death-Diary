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
| 仓库 / 大门 / 地图 | 物品管理、外出、地点探索 |
| 夜袭 | 跨日 DayLayer、防御与失物规则 |
| 电台 | 本地作弊终端 `/list` `/get` `/getall`（全物品表） |

## 运行

需要 [Bun](https://bun.sh)。

```bash
bun install
bun run dev
```

默认开发地址：`http://localhost:8080`（以 Vite 配置为准）。

| 命令 | 说明 |
|------|------|
| `bun install` | 安装依赖 |
| `bun run dev` | 开发服务器（热更新） |
| `bun run build` | 生产构建 → `dist/` |
| `bun run gen:frames` | 从 `public/source-art/frames` 生成 multiatlas / `frames.gen.ts` |
| `bun run typecheck` | `tsc --noEmit` |

生产部署：上传 `dist/` 全部内容即可。

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

部分系统仍为半成品（完整 NPC 交易、真支付、部分地图遭遇等），以代码与 `ART.md` 为准。

## License

以仓库内授权文件为准。原作商业资源与 SDK 请自行处理权利与渠道合规。
