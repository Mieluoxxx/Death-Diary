# e2e-font-consistency.md

## 任务

验证游戏内所有 UI 文本都以「方正大黑 FZDaHei-B02S」渲染，不存在细体系统字体混入（用户反馈：部分界面字体样式不一致）。

## 背景（根因）

Phaser Text 在**创建时**把字形烘焙进 canvas 纹理。若 `fzdh.ttf`（2.2MB）尚未加载完（弱网/冷缓存），早期创建的 Text 会用 fallback 字体渲染并**永久固化**，即使字体稍后加载完成也不重绘——表现为同画面一部分粗体、一部分细体。

修复：`src/game/ui/uiFont.ts` 的 `scheduleTextRedrawOnFontReady(game)` 在 `document.fonts.ready` 后重绘所有场景 Text；`src/main.ts` 启动时已调用。

测试目标是确认：**① 字体确实加载；② 运行中的 Text 都是 FZDaHei；③ 修复后的重绘机制不破坏正常流程。**

## 测试步骤

### 1. 字体加载状态检查

```bash
ego-browser nodejs <<'EOF'
const task = await useOrCreateTaskSpace('death-diary e2e font')
await openOrReuseTab('http://localhost:8080/', { wait: true, timeout: 30 })
await waitForNetworkIdle(3)
const state = await js(String.raw`({
  fontsStatus: document.fonts.status,
  fzLoaded: document.fonts.check('20px "FZDaHei-B02S"'),
  faces: [...document.fonts].filter(f => f.family.includes('FZDaHei')).map(f => ({ family: f.family, status: f.status })),
})`)
console.log(JSON.stringify(state, null, 2))
EOF
```

### 2. 运行中 Text 的字体声明检查

用 `window.__deathDiaryGame`（main.ts 挂载的 hook）遍历 `MainMenu` 场景所有 Text，确认 `style.fontFamily` 以 `"FZDaHei-B02S"` 开头：

```bash
ego-browser nodejs <<'EOF'
const task = await useOrCreateTaskSpace('death-diary e2e font')
const info = await js(String.raw`(() => {
  const g = window.__deathDiaryGame;
  const out = [];
  const walk = (obj, depth) => {
    if (!obj || depth > 8) return;
    if (Array.isArray(obj.list)) {
      for (const c of obj.list) {
        if (c.type === 'Text') {
          out.push({ text: String(c.text).slice(0, 20), font: c.style.fontFamily.slice(0, 40) });
        }
        if (c.type === 'Container') walk(c, depth + 1);
      }
    }
  };
  for (const s of g.scene.getScenes(true)) walk(s.children, 0);
  return out;
})()`)
console.log(JSON.stringify(info, null, 2))
EOF
```

### 3. 视觉抽查（关键界面截图）

走完「新的开始 → 确定 → 跳过引导」直到主界面，截图；再进「大门 → 出去」到 GateOutNode（设备视口 1512x828 时坐标系：大门 `[830, 655]`，出去箭头 `[930, 225]`；其他视口先 `pageInfo()` 目测校准）。GateOutNode 存活约 3 秒，截图趁早。

对比两处文字粗细：
- 顶部日志区（topFrame）：应为粗黑体
- 底部提示行（GateOutNode）：**必须同为粗黑体**——此处在修复前是细体重灾区

### 4. 字体字形覆盖率抽检（排除字体文件缺字）

对 `你走出了避难所。门外一片死寂` 逐字用 `20px "FZDaHei-B02S"` 绘制并统计 alpha 墨量：每个汉字 ink 应 ≥ 60（sans-serif 对照普遍低 15~25%），`。` 全角句号 ink=0 属正常（标点命中 fallback 但视觉无差）。

## 预期结果

1. `fontsStatus: "loaded"`，`fzLoaded: true`，faces 含 `FZDaHei-B02S / loaded`
2. 所有 Text 的 `fontFamily` 都以 `"FZDaHei-B02S"` 开头
3. 顶部日志区与 GateOutNode 提示行**均为粗黑体**，画面无细体混入
4. 字形墨量抽检通过

## 失败判定

- 任一 Text 字体名不符 → FAIL
- GateOutNode 提示行呈细体（与顶部日志粗细明显不同）→ FAIL（证明重绘修复失效）
- `document.fonts.check` 为 false → FAIL（字体未加载，全游戏都会回退）

## 已知边界

- 字体加载失败（网络完全断）时游戏仍会运行（ensureUiFontLoaded 超时兜底），此时全界面为 fallback 字体——这是**可接受的降级**，不算本卡 FAIL，但请在报告中注明
- 数字/拉丁字符（如 "10:56"、"17"）FZDaHei 无对应字形时回退系统字体，属正常，不计 FAIL
