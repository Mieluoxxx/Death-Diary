# NPC 主动拜访与交易原版还原实施计划

## Implementation

1. 从原版 `itemConfig.js` 机械同步所有物品 `price` 到现版 `ItemDef`，保留现有 `value` 语义。
2. 在 `npcSystem.ts` 恢复原版交易比例，并让需求交付显式区分 `bag` 与 `storage`；让会面页和上门弹窗各自传入正确来源并补领域单测。
3. 添加共享五颗半心渲染 helper，并把地图 NPC 确认弹窗从地点弹窗中拆出。
4. 将 `npcNode.ts` 收缩为原版会面页，恢复立绘、心形、随机台词、需求和交易入口。
5. 让装备栏支持可选草稿背包数据源；新增 `NpcStorageNode` 导航与页面，复用装备栏、分区条和物品网格，实现克隆草稿、逐个移动、长按数量选择、报价文案和禁用状态。
6. 成功交易后返回会面页，删除占位实现新增的交易日志和顺序台词行为。
7. 重写 `e2e/e2e-npc-trade.md`，删除旧占位页验收，使用 Ego 验证完整两页流程和原版结构。
8. 更新 `src/game/ui/nodes/docs/README.md`，移除“NPC 占位”说明并记录两个导航节点职责。

## Expected Files

- `src/game/data/itemConfig.ts`
- `src/game/systems/npcSystem.ts`
- `src/game/systems/npcSystem.test.ts`
- `src/game/systems/audioManager.ts`
- `src/game/ui/navigation.ts`
- `src/game/ui/equipStrip.ts`
- `src/game/ui/npcHearts.ts`（新增，共享两处心形渲染）
- `src/game/ui/npcVisitDialog.ts`
- `src/game/ui/nodes/mapNode.ts`
- `src/game/ui/nodes/npcNode.ts`
- `src/game/ui/nodes/npcStorageNode.ts`（新增）
- `src/game/ui/nodes/itemGrid.ts`
- `src/game/ui/nodes/docs/README.md`
- `e2e/e2e-npc-trade.md`

## Validation Commands

```bash
bun test src/game/systems/npcSystem.test.ts
bun run lint
bun run typecheck
bun run gen:frames:check
bun run build-nolog
```

随后使用 Ego Browser 从空存档执行新版 E2E，并保存地图弹窗、会面页、交易前和交易后截图。

## Review Gates

- 对照 `../buried-city/src/ui/npcNode.js`、`npcStorageNode.js`、`ItemChangeNode.js`、`src/game/npc.js` 逐项复核。
- 确认 `giveNpcNeed` 两种来源都有独立测试，避免上门与主动拜访互相回归。
- 确认交易按钮在初始和不公平状态不可提交。
- 确认未把原版 `price` 与现版夜袭用 `value` 合并。
- 确认所有修改只涉及 NPC 流程，没有吸收工作区中并行的架构改动。

## Rollback Points

- 领域层与 UI 层分开提交，便于单独回退计价或页面迁移。
- 不执行存档迁移；回退代码即可恢复旧行为。
