# 对齐原版火炉设施页面

## Goal

建造完成的火炉（bid 5）设施页面与原版 Buried-City 完全对齐：图标、文案、颜色、
进度条语义、按钮交互反馈均以原版 `BonfireBuildAction`（`buildAction.js:770-901`）、
原版文案串（`string_zh.js` 1010/1011/1012/1134/1146）与 `buildActionConfig["5"]`
为准。数值层已一致，不改动。

## Requirements

### R1 动作行图标

- 使用动作图标 `build_action_5_0.png`（原版 `#build_action_5_0.png`），
  替换误用的建筑图标 `build_5_0.png`。图集已含该帧，无需生成资源。

### R2 动作行文案（对齐原版串号）

- 按钮（action1）：恒为「添加燃料」（原版串 1010），不再区分「添柴/燃料已满」。
- hint 熄灭态（原版 1011）：「炉火熄灭了，1个木材可供4小时取暖」
- hint 燃烧态（原版 1012）：「炉火很旺，炉膛里有{fuel}个木材可取暖{hours}个小时」，
  其中 `hours = floor(fuel × 240 / 60)`（即 fuel×4）。
- hint 颜色：两个状态均为 WHITE（原版 RED 仅用于缺建筑，火炉行不涉及）。

### R3 进度条语义（原版连续倒计）

- 原版公式：`percentage = (totalTime − pastTime) / totalTime × 100`，
  `totalTime = fuel × 240 分钟`，`pastTime` 为本轮连续燃烧已流逝时间。
- 替换现有的阶梯式 `fuel/6×100`。
- 燃料消耗从「每小时 tick 且 hour%4===0 时 −1」的离散模型改为基于
  本轮燃烧锚点的连续计时模型（见 design.md），每满 240 分钟烧掉 1 根。

### R4 交互反馈（原版弹提示而非禁用）

- 按钮**始终可点击**（`actionDisabled: false`）。
- 满燃料点击：`ok:false, msg:'火炉已经塞满了！'`（原版 1134）。
- 木材不足点击：`ok:false, msg:'没有足够的木材'`（原版 1146）。
- msg 走移植版既有 `onFail(res.msg)` 展示通道（与 craft 行一致），
  不新造弹窗组件。

### R5 存档兼容

- session 新增燃烧锚点字段不得破坏旧存档读取（saveContract 契约校验与
  迁移必须更新并通过测试）。
- 云存档 payload 同步兼容。

## Out of Scope

- 数值调整（cost 1101011×1 / makeTime 240 / max 6 已与原版一致）。
- 动作行成本行显示（两边行为已等价：原版 items=undefined 不显示，
  移植版 hint 优先分支同样不显示）。
- 温度系统联动逻辑（原版烧尽 `updateTemperature`；移植版
  `isBurnActive`/`updateTemperature` 链路已存在，仅核对不需重写）。
- 其他设施的页面对齐。

## Acceptance Criteria

- [ ] 火炉动作行图标为 `build_action_5_0.png`。
- [ ] 按钮文案恒为「添加燃料」，无禁用态。
- [ ] 满燃料（6 根）点击 → 显示「火炉已经塞满了！」。
- [ ] 木材不足点击 → 显示「没有足够的木材」。
- [ ] 熄灭 hint：「炉火熄灭了，1个木材可供4小时取暖」，白色。
- [ ] 燃烧 hint：「炉火很旺，炉膛里有X个木材可取暖Y个小时」，白色，
      X=当前燃料根数，Y=X×4。
- [ ] 进度条为剩余燃烧时间连续倒计（燃烧中随时间流动，非阶梯跳变）。
- [ ] 每满 240 游戏分钟自动消耗 1 根燃料，烧尽后 hint 回到熄灭态。
- [ ] 旧存档（无锚点字段）读档不报错，燃烧态按迁移规则恢复。
- [ ] `bun run typecheck`、`bun run lint`、`bun test src/game`、
      `bun run test:server`、`bun run build` 全绿。
