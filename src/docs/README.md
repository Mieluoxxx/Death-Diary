# `src/` — 应用入口

Phaser 游戏的 TypeScript 源码根。入口极薄，真正玩法在 `game/`。

## 结构

| 路径 | 职责 |
|------|------|
| `main.ts` | `DOMContentLoaded` 后调用 `StartGame('game-container')` |
| `vite-env.d.ts` | Vite 客户端类型引用 |
| `game/` | 游戏主体：场景、系统、数据、UI、会话 |

## 启动链

```
index.html
  → src/main.ts
    → game/main.ts  (Phaser.Game + scene 列表)
      → Boot → Preloader → MainMenu → …
```

## 约定

- 设计分辨率 **640×1136**，`Scale.FIT`（见 `game/main.ts`）。
- 业务逻辑不要写在 `src/main.ts`；放在 `game/` 对应模块。
- 静态资源在 `public/`；源码只引用 atlas key / frame 名。

## 相关文档

- 仓库总览：[`../../README.md`](../../README.md)
- 美术流水线：[`../../ART.md`](../../ART.md)
- 游戏模块：[`../game/docs/README.md`](../game/docs/README.md)
