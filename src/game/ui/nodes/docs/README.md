# `src/game/ui/nodes/` — 导航节点页面

挂在 `navigation` 栈上的全宽底框内容页。每个 `mountXxxNode(ctx)` 返回 `{ onLeft?, onRight?, update?, destroy? }`。

## 节点与 NavNode

| 文件 | NavNode（约） | 职责 |
|------|----------------|------|
| `homeNode.ts` | `HOME` | 家园占位（地图由 HomeScene 画） |
| `storageNode.ts` | `STORAGE` | 家中仓库分区格子 + 物品详情 |
| `gateNode.ts` | `GATE` | 大门：装备条 + 背包↔仓库 |
| `gateOutNode.ts` | `GATE_OUT` | 出门过渡 |
| `mapNode.ts` | `MAP` | 大地图旅行 |
| `siteNode.ts` | `SITE` | 地点入口：进度、存放、进入 |
| `adSiteNode.ts` | `AD_SITE` | 废品站：每日免费补给（无广告） |
| `siteStorageNode.ts` | `SITE_STORAGE` | 地点物品存放点（上下分栏） |
| `battleNode.ts` | `BATTLE_AND_WORK` | 战斗/搜刮过程 |
| `workLootNode.ts` | `WORK_ROOM_STORAGE` | 搜刮收获：背包↔箱子 |
| `radioNode.ts` | `RADIO` | 电台作弊终端 |
| `npcNode.ts` | `NPC` | NPC 会面：立绘、好感、需求与交易入口 |
| `npcStorageNode.ts` | `NPC_STORAGE` | NPC 交易：装备栏与克隆双库存草稿 |
| `itemGrid.ts` | （组件） | 可滚物品网格，供 gate/site/work 复用 |

## 布局模式

原版组合在迁移中的对应物：

| 原版 | 迁移 |
|------|------|
| `EquipNode` | `ui/equipStrip.ts` |
| `ItemChangeNode` | 上下 `sectionBar` + `mountItemGrid` |
| `SectionTableView` | `storageNode` 自绘分区 或 `itemGrid` |
| 地点标题 chrome | `ui/siteChrome.ts` |

## 约定

- 节点 **不要** 自己造一套滚动；用 `scrollViewport` / `itemGrid`。
- 装备交互用 `mountEquipStrip`，避免只读复制粘贴。
- `destroy` 必须关掉 scroll / 退订 bus / 关下拉。
- `ctx.toScreenY` / `bgBottomY` 与底框坐标系一致；改 chrome 时对照原版 BottomFrame。

## 相关

- 导航 host：[`../../docs/README.md`](../../docs/README.md)
- 地图/战斗规则：[`../../../systems/docs/README.md`](../../../systems/docs/README.md)
