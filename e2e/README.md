# E2E 测试卡

本目录的 `.md` 文件是给 AI Agent（如 pi + ego-browser）执行的端到端 UI/UX 测试提示词。

## 执行约定

- **工具**：`ego-browser nodejs <<'EOF' ... EOF`（见 `~/.agents/skills/ego-browser/SKILL.md`）
- **空间**：每个测试卡开头 `useOrCreateTaskSpace('death-diary e2e <卡名>')`，完成后 `completeTaskSpace(id, { keep: false })`
- **前置**：`bun run dev`（web:8080 + api:3001）已运行；测试可用 `window.__deathDiaryGame` 直接检查 Phaser 场景（main.ts 已挂载该 hook）
- **汇报**：每张卡执行后输出「结论: PASS/FAIL + 证据截图路径 + 与预期差异」
- **失败时**：不要自己改游戏代码，记录复现步骤和截图，报告给开发者
