# `src/game/settings/` — 玩家设置

语言、音乐/音效等跨局偏好（与单局 `session` 分离）。

## 文件

| 文件 | 职责 |
|------|------|
| `settingsStore.ts` | 读写 localStorage、语言码、`t()` 文案表、IAP 多语言描述等 |

## 要点

- **语言**：`LangCode`（`zh` / `zh-Hant` / `ja` / `en`…）。
- **`t(key, lan)`**：短键文案（按钮「知道了」、设置项等）。
- **音乐/音效开关**：`getMusicOn` / `getSfxOn`（localStorage）。实际 BGM 播放在 `systems/audioManager.ts`；设置层通过 `setMusicEnabled` 同步停/播。
- 状态属性长描述在 `ui/statusCopy.ts`；IAP 文案在本 store。
- 设置层 UI：`ui/settingLayer.ts`。

## 约定

- 设置变更应能刷新已打开的菜单文案。
- 不要把单局玩法进度写进 settings。

## 相关

- 设置 UI：[`../../ui/docs/README.md`](../../ui/docs/README.md)
- 勋章（另一份跨局存储）：[`../../medal/docs/README.md`](../../medal/docs/README.md)
