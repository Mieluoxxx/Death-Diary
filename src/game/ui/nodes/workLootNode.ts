/**
 * WorkRoomStorageNode — faithful port of:
 *   Buried-City/src/ui/workRoomStorageNode.js
 *   + EquipNode + ItemChangeNode(smallSize=true, withTakeAll=true)
 *
 * Cocos layout (bg 596×839, y-up from bg bottom):
 * - EquipNode 572×100, anchor top-center @ (bgW/2, contentTop=770)
 * - ItemChangeNode 596×570, anchor bottom-center @ (bgW/2, 100)
 *   - top half: 背包 section + bag table
 *   - bottom half: 箱子/桌子/柜子 section + take-all + loot table
 * - 下一个房间 white btn @ (bgW/2, 60)
 */

import { HAND_ITEM_ID } from '../../data/itemConfig';
import { getSession } from '../../session/sessionStore';
import {
    getBagCapacity,
    getBagWeight,
    transferAll,
    transferItems,
    type EquipPos,
} from '../../systems/inventory';
import {
    currentRoom,
    flushTempToSite,
    getSite,
} from '../../systems/mapSystem';
import { gameBusOn, gameBusOff } from '../../systems/gameBus';
import type { NodeMountContext, NodeMountResult } from '../navigation';
import { NavNode } from '../navigation';
import {
    mountItemGrid,
    transferFailMessage,
    ITEM_GRID_COLUMNS,
} from './itemGrid';
import {
    UI_FONT_FAMILY,
    UI_FONT_SIZE,
    UI_TEXT_RESOLUTION,
} from '../uiFont';
import { addAtlasButton } from '../atlasButton';

const WORK_TITLES = ['箱子', '桌子', '柜子'];

/** Empty-slot placeholder frames (equipNode.updateTabView). */
const EMPTY_SLOT_FRAME: Record<EquipPos, string> = {
    0: 'icon_tab_gun.png',
    1: 'icon_tab_weapon.png',
    2: 'icon_tab_equip.png',
    3: 'icon_tab_tool.png',
};

export type WorkLootUserData = {
    siteId: number;
    workType: number;
};

function parseUserData (raw: unknown): WorkLootUserData
{
    if (raw && typeof raw === 'object' && 'siteId' in raw)
    {
        const o = raw as { siteId: number; workType?: number };
        return {
            siteId: Number(o.siteId),
            workType: typeof o.workType === 'number' ? o.workType : 0,
        };
    }
    // Legacy: plain siteId number
    const siteId = Number(raw);
    const site = getSite(siteId);
    let workType = 0;
    if (site && site.step > 0)
    {
        const prev = site.rooms[site.step - 1];
        if (prev?.type === 'work')
        {
            workType = prev.workType ?? 0;
        }
    }
    return { siteId, workType };
}

export function mountWorkLootNode (ctx: NodeMountContext): NodeMountResult
{
    const { siteId, workType } = parseUserData(ctx.userData);
    const boxTitle = WORK_TITLES[Math.max(0, Math.min(2, workType))] ?? '箱子';

    ctx.setTitle(boxTitle);
    ctx.setLeftEnabled(true);
    ctx.setRightEnabled(false);

    // Absolute bg coords (no content nudge) — match Cocos bg children.
    const bgLeft = ctx.width / 2 - ctx.bgWidth / 2;
    const bgBottom = ctx.bgBottomY;
    const contentTopY = bgBottom - 770; // Phaser y of contentTopLine (top of content area)

    // ---------- EquipNode: 572×100, top at contentTop ----------
    const equipW = 572;
    const equipH = 100;
    const tabBgW = 110;
    const tabBgH = 73;
    const tabCount = 4;
    const pad = (equipW - tabCount * tabBgW) / (tabCount + 1);
    const equipLeft = ctx.width / 2 - equipW / 2;
    // EquipNode top edge at contentTop; center of node = contentTop + equipH/2
    const equipCy = contentTopY + equipH / 2;

    const session = getSession();
    ([0, 1, 2, 3] as EquipPos[]).forEach((pos, i) =>
    {
        const x = equipLeft + pad * (i + 1) + tabBgW * (i + 0.5);
        if (ctx.scene.textures.exists('ui') && ctx.scene.textures.get('ui').has('build_icon_bg.png'))
        {
            ctx.content.add(ctx.scene.add.image(x, equipCy, 'ui', 'build_icon_bg.png'));
        }
        else
        {
            ctx.content.add(ctx.scene.add.rectangle(x, equipCy, tabBgW, tabBgH, 0x3a3a3a));
        }

        // equipNode.updateTabView icon selection
        const itemId = session?.equip[pos] ?? 0;
        let frame = EMPTY_SLOT_FRAME[pos];
        if (itemId === HAND_ITEM_ID)
        {
            frame = 'icon_tab_hand.png';
        }
        else if (itemId)
        {
            const tab = `icon_tab_${itemId}.png`;
            if (ctx.scene.textures.exists('gate') && ctx.scene.textures.get('gate').has(tab))
            {
                frame = tab;
            }
        }
        if (ctx.scene.textures.exists('gate') && ctx.scene.textures.get('gate').has(frame))
        {
            ctx.content.add(ctx.scene.add.image(x, equipCy, 'gate', frame));
        }
    });

    // ---------- ItemChangeNode smallSize 596×570, bottom at y=100 ----------
    // Phaser: bottom edge at bgBottom-100, height 570 → top at bgBottom-100-570
    const changeH = 570;
    const changeBottomY = bgBottom - 100;
    const changeTopY = changeBottomY - changeH;
    const halfH = changeH / 2;
    // frame_section_bg is 45px tall in art
    const sectionH = 45;
    const gridWidth = 550;
    const gridLeft = bgLeft + (ctx.bgWidth - gridWidth) / 2;

    // Top half: bag (anchor top of ItemChange)
    const bagSectionCy = changeTopY + sectionH / 2;
    addSectionBar(ctx, bgLeft, bagSectionCy, ctx.bgWidth, '背包');

    // string 1028: "重量 %s"  with current/total; red when full
    const weightText = ctx.scene.add
        .text(bgLeft + ctx.bgWidth - 18, bagSectionCy, '', {
            fontFamily: UI_FONT_FAMILY,
            resolution: UI_TEXT_RESOLUTION,
            fontSize: `${UI_FONT_SIZE.COMMON_2}px`,
            color: '#111111',
        })
        .setOrigin(1, 0.5);
    ctx.content.add(weightText);

    const bagGrid = mountItemGrid(ctx.scene, ctx.content, {
        x: gridLeft,
        y: changeTopY + sectionH + 4,
        width: gridWidth,
        height: halfH - sectionH - 14,
        columns: ITEM_GRID_COLUMNS,
        getCounts: () => getSession()?.bag ?? {},
        emptyText: '',
        compact: true,
        onTap: (itemId) =>
        {
            const res = transferItems('bag', 'temp', itemId, 1, siteId);
            if (!res.ok)
            {
                ctx.showToast(transferFailMessage(res));
            }
            refresh();
        },
    });

    // Bottom half: box/desk/cabinet
    const boxSectionCy = changeTopY + halfH + sectionH / 2;
    addSectionBar(ctx, bgLeft, boxSectionCy, ctx.bgWidth, boxTitle);

    // createCommonBtnBlack on section: right side, hand icon as child of button.
    // Button size 158×45; place center near right of section with 20px margin.
    const takeAll = addAtlasButton(ctx.scene, bgLeft + ctx.bgWidth - 20 - 79, boxSectionCy, {
        atlas: 'ui',
        frame: 'btn_common_black_normal.png',
        label: '全部拿取',
        labelColor: '#f5f0e6',
        labelSizeTier: 'COMMON_3',
        onClick: () =>
        {
            const { moved, blocked } = transferAll('temp', 'bag', siteId);
            if (blocked > 0)
            {
                ctx.showToast(`拿取${moved}，负重不足剩余${blocked}`);
            }
            refresh();
        },
    });
    ctx.scene.children.remove(takeAll);
    ctx.content.add(takeAll);

    // Original: btnIcon at (27, height/2) of button, labelAnchor (0.3, 0.5).
    // Shift label right so hand icon fits on the left of the black button.
    if (takeAll.list[1] && 'setOrigin' in takeAll.list[1])
    {
        const label = takeAll.list[1] as Phaser.GameObjects.Text;
        label.setOrigin(0.3, 0.5);
        label.setX(18);
    }
    if (
        ctx.scene.textures.exists('ui')
        && ctx.scene.textures.get('ui').has('btn_icon_take_all.png')
    )
    {
        const hand = ctx.scene.add
            .image(-52, 0, 'ui', 'btn_icon_take_all.png')
            .setOrigin(0.5);
        takeAll.add(hand);
        takeAll.sendToBack(hand);
        // keep black bg under hand: reorder — bg first, hand, label
        const bg = takeAll.list[0];
        if (bg)
        {
            takeAll.sendToBack(bg);
        }
        takeAll.bringToTop(hand);
        if (takeAll.list[1] && takeAll.list[1] !== hand && takeAll.list[1] !== bg)
        {
            takeAll.bringToTop(takeAll.list[1]);
        }
    }

    const lootGrid = mountItemGrid(ctx.scene, ctx.content, {
        x: gridLeft,
        y: changeTopY + halfH + sectionH + 4,
        width: gridWidth,
        height: halfH - sectionH - 14,
        columns: ITEM_GRID_COLUMNS,
        getCounts: () => getSession()?.tempLoot ?? {},
        emptyText: '',
        compact: true,
        onTap: (itemId) =>
        {
            const res = transferItems('temp', 'bag', itemId, 1, siteId);
            if (!res.ok)
            {
                ctx.showToast(transferFailMessage(res));
            }
            refresh();
        },
    });

    // 下一个房间 @ (bgW/2, 60) — original always this label.
    const nextBtn = addAtlasButton(ctx.scene, ctx.width / 2, bgBottom - 60, {
        atlas: 'ui',
        frame: 'btn_common_white_normal.png',
        label: '下一个房间',
        onClick: () =>
        {
            flushTempToSite(siteId);
            const next = currentRoom(siteId);
            const ended = Boolean(getSite(siteId)?.ended) || !next;
            if (ended)
            {
                // Original updateView schedules back when site ended.
                ctx.back();
            }
            else
            {
                ctx.replace(NavNode.BATTLE_AND_WORK, siteId);
            }
        },
    });
    ctx.scene.children.remove(nextBtn);
    ctx.content.add(nextBtn);

    const refresh = () =>
    {
        const live = getSession();
        if (!live)
        {
            return;
        }
        const cur = getBagWeight(live);
        const max = getBagCapacity(live);
        // string 1028: "重量 %s"
        weightText.setText(`重量 ${cur}/${max}`);
        weightText.setColor(cur >= max ? '#ff3333' : '#111111');
        bagGrid.refresh();
        lootGrid.refresh();
    };
    refresh();
    const onSession = () => refresh();
    gameBusOn('session_updated', onSession);

    return {
        onLeft: () =>
        {
            flushTempToSite(siteId);
            ctx.back();
        },
        destroy: () =>
        {
            gameBusOff('session_updated', onSession);
            bagGrid.destroy();
            lootGrid.destroy();
        },
    };
}

function addSectionBar (
    ctx: NodeMountContext,
    left: number,
    centerY: number,
    width: number,
    title: string,
): void
{
    const cx = left + width / 2;
    if (ctx.scene.textures.exists('ui') && ctx.scene.textures.get('ui').has('frame_section_bg.png'))
    {
        const bar = ctx.scene.add.image(cx, centerY, 'ui', 'frame_section_bg.png');
        // Original section sprite natural size; stretch to content width like gate.
        bar.setDisplaySize(Math.min(width - 12, 584), 45);
        ctx.content.add(bar);
    }
    else
    {
        ctx.content.add(
            ctx.scene.add.rectangle(cx, centerY, width - 12, 45, 0xe8e0d0),
        );
    }
    // name at x=10 of section, black COMMON_2
    ctx.content.add(
        ctx.scene.add
            .text(left + 16, centerY, title, {
                fontFamily: UI_FONT_FAMILY,
                resolution: UI_TEXT_RESOLUTION,
                fontSize: `${UI_FONT_SIZE.COMMON_2}px`,
                color: '#111111',
            })
            .setOrigin(0, 0.5),
    );
}
