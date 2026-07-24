# `src/game/systems/` — 规则与副作用

玩法逻辑层：改 session、推时钟、发 `gameBus`。UI 只应调用这里的公开 API。

## 模块分组

### 时间与生存

| 文件 | 职责 |
|------|------|
| `timeClock.ts` | 游戏时间、`addTimerCallback`、加速工作时间 |
| `survivalLoop.ts` | 每小时/每日：属性衰减、天气、睡眠回复、夜袭触发 |
| `playerAttrs.ts` | `changeAttr`、Buff、hpMax、死亡入口 |
| `nightRaidSystem.ts` | 夜袭掷骰、失物、`night_raid` |
| `deathSystem.ts` | 复活 / 急救包 |

### 物品与建造

| 文件 | 职责 |
|------|------|
| `inventory.ts` | 负重、转移、装备 |
| `itemUse.ts` | 吃 / 用药 / Buff |
| `craftSystem.ts` | 配方制作 |
| `buildSystem.ts` | 建筑升级 |
| `facilityAction.ts` | 床 / 椅子 / 狗 / 火 / 雷区 / 电网 |
| `timedProgress.ts` | **统一计时进度** job + `progress` 事件 |
| `iapStore.ts` | IAP 解锁 |

### 地图与战斗

| 文件 | 职责 |
|------|------|
| `mapSystem.ts` | 地点解锁、房间、旅行、站点仓库 |
| `battleSystem.ts` | 战斗状态机、日志、闪避遭遇 |

### 基础设施

| 文件 | 职责 |
|------|------|
| `gameBus.ts` | 类型化 pub/sub |

## 进度事件

统一通道：

```ts
gameBusEmit('progress', {
  channel: { kind: 'facility' | 'craft' | 'build_upgrade', id, actionId? },
  percentage, // 0..100
});
gameBusEmit('progress_done', { channel });
```

优先 `startTimedProgress()`（睡眠、椅子已接；制作/升级可继续迁入）。

## 约定

1. 配置在 `data/`；可变状态在 `session`。
2. 改 session 后按需 `session_updated` 或更具体事件。
3. 长过程（睡觉、制作）必须有可查询 percentage，避免只改旗标。
4. 玩法时长用 `timeClock` 游戏时间，不用 `setTimeout`。

## 相关

- 数据：[`../../data/docs/README.md`](../../data/docs/README.md)
- 会话：[`../../session/docs/README.md`](../../session/docs/README.md)
- UI：[`../../ui/docs/README.md`](../../ui/docs/README.md)
