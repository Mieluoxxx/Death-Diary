# `src/game/ui/` — 界面与共用控件

家园内面板、顶栏、弹窗、字体与可复用组件。导航栈节点见 [`nodes/docs`](../nodes/docs/README.md)。

## 文件分组

### 壳与导航

| 文件 | 职责 |
|------|------|
| `navigation.ts` | 底框导航 host、`NavNode`、栈 forward/back/replace |
| `topFrame.ts` | 顶栏：时间/属性条/4 行日志/日志全屏面板 |
| `settingLayer.ts` | 游戏内/菜单设置层 |
| `buildPanel.ts` | 建筑升级 + 操作列表（制作/睡觉等） |

### 弹窗

| 文件 | 职责 |
|------|------|
| `dialogSmall.ts` | 状态小对话框 + 属性快捷物品横条 |
| `itemDialog.ts` | 物品详情：使用 / 知道了 |
| `payDialog.ts` | 支付/解锁确认 |
| `dayLayer.ts` | 跨日/夜袭结果全屏层 |

### 共用组件（优先复用）

| 文件 | 职责 |
|------|------|
| `scrollViewport.ts` | **统一滚动视口**（FilterMask + 拖/轮 + 视口外关 hit） |
| `equipStrip.ts` | 装备栏 + 下拉换装 |
| `sectionBar.ts` | `frame_section_bg` 分区条 |
| `siteChrome.ts` | 地点标题旁「进度 / 存放物品」 |
| `atlasButton.ts` | 图集按钮 |
| `uiFont.ts` | 字体族、字号、CJK wordWrap、resolution |
| `statusCopy.ts` | 属性状态文案 |

## 约定

1. **新列表滚动**用 `mountScrollViewport`，不要再手写一套 mask。
2. **进度条数据**订 `gameBus` 的 `progress`（见 systems 文档），不要为每个系统加 `*_progress`。
3. UI 不直接写生存公式；调用 `systems/*`。
4. Cocos y-up → Phaser y-down 换算写在注释或 `toScreenY` 里。

## 相关

- 节点页面：[`../nodes/docs/README.md`](../nodes/docs/README.md)
- 规则层：[`../../systems/docs/README.md`](../../systems/docs/README.md)
