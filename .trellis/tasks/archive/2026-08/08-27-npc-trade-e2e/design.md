# NPC 主动拜访与交易原版还原设计

## Architecture

保留现有 `NpcNode` 名称作为会面页，新增 `NpcStorageNode` 作为独立交易页：

```text
MapNode
  -> NPC travel dialog
  -> NpcNode (portrait, hearts, need, trade entry)
  -> NpcStorageNode (equip strip, draft bag, draft NPC storage)
  -> success: back to a newly mounted NpcNode
```

不新增框架或依赖。复用现有 `mountEquipStrip`、`addSectionBar`、`mountItemGrid`、导航栈和原版图集。

## UI Boundaries

### Map NPC dialog

`mapNode.ts` 增加 NPC 专用弹窗分支，使用 `icon_npc.png`、`npc_dig_<id>.png` 和共享心形渲染；地点弹窗继续只处理真实 site id。

### NpcNode

`npcNode.ts` 删除合并交易 UI，只负责：

- NPC 姓名和五颗半心制好感
- `npc_dig_bg.png` + `npc_dig_<id>.png`
- 一次挂载一次随机台词
- 需求文案/“给他”按钮
- 交易物品种类数/“交易”按钮

心形渲染由一个小型共享 helper 提供，因为地图弹窗和会面页都需要同一规则。

### NpcStorageNode

新增 `npcStorageNode.ts`，布局沿用原版坐标：顶部 `572x100` 装备栏，下方 `596x670` 交易区，上下各一半。分区条内显示背包重量或 NPC 名称、报价文案和黑色交易按钮。

批量数量选择只服务这一页，直接在文件内实现，不建立通用表单框架。

## Draft And Commit Flow

进入交易页时复制：

- `originalBag` / `draftBag`
- `originalNpcStorage` / `draftNpcStorage`

点击任一栏物品时只在两个 draft map 间移动。确认时用 `draftBag - originalBag` 计算净变化：正数为玩家索取，负数为玩家给出，再调用领域提交函数。返回时销毁草稿，不触碰会话。

`mountEquipStrip` 增加可选的只读背包数据源；交易页传入 draft bag，使装备候选与原版 `tmpBag` 一致。其他页面不传参数，继续读取真实会话背包。

## Pricing Contract

`ItemDef` 增加原版 `price` 字段，保留 `value` 给夜袭和掉落系统使用。

```text
weighted(stock) = sum(item.price * favoriteMultiplier(item) * quantity)
rate = weighted(draftNpcStorage) / weighted(originalNpcStorage)
```

报价文案阈值严格使用原版：`1.3 / 1.1 / 1.0 / 0.9 / 0.7`。初始草稿未变化时不显示报价且按钮禁用；发生移动后再计算。

## Need Delivery Contract

领域 API 显式接收来源：

```text
giveNpcNeed(npcId, 'bag')      // 主动拜访
giveNpcNeed(npcId, 'storage')  // NPC 上门
```

默认值不得掩盖调用上下文。调用者必须明确选择，以防再次出现修复一条路径、破坏另一条路径的回归。

## Compatibility

- 不改变 `SessionState` 或存档结构。
- `tradingCount` 字段保留，仅停止将其用于台词索引。
- NPC、物品和地图 id 不变。
- 新增的 `price` 是静态配置字段，不需要迁移存档。

## Validation Strategy

- 领域单测覆盖 bag/storage 来源、原版公平交易公式、库存提交和随机台词选择。
- Ego E2E 覆盖导航分层、草稿取消/提交和按钮启用状态，不为一次性页面状态新增测试框架。
- Ego E2E 使用确定性夹具，但从地图点击开始全部走真实 UI；截图同时检查会面页和交易页结构。

## Rollback

本任务不迁移持久化数据。若实现失败，可整体回退新增 `NpcStorageNode`、心形 helper、地图 NPC 弹窗分支和相关领域改动，旧存档仍可由此前版本读取。
