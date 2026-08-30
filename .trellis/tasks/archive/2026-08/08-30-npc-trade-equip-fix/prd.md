# 修复 NPC 交易装备联动与 UI 细节

## 背景

本会话集中修复三个实机反馈的 UI/状态联动 bug，均以原版 Buried-City 行为为基准对齐，全部已完成验证并提交。本任务为事后归档记录。

## 修复内容

### 1. NPC 交易装备联动（主体，e33fc2c）

**现象**：交易页把装备中的武器给出去，装备栏图标不消失；拿回背包后图标"复活"像自动装回。

**根因**：交易页是草稿模式（只改 `draftBag`），装备槽冻结到 commit 才联动；此前又加了纯显示层联动，造成图标与数据不一致的观感。

**原版语义**（`Bag.decreaseItem`）：草稿把装备中物品扣到 0 → **立即真实卸下** + 事件刷新装备栏；拿回不自动装回；取消不恢复（卸了就是卸了）。

**改动**：
- `inventory.ts`：+`unequipByItemId(itemId)`（按 itemId 找槽卸下，原版 equipment.js 同名 API）
- `npcStorageNode.ts`：`move()` 给出方向扣空后真实卸下
- `equipStrip.ts`：装备图标显示条件加"草稿包仍有余量"；武器槽扣空回拳头（对齐 commitNpcTrade 的 `pos===1 → HAND`）

**验收**（实况端到端已验证）：
- 给出电锯扣空 → `equip[1]` 立即变 HAND、图标变拳头、真实 bag 未动
- 拿回 → 装备保持卸下、物品在包里
- 确认/取消行为与原版一致

### 2. 好感度心心错位重叠（c387443）

**根因**：Phaser `setFrame()` 会把 origin 重置回贴图轴点 0.5，`setReputation` 每次 setFrame 后实心/半心图标左移 11px 挤进前一格。

**改动**：`npcHearts.ts` `setReputation` 中 setFrame 后重新 `setOrigin(0, 0.5)`。

### 3. 图集按钮默认字色黑底黑字（f8d799d）

**根因**：`atlasButton.ts` 默认 `labelColor='#111'`，黑笔刷按钮漏传时字隐形。

**改动**：默认色按 frame 自适应（`/white/` → 深字，否则米白），对齐原版 createCommonBtnBlack/White 语义。

## 经验记录

- Phaser `setFrame()` 重置 origin：依赖非默认 origin 的图，setFrame 后必须重新 setOrigin。
- 草稿模式的状态联动：显示层"假装跟随草稿"会产生数据/观感分裂，应优先对齐原版的真实状态联动时机。
