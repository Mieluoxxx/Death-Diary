/**
 * BattleAndWorkNode — ports Buried-City battleAndWorkNode:
 * 1) createBattleBeginView (equip / threat / warnings / 战斗)
 * 2) createBattleProcessView (7 log lines + 僵尸数量 + pb)
 *
 * Logs use original approach strings from battleSystem (1045/1046/…).
 */

import { GameObjects } from 'phaser';
import { HAND_ITEM_ID, getItemDef } from '../../data/itemConfig';
import { getSiteConfig } from '../../data/siteConfig';
import { getSession } from '../../session/sessionStore';
import {
    currentRoom,
    fillTempLootFromRoom,
    getSite,
    roomEnd,
    siteStorageCount,
} from '../../systems/mapSystem';
import {
    clearBattle,
    forceEndBattle,
    getActiveBattle,
    startBattle,
    tickBattle,
    type BattleLogEntry,
} from '../../systems/battleSystem';
import { EquipPosMap } from '../../systems/inventory';
import type { NodeMountContext, NodeMountResult } from '../navigation';
import { NavNode } from '../navigation';
import {
    UI_FONT_FAMILY,
    UI_FONT_SIZE,
    UI_TEXT_RESOLUTION,
    uiWordWrap,
} from '../uiFont';
import { addAtlasButton } from '../atlasButton';

const LOG_LINES = 7;
const LOG_STEP = 50;
const LOG_BASE_Y = 120;
const PB_BOTTOM_Y = 60;
const CONTENT_LEFT = 40;

/** string_zh 3009 by difficulty-1 index. */
const BATTLE_DES: string[] = [
    '前方发现僵尸！',
    '前方发现僵尸！',
    '一些游荡的僵尸注意到了你。',
    '一些游荡的僵尸注意到了你。',
    '一大群僵尸被惊动了，正准备向你扑来',
    '一大群僵尸被惊动了，正准备向你扑来',
    '一大群僵尸被惊动了，正准备向你扑来',
    '尸群带着死亡的恐怖气息向你靠拢',
    '你被一群僵尸包围了',
    '尸群带着死亡的恐怖气息向你靠拢',
    '尸群带着死亡的恐怖气息向你靠拢',
    '你被一群僵尸包围了',
];

function hasFrame (ctx: NodeMountContext, atlas: string, frame: string): boolean
{
    return ctx.scene.textures.exists(atlas) && ctx.scene.textures.get(atlas).has(frame);
}

function placeChromeCaptions (
    ctx: NodeMountContext,
    siteName: string,
    progress: string,
    storageN: number,
): void
{
    const titleY = ctx.bgBottomY - 803;
    const titleX = ctx.width / 2 - ctx.bgWidth / 2 + 111;
    const rightEdge = ctx.width / 2 + ctx.bgWidth / 2 - CONTENT_LEFT + 20;

    const titleProbe = ctx.scene.add
        .text(0, 0, siteName, {
            fontFamily: UI_FONT_FAMILY,
            resolution: UI_TEXT_RESOLUTION,
            fontSize: `${UI_FONT_SIZE.COMMON_1}px`,
        })
        .setVisible(false);
    const progressX = titleX + titleProbe.width + 16;
    titleProbe.destroy();

    if (progress)
    {
        ctx.content.add(
            ctx.scene.add
                .text(progressX, titleY, progress, {
                    fontFamily: UI_FONT_FAMILY,
                    resolution: UI_TEXT_RESOLUTION,
                    fontSize: `${UI_FONT_SIZE.COMMON_3}px`,
                    color: '#ffffff',
                })
                .setOrigin(0, 0.5)
                .setDepth(5),
        );
    }
    ctx.content.add(
        ctx.scene.add
            .text(rightEdge, titleY, `存放物品:${storageN}`, {
                fontFamily: UI_FONT_FAMILY,
                resolution: UI_TEXT_RESOLUTION,
                fontSize: `${UI_FONT_SIZE.COMMON_3}px`,
                color: '#ffffff',
            })
            .setOrigin(1, 0.5)
            .setDepth(5),
    );
}

function placeDigHeader (
    ctx: NodeMountContext,
    digFrame: string | null,
    digAtlas: string,
): number
{
    const digTop = ctx.bgBottomY - (770 - 20);
    let below = digTop + 40;

    if (hasFrame(ctx, 'npc', 'npc_dig_bg.png'))
    {
        const plate = ctx.scene.add
            .image(ctx.width / 2, digTop, 'npc', 'npc_dig_bg.png')
            .setOrigin(0.5, 0);
        ctx.content.add(plate);
        below = plate.y + plate.displayHeight + 8;

        if (hasFrame(ctx, 'dig_monster', 'monster_dig_mid_bg.png'))
        {
            ctx.content.add(
                ctx.scene.add
                    .image(plate.x, plate.y + plate.displayHeight / 2, 'dig_monster', 'monster_dig_mid_bg.png')
                    .setOrigin(0.5),
            );
        }
        if (digFrame && hasFrame(ctx, digAtlas, digFrame))
        {
            ctx.content.add(
                ctx.scene.add
                    .image(plate.x, plate.y + plate.displayHeight / 2, digAtlas, digFrame)
                    .setOrigin(0.5),
            );
        }
        return below;
    }

    if (digFrame && hasFrame(ctx, digAtlas, digFrame))
    {
        const dig = ctx.scene.add
            .image(ctx.width / 2, digTop, digAtlas, digFrame)
            .setOrigin(0.5, 0);
        ctx.content.add(dig);
        below = dig.y + dig.displayHeight + 8;
    }
    return below;
}

export function mountBattleNode (ctx: NodeMountContext): NodeMountResult
{
    const siteId = Number(ctx.userData);
    const room = currentRoom(siteId);
    const cfg = getSiteConfig(siteId);
    const site = getSite(siteId);
    const siteName = cfg?.name ?? '战斗';

    ctx.setTitle(siteName, { align: 'left' });
    ctx.setLeftEnabled(false);
    ctx.setRightEnabled(false);

    const progress =
        site && site.rooms.length > 0
            ? `进度:${Math.min(site.step + 1, site.rooms.length)}/${site.rooms.length}`
            : '';
    placeChromeCaptions(ctx, siteName, progress, siteStorageCount(siteId));

    if (!room)
    {
        ctx.setLeftEnabled(true);
        ctx.content.add(
            ctx.scene.add
                .text(ctx.width / 2, ctx.height / 2, '没有可进入的房间', {
                    fontFamily: UI_FONT_FAMILY,
                    resolution: UI_TEXT_RESOLUTION,
                    fontSize: '20px',
                    color: '#ccc',
                })
                .setOrigin(0.5),
        );
        return { onLeft: () => ctx.back() };
    }

    if (room.type === 'work')
    {
        // Original createWorkBeginView — choose tool first, never auto-scavenge.
        return mountWorkBegin(ctx, siteId, room.workType ?? 0);
    }

    // Begin view first (not auto-start).
    return mountBattleBegin(ctx, siteId, room.monsters, room.difficulty);
}

function mountBattleBegin (
    ctx: NodeMountContext,
    siteId: number,
    monsters: number[],
    difficulty: number,
): NodeMountResult
{
    const digName = `monster_dig_${Math.max(1, Math.min(12, difficulty))}.png`;
    const belowDig = placeDigHeader(ctx, digName, 'dig_monster');

    // des under dig (original: digDes.y - digDes.height - 20), white COMMON_2.
    const desText = BATTLE_DES[difficulty - 1] ?? BATTLE_DES[0]!;
    const des = ctx.scene.add
        .text(ctx.width / 2, belowDig + 20, desText, {
            fontFamily: UI_FONT_FAMILY,
            resolution: UI_TEXT_RESOLUTION,
            fontSize: `${UI_FONT_SIZE.COMMON_2}px`,
            color: '#ffffff',
            align: 'center',
            wordWrap: uiWordWrap(ctx.bgWidth - 80),
        })
        .setOrigin(0.5, 0);
    ctx.content.add(des);

    const left = ctx.width / 2 - ctx.bgWidth / 2 + CONTENT_LEFT;
    // Original labels stack top→bottom from node local y=400 (from bottom).
    // Use top-left origin and grow downward so order stays correct.
    let cursorY = ctx.bgBottomY - 400;

    const session = getSession();
    let hasWeapon = false;
    if (session)
    {
        for (const id of [
            session.equip[EquipPosMap.GUN],
            session.equip[EquipPosMap.WEAPON],
        ])
        {
            if (id && id !== HAND_ITEM_ID)
            {
                const slot = getItemDef(id).slot;
                if (slot === 'gun' || slot === 'weapon')
                {
                    hasWeapon = true;
                }
            }
        }
    }

    // 你的装备:
    const equipLabel = ctx.scene.add
        .text(left, cursorY, '你的装备:', {
            fontFamily: UI_FONT_FAMILY,
            resolution: UI_TEXT_RESOLUTION,
            fontSize: `${UI_FONT_SIZE.COMMON_3}px`,
            color: '#ffffff',
        })
        .setOrigin(0, 0);
    ctx.content.add(equipLabel);

    let iconX = equipLabel.x + equipLabel.width + 8;
    const iconY = cursorY + equipLabel.height / 2;
    const equipIds = session
        ? [
            session.equip[EquipPosMap.GUN],
            session.equip[EquipPosMap.WEAPON],
            session.equip[EquipPosMap.EQUIP],
            session.equip[EquipPosMap.TOOL],
        ]
        : [];
    for (const id of equipIds)
    {
        if (!id || id === HAND_ITEM_ID)
        {
            continue;
        }
        const frame = `icon_item_${id}.png`;
        if (hasFrame(ctx, 'icon', frame))
        {
            const icon = ctx.scene.add
                .image(iconX, iconY, 'icon', frame)
                .setOrigin(0, 0.5)
                .setScale(0.45);
            ctx.content.add(icon);
            iconX += icon.displayWidth + 6;
        }
    }
    if (!hasWeapon)
    {
        if (hasFrame(ctx, 'gate', 'icon_tab_hand.png'))
        {
            ctx.content.add(
                ctx.scene.add
                    .image(iconX, iconY, 'gate', 'icon_tab_hand.png')
                    .setOrigin(0, 0.5)
                    .setScale(0.7),
            );
        }
        else if (hasFrame(ctx, 'icon', 'icon_item_1.png'))
        {
            ctx.content.add(
                ctx.scene.add
                    .image(iconX, iconY, 'icon', 'icon_item_1.png')
                    .setOrigin(0, 0.5)
                    .setScale(0.45),
            );
        }
    }

    cursorY += equipLabel.height + 15;

    // 威胁等级: N (red)
    const threat = ctx.scene.add
        .text(left, cursorY, `威胁等级: ${difficulty}`, {
            fontFamily: UI_FONT_FAMILY,
            resolution: UI_TEXT_RESOLUTION,
            fontSize: `${UI_FONT_SIZE.COMMON_3}px`,
            color: '#ff3333',
        })
        .setOrigin(0, 0);
    ctx.content.add(threat);
    cursorY += threat.height + 15;

    // 1207 unarmed warning
    if (!hasWeapon)
    {
        const warn = ctx.scene.add
            .text(left, cursorY, '你没有装备任何武器，只能徒手进攻！', {
                fontFamily: UI_FONT_FAMILY,
                resolution: UI_TEXT_RESOLUTION,
                fontSize: `${UI_FONT_SIZE.COMMON_3}px`,
                color: '#ff3333',
                wordWrap: uiWordWrap(ctx.bgWidth - 80),
            })
            .setOrigin(0, 0);
        ctx.content.add(warn);
        cursorY += warn.height + 15;
    }

    // Low vigour warning (1206)
    if (session && session.attrs.vigour < 30)
    {
        ctx.content.add(
            ctx.scene.add
                .text(left, cursorY, '你的精力值过低，攻击速度降为50%！', {
                    fontFamily: UI_FONT_FAMILY,
                    resolution: UI_TEXT_RESOLUTION,
                    fontSize: `${UI_FONT_SIZE.COMMON_3}px`,
                    color: '#ff3333',
                    wordWrap: uiWordWrap(ctx.bgWidth - 80),
                })
                .setOrigin(0, 0),
        );
    }

    const fightBtn = addAtlasButton(ctx.scene, ctx.width / 2, ctx.bgBottomY - 60, {
        atlas: 'ui',
        frame: 'btn_common_white_normal.png',
        label: '战斗',
        onClick: () =>
        {
            // Clear begin content and swap to process view.
            ctx.content.removeAll(true);
            // Re-place chrome captions (removed with content).
            const site = getSite(siteId);
            const cfg = getSiteConfig(siteId);
            const name = cfg?.name ?? '战斗';
            const prog =
                site && site.rooms.length > 0
                    ? `进度:${Math.min(site.step + 1, site.rooms.length)}/${site.rooms.length}`
                    : '';
            placeChromeCaptions(ctx, name, prog, siteStorageCount(siteId));
            // Attach process handlers by replacing active node via side-effect mount.
            const process = mountBattleProcess(ctx, siteId, monsters, difficulty);
            // Store on content for host update — host already holds this result; we need to swap.
            // Workaround: mutate returned result's update/destroy by assignment after return is impossible.
            // Instead re-forward replace with a flag is heavy. Use content data bag:
            (ctx.content as unknown as { __battleProcess?: NodeMountResult }).__battleProcess = process;
        },
    });
    ctx.content.add(fightBtn);

    // Host update bridge: while begin view is active, poll for process swap.
    let processHandle: NodeMountResult | null = null;
    return {
        update: (deltaMs: number) =>
        {
            const bag = ctx.content as unknown as { __battleProcess?: NodeMountResult };
            if (!processHandle && bag.__battleProcess)
            {
                processHandle = bag.__battleProcess;
                delete bag.__battleProcess;
            }
            processHandle?.update?.(deltaMs);
        },
        destroy: () =>
        {
            processHandle?.destroy?.();
        },
    };
}

function placeBottomProgress (
    ctx: NodeMountContext,
    opts?: { showCount?: boolean },
): {
    setPct: (pct: number) => void;
    setCount: (alive: number, total: number) => void;
}
{
    const showCount = opts?.showCount !== false;
    const pbBottomY = ctx.bgBottomY - PB_BOTTOM_Y;
    let fill: GameObjects.Image | GameObjects.Rectangle | null = null;
    let fillMax = 264;
    let bgCenterX = ctx.width / 2;
    let bgTopY = pbBottomY;

    if (hasFrame(ctx, 'ui', 'pb_bg.png'))
    {
        const bg = ctx.scene.add
            .image(ctx.width / 2, pbBottomY, 'ui', 'pb_bg.png')
            .setOrigin(0.5, 1);
        ctx.content.add(bg);
        bgCenterX = bg.x;
        bgTopY = bg.y - bg.displayHeight;
        fillMax = hasFrame(ctx, 'ui', 'pb.png')
            ? ctx.scene.textures.get('ui').get('pb.png').width
            : bg.width - 4;
        if (hasFrame(ctx, 'ui', 'pb.png'))
        {
            const cy = bg.y - bg.displayHeight / 2;
            fill = ctx.scene.add
                .image(bg.x - fillMax / 2, cy, 'ui', 'pb.png')
                .setOrigin(0, 0.5);
            fill.setCrop(0, 0, 1, fill.height);
            fill.setVisible(false);
            ctx.content.add(fill);
        }
    }
    else
    {
        const bg = ctx.scene.add
            .rectangle(ctx.width / 2, pbBottomY, 268, 17, 0x333333)
            .setOrigin(0.5, 1);
        ctx.content.add(bg);
        bgTopY = pbBottomY - 17;
        fill = ctx.scene.add
            .rectangle(ctx.width / 2 - 132, pbBottomY - 8.5, 1, 13, 0xc4a35a)
            .setOrigin(0, 0.5);
        ctx.content.add(fill);
    }

    // Battle only: 僵尸数量 above bar. Work process must not show this.
    const countLabel = showCount
        ? ctx.scene.add
            .text(bgCenterX + 134, bgTopY - 5, '', {
                fontFamily: UI_FONT_FAMILY,
                resolution: UI_TEXT_RESOLUTION,
                fontSize: `${UI_FONT_SIZE.COMMON_3}px`,
                color: '#ffffff',
            })
            .setOrigin(1, 1)
        : null;
    if (countLabel)
    {
        ctx.content.add(countLabel);
    }

    return {
        setPct: (pct: number) =>
        {
            const p = Math.max(0, Math.min(1, pct));
            if (!fill)
            {
                return;
            }
            if ('setCrop' in fill && typeof fill.setCrop === 'function' && hasFrame(ctx, 'ui', 'pb.png'))
            {
                const img = fill as GameObjects.Image;
                const w = Math.max(1, Math.round(fillMax * p));
                img.setCrop(0, 0, w, img.height);
                img.setVisible(p > 0);
            }
            else
            {
                (fill as GameObjects.Rectangle).width = Math.max(1, fillMax * p);
            }
        },
        setCount: (alive: number, total: number) =>
        {
            if (!countLabel)
            {
                return;
            }
            countLabel.setText(`僵尸数量:${alive}/${total}`);
        },
    };
}

/** string_zh 3008 by workType. */
const WORK_DES = [
    '你在角落里发现一个上锁的箱子。',
    '这是一个锁着抽屉的桌子，好像没有被翻找过。',
    '一组柜子，显然被人群和僵尸忽略了。',
];

function listWorkTools (session: ReturnType<typeof getSession>): number[]
{
    // Original: HAND + bag items of type 1302 with effect_tool.
    const ids: number[] = [HAND_ITEM_ID];
    if (!session)
    {
        return ids;
    }
    for (const [idText, num] of Object.entries(session.bag))
    {
        if (num <= 0)
        {
            continue;
        }
        const id = Number(idText);
        const def = getItemDef(id);
        if (def.effectTool)
        {
            ids.push(id);
        }
    }
    // Also allow equipped weapon/tool if it has effect_tool (e.g. crowbar).
    for (const pos of [EquipPosMap.WEAPON, EquipPosMap.TOOL] as const)
    {
        const id = session.equip[pos];
        if (id && id !== HAND_ITEM_ID && getItemDef(id).effectTool && !ids.includes(id))
        {
            ids.push(id);
        }
    }
    return ids;
}

function toolWorkMinutes (itemId: number, vigour: number): number
{
    // Original: HAND=45m, else effect_tool.workingTime; * vigourEffect.
    let minutes =
        itemId === HAND_ITEM_ID
            ? 45
            : (getItemDef(itemId).effectTool?.workingTime ?? 45);
    // vigourEffect: low vigour slows work (simple: <30 → ×2)
    if (vigour < 30)
    {
        minutes = Math.round(minutes * 2);
    }
    return minutes;
}

function mountWorkBegin (
    ctx: NodeMountContext,
    siteId: number,
    workType: number,
): NodeMountResult
{
    ctx.setLeftEnabled(true);
    ctx.setRightEnabled(false);

    const wt = Math.max(0, Math.min(2, workType));
    const digFrame = `work_dig_${wt}.png`;
    const digTop = ctx.bgBottomY - (770 - 20);
    let digBottom = digTop + 200;

    if (hasFrame(ctx, 'dig_work', digFrame))
    {
        const dig = ctx.scene.add
            .image(ctx.width / 2, digTop, 'dig_work', digFrame)
            .setOrigin(0.5, 0);
        ctx.content.add(dig);
        digBottom = dig.y + dig.displayHeight;
    }

    // des under dig
    ctx.content.add(
        ctx.scene.add
            .text(ctx.width / 2, digBottom + 20, WORK_DES[wt] ?? WORK_DES[0]!, {
                fontFamily: UI_FONT_FAMILY,
                resolution: UI_TEXT_RESOLUTION,
                fontSize: `${UI_FONT_SIZE.COMMON_2}px`,
                color: '#ffffff',
                align: 'center',
                wordWrap: uiWordWrap(ctx.bgWidth - 80),
            })
            .setOrigin(0.5, 0),
    );

    const session = getSession();
    const tools = listWorkTools(session);
    const vigour = session?.attrs.vigour ?? 80;
    const areaW = ctx.bgWidth - CONTENT_LEFT * 2;
    const areaLeft = ctx.width / 2 - areaW / 2;
    const iconW = 57;
    const n = Math.max(1, tools.length);
    const padding = (areaW - n * iconW) / (n * 2);
    // Original tool row at local y=120 from bg bottom.
    const btnY = ctx.bgBottomY - 120;

    let processHandle: NodeMountResult | null = null;

    tools.forEach((itemId, i) =>
    {
        const x = areaLeft + (padding * 2 + iconW) * i + (padding + iconW / 2);
        const minutes = toolWorkMinutes(itemId, vigour);

        // btn_tool background
        if (hasFrame(ctx, 'ui', 'btn_tool.png'))
        {
            const bg = ctx.scene.add
                .image(x, btnY, 'ui', 'btn_tool.png')
                .setInteractive({ useHandCursor: true });
            ctx.content.add(bg);
            bg.on('pointerup', () =>
            {
                // Clear begin UI and start timed process.
                ctx.content.removeAll(true);
                const site = getSite(siteId);
                const cfg = getSiteConfig(siteId);
                const name = cfg?.name ?? '搜刮';
                const prog =
                    site && site.rooms.length > 0
                        ? `进度:${Math.min(site.step + 1, site.rooms.length)}/${site.rooms.length}`
                        : '';
                placeChromeCaptions(ctx, name, prog, siteStorageCount(siteId));
                processHandle = mountWorkProcess(ctx, siteId, minutes, itemId, wt);
            });

            // Tool icon (hand / crowbar…)
            if (itemId === HAND_ITEM_ID && hasFrame(ctx, 'gate', 'icon_tab_hand.png'))
            {
                ctx.content.add(
                    ctx.scene.add
                        .image(x, btnY, 'gate', 'icon_tab_hand.png')
                        .setScale(0.7),
                );
            }
            else
            {
                const frame = `icon_item_${itemId}.png`;
                if (hasFrame(ctx, 'icon', frame))
                {
                    ctx.content.add(
                        ctx.scene.add
                            .image(x, btnY, 'icon', frame)
                            .setScale(0.5),
                    );
                }
            }
        }
        else
        {
            const hit = ctx.scene.add
                .circle(x, btnY, 28, 0x444444)
                .setInteractive({ useHandCursor: true });
            ctx.content.add(hit);
            hit.on('pointerup', () =>
            {
                ctx.content.removeAll(true);
                processHandle = mountWorkProcess(ctx, siteId, minutes, itemId, wt);
            });
        }

        // 耗时:Nm under button
        ctx.content.add(
            ctx.scene.add
                .text(x, btnY + iconW / 2 + 10, `耗时:${minutes}m`, {
                    fontFamily: UI_FONT_FAMILY,
                    resolution: UI_TEXT_RESOLUTION,
                    fontSize: `${UI_FONT_SIZE.COMMON_3}px`,
                    color: '#ffffff',
                })
                .setOrigin(0.5, 0),
        );
    });

    return {
        onLeft: () =>
        {
            if (processHandle)
            {
                return;
            }
            ctx.back();
        },
        update: (deltaMs: number) =>
        {
            processHandle?.update?.(deltaMs);
        },
        destroy: () =>
        {
            processHandle?.destroy?.();
        },
    };
}

function mountWorkProcess (
    ctx: NodeMountContext,
    siteId: number,
    minutes: number,
    _itemId: number,
    workType: number,
): NodeMountResult
{
    ctx.setLeftEnabled(false);
    ctx.setRightEnabled(false);

    // Keep dig visible during process (original dig_des stays on bg).
    const digFrame = `work_dig_${Math.max(0, Math.min(2, workType))}.png`;
    if (hasFrame(ctx, 'dig_work', digFrame))
    {
        const digTop = ctx.bgBottomY - (770 - 20);
        ctx.content.add(
            ctx.scene.add
                .image(ctx.width / 2, digTop, 'dig_work', digFrame)
                .setOrigin(0.5, 0),
        );
    }

    const bar = placeBottomProgress(ctx, { showCount: false });
    bar.setPct(0);

    // Original: time minutes * 60 game-seconds, accelerated in UI.
    // Slice: map real duration so 45m ≈ ~3s wall, 10m ≈ ~1.2s (feel responsive).
    const durationMs = Math.max(1200, Math.min(4500, minutes * 80));
    let progress = 0;
    let done = false;

    return {
        update: (deltaMs: number) =>
        {
            if (done)
            {
                return;
            }
            progress += deltaMs / durationMs;
            if (progress >= 1)
            {
                progress = 1;
                done = true;
                bar.setPct(1);
                fillTempLootFromRoom(siteId);
                roomEnd(siteId, true);
                // Pass workType so loot title is 箱子/桌子/柜子 (original userData.room).
                ctx.replace(NavNode.WORK_ROOM_STORAGE, { siteId, workType });
                return;
            }
            bar.setPct(progress);
        },
        destroy: () =>
        {
            // no-op
        },
    };
}

function mountBattleProcess (
    ctx: NodeMountContext,
    siteId: number,
    monsters: number[],
    difficulty: number,
): NodeMountResult
{
    clearBattle();
    startBattle(monsters);

    const digName = `monster_dig_${Math.max(1, Math.min(12, difficulty))}.png`;
    placeDigHeader(ctx, digName, 'dig_monster');

    const logLeft = ctx.width / 2 - ctx.bgWidth / 2 + CONTENT_LEFT;
    const logWidth = ctx.bgWidth - CONTENT_LEFT * 2;
    const logLabels: GameObjects.Text[] = [];
    for (let i = 0; i < LOG_LINES; i++)
    {
        const y = ctx.bgBottomY - (i * LOG_STEP + LOG_BASE_Y);
        const label = ctx.scene.add
            .text(logLeft, y, '', {
                fontFamily: UI_FONT_FAMILY,
                resolution: UI_TEXT_RESOLUTION,
                fontSize: `${UI_FONT_SIZE.COMMON_3}px`,
                color: '#ffffff',
                wordWrap: uiWordWrap(logWidth),
            })
            .setOrigin(0, 1);
        ctx.content.add(label);
        logLabels.push(label);
    }

    const logBuf: BattleLogEntry[] = [];
    const paintLogs = () =>
    {
        for (let i = 0; i < LOG_LINES; i++)
        {
            const entry = logBuf[i];
            const label = logLabels[i]!;
            if (entry)
            {
                label.setText(entry.text);
                label.setColor(entry.color ?? '#ffffff');
            }
            else
            {
                label.setText('');
            }
        }
    };

    const totalMon = monsters.length;
    const bar = placeBottomProgress(ctx);
    bar.setPct(0);
    bar.setCount(totalMon, totalMon);

    let finished = false;
    let resultShown = false;
    let lastEntryLen = 0;
    let lastAlive = totalMon;
    let endTimer: Phaser.Time.TimerEvent | null = null;

    // Seed initial logs already pushed by startBattle.
    const seed = getActiveBattle();
    if (seed)
    {
        for (const e of seed.sum.entries)
        {
            logBuf.unshift(e);
        }
        if (logBuf.length > LOG_LINES)
        {
            logBuf.length = LOG_LINES;
        }
        lastEntryLen = seed.sum.entries.length;
        paintLogs();
    }

    const showResult = (win: boolean) =>
    {
        if (resultShown)
        {
            return;
        }
        resultShown = true;
        finished = true;

        // Original: roomEnd happens when battle ends, then after ~2s show end view.
        // End view: des "你成功地消灭了僵尸", 消耗/损失, button "下一个房间" → updateView (next room).
        // Defeat: leave battle node (back to site).
        const sum = getActiveBattle()?.sum;
        if (win)
        {
            roomEnd(siteId, true);
        }

        const endDelay = ctx.scene.time.delayedCall(1800, () =>
        {
            if (!ctx.scene.sys.isActive())
            {
                return;
            }
            // Clear process UI (logs/bar) for end summary.
            ctx.content.removeAll(true);

            const site = getSite(siteId);
            const cfg = getSiteConfig(siteId);
            const name = cfg?.name ?? '战斗';
            const prog =
                site && site.rooms.length > 0
                    ? `进度:${Math.min(site.step + 1, site.rooms.length)}/${site.rooms.length}`
                    : '';
            placeChromeCaptions(ctx, name, prog, siteStorageCount(siteId));

            // Keep dig art on end view (original keeps dig_des).
            const digName = `monster_dig_${Math.max(1, Math.min(12, difficulty))}.png`;
            const belowDig = placeDigHeader(ctx, digName, 'dig_monster');

            // des: 你成功地消灭了僵尸 / 失败
            ctx.content.add(
                ctx.scene.add
                    .text(
                        ctx.width / 2,
                        belowDig + 16,
                        win ? '你成功地消灭了僵尸' : '战斗失败',
                        {
                            fontFamily: UI_FONT_FAMILY,
                            resolution: UI_TEXT_RESOLUTION,
                            fontSize: `${UI_FONT_SIZE.COMMON_2}px`,
                            color: '#ffffff',
                        },
                    )
                    .setOrigin(0.5, 0),
            );

            const left = ctx.width / 2 - ctx.bgWidth / 2 + CONTENT_LEFT;
            let y = ctx.bgBottomY - 400;

            // 消耗: bullets
            const usedBullets = sum?.bulletsUsed ?? 0;
            ctx.content.add(
                ctx.scene.add
                    .text(left, y, usedBullets > 0 ? `消耗: 子弹×${usedBullets}` : '消耗: 无', {
                        fontFamily: UI_FONT_FAMILY,
                        resolution: UI_TEXT_RESOLUTION,
                        fontSize: `${UI_FONT_SIZE.COMMON_3}px`,
                        color: '#ffffff',
                    })
                    .setOrigin(0, 0),
            );
            y += 28;

            // 损失: 生命 N
            const harm = sum?.playerHarm ?? 0;
            ctx.content.add(
                ctx.scene.add
                    .text(left, y, `损失: 生命 ${harm}`, {
                        fontFamily: UI_FONT_FAMILY,
                        resolution: UI_TEXT_RESOLUTION,
                        fontSize: `${UI_FONT_SIZE.COMMON_3}px`,
                        color: '#ffffff',
                    })
                    .setOrigin(0, 0),
            );

            const nextRoom = currentRoom(siteId);
            const siteEnded = Boolean(getSite(siteId)?.ended) || !nextRoom;

            if (win && !siteEnded && nextRoom)
            {
                // 1060 下一个房间 → stay on BattleAndWorkNode, load next room view.
                const btn = addAtlasButton(ctx.scene, ctx.width / 2, ctx.bgBottomY - 60, {
                    atlas: 'ui',
                    frame: 'btn_common_white_normal.png',
                    label: '下一个房间',
                    onClick: () =>
                    {
                        clearBattle();
                        // Re-enter this node so begin/process rebuilds for the new room.
                        ctx.replace(NavNode.BATTLE_AND_WORK, siteId);
                    },
                });
                ctx.scene.children.remove(btn);
                ctx.content.add(btn);
            }
            else
            {
                // Site fully cleared, or defeat → leave battle node.
                const btn = addAtlasButton(ctx.scene, ctx.width / 2, ctx.bgBottomY - 60, {
                    atlas: 'ui',
                    frame: 'btn_common_white_normal.png',
                    label: win ? '离开' : '撤退',
                    onClick: () =>
                    {
                        clearBattle();
                        ctx.back();
                    },
                });
                ctx.scene.children.remove(btn);
                ctx.content.add(btn);
            }
        });

        endTimer = endDelay;
    };

    return {
        update: (deltaMs: number) =>
        {
            if (finished)
            {
                return;
            }
            const battle = getActiveBattle();
            if (battle)
            {
                while (lastEntryLen < battle.sum.entries.length)
                {
                    const e = battle.sum.entries[lastEntryLen]!;
                    logBuf.unshift(e);
                    if (logBuf.length > LOG_LINES)
                    {
                        logBuf.length = LOG_LINES;
                    }
                    lastEntryLen += 1;
                }
                paintLogs();

                const alive = battle.monsters.filter((m) => !m.dead && m.hp > 0).length;
                if (alive !== lastAlive)
                {
                    lastAlive = alive;
                    bar.setCount(alive, totalMon);
                    bar.setPct(totalMon > 0 ? (totalMon - alive) / totalMon : 0);
                }
            }
            const result = tickBattle(deltaMs / 1000);
            if (result)
            {
                const b = getActiveBattle();
                if (b)
                {
                    while (lastEntryLen < b.sum.entries.length)
                    {
                        logBuf.unshift(b.sum.entries[lastEntryLen]!);
                        if (logBuf.length > LOG_LINES)
                        {
                            logBuf.length = LOG_LINES;
                        }
                        lastEntryLen += 1;
                    }
                    paintLogs();
                }
                showResult(result.win);
            }
        },
        destroy: () =>
        {
            endTimer?.remove(false);
            if (!finished && getActiveBattle()?.running)
            {
                forceEndBattle(false);
            }
            clearBattle();
        },
    };
}
