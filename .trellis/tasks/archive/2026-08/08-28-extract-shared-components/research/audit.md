# 双栏转移节点对原版 ItemChangeNode 审计

基准：`Buried-City/src/ui/ItemChangeNode.js`。调用点：`gateNode.js:27`、`siteStorageNode.js:22`（withTakeAll）、`workRoomStorageNode.js:30`（withTakeAll, smallSize）；`npcStorageNode.js` 的 `ItemExchangeNode` 继承它（draft clone + 交易按钮）。

## 逐节点结论

| 节点 | 原版实现 | 原版长按行为 | 现版 | 结论 |
|---|---|---|---|---|
| gateNode | ItemChangeNode(bag, storage) | 滑条 | openQuantityDialog | ✅ 已对齐 |
| npcStorageNode | ItemExchangeNode（继承，draft 交易） | 滑条（max 取 draft） | openQuantityDialog（max 取 draft） | ✅ 已对齐 |
| workLootNode | ItemChangeNode(withTakeAll, smallSize) | 滑条 | 物品详情 | ❌ 待对齐 → 本任务改接 openQuantityDialog |
| siteStorageNode | ItemChangeNode(withTakeAll) | 滑条 | 物品详情 | ❌ 待对齐 → 本任务改接 openQuantityDialog |
| storageNode（家仓库） | 自有实现：单击 → showItemDialog | 无滑条（详情弹窗） | 物品详情 | ✅ 保留——原版语义就是详情弹窗，非滑条 |

## 逐契约项核对

| 契约 | 原版 | 现版 | 结论 |
|---|---|---|---|
| 单击转 1 个 | `exchange(id,itemId,1)` | `onTap → transferItems(...,1)` | ✅ 已对齐 |
| 长按数量滑条 | `showItemSliderDialog` + ControlSlider | `openQuantityDialog` | gate/npc ✅；workLoot/site ❌ 待对齐（本任务） |
| 滑条填充条 | ControlSlider 按 value/max 比例伸缩 | 整条平铺不伸缩 | ❌ 修（步骤 2） |
| 滑条打开音效 | `Dialog.show()` 播 POPUP | 无 | ❌ 修（步骤 2） |
| 滑条文案排版 | txt_1 重量 + txt_2 数量，紧跟标题下（DialogCommon） | 合并单行 COMMON_2 | ❌ 修（步骤 2） |
| 数值范围/回调 | min=1、max=持有量、确定回调 value | 同 | ✅ |
| 拖动/点按改值 | ControlSlider 拖动 + 轨道点按 | cap 拖动 + trackHit 点按 | ✅ 等价 |
| take-all 搬运语义 | 逐物品逐个 decrease/increase，每件 validateItemWeight，满即停 | `transferAll` 整摞优先 + 逐个回退（blocked 计数） | ✅ 已对齐 |
| take-all 按钮外观 | createCommonBtnBlack(1124) + 手型图标 + labelAnchor(0.3,0.5) | 两节点重复内联实现 | ❌ 抽取共享组件（步骤 5） |
| take-all LOOT 音效 | 按钮回调**无条件**播放 | `moved > 0` 才播 | △ 保留：空手拿取不播音效，语义更合理且不可闻差异仅在空场景 |
| 负重校验反馈 | validateItemWeight 失败 → showTinyInfoDialog(1131) | transferItems `overweight` → toast | ✅ 等价 |
| 来源数量校验 | validateItem 失败静默返回 | `not_enough` → toast | ✅ 等价 |
| 物品过滤黑名单 | `blackList.storageMove` 过滤 bottom（仅当 bottom 是 Bag） | 无此过滤 | ✅ 已对齐——原版 `storageMove: []` 为空表，且所有调用点 bag 恒在 top，过滤分支是死代码，无行为差异 |
| 背包重量文案 | COMMON_2+4 右对齐 section 右侧，满变红 | 同布局、满变红 | ✅（字号偏差见下） |
| take-all 搬运方向 | 仅 bottom → top（箱子→背包） | `transferAll('temp'/'site' → 'bag')` | ✅ 等价 |
| EXCHANGE 进入音效 | ctor 播 EXCHANGE | mount 时播 EXCHANGE | ✅ 已对齐 |

## 新发现偏差（PRD / design.md 未列出）

1. **workLootNode 背包重量字号**：现版用 COMMON_2，原版 ItemChangeNode 统一 COMMON_2+4（现版 siteStorageNode 已是 +4）。纯视觉细节、非交互契约，超本任务范围 → 仅记录，回报主线决策，本任务不修。
2. **des 描述文字与 dig 图间距**（quantityDialog 前置工作既成选择，视觉细节、非交互契约）：原版 DialogBig 的 des 顶部与 digDes 底部重叠 5px（des 顶 ≈ bgTop+90+h，h 为 dig 显示高），现版取 dig 底 +12（≈ bgTop+107+h）；无 dig 图时原版 des 顶 = bgTop+110，现版 = bgTop+95。保留现版：原版重叠 5px 属贴图余量容差，+12 保证可读性，无 dig 分支差异为 15px 内视觉偏差。→ 保留并记录。
3. **design.md 两处近似坐标与原版几何推导不符**（实现按原版语义执行，不按笔误数字）：
   - 文案行"≈bgTop+34"：DialogCommon 中 txt 顶部 = 标题底 + 2。标题中心 bgTop+45、COMMON_1=32px → 文案顶部实际 ≈ bgTop+63（bgTop+34 会跑到标题上方，不成立）。实现取 `bgTop + 45 + title.height/2 + 2`（动态、严格"紧跟标题下"）。
   - dig 图"≈bgTop+85"：contentNode 高 = 625−90−72 = 463、顶距 bgTop 90，dig 顶 = content 顶 −5 → **bgTop+95**。实现取 bgTop+95。

## 文案字串

原版 1028（重量）/1029（数量）/1030（确定）在现版无字串表映射，沿用现版中文约定：`重量 W`、`数量 v/N`、`确定`（PRD 已授权）。
