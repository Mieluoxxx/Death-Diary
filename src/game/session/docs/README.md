# `src/game/session/` — 会话与存档

可序列化的运行时状态：玩家属性、背包/仓库、建筑等级、地图进度、日志等。

## 文件

| 文件 | 职责 |
|------|------|
| `browserSave.ts` | IndexedDB `death-diary/save-data` 中的 JSON 字符串读写 |
| `sessionStore.ts` | `SessionState`、启动加载、持久化与导入导出 |

## 核心 API

| API | 说明 |
|-----|------|
| `getSession()` | 当前会话；无存档则 `null` |
| `mutateSession(fn)` | 事务式修改并返回新状态（内部写回存储） |
| `createNewSession(role, talent)` | 新开局 |
| `initializeSessionStore()` | 启动时读取 IndexedDB 存档 |
| `exportSessionJson()` | 生成版本化存档 JSON 字符串；无存档则 `null` |
| `importSessionJson(json)` | 校验、覆盖并立即写入导入的 JSON 存档 |
| `flushSessionSave()` | 立即等待待写入的 IndexedDB 存档完成 |
| IndexedDB | 数据库 `death-diary`、对象仓库 `save-data`、键 `active-session` |
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
- 日志有上限（`MAX_LOG_ENTRIES`）；完整历史见顶栏日志面板。
- 会话修改采用 100ms 合并写入，避免同一帧内重复创建 IndexedDB 事务。
- 导入和导出统一使用 `{ format: "death-diary-save", version: 1, exportedAt, session }`。

## 相关

- 属性与死亡：[`../../systems/docs/README.md`](../../systems/docs/README.md)
- 地图字段：`mapSystem` + `data/siteConfig`
