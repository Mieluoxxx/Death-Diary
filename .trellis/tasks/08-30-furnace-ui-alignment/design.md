# Design — 对齐原版火炉设施页面

## 现状模型 vs 原版模型

| | 原版（BonfireBuildAction） | 移植版现状 |
|---|---|---|
| 燃料格数 | `fuel`（0..config.max=6） | `session.bonfireFuel` |
| 每根燃烧时长 | `makeTime 240 分钟`（连续 timer） | hourly tick + `hour%4===0` 离散 −1 |
| 连续性 | `pastTime` 连续累计（含离线恢复） | 仅整小时跳变 |
| 进度条 | `(fuel×240 − pastTime)/(fuel×240)` | `fuel/6×100` |
| 本轮起点 | `startTime`（存档恢复） | 无 |

原版关键语义（`buildAction.js` addFuel/addFuelTimer/process）：
- `fuel === 0` 时添柴 → 注册 timer，**本轮起点 = 当前时刻**；
  `fuel > 0` 时添柴 → 仅 `fuel++`，timer 不重置（totalTime = fuel×240 随之变长）。
- 进度条每帧 `totalTime = fuel × timePerFuel` 重算（添柴会让进度条**回跳**——
  这是原版的真实表现，需保留）。

## 数据模型（SessionState 增量）

新增 **1 个字段**：

```ts
/** 火炉本轮连续燃烧的起点（gameTime 总秒数）。0 = 未燃烧。 */
bonfireRoundAnchorSec: number;
```

`bonfireFuel` 语义微调（字段保留，存档兼容）：**本轮已添入的根数**
（原版 `fuel` 的 timer 语义），而非「当前剩余根数」。

派生量（统一放 `survivalLoop` 的纯函数，UI 与 tick 共用）：

```ts
const SECONDS_PER_FUEL = 240 * 60; // makeTime 240 分钟

// 本轮已流逝（全轮连续，添柴不重置）
elapsed = gameTime − bonfireRoundAnchorSec;
// 已完整烧掉的根数
burned = floor(elapsed / SECONDS_PER_FUEL);
// 剩余根数（原版 this.fuel 被 end 回调递减后的值）
fuelLeft = max(0, bonfireFuel − burned);
// 进度条（原版 process 公式，totalTime 用递减后的 fuelLeft）
pct = fuelLeft > 0 ? max(0, (fuelLeft × SECONDS_PER_FUEL − elapsed) / (fuelLeft × SECONDS_PER_FUEL)) × 100 : 0;
// 烧尽判定
burnedOut = fuelLeft <= 0;
```

注：原版每根烧完时 totalTime 按递减后的 fuel 重算而 pastTime 连续，进度条会
阶段性回跳甚至变负（视觉上贴 0）——派生公式的 `max(0, …)` 恰好忠实还原这一
表现（有测试固化）。

`gameTime` 为存档内 source of truth（总游戏秒），离线追帧/读档后
elapsed 自动正确，无需额外恢复逻辑（对应原版 save/restore 的
`startTime`/`pastTime`）。

## 燃烧推进（survivalLoop）

`maybeBurnBonfireFuel(session)` 重写（保持函数名与调用点
`runHourlySurvivalTick` 不变）：

1. `burnedOut` → `bonfireFuel = 0; bonfireRoundAnchorSec = 0;`
   （原版 end 回调仅 resetActiveBtnIndex + updateTemperature，无日志，
   实现保持一致；温度由既有 `isFireActive → updateTemperature` 链路收敛）。
2. 未烧尽 → 不动字段（剩余根数与进度均为派生量，离散 tick 不再
   直接减 `bonfireFuel`）。

> 注：hourly tick 粒度 1 游戏小时 < 240 分钟/根，烧尽判定误差 ≤1 小时，
> 与原版秒级推进的差异仅体现在烧尽时刻对齐，页面进度条为渲染时
> 实时派生、不受 tick 粒度影响。

## 添柴（addBonfireFuel 改造）

1. 未建造 → `ok:false '你没有火炉'`（维持现状，原版该分支走 needBuild hint RED，不涉及）。
2. `fuelLeft >= 6`（**派生剩余根数**，替代旧的 `bonfireFuel >= 6`）→
   `ok:false '火炉已经塞满了！'`（原版 1134）。
3. 木材不足 → `ok:false '没有足够的木材'`（原版 1146）。
4. 成功：`bonfireFuel += 1`；若添柴前 `burnedOut || bonfireFuel === 0`（新轮）
   → `bonfireRoundAnchorSec = gameTime`（对齐原版 addFuelTimer 仅在 fuel==0 注册）；
   返回 msg 去掉自编文案（`添加燃料` 行为反馈由 UI hint 呈现）。

## UI 层（facilityAction.ts bid 5 分支重写）

```ts
{
    bid, actionId: 0,
    iconHint: 'build_action_5_0.png',          // R1
    isActioning: burning,
    percentage: pct,                            // R3 连续倒计
    hint: burning
        ? `炉火很旺，炉膛里有${fuelLeft}个木材可取暖${fuelLeft * 4}个小时`
        : '炉火熄灭了，1个木材可供4小时取暖',
    hintColor: 'white',
    costRows: rows,                             // 保留（hint 优先分支下不渲染，与原版等价）
    actionLabel: '添加燃料',                     // R2
    actionDisabled: false,                      // R4
}
```

`buildPanel.ts` 设施行点击已走 `onFail(res.msg)`，无需改渲染层。

## 存档契约

实测 `saveContract.ts` 仅做信封级校验（version/envelope），session 字段级
校验在 `sessionStore.ts`：`isSessionState`（宽松，不含 bonfire 字段）+
`normalizeSession`（迁移落点，guide 字段有先例）。因此：

- `bonfireRoundAnchorSec` 无需加入 saveContract；缺失字段由
  `normalizeSession` 补默认（不影响宽松校验通过）。
- 迁移：旧档无字段 → `bonfireFuel > 0 ? gameTime : 0`（视为本轮刚开始烧，
  最大误差一轮周期，可接受并在测试中固化该行为）。
- 云存档路径：`setSession`（applyRemoteSession 入口）同样过
  `normalizeSession`，远端旧档到达即迁移。
- 测试：survivalLoop.bonfire.test.ts 固化派生与添柴行为；迁移规则由
  normalizeSession 的实现路径覆盖（读档/导入/云拉取共用）。

## 边界与影响面

- 触点：`sessionStore.ts`（字段+初始值）、`survivalLoop.ts`
  （addBonfireFuel / maybeBurnBonfireFuel / 派生函数）、
  `facilityAction.ts`（bid 5 rows）、`saveContract.ts(+test)`。
- 不触碰：buildPanel.ts 渲染层、timeClock、温度系统、其他设施分支。
- `isFireActive`（survivalLoop.ts:310）语义核对：改为基于派生
  `fuelLeft > 0`，与温度联动行为保持一致。

## 回滚

单任务单 commit 序列，revert 即回滚；字段为纯增量、旧档迁移有测试
固化，无数据破坏风险。
