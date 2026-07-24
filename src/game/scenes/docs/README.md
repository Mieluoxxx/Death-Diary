# `src/game/scenes/` — Phaser 场景

每个文件一个 `Scene` 子类，在 `game/main.ts` 的 `scene` 数组中注册。

## 场景一览

| 场景 / 类 | 职责 |
|-----------|------|
| `Boot` | 启动、字体等极早初始化 |
| `Preloader` | 预载图集与加载条 |
| `MainMenu` | 主菜单：新游戏 / 继续 / 设置 / 商店 / 勋章 |
| `MedalScene` | 勋章墙 |
| `ShopScene` | IAP 商店（Web 免费解锁） |
| `ChooseScene` | 选角 / 天赋 |
| `StoryScene` | 开场叙述 |
| `Home` (`HomeScene`) | **主游戏场景**：家园、导航栈、生存循环 |
| `Death` (`DeathScene`) | 死亡结算 |
| `EndScene` | 结局相关 |
| `Game` / `GameOver` | 模板遗留或占位，以当前路由为准 |

## HomeScene 边界

家园是「壳」：

- 画家园地图与建筑按钮
- `createNavigationHost` 推导航节点
- `addTopFrame` 顶栏
- `startSurvivalLoop`；订 `night_raid`、`player_died`
- **不**实现仓库格子或战斗 UI（在 `ui/nodes`）

## 约定

- 全屏流程用 Scene；面板级 UI 用 navigation 栈 / `ui/`。
- `shutdown` 时退订 bus、停 survival loop。
- 场景切换：`this.scene.start('Key')`。

## 相关

- 游戏主配置：[`../../docs/README.md`](../../docs/README.md)
- 导航节点：[`../../ui/nodes/docs/README.md`](../../ui/nodes/docs/README.md)
