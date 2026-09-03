# 修复 NPC 来访求助请求——对齐原版随机求助双链

## 背景 / 根因（调研已完成）

用户报告"NPC 的请求无法同意"。调研结论：移植版混淆了原版的**两条 NPC 需求链**：

| | 原版来访弹窗（needHelp） | 原版 NPC 面板（takeNeedItem） |
|---|---|---|
| 需求来源 | **随机 roll**（npcGiftConfig 价值预算 4：1101\*\* 木材系 120、1103\*1 50、1104\*1 10、1105011 10、1105022 10、1302\*1 10） | 静态 `needItem[好感等级]`（酒 1105022 ×1~4 递增） |
| 扣减源 | storage | bag |
| 拒绝惩罚 | 好感 -1（先扣 1 保底，同意才还原并 +1） | 无 |

移植版 `runNpcDailyVisit` 的来访需求错用了**面板链的静态表**（`getNpcNeed` = 酒 1105022×1~4）。酒只能靠酒窖（bid 7，YAZI/STRANGER 限定）酿造——**LUO 线无酒窖**，玩家永远凑不齐 → 同意按钮永久禁用。

面板链（npcNode.ts，`giveNpcNeed(npcId,'bag')`）与原版一致，无恙。

## 修复方案

1. **数据**：npcConfig 补 `npcGiftConfig`（produceValue 4 + 原版权重池 6 条）。
2. **npcSystem**：
   - `rollNpcHelpItems()`：复用 `rollValueBudgetLoot`（= 原版 `utils.getFixedValueItemIds`）roll 随机求助清单。
   - `runNpcDailyVisit`：来访 `need` 改为 roll 结果（`NpcVisit.need` 单个 → 数组），日志、事件同步。
   - `giveNpcNeed`：支持多物品清单（`NpcItemStack[]`），语义对齐原版 needHelp：
     - 同意 = 全部从 source 扣 + 好感净 +1（原版先 -1 保底、同意还原 +1 再 +1）
     - 新增 `declineNpcNeed`（拒绝 → 好感 -1 惩罚）
3. **npcVisitDialog**：need 渲染改数组（addItemGrid 已支持）；同意按钮 enabled = 清单全部足够；拒绝走惩罚路径。

## 验收标准

1. 来访弹窗需求为随机常见资源（木材系大概率），玩家能同意。
2. 同意：物品扣除正确、好感净 +1、日志/音效正确。
3. 拒绝：好感 -1，日志正确。
4. 面板交付链（bag 静态酒需求）行为不变。
5. bun test 全绿（npcSystem.test.ts 更新）+ tsc + biome 干净。
