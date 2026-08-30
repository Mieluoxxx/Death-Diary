# Implement — 对齐原版火炉设施页面

## 执行清单（按序）

1. **数据层：sessionStore.ts**
   - [ ] `SessionState` 增加 `bonfireRoundAnchorSec: number`（注释：本轮燃烧起点 gameTime 秒，0=未燃烧）。
   - [ ] `createNewSession` 初始值 `0`。

2. **存档契约：saveContract.ts + saveContract.test.ts**
   - [ ] 新字段可选校验（`isFiniteNumber`，缺省 0）。
   - [ ] 迁移：旧档 `bonfireFuel > 0` 且无锚点 → `bonfireRoundAnchorSec = gameTime`。
   - [ ] 测试：新档全零 / 旧档燃烧态迁移 / 非法值拒收，三条用例。

3. **燃烧模型：survivalLoop.ts**
   - [ ] `SECONDS_PER_FUEL = 240 * 60` 常量 + 派生纯函数
         `bonfireDerived(session)` → `{ burning, elapsed, fuelLeft, pct, burnedOut }`
         （导出，UI 与 tick 共用）。
   - [ ] `maybeBurnBonfireFuel` 重写为烧尽清零 + 日志（不再 hour%4 离散减）。
   - [ ] `addBonfireFuel`：满仓判定改派生 `fuelLeft >= 6` → `'火炉已经塞满了！'`；
         缺木材 → `'没有足够的木材'`；新轮锚点 `bonfireRoundAnchorSec = gameTime`；
         成功 msg 去自编文案。
   - [ ] `isBurnActive` 改用派生 `fuelLeft > 0`。
   - [ ] 单测：添柴新轮锚点 / 续添不重置锚点 / 240 分钟烧 1 根 / 烧尽清零 /
         满仓与缺材 msg（bun test，纯函数直测）。

4. **UI 层：facilityAction.ts bid 5 分支**
   - [ ] 重写 rows：`iconHint: 'build_action_5_0.png'`、hint 两态原版文案
         （1011/1012）、`hintColor: 'white'`、`percentage` 连续倒计、
         `actionLabel: '添加燃料'`、`actionDisabled: false`。

5. **核对项（读代码确认，不改即记录）**
   - [ ] buildPanel 设施行 `onFail(res.msg)` 展示通道对 bid 5 生效。
   - [ ] 温度联动：烧尽后 `isBurnActive` 翻转 → `updateTemperature` 收敛。

## 验证命令

```bash
bun run typecheck          # client + server
bun run lint               # biome
bun test src/game          # 含新增单测
bun run test:server
bun run build
```

## 审查门

- 提交前对照 PRD Acceptance Criteria 逐条勾选。
- diff 范围仅限 design.md「边界与影响面」列出的 4 个文件 + 测试。

## 回滚点

- 步骤 1-2（存档字段）与步骤 3-4（行为）可独立 revert；
  任一验证步骤失败先回滚最后一步。

## 执行结果（2026-08-30 收尾）

清单实际落点与原计划的偏差（均已记录于 design.md 同步修订）：

1. sessionStore 字段 ✓（`bonfireRoundAnchorSec` + 初始值 0）
2. 存档迁移落点改为 `normalizeSession`（saveContract 实为信封级校验，无 session
   字段校验；迁移覆盖本地读档/导入/云拉取三条路径，`setSession` 一并过规范化）。
   saveContract.ts 未改动——原计划的两条用例改由 normalizeSession 路径覆盖。
3. 燃烧模型 ✓（`BONFIRE_SECONDS_PER_FUEL`/`BONFIRE_FUEL_MAX` 常量 + `bonfireDerived`
   派生纯函数 + `maybeBurnBonfireFuel` 烧尽清零 + `addBonfireFuel` 派生判定；
   `isFireActive` 改派生 fuelLeft）。烧尽无日志（对齐原版 end 回调，修正原计划）。
4. facilityAction bid 5 重写 ✓
5. 核对项 ✓（设施行 onFail(res.msg) 通道生效；isFireActive → updateTemperature 收敛）

主人实测后的两轮补充修复：

- 添柴成功补 `appendSessionLog('你向火炉添加了燃料')`（原版 log.addMsg(1097)，主人
  反馈「原材料没写明」）与 `gameBusEmit('facility_changed', {bid: 5})`（原版
  _sendUpdageSignal → build_node_update，主人反馈「点击没有直接开始燃烧」）。
- ponytail 重构：buildPanel 抽 `addActionHintText`（原版 LabelTTF cc.size(268,0)
  固定宽换行 + 顶对齐）与 `addCostGrid`（原版 ItemRichText 268px/3 列网格、图标左
  数量右、红白标色、空清单"无"）两个共享 helper，替换设施行/制造行 4 处重复；
  制造行成本清单从单行横排改为原版网格（主人反馈材料清单过长需换行）。

Acceptance Criteria：10/10 达成（图标/按钮文案/满仓与缺材反馈/两态 hint 文案颜色/
连续倒计/240 分钟烧 1 根/烧尽回熄灭态/旧档迁移/质量门全绿）。
