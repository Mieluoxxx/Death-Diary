# `src/game/session/` — 会话与存档

可序列化的运行时状态：玩家属性、背包/仓库、建筑等级、地图进度、日志等。

## 文件

| 文件 | 职责 |
|------|------|
| `sessionStore.ts` | `SessionState` 类型、`createNewSession`、读写 localStorage、`mutateSession`、`appendSessionLog` |

## 核心 API

| API | 说明 |
|-----|------|
| `getSession()` | 当前会话；无存档则 `null` |
| `mutateSession(fn)` | 事务式修改并返回新状态（内部写回存储） |
| `createNewSession(role, talent)` | 新开局 |
| 存盘 key | `buried_city_session_v3` |
| `appendSessionLog(text, timeLabel?)` | 写日志（顶栏 + 历史） |
| `attrRatio` / `formatClock` | UI 展示用 |

## 状态边界

**放进 session：**

- 会进存档的进度与资源（attrs、bag、storage、buildLevels、map、logs…）
- 跨系统可见旗标（`isInSleep`、`isAtHome`、`buff`…）

**不要放进 session：**

- 纯 UI 临时状态（下拉是否打开、滚动偏移）→ UI handle
- 计时 job 句柄 → `systems/timedProgress`、`timeClock` 内存 Map
- 图集是否已加载 → `assets/loadAtlas`

## 约定

- systems 改状态优先 `mutateSession`，再按需 `gameBusEmit`。
- 读档走 `normalizeSession`，给新字段默认值。
- 日志有上限（`MAX_LOG_ENTRIES`）；完整历史见顶栏日志面板。

## 相关

- 属性与死亡：[`../../systems/docs/README.md`](../../systems/docs/README.md)
- 地图字段：`mapSystem` + `data/siteConfig`
