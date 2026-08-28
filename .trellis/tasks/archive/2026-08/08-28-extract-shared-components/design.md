# 共享组件抽取设计

## 行为基准

原版 `ItemChangeNode.js`（背 包↔仓库通用双栏组件）：

- `onItemClick(storageCell, id, isLongPressed)`：长按 → `showItemSliderDialog`，单击 → `exchange(id, itemId, 1)`
- `showItemSliderDialog`（`uiUtil.js:436`）：DialogBig 面板 + `cc.ControlSlider(slider_bg/slider_content/slider_cap)`，min=1、max=持有量，拖动实时更新"重量/数量"，确定回调转移
- `exchangeAll(id)`：对来源栏逐物品逐个 `decreaseItem/increaseItem`，每件先 `validateItemWeight`，背包满即停
- `withTakeAll` → 分区条右侧黑色按钮 + `btn_icon_take_all.png` 手型图标

## 组件归属

```text
src/game/ui/
  quantityDialog.ts   ✅ 已存在（openQuantityDialog，本任务前置工作抽取）
  takeAllButton.ts    新增：mountTakeAllButton(scene, parent, opts) 或薄封装 addAtlasButton
src/game/ui/nodes/
  workLootNode.ts     onInspect → openQuantityDialog（两个网格）
  siteStorageNode.ts  onInspect → openQuantityDialog（两个网格）+ 使用共享按钮
  gateNode.ts / npcStorageNode.ts / storageNode.ts   不动
```

## quantityDialog 与原版逐项对照（本次审计结论）

原版 `showItemSliderDialog`（`uiUtil.js:436`）+ `DialogBig`（`dialog.js:346`）+ `cc.ControlSlider`：

| 项 | 原版 | 现版 | 结论 |
|---|---|---|---|
| 面板 | dialog_big_bg 448×625，底部偏移 29+(839-625)/2=136 | 同 | ✅ |
| 滑条位置 | content 底部 +40（= bgBottom-112） | bgBottom-112 | ✅ |
| 确定按钮 | actionNode 高 72 中心（bgBottom-36） | bgBottom-36 | ✅ |
| **填充条** | `slider_content` 宽度随 value/max 比例伸缩 | 整条平铺不伸缩 | ❌ 修：按比例 `setDisplaySize` 并左对齐 |
| **音效** | `Dialog.show()` 播 POPUP | 无 | ❌ 修：`playEffect(Sound.POPUP)` |
| 文案行 | txt_1 重量 + txt_2 数量，两个标签紧跟标题下（≈bgTop+63，标题底 +2），重量在前 | 合并单行 bgTop+58，数量在前 | △ 对齐 DialogBig 排版 |
| 标题基线 | titleNode 中心 ≈bgTop+45 | bgTop+18（顶部锚定） | △ 对齐 |
| dig 图 | contentNode 顶部内缩 5px（≈bgTop+95） | bgTop+105 | △ 对齐 |
| 遮罩 | 黑色 200/255≈0.78，点外部 dismiss（autoDismiss） | 0.72，点外部 destroy | △ 透明度对齐，交互一致 |
| 数值范围 | min=1，max=持有量，确定回调 value | 同 | ✅ |
| 拖动/点按 | ControlSlider 拖动+轨道内点按均改值 | cap 拖动 + trackHit 点按 | ✅ 等价 |

文案字串沿用现版中文约定（原版 1028/1029/1030 在现版无字串表映射）。

## 关键设计点

### 数量滑条接线（workLootNode / siteStorageNode）

与 gateNode 相同模式，复用各节点现有 onTap 的转移函数，仅把数量 1 换成 amount：

```ts
onInspect: (itemId) => {
    equip.closeDropDown();
    openQuantityDialog(ctx.scene, itemId, getSource()?.[itemId] ?? 1, (amount) => {
        const res = transferItems('bag', 'temp'|'site', itemId, amount, siteId);
        if (!res.ok) ctx.showToast(transferFailMessage(res));
        refresh();
    });
},
```

- max 取打开弹窗时刻来源栏的持有量（弹窗内不追踪后续变化，与原版一致）
- 反向格子（箱子→背包）max 取箱子计数；`transferItems` 自带负重/数量校验，失败 toast，无需弹窗内预检
- 填充条实现：`slider_content` 始终左端对齐轨道左端，宽度 = valueRatio × trackW（max≤1 时隐藏填充），与原版 ControlSlider 一致

### take-all 共享按钮

现两处实现差异仅在：坐标、sectionCy、onClick（各自的 exchangeAll 等价逻辑）、workLootNode 的引导高亮。抽取方案：

- 共享件只管"黑色按钮 + 全部拿取文案 + 手型图标 + 点击回调"，定位参数由调用方传
- 引导高亮（`addGuideWarn`）留在 workLootNode 调用方处理，组件不感知引导系统
- `exchangeAll` 领域逻辑维持各节点现状（两端 data 结构不同：temp/site 与 bag），若审计发现两处搬运语义一致，可后续再收 `systems/inventory`，本任务不强制

### 兼容性

纯 UI 行为对齐，不动 session 结构、存档、导航栈。`quantityDialog` 已在 gateNode/npcStorageNode 使用，本次只是增加两个使用方。

## 明确不做

- 不改 `mountItemGrid` 的 450ms 长按阈值与滚动点击判定
- 不做多选勾选批量转移（原版无）
- 不把 `storageNode`（家仓库）改成滑条——原版语义就是物品对话框
