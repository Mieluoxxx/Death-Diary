# `src/game/data/` — 静态配置表

只读数据层：物品、建筑、地图、怪物、效果、IAP 等。对应原版 `itemConfig` / `siteConfig` / `buildActionConfig` 等。

## 文件一览

| 文件 | 内容 |
|------|------|
| `itemConfig.ts` | 物品定义：重量、价值、装备槽、武器/防具/工具效果 |
| `itemEffects.ts` | 食物 / 药品 / Buff 效果表 + `isFoodItem` 等谓词 |
| `formulaConfig.ts` | 制作配方 |
| `buildConfig.ts` | 建筑升级树、坐标、费用 |
| `buildActionConfig.ts` | 设施动作（床、椅子、狗、雷区…） |
| `buildStrings.ts` | 建筑/物品中文名与描述片段 |
| `siteConfig.ts` | 地图地点：坐标、房间数、掉落、解锁图 |
| `monsterConfig.ts` | 怪物与遭遇池 |
| `moonlightingConfig.ts` | 夜袭概率与强度相关 |
| `playerConfig.ts` | 按小时属性衰减、温度等 |
| `playerAttrEffect.ts` | 属性区间 → 日志/效果条带 |
| `weatherConfig.ts` | 天气与日志 |
| `npcConfig.ts` | NPC 文案占位 |
| `purchaseList.ts` | IAP 包定义 |
| `radioItemCatalog.ts` | 电台作弊 `/list` 目录 |
| `blackList.ts` | 仓库显示/夜袭不可偷等黑名单 |

## 约定

- **纯数据 + 小工具函数**（查找、默认值）。不要在这里改 `session` 或发 bus。
- ID 与原版一致（如罐头 `1103083`、睡袋建筑 `bid=9`）。
- 新增配置优先扩展现有表，而不是在 systems 里写魔法数。
- 文案目前以简体为主；多语言设置在 `settings/`，完整 i18n 表仍在迁移中。

## 谁读这些表

| 消费者 | 典型配置 |
|--------|----------|
| `systems/inventory` | `itemConfig` |
| `systems/itemUse` / `facilityAction` | `itemEffects`, `buildActionConfig` |
| `systems/mapSystem` / `nightRaidSystem` | `siteConfig`, `moonlightingConfig` |
| `systems/craftSystem` | `formulaConfig` |
| `ui/nodes/*` | 名称、图标 frame、地点名 |

## 相关

- 会话字段如何引用配置：[`../../session/docs/README.md`](../../session/docs/README.md)
- 规则如何用配置：[`../../systems/docs/README.md`](../../systems/docs/README.md)
