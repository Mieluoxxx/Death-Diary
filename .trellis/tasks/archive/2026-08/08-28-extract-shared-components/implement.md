# 共享组件抽取实施计划

## Implementation

1. **审计先行**：对照原版 `ItemChangeNode.js` 逐节点核对 gateNode / npcStorageNode / workLootNode / siteStorageNode / storageNode 五个双栏页面，重点：长按行为、take-all 语义（逐个搬运 + 负重校验 + 满即停）、物品过滤黑名单、重量文案。结论写入 `research/audit.md`，每条差异标注"已对齐 / 待对齐 / 保留（理由）"。
2. **quantityDialog 对齐原版滑条细节**：`slider_content` 填充条随 value/max 比例伸缩（左对齐、max≤1 时隐藏）、打开播 `Sound.POPUP`、文案行拆为“重量 + 数量”两个标签对齐 DialogBig 排版（紧跟标题下 ≈bgTop+63，重量在前）、标题基线 ≈bgTop+45、dig 图 ≈bgTop+95、遮罩透明度 0.78。此步同时改善 gateNode / npcStorageNode 的观感。
3. **workLootNode 接滑条**：两个网格的 `onInspect` 换成 `openQuantityDialog`，确认回调沿用各自 `transferItems`（数量 1 → amount）+ toast + refresh。
4. **siteStorageNode 接滑条**：同上，来源/目标为 `site` 方向。
5. **抽取 take-all 共享按钮**：新增 `src/game/ui/takeAllButton.ts`（黑色按钮 + 文案 + 手型图标 + onClick），`workLootNode` / `siteStorageNode` 替换使用；引导高亮留在 workLootNode。
6. **回归核对**：确认 gateNode / npcStorageNode / storageNode 网格接线无变化；`nodes/docs/README.md` 若记录交互约定则补充滑条说明。

## Expected Files

- `src/game/ui/quantityDialog.ts`（滑条细节对齐原版）
- `src/game/ui/takeAllButton.ts`（新增）
- `src/game/ui/nodes/workLootNode.ts`
- `src/game/ui/nodes/siteStorageNode.ts`
- `src/game/ui/nodes/docs/README.md`（按需）
- `.trellis/tasks/08-28-extract-shared-components/research/audit.md`（新增）

## Review Gates

- 步骤 1 审计完成后：若发现 PRD 未列出的偏差，先回报并更新 PRD，再继续步骤 2。

## Validation Commands

```bash
bun run typecheck
bun run lint
bun run build-nolog
```

人工验证（Ego 浏览器）：搜刮点与地点仓库长按物品弹滑条、**填充条随拖动伸缩**、确认转移、背包满时 toast；gate 与 NPC 交易滑条观感一致；“全部拿取”在两页面均正常且图标不缺。

## Rollback

改动集中于 3 个 UI 文件 + 1 个新增文件，`git checkout -- <files>` 即可回滚，不涉及存档与数据迁移。
