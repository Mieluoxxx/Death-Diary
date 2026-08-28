# 共享组件的抽取（对齐原版 ItemChangeNode 行为）

## Goal

以原版 Buried-City 的 `ItemChangeNode` 为行为基准，审计所有"双栏转移"页面（背包 ↔ 仓库/箱子/存放点），把其中重复实现和偏离原版的交互统一收敛为共享组件，消除节点间的复制粘贴偏差。

## Background

原版 `ItemChangeNode`（`Buried-City/src/ui/ItemChangeNode.js`）是所有双栏转移页面的共同实现，`gateNode`、`siteStorageNode`、`workRoomStorageNode` 直接使用，`npcStorageNode`（ItemExchangeNode）继承它。它的交互契约：

- **单击**物品 → 转移 1 个
- **长按**物品 → `uiUtil.showItemSliderDialog` 横向数量滑条，选 1~持有量后转移 N 个
- `withTakeAll=true` 时 → "全部拿取"按钮（`exchangeAll` 逐个搬运 + 负重校验，搬满为止）

现版移植时该契约被逐节点手写，产生了偏差与重复：

| 节点 | 长按行为 | 对齐状态 |
|---|---|---|
| `gateNode.ts` | 数量滑条 | ✅ 已对齐（2026-08-28，含 `openQuantityDialog` 抽取为共享组件） |
| `npcStorageNode.ts` | 数量滑条 | ✅ 本就对齐，现已改用共享 `openQuantityDialog` |
| `workLootNode.ts` | 物品详情 ❌ | 应为滑条（原版 workRoomStorageNode 用 ItemChangeNode） |
| `siteStorageNode.ts` | 物品详情 ❌ | 应为滑条（原版 siteStorageNode 用 ItemChangeNode） |
| `storageNode.ts`（家仓库） | 物品详情 | ✅ 保留——原版家仓库点击即弹 `showItemDialog`，语义不同，不改 |

另发现“全部拿取”按钮在 `workLootNode.ts`（约 112-151 行）与 `siteStorageNode.ts`（约 100 行起）重复实现，仅引导逻辑（`GuideStep.ALL_GET`）为 workLootNode 特有。

对照原版逐项核对后，共享 `openQuantityDialog` 本体也有偏离原版 `showItemSliderDialog` 的细节：**`slider_content` 填充条未随所选数量按比例伸缩**（原版 `cc.ControlSlider` 的填充条宽度 = value/max × 轨道宽），且打开时缺少 POPUP 音效、数量/重量文案行位置与 DialogBig 排版不一致。这些细节一并纳入本任务。

## Requirements

1. 先审计后动手：对照原版逐节点核对上表 5 个节点，确认无其他偏差（如 `exchangeAll` 的负重校验语义、物品过滤黑名单），审计结论记录到 `research/audit.md`。
2. `quantityDialog` 对齐原版 `showItemSliderDialog` + `cc.ControlSlider`：填充条随 value 比例伸缩、打开播 `Sound.POPUP`、数量/重量文案行按 DialogBig 排版（重量在前、紧跟标题下方）、遮罩透明度 0.78；此改动同时惠及已接线的 gateNode / npcStorageNode。
3. `workLootNode`、`siteStorageNode` 的长按统一接入共享 `openQuantityDialog`：确认后按各自现有 `transferItems(from, to, itemId, amount, siteId)` 转移所选数量，负重不足 toast 提示，随后刷新。
4. 把重复的“全部拿取”按钮抽取为共享组件，两个节点替换使用；引导高亮（workLootNode 特有）由调用方自行附加，组件保持薄。
5. 与原版不一致且决定保留现版行为的条目，必须在审计清单中写明理由，不得静默偏离。
6. 不改动已对齐的 `gateNode`、`npcStorageNode`、`storageNode` 的网格接线（quantityDialog 本体修属例外，见第 2 条）。

## Acceptance Criteria

- [x] `quantityDialog`：滑条填充条随数量比例伸缩（对齐原版 `ControlSlider`），打开有 POPUP 音效，文案行排版对齐 DialogBig。
- [x] `workLootNode`、`siteStorageNode` 四个网格：单击移 1 个，长按弹数量滑条，确认后转移 N 个并刷新；负重不足有 toast。
- [x] "全部拿取"按钮为单一共享实现，两个页面的图标、布局、文案与现状一致。
- [x] `research/audit.md` 完成：每个双栏节点对原版 `ItemChangeNode` 的差异均有"已对齐 / 保留并说明理由"的结论。
- [x] 节点文件中不再残留重复的弹窗/按钮实现。
- [x] `bun run typecheck`、`bun run lint`、`bun run build-nolog` 通过。

## Out Of Scope

- 不重构 `mountItemGrid` 本身的单击/长按判定与滚动逻辑。
- 不新增原版不存在的"多选勾选批量转移"功能。
- 不触碰 backend、存档结构与导航框架。
