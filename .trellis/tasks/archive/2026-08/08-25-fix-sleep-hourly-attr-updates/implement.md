# 修复睡眠期间状态按小时变化 - 实施计划

1. 建立当前行为的自动化复现，覆盖非整点开始的 1、4、8 小时睡眠，并记录小时回调、属性和事件序列。
2. 根据失败断言定位断点属于共享时间调度、睡眠结束顺序还是顶部刷新生命周期。
3. 在真实所有权层实现最小修复；保持属性公式只存在于 `survivalLoop.ts`。
4. 增加回归覆盖：大时间步重复回调 catch-up、非重复任务只完成一次、同边界优先级、昼夜/午夜边界，以及每小时 UI 刷新事件。
5. 运行 `bun run lint`、`bun run typecheck`、`bun test`、`bun run gen:frames:check` 和 `git diff --check`。
6. 在本地页面执行 4 小时睡眠，确认睡眠进度结束前顶部属性条已逐次变化，并检查控制台错误。
7. 对比原版属性按钮事件契约，复现高频相同目标刷新不断重启 tween 的展示层问题。
8. 为属性填充记录独立 `targetRatio`；相同目标刷新复用活动 tween，新目标才重定向。
9. 增加动画生命周期回归测试，并重新执行完整质量门禁和 4 小时睡眠视觉验证。

## Expected Files

- `src/game/systems/timeClock.ts`：仅当复现证明共享调度器漏触发或顺序错误时修改。
- `src/game/systems/survivalLoop.ts`：仅当小时规则接入存在缺口时修改，不复制公式。
- `src/game/systems/facilityAction.ts`：仅当睡眠结束状态的时序错误时修改。
- `src/game/ui/topFrame.ts` 或 `src/game/scenes/HomeScene.ts`：仅当属性已逐次变化但刷新被阻断时修改。
- 新增测试文件：承载计时器、睡眠和属性动画生命周期回归，不使用源码字符串断言。

## Rollback Point

实现与测试作为独立提交；若共享任务出现回归，可整体回退实现提交，任务文档和复现测试仍保留诊断价值。
