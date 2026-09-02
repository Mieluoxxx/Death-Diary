# 执行计划

## 步骤清单

- [x] 1. 数据层
  - [x] 1.1 新建 `src/game/data/secretRooms.ts`（5 档配置 + SECRET_ENTRY 文案常量）
  - [x] 1.2 `siteConfig.ts`：`SiteConfig.secretRoomsId?` 字段 + 28 站标注
    （3,4,7,9,10,31,52→1；11,13,21,22,43,203→2；12,14→3；33→4；301~312→5）
- [x] 2. 状态层
  - [x] 2.1 `sessionStore.ts`：SiteState 追加 6 个 optional 密室字段
- [x] 3. 逻辑层
  - [x] 3.1 新建 `src/game/systems/secretRoomSystem.ts`（test/enter/begin/end/abort/isActive）
  - [x] 3.2 `mapSystem.ts`：`fillTempLootFromRoom` 密室取房分支
- [x] 4. UI 层
  - [x] 4.1 `battleNode.ts`：mountBattleNode 三分支 + mountSecretEntryView + 退出确认弹层 + 音乐
  - [x] 4.2 `battleNode.ts`：showResult / mountWorkProcess 完成回调的密室分支
  - [x] 4.3 `adSiteNode.ts`：广告三件套 → 礼物箱交互
- [x] 5. 测试
  - [x] 5.1 `secretRoomSystem.test.ts`：房间数区间、末房 work、难度 clamp、加成道具、abort 清理
- [x] 6. 验证
  - [x] 6.1 bun test 全绿 / tsc --noEmit / biome check
  - [x] 6.2 手动冒烟：bun 脚本模拟 session 全链路（触发/进入/清房/拾取/中止/miss/无密室站）通过；UI 视觉冒烟待游戏内确认

## 验证命令

```bash
bun test
npx tsc --noEmit
npx biome check src/game
```

## 回滚点

每步独立可 revert；核心回滚集 = secretRooms.ts(删) + siteConfig/sessionStore/mapSystem/battleNode/adSiteNode(revert)。

## 整改追加（用户迭代：202 密道副本化）

- [x] 7. 202 从开箱领奖站改造为密道主题副本站
  - [x] SITE_PRODUCE_CONFIG['202']（原版 adConfig 奖励池，预算 11）；删除 adConfig.ts（冷却常量搬至 siteConfig）
  - [x] siteConfig 202：workRoom 0→1 + 密道主题 des；workType 固定 1（桌子补给事件）
  - [x] mapSystem：claimScrapyardGift → enterScrapyardDungeon（冷却 gate + 重滚桌子房 + 记录进入日）
  - [x] 删 adSiteNode.ts + AD_SITE 路由；202 走通用 siteNode（物品存放点 + 进入副本双按钮）
  - [x] siteNode：202 冷却进度条/进入资格；battleNode：202 密道主题标题/进度/SITE_SECRET 音乐
  - [x] applySecretRoomMusic 共享化（audioManager）；siteNode 返回时恢复站点 BGM
  - [x] bun 冒烟：进入/同日冷却/7 天重置/桌子 loot/tempLoot 全通过

- [x] 8. 用户迭代 3：202 对齐普通关卡遇密道的完整节奏
  - [x] siteConfig 202：battleRoom 1（难度[1,1]）+ workRoom 0 + secretRoomsId: 1；删 SITE_PRODUCE_CONFIG['202']（密室物资走档1池）
  - [x] secretRoomSystem：siteId===AD_SITE_ID 密道必触发特判
  - [x] enterScrapyardDungeon：rooms 重滚复用 createSiteState（1 间战斗房）+ showedCount 重置
  - [x] battleNode showResult：siteEnded 判断改用 isSecretRoomsActive（入口显示优先于"离开"按钮）
  - [x] 流程 = 进入副本 → 战斗房 → 胜利 → 密道入口 → 密室（battle+work 桌子/箱子）→ 开箱拾取 → 出密室；bun 冒烟全通过

- [x] 9. Advisor 审查修复
  - [x] P0 enterScrapyardDungeon 清理悬挂密室状态（战斗失败撤退 → 冷却重进不再掉进旧密室链）
  - [x] P1 删 createSiteState 的 202 workType 死特判（workRoom=0 永不执行）
  - [x] P2 退出确认弹层遮罩 setInteractive 拦截穿透点击
  - [x] P3 密道入口双按钮坐标对齐 siteNode（bg 内容区 1/4、3/4）
  - [x] 冒烟新增失败-冷却-重进回归断言（5 条全过）
