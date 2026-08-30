# 对齐原版 BossSite 081研究所 boss 链枢纽

## Goal

对齐原版 Buried-City 的 `BossSite`（site 61 · 081研究所）与 `BossSiteNode` UI：
61 是 boss 链（301-312）的聚合枢纽，点击进入内景图，12 个子副本按钮按
锁定/可打/已通关状态呈现；同时修复子副本坐标被误用于大地图导致的
「升降台位置错误」。

## Background

- 原版 `site.js`: `BOSS_SITE = 61`，`BossSite` 子类 `isSiteEnd()` 恒 false，
  进度 = 已解锁子副本数/12；`map.forEach` 有 `siteId < 300` 过滤（301-312 不上大地图）。
- 原版 `ui/bossSiteNode.js`（103 行）：进入 61 → `new_site_bg.png` 内景 +
  12 个 `boss_sub_site_<id>.png` 按钮（位置 = siteConfig coordinate，内景局部坐标）+
  状态图标（未解锁 `icon_room_lock.png` 禁用；已解锁未通关 `icon_room_active.png`
  闪烁 fade 1.5s 循环）+ 出口 `boss_sub_site_exit.png` @ (506.5, 50.5)。
- 移植版现状：mapNode 渲染循环无 300 过滤（301-312 错误上大地图）；点击 61 走
  普通 siteNode → 空面板（battleRoom/workRoom 均为 0）。
- 素材已全部在图集（boss_sub_site_301..312、exit、new_site_bg、状态图标），
  301-312 的 siteConfig 数据（rooms/difficulty）已配好，仅缺 UI 与路由。

## Scope

1. `mapNode.ts` 渲染循环跳过 `siteId >= 300`（对齐原版 forEach 过滤）。
2. `navigation.ts` 新增 `NavNode.BOSS`。
3. 新建 `src/game/ui/nodes/bossNode.ts`：按原版规格实现枢纽 UI，
   点击子副本 `forward(NavNode.SITE, id)` 复用现有 site 流程；出口返回地图。
4. `mapNode.ts` 点击 61 → `forward(NavNode.BOSS, 61)`。
5. `siteConfig.ts` 注释标注：61 = 大地图坐标；301-312 = boss 内景按钮坐标。
6. 单测：boss 链按钮状态映射（未解锁/已解锁未通关/已通关）。

## Acceptance

- 大地图不再出现 301-312 图标；61 仍正常显示。
- 点击 61 进入内景：12 按钮布局与状态正确（锁定灰禁用、未通关闪烁）。
- 点击已解锁子副本进入其战斗/工作流程；出口返回地图。
- `bun run lint` / `typecheck` / `bun test src/game` / `build` 全绿。

## Out of scope

- 301-312 子副本的战斗/工作内容调整（已有数据，走现有 SITE 流程）。
- 61 的存档结构变更（进度读 unlocked 聚合，无需新字段）。

## Execution log

### 2026-08-30 — implemented

- `bossNode.ts` (new): inset scene (`new_site_bg`, anchor bottom-center), 12
  sub-site buttons at siteConfig coords (Cocos child-origin = bg anchor
  (0.5,0) → bottom-center), lock tint + `icon_room_lock`, `icon_room_active`
  pulsing (1.5s yoyo), exit button → back; bottom-frame buttons disabled
  (original uiConfig parity). Pure status fn `bossSubSiteStatus` exported.
- `mapNode.ts`: render loop skips `siteId >= 300` (original forEach filter);
  `enterSite(61)` routes to `NavNode.BOSS`.
- `navigation.ts`: added `NavNode.BOSS` + mounter registration.
- `siteConfig.ts`: `BOSS_SITE_ID` / `BOSS_SUB_SITE_IDS` exported; comments
  marking 61 as map coord vs 301-312 as inset-scene button coords.
- Validation: lint clean, both tsc configs exit 0, client 40 pass, server 5
  pass, build OK. Fix during dev: sessionStore import path (session/, not systems/).

### 2026-08-30 — blank-screen fix + advisor review round

- Root cause of "entered but nothing visible": `new_site` atlas is lazy-tier
  and nothing ever called `loadAtlas` for it → every `hasFrame` guard skipped.
  Fix: added `'new_site'` to `HOME_ATLAS_KEYS` (same pattern as `'map'`/`'site'`;
  Home owns the map/boss entry). Verified `new_site_bg` is 596×840 (= bottom
  frame rect), buttons 218×88, exit 167×87 — inset layout math holds.
- Advisor review round:
  - P0-1 (travel bypass) DISPROVEN by code: `startTravel` arrival callback
    funnels into the patched `enterSite`, so first-visit travel routes to BOSS.
  - P0-2 fixed: unlocked sub-sites had no SiteState (badge wrong + battle
    dead-on-arrival). `ensureSite(id)` now called for every unlocked sub at
    bossNode mount — idempotent, no map.pos/log side effects (original
    unlockSite constructs the Site at unlock).
  - P1 fixed: exit button now `leaveSite()` + `back()` (original outSite
    parity; travel arrival sets isAtSite/nowSiteId=61).
  - Confirmed `site_61` lives in the `site` atlas block (map icon OK).
  - P2 noted, no change: MID button variant / fade-to-0 cosmetic deltas.
- Gates: lint clean, tsc ×2 exit 0, client 40 pass, server 5 pass, build OK.
