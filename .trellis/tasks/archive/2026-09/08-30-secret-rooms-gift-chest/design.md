# 技术设计

## 原版对照（Buried-City）

| 原版 | 职责 | 移植落点 |
|---|---|---|
| `src/data/secretRooms.js` | 5 档密室配置 | 新 `src/game/data/secretRooms.ts` |
| `site.js` ctor/testSecretRoomsBegin/genSecretRooms/enter/End | 触发与生成 | 新 `src/game/systems/secretRoomSystem.ts` |
| `battleAndWorkNode.js` updateView 分支 + createSecretRoomsEntryView | 入口 UI 与房间路由 | 改 `src/game/ui/nodes/battleNode.ts` |
| `SiteState.save/restore` 密室字段 | 存档 | 扩展 `sessionStore.ts` SiteState（optional） |
| `adSiteNode.js` 广告三件套 | 202 领奖交互 | 改 `src/game/ui/nodes/adSiteNode.ts` → 礼物箱 |

> **演变记录**（第 7/8 步迭代后）：`adSiteNode.ts` 已删除；202 走通用 `siteNode`
> + `battleNode` 密道分支，冷却入口资格由 `mapSystem.enterScrapyardDungeon` 承担。
> 下表 adSiteNode 行仅作历史记录。

## 关键决策

1. **分支放在 battleNode（UI 层），不改 `currentRoom` 通用语义**。原版即如此（updateView 里 `isInSecretRooms ? secretRoomBegin() : roomBegin()`）。`map.sites[x].rooms/step` 永远只表示普通副本，密室走独立字段，避免污染 siteStorage/进度等读点。
2. **密室房间复用 `SiteRoom` 类型与现有视图**：battle 房走 mountBattleBegin/Process、work 房走 mountWorkBegin/Process；work 物品写 `room.loot`，`fillTempLootFromRoom` 内部按 `isInSecretRooms` 切换取房来源。
3. **触发时机**：`showResult(win)` 内 `roomEnd` 处分支——`isInSecretRooms ? secretRoomEnd : roomEnd + testSecretRoomsBegin`；结算视图后点「下一个房间」→ `ctx.replace(BATTLE_AND_WORK)` → mountBattleNode 渲染入口/密室视图（等价原版 updateView 分支）。
4. **配置 weight 0 条目保留**：与 `adConfig.ts` 移植先例一致，忠实原版随机行为。
5. **音乐**：`audioManager.Music.SITE_SECRET` 已存在；mountBattleNode 密室相关分支播放、离开时恢复站点音乐。

## 数据结构

```ts
// secretRooms.ts
export type SecretRoomsConfig = {
    id: 1 | 2 | 3 | 4 | 5;
    maxCount: number;            // 每站每局触发上限
    probability: number;         // 基础触发概率
    minRooms: number;            // 房间数区间
    maxRooms: number;
    minDifficultyOffset: number; // 战斗房难度偏移
    maxDifficultyOffset: number;
    produceValue: number;        // 末房工作房价值预算
    produceList: readonly { itemId: string; weight: number }[];
};
export const SECRET_ROOMS: Record<1|2|3|4|5, SecretRoomsConfig>;
export const SECRET_ENTRY = { title: '密道', des: '你发现破损的墙壁后面，似乎另有洞天。直觉告诉你，黑暗中隐藏着未知的风险和秘密。', leaveConfirm: '密室一旦离开就不可以重新进入，确定要离开吗？' };
```

```ts
// sessionStore.ts SiteState 追加（全 optional，旧存档免迁移）
secretRoomsShowedCount?: number;
isSecretRoomsEntryShowed?: boolean;
isInSecretRooms?: boolean;
secretRooms?: SiteRoom[];
secretRoomsStep?: number;
secretRoomType?: number;
```

```ts
// siteConfig.ts SiteConfig 追加
secretRoomsId?: 1 | 2 | 3 | 4 | 5;
// 28 站标注：3,4,7,9,10,31,52→1；11,13,21,22,43,203→2；12,14,22?→3；33→4；301..312→5
```

## secretRoomSystem API

```ts
testSecretRoomsBegin(siteId): boolean   // 房胜后判定；命中 → 入口显示 + genRooms（mutateSession）
enterSecretRooms(siteId): void
secretRoomBegin(siteId): SiteRoom | null
secretRoomEnd(siteId): void             // step+1；末房完成 → isInSecretRooms=false
abortSecretRooms(siteId): void          // 左键确认离开：清空密室房与入口
isSecretRoomsActive(siteId): boolean    // entryShowed || isInSecretRooms
```

触发判定（原版语义）：`showedCount < maxCount(+探测器1)` 且 `Math.random() < probability(+手电0.05/+探测器0.12)`；`secretRoomType = randomInt(0,2)`（原版 3 种文案相同，保留字段对齐存档）。

## UI 改动（battleNode.ts）

- `mountBattleNode` 顶部三分支：
  1. `isSecretRoomsEntryShowed` → `mountSecretEntryView`：标题「密道」、进度 `???`、`site_dig_secret.png`、des、按钮「再想想」(abort+back) /「进入」(enterSecretRooms+replace 本节点)；左键禁用（原版 leftBtn 不可见）；音乐 SITE_SECRET。
  2. `isInSecretRooms` → 标题「密道」、进度 `???`、room=secretRoomBegin()，复用现有 begin/process 挂载；音乐 SITE_SECRET；onLeft → 退出确认弹层。
  3. 普通 → 现状逻辑 + `onLeft` 不变。
- `mountBattleProcess.showResult(win)`：roomEnd 处按决策 3 分支。
- `mountWorkProcess` 完成：`isInSecretRooms ? secretRoomEnd : roomEnd`；`fillTempLootFromRoom` 取房分支。
- 退出确认弹层：轻量双按钮面板（再想想 / 离开），样式复用 uiTextStyle + atlas 按钮，不引入新组件。

## adSiteNode.ts 改动

- 删 icon_ad_play / icon_ad_stop / icon_ad_play_highlight。
- 设备图中心叠 `icon_gift.png`（icon 图集，Scale 适中）+ 可点击 + 呼吸 tween（可领时 alpha yoyo）。
- 点击 → 冷却中 toast「设备还未刷新」；可领 → `claimScrapyardGift` → tween 反馈（gift 弹跳）+ toast「补给已放入存放点」。
- 冷却中 gift alpha 0.45、停交互。
- 进度条文案沿用 `scrapyardProgressStr`。

## 兼容性 / 回滚

- SiteState 新字段全 optional：旧存档 `isSessionState` 校验不涉及新字段，零迁移。
- `fillTempLootFromRoom` 增加密室分支对普通流程零影响（isInSecretRooms 默认 false）。
- 回滚 = revert battleNode/adSiteNode/mapSystem/sessionStore/siteConfig/secretRooms.ts 六处，无数据破坏。

## 风险

- 密室 work 房物品经 tempLoot → WORK_ROOM_STORAGE 流程，需确认 `flushTempToSite` 在密室场景仍写入本站 storage（原版密室物品也入 site.storage）。
- 概率 roll 依赖 Math.random，测试只覆盖结构性边界（房间数区间、末房 work、难度 clamp、加成生效）。
