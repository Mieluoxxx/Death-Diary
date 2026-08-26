# NPC 首次来访求助 E2E

## 目的

验证 NPC 首次来访不会停留在“仅认识”状态，而是在天亮时进入 NPC 索要物品的求助事件。

## 前置

- 启动开发服务：`bun run dev`
- 使用 `ego-browser nodejs <<'EOF' ... EOF` 执行下方脚本

## 执行脚本

```bash
ego-browser nodejs <<'EOF'
const task = await useOrCreateTaskSpace('death-diary e2e npc first visit')

const restoreScene = async () => {
  try {
    await js(String.raw`(async () => {
      const npc = await import('/src/game/systems/npcSystem.ts')
      npc.setNpcVisitChanceOverride(null)
      const bus = await import('/src/game/systems/gameBus.ts')
      if (window.__npcVisitListener) bus.gameBusOff('npc_visit', window.__npcVisitListener)
      const home = window.__deathDiaryGame?.scene.getScene('Home')
      const dialog = home?.children.list.find(child => child.name === 'npcVisitDialog')
      if (dialog) {
        dialog.destroy(true)
        const clock = await import('/src/game/systems/timeClock.ts')
        clock.resumeTimeClock()
      }
      if (home?.scene.isActive()) {
        home.scene.start('MainMenu')
        await new Promise(resolve => setTimeout(resolve, 500))
      }
    })()`)
    await js(String.raw`new Promise(resolve => {
      const request = indexedDB.deleteDatabase('death-diary')
      request.onsuccess = request.onerror = request.onblocked = () => resolve(true)
    })`)
  } finally {
    await completeTaskSpace(task.id, { keep: false })
  }
}

// 每次从空存档开始，避免已有 IndexedDB 存档改变起始页面。
await openOrReuseTab('http://localhost:8080/', { wait: true, timeout: 30 })
await js(String.raw`new Promise(resolve => {
  const request = indexedDB.deleteDatabase('death-diary')
  request.onsuccess = request.onerror = request.onblocked = () => resolve(true)
})`)
await gotoAndWait('http://localhost:8080/', { timeout: 30, settle: 1 })
await waitForNetworkIdle(2)

const point = async (x, y) => {
  const canvas = await js(String.raw`document.querySelector('canvas').getBoundingClientRect().toJSON()`)
  return [canvas.left + x * canvas.width / 640, canvas.top + y * canvas.height / 1136]
}
const sessionState = async () => await js(String.raw`(async () => {
  const store = await import('/src/game/session/sessionStore.ts')
  const session = store.getSession()
  return session && {
    day: session.day,
    hour: session.hour,
    minute: session.minute,
    bed: session.buildLevels[9],
    sleeping: session.isInSleep,
  }
})()`)
const waitFor = async (check, label, seconds = 60) => {
  for (let i = 0; i < seconds; i++) {
    const state = await sessionState()
    if (check(state)) return state
    await wait(1)
  }
  throw new Error(`等待${label}超时`)
}
const canvasTexts = async () => await js(String.raw`(() => {
  const result = []
  const walk = (node, depth = 0) => {
    if (!node || depth > 10) return
    if (node.type === 'Text') result.push(String(node.text))
    if (Array.isArray(node.list)) node.list.forEach(child => walk(child, depth + 1))
  }
  window.__deathDiaryGame?.scene.getScenes(true).forEach(scene => walk(scene.children))
  return result
})()`)
const waitForCanvasText = async (text, label, seconds = 20) => {
  for (let i = 0; i < seconds; i++) {
    if ((await canvasTexts()).some(value => value.includes(text))) return
    await wait(1)
  }
  throw new Error(`等待${label}超时`)
}
const waitForScene = async (key, seconds = 20) => {
  for (let i = 0; i < seconds * 4; i++) {
    const scenes = await js(String.raw`window.__deathDiaryGame?.scene.getScenes(true).map(scene => scene.scene.key) || []`)
    if (scenes.includes(key)) return
    await wait(0.25)
  }
  throw new Error(`等待场景 ${key} 超时`)
}

// 1. 新游戏 → 陌生人 → 确定 → 关闭开局引导。
try {
await waitForScene('MainMenu')
await click(await point(320, 690), { label: 'start a new game' })
await waitForScene('Choose')
await waitForCanvasText('确定', '角色确认按钮')
await click(await point(480, 1078), { label: 'confirm stranger' })
await waitForScene('Home')
await click(await point(320, 805), { label: 'dismiss opening guide' })

// 2. 打开电台，执行 /getall 100。
await click(await point(270, 480), { label: 'open radio' })
await wait(0.3)
await fillInput('.radio-command-input', '/getall 100')
await pressKey('Enter')
await wait(0.2)

// 3. 返回家中，建造睡袋。
await click(await point(60, 333), { label: 'return home' })
await wait(0.2)
await click(await point(80, 546), { label: 'open sleeping bag' })
await waitForCanvasText('建造', '睡袋建造按钮')
await click(await point(558, 410), { label: 'build sleeping bag' })
await waitFor(state => state?.bed >= 0, '睡袋建造完成')

// 临时将 NPC 来访概率固定为 100%，不干扰 Phaser 或其他系统的随机数。
await js(String.raw`(async () => {
  const npc = await import('/src/game/systems/npcSystem.ts')
  npc.setNpcVisitChanceOverride(1)
  const bus = await import('/src/game/systems/gameBus.ts')
  window.__npcVisits = []
  window.__npcVisitListener = visit => window.__npcVisits.push(visit)
  bus.gameBusOn('npc_visit', window.__npcVisitListener)
})()`)

// 睡袋建造完成后，从第 1 天约 10 点连续睡到第 2 天 6 点。
// 4h + 4h + 4h + 8h + 1h，最后一次跨过 06:00 天亮回调。
for (const action of [1, 1, 1, 2, 0]) {
  const actionY = action === 0 ? 580 : action === 1 ? 700 : 818
  await click(await point(550, actionY), { label: 'sleep until next checkpoint' })
  await waitFor(state => state?.sleeping === true, '进入睡眠', 5)
  for (let i = 0; i < 60; i++) {
    // 午夜会打开 DayLayer 并暂停时钟；点击遮罩后睡眠才能继续。
    const dayLayerOpen = await js(String.raw`Boolean(window.__deathDiaryGame?.scene.getScene('Home')?.children.list.some(child => child.name === 'dayLayer'))`)
    if (dayLayerOpen) {
      await wait(3)
      await click(await point(320, 568), { label: 'dismiss day transition' })
      await wait(0.5)
    }
    // NPC 求助弹窗是本测试的终点；它会按原版暂停睡眠计时。
    const npcDialogOpen = await js(String.raw`Boolean(window.__deathDiaryGame?.scene.getScene('Home')?.children.list.some(child => child.name === 'npcVisitDialog'))`)
    if (npcDialogOpen) break
    if (!(await sessionState())?.sleeping) break
    await wait(1)
  }
  const npcDialogOpen = await js(String.raw`Boolean(window.__deathDiaryGame?.scene.getScene('Home')?.children.list.some(child => child.name === 'npcVisitDialog'))`)
  if (!npcDialogOpen) await waitFor(state => !state?.sleeping, '睡眠结束')
}

// The dawn callback can run just after the sleep completion callback; wait for
// the domain event instead of asserting on the first post-sleep frame.
for (let i = 0; i < 30; i++) {
  if ((await js(String.raw`window.__npcVisits?.length || 0`)) > 0) break
  await wait(1)
}
const visits = await js(String.raw`window.__npcVisits || []`)
const texts = await canvasTexts()
await js(String.raw`(async () => {
  const npc = await import('/src/game/systems/npcSystem.ts')
  npc.setNpcVisitChanceOverride(null)
  const bus = await import('/src/game/systems/gameBus.ts')
  if (window.__npcVisitListener) bus.gameBusOff('npc_visit', window.__npcVisitListener)
})()`)

const visit = visits.find(value => value.kind === 'help')
const evidence = texts.find(text => text.includes('托人询问'))
const dialogOpen = await js(String.raw`Boolean(window.__deathDiaryGame?.scene.getScene('Home')?.children.list.some(child => child.name === 'npcVisitDialog'))`)
if (!visit || !evidence || !dialogOpen) throw new Error('NPC 首次来访求助弹窗未触发')
cliLog(JSON.stringify({ result: 'PASS', visit, evidence, dialogOpen }))
} finally {
  await restoreScene()
}
EOF
```

## 通过标准

- 脚本输出 `result: PASS`
- `evidence` 包含 `托人询问`，并带有 NPC 索要物品和数量
- `dialogOpen` 为 `true`，画面上存在 NPC 求助弹窗

## 失败证据

失败时先记录当前页面截图与最后一个游戏时间，再由 `finally` 自动恢复现场；不要在 E2E 脚本中修改游戏逻辑。
