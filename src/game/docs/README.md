# `src/game/` — 游戏核心

Death-Diary 玩法与表现的主目录。对照原版 Buried-City 的 Cocos 结构做 Phaser 4 竖屏迁移。

## 子模块

| 目录 | 职责 |
|------|------|
| [`assets/`](../assets/docs/README.md) | 图集加载、frame 清单、懒加载 |
| [`data/`](../data/docs/README.md) | 静态配置表（物品、地点、配方…） |
| [`scenes/`](../scenes/docs/README.md) | Phaser Scene（菜单 / 家园 / 死亡…） |
| [`session/`](../session/docs/README.md) | 存档会话状态（`SessionState`） |
| [`settings/`](../settings/docs/README.md) | 语言、音效等设置 |
| [`medal/`](../medal/docs/README.md) | 跨局勋章进度 |
| [`systems/`](../systems/docs/README.md) | 规则与副作用（时钟、战斗、制作…） |
| [`ui/`](../ui/docs/README.md) | 导航、顶栏、弹窗、共用控件 |

根文件：

| 文件 | 职责 |
|------|------|
| `main.ts` | `Phaser.Game` 配置与场景注册，`export default StartGame` |

## 分层原则

```
scenes  → 组装生命周期、挂 UI、订 bus
ui      → 展示与输入；尽量不写规则
systems → 改 session、发 gameBus、推进时钟
data    → 只读配置
session → 可序列化状态 + mutateSession
```

- **规则在 systems**，不要在 UI 节点里直接改属性公式。
- **跨层通知走 `systems/gameBus`**，不要 scene 互调。
- **坐标**：原版 Cocos 多为 y-up（相对底框）；Phaser y-down。换算集中在 navigation / 各 node 注释里。

## 常用入口

| 玩家路径 | 代码入口 |
|----------|----------|
| 新游戏 | `MainMenu` → `ChooseScene` → `StoryScene` → `HomeScene` |
| 继续 | `MainMenu` 读 session → `HomeScene` |
| 家园设施 | `HomeScene` → `openBuildPanel` / `NavNode.*` |
| 外出 | `GATE` → `GATE_OUT` → `MAP` → `SITE` → 战斗/搜刮 |
| 死亡 | `player_died` → `DeathScene` |

## 相关

- UI 节点导航：[`../ui/docs/README.md`](../ui/docs/README.md)
- 系统总线与时钟：[`../systems/docs/README.md`](../systems/docs/README.md)
