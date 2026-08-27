# NPC 主动拜访与原版交易 E2E

## 目的

验证玩家携带物资主动拜访老罗时，地图弹窗、NPC 会面页和独立交易页均符合 `../buried-city` 1.4.0，并完成一笔原版判定为公平的 `酒 x1` 换 `子弹 x3` 交易。

## 前置

- 启动全新的开发服务：`bun run dev`
- 使用 Ego Browser 执行下方脚本
- 如使用其他 Vite 端口，执行前修改脚本中的 `baseUrl`

## 执行脚本

```bash
ego-browser nodejs <<'EOF'
const task = await useOrCreateTaskSpace('death-diary e2e npc trade')
const baseUrl = 'http://localhost:8080/'
await openOrReuseTab(baseUrl, { wait: true, timeout: 30 })
await js(String.raw`new Promise(resolve => {
  const request = indexedDB.deleteDatabase('death-diary')
  request.onsuccess = request.onerror = request.onblocked = () => resolve(true)
})`)
await gotoAndWait(baseUrl, { timeout: 30, settle: 1 })
await waitForNetworkIdle(2)

const point = async (x, y) => {
  const canvas = await js(String.raw`document.querySelector('canvas').getBoundingClientRect().toJSON()`)
  return [canvas.left + x * canvas.width / 640, canvas.top + y * canvas.height / 1136]
}
const activeScenes = async () => await js(String.raw`window.__deathDiaryGame?.scene.getScenes(true).map(scene => scene.scene.key) || []`)
const navName = async () => await js(String.raw`(async () => {
  const { getSession } = await import('/src/game/session/sessionStore.ts')
  return getSession()?.navigation.at(-1)?.nodeName ?? null
})()`)
const waitForScene = async (key, seconds = 20) => {
  for (let i = 0; i < seconds * 4; i++) {
    if ((await activeScenes()).includes(key)) return
    await wait(0.25)
  }
  throw new Error(`等待场景 ${key} 超时`)
}
const waitForNav = async (name, seconds = 20) => {
  for (let i = 0; i < seconds * 4; i++) {
    if ((await activeScenes()).includes('Home') && await navName() === name) return
    await wait(0.25)
  }
  throw new Error(`等待导航节点 ${name} 超时，当前为 ${await navName()}`)
}
const canvasTexts = async () => await js(String.raw`(() => {
  const result = []
  const walk = (node, depth = 0) => {
    if (!node || depth > 14) return
    if (node.type === 'Text' && node.visible !== false) result.push(String(node.text))
    if (Array.isArray(node.list)) node.list.forEach(child => walk(child, depth + 1))
  }
  window.__deathDiaryGame?.scene.getScenes(true).forEach(scene => walk(scene.children))
  return result
})()`)
const waitForText = async (text, seconds = 20) => {
  for (let i = 0; i < seconds * 4; i++) {
    if ((await canvasTexts()).some(value => value.includes(text))) return
    await wait(0.25)
  }
  throw new Error(`等待文本“${text}”超时`)
}
const objects = async () => await js(String.raw`(() => {
  const result = []
  const walk = (node, depth = 0) => {
    if (!node || depth > 14) return
    result.push({
      name: node.name || '',
      type: node.type,
      frame: node.frame?.name ?? null,
      visible: node.visible !== false,
      hitInput: node.hitTarget?.input?.enabled ?? null,
      x: node.x ?? null,
      y: node.y ?? null,
      width: node.displayWidth ?? node.width ?? 0,
      height: node.displayHeight ?? node.height ?? 0,
    })
    if (Array.isArray(node.list)) node.list.forEach(child => walk(child, depth + 1))
  }
  window.__deathDiaryGame?.scene.getScenes(true).forEach(scene => walk(scene.children))
  return result
})()`)
const requireNames = (rows, names, label) => {
  const missing = names.filter(name => !rows.some(row => row.name === name && row.visible))
  if (missing.length) throw new Error(`${label} 缺少对象：${missing.join(', ')}`)
}
const waitForObjectGone = async (name, seconds = 10) => {
  for (let i = 0; i < seconds * 4; i++) {
    if (!(await objects()).some(row => row.name === name)) return
    await wait(0.25)
  }
  throw new Error(`等待对象 ${name} 关闭超时`)
}
const tradeState = async () => await js(String.raw`(async () => {
  const { getSession } = await import('/src/game/session/sessionStore.ts')
  const session = getSession()
  if (!session) return null
  return {
    bag: { wine: session.bag[1105022] ?? 0, bullets: session.bag[1305011] ?? 0 },
    npc: {
      wine: session.npcs[1].storage[1105022] ?? 0,
      bullets: session.npcs[1].storage[1305011] ?? 0,
      tradingCount: session.npcs[1].tradingCount,
    },
    lastLog: session.lastLog,
    logCount: session.logs.length,
  }
})()`)

try {
  // 1. 正常创建陌生人新游戏。
  await waitForScene('MainMenu')
  await click(await point(320, 690), { label: 'start new game' })
  await waitForScene('Choose')
  await waitForText('确定')
  await click(await point(480, 1078), { label: 'confirm stranger' })
  await waitForScene('Home')
  await waitForText('跳过引导')
  await click(await point(509, 328), { label: 'skip opening guide' })
  await waitForObjectGone('guideDialog')

  // 2. 只准备无关前置：背包酒 x1、老罗解锁并持有子弹 x8。
  const fixture = await js(String.raw`(async () => {
    const store = await import('/src/game/session/sessionStore.ts')
    const bus = await import('/src/game/systems/gameBus.ts')
    store.mutateSession(session => {
      session.guide = { version: 1, status: 'completed', step: 28 }
      session.navigation = [{ nodeName: 'HomeNode' }]
      session.bag = { 1105022: 1 }
      Object.assign(session.npcs[1], {
        unlocked: true,
        reputation: 0,
        maxReputation: 0,
        storage: { 1305011: 8 },
        tradingCount: 0,
        pendingRewards: [],
      })
      // 真实移动 50 单位，低于随机遭遇检查阈值。
      session.map.homePos = { x: 336, y: 211 }
      session.map.pos = { ...session.map.homePos }
    })
    bus.gameBusEmit('session_updated')
    return store.getSession()?.bag[1105022] ?? 0
  })()`)
  if (fixture !== 1) throw new Error('交易夹具准备失败')

  // 3. 走真实 UI 到地图，验证 NPC 专用弹窗。
  await click(await point(447, 902), { label: 'open home gate' })
  await waitForNav('GateNode')
  await click(await point(558, 315), { label: 'leave shelter' })
  await waitForNav('GateOutNode')
  await click(await point(320, 700), { label: 'continue to map' })
  await waitForNav('MapNode')
  await click(await point(415, 901), { label: 'select old luo' })
  await waitForText('交易物品: 1')
  let rows = await objects()
  requireNames(rows, [
    'npcTravelDialog', 'npcTravelIcon', 'npcTravelHearts', 'npcTravelPortrait',
    'npcTravelDescription', 'npcTravelTime', 'npcTravelTradeCount',
    'npcTravelCancel', 'npcTravelGo',
  ], '地图 NPC 弹窗')
  if (rows.filter(row => row.name.startsWith('npcTravelHeartsBackground')).length !== 5) {
    throw new Error('地图 NPC 弹窗不是五颗心')
  }
  if (rows.find(row => row.name === 'npcTravelIcon')?.frame !== 'icon_npc.png' ||
      rows.find(row => row.name === 'npcTravelPortrait')?.frame !== 'npc_dig_1.png') {
    throw new Error('地图 NPC 弹窗素材错误')
  }
  if (!(await canvasTexts()).includes('取消')) throw new Error('地图 NPC 弹窗缺少“取消”')
  const travelScreenshot = await captureScreenshot()

  // 4. 前往并验证会面页，而不是直接进入交易页。
  await click(await point(432, 964), { label: 'travel to old luo' })
  await waitForNav('NpcNode', 15)
  const meetingTexts = await canvasTexts()
  rows = await objects()
  requireNames(rows, [
    'npcMeetingPage', 'npcHearts', 'npcPortrait', 'npcPortraitBackground',
    'npcPortraitImage', 'npcDialog', 'npcNeedText', 'npcTradeText',
    'npcGiveButton', 'npcTradeButton',
  ], 'NPC 会面页')
  if (!meetingTexts.includes('老罗') ||
      !meetingTexts.includes('给他酒x1, 你有1') ||
      !meetingTexts.includes('交易物品: 1')) {
    throw new Error(`NPC 会面文案错误：${JSON.stringify(meetingTexts)}`)
  }
  if (rows.find(row => row.name === 'npcPortraitBackground')?.frame !== 'npc_dig_bg.png' ||
      rows.find(row => row.name === 'npcPortraitImage')?.frame !== 'npc_dig_1.png') {
    throw new Error('NPC 会面页立绘素材错误')
  }
  const meetingScreenshot = await captureScreenshot()

  // 5. 独立交易页初始按钮禁用，装备栏和上下双库存存在。
  const unchanged = await tradeState()
  await click(await point(469, 1018), { label: 'open npc trade' })
  await waitForNav('NpcStorageNode')
  rows = await objects()
  requireNames(rows, ['npcTradeBagGrid', 'npcTradeNpcGrid', 'npcTradeRate', 'npcTradeConfirm'], 'NPC 交易页')
  if (rows.filter(row => row.frame === 'build_icon_bg.png').length !== 4) {
    throw new Error('NPC 交易页缺少四格装备栏')
  }
  if (rows.find(row => row.name === 'npcTradeConfirm')?.hitInput !== false) {
    throw new Error('初始交易按钮未禁用')
  }
  const bagGrid = rows.find(row => row.name === 'npcTradeBagGrid')
  const npcGrid = rows.find(row => row.name === 'npcTradeNpcGrid')
  if (bagGrid?.x !== 45 || bagGrid.y !== 497 || npcGrid?.x !== 45 || npcGrid.y !== 832) {
    throw new Error(`NPC 交易页几何错误：${JSON.stringify({ bagGrid, npcGrid })}`)
  }
  const tradeInitialScreenshot = await captureScreenshot()

  // 6. 长按批量索取 3 发子弹；不公平草稿仍禁用，且不能提前修改会话。
  const hold = await point(100, 882)
  await cdp('Input.dispatchMouseEvent', { type: 'mousePressed', x: hold[0], y: hold[1], button: 'left', clickCount: 1 })
  await wait(0.6)
  await cdp('Input.dispatchMouseEvent', { type: 'mouseReleased', x: hold[0], y: hold[1], button: 'left', clickCount: 1 })
  await wait(0.2)
  rows = await objects()
  requireNames(rows, ['npcTradeQuantityDialog', 'npcTradeQuantityConfirm'], '数量滑块')
  await click(await point(252, 888), { label: 'select three bullets' })
  await waitForText('数量 3/8')
  const quantityScreenshot = await captureScreenshot()
  await click(await point(320, 964), { label: 'confirm batch quantity' })
  await wait(0.2)
  const unfairTexts = await canvasTexts()
  rows = await objects()
  if (!unfairTexts.includes('开什么玩笑！！') ||
      rows.find(row => row.name === 'npcTradeConfirm')?.hitInput !== false) {
    throw new Error(`不公平交易未禁用：${JSON.stringify({ unfairTexts, rows })}`)
  }
  const unfairScreenshot = await captureScreenshot()
  if (JSON.stringify(await tradeState()) !== JSON.stringify(unchanged)) {
    throw new Error('交易草稿提前修改了真实会话')
  }
  await click(await point(82, 315), { label: 'cancel trade draft' })
  await waitForNav('NpcNode')
  if (JSON.stringify(await tradeState()) !== JSON.stringify(unchanged)) {
    throw new Error('返回没有丢弃交易草稿')
  }

  // 7. 重新进入，酒 x1 换子弹 x3 必须显示原版公平文案。
  await click(await point(469, 1018), { label: 'reopen npc trade' })
  await waitForNav('NpcStorageNode')
  await click(await point(100, 547), { label: 'offer one wine' })
  await wait(0.1)
  for (let i = 0; i < 3; i++) {
    await click(await point(210, 882), { label: 'request one bullet' })
    await wait(0.1)
  }
  const draftTexts = await canvasTexts()
  rows = await objects()
  if (!draftTexts.includes('这是个公平的交易。')) {
    throw new Error(`未显示原版公平文案：${JSON.stringify(draftTexts)}`)
  }
  if (rows.find(row => row.name === 'npcTradeConfirm')?.hitInput !== true) {
    throw new Error('公平交易按钮未启用')
  }
  const tradeDraftScreenshot = await captureScreenshot()

  // 8. 确认后自动返回会面页；库存、次数正确且没有新增交易日志。
  const before = await tradeState()
  await click(await point(519, 806), { label: 'confirm fair trade' })
  await waitForNav('NpcNode')
  const after = await tradeState()
  if (!after ||
      after.bag.wine !== 0 || after.bag.bullets !== 3 ||
      after.npc.wine !== 1 || after.npc.bullets !== 5 ||
      after.npc.tradingCount !== 1 ||
      after.lastLog !== before?.lastLog || after.logCount !== before?.logCount) {
    throw new Error(`交易结果错误：${JSON.stringify({ before, after })}`)
  }
  rows = await objects()
  requireNames(rows, ['npcMeetingPage', 'npcPortraitImage', 'npcTradeButton'], '交易后会面页')
  if (rows.some(row => row.name === 'npcTradeBagGrid')) {
    throw new Error('交易成功后没有返回会面页')
  }
  const returnScreenshot = await captureScreenshot()

  cliLog(JSON.stringify({
    result: 'PASS',
    before,
    after,
    screenshots: {
      travel: travelScreenshot,
      meeting: meetingScreenshot,
      tradeInitial: tradeInitialScreenshot,
      quantity: quantityScreenshot,
      unfair: unfairScreenshot,
      tradeDraft: tradeDraftScreenshot,
      returned: returnScreenshot,
    },
  }))
} catch (error) {
  let failureScreenshot = null
  let screenshotError = null
  try {
    failureScreenshot = await captureScreenshot()
  } catch (captureError) {
    screenshotError = String(captureError)
  }
  cliLog(JSON.stringify({
    result: 'FAIL',
    error: String(error),
    screenshotError,
    nav: await navName(),
    state: await tradeState(),
    screenshot: failureScreenshot,
  }))
  throw error
}
EOF
```

## 通过标准

- 地图 NPC 弹窗包含 NPC 图标、五颗心、立绘、简介、距离、交易种类和“取消/前往”
- 到达后先进入 `NpcNode` 会面页，显示原版立绘、心形、随机台词、需求和交易入口
- 点击“交易”进入独立 `NpcStorageNode`，显示装备栏、上方背包和下方老罗库存
- 初始交易按钮禁用；`酒 x1` 换 `子弹 x3` 显示“这是个公平的交易。”并启用按钮
- 长按可一次移动多个物品；不公平草稿保持禁用，返回会面页会丢弃草稿
- 成功后自动返回会面页，库存和 `tradingCount` 正确，没有新增交易成功日志
- 脚本输出 `result: PASS`，七张截图无明显溢出、遮挡或错误素材

## 结束任务空间

确认输出和截图后单独执行：

```bash
ego-browser nodejs <<'EOF'
const result = await completeTaskSpace('death-diary e2e npc trade', { keep: false })
cliLog(JSON.stringify(result))
EOF
```
