# `src/game/medal/` — 勋章

跨局成就/勋章进度，独立 localStorage（不进单局 session）。

## 文件

| 文件 | 职责 |
|------|------|
| `medalStore.ts` | 勋章序列进度读写、完成度查询 |

## 要点

- UI 场景：`scenes/MedalScene.ts`（主菜单入口）。
- Web 切片：存储与展示已接；部分达成条件随玩法系统逐步挂接。
- 清档/迁移时与 session、settings 分开处理。

## 相关

- 场景：[`../../scenes/docs/README.md`](../../scenes/docs/README.md)
