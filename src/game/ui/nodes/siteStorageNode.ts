/**
 * SiteStorageNode — port of Buried-City siteStorageNode.js:
 *   EquipNode (top) + ItemChangeNode(bag, 物品存放点, withTakeAll)
 *
 * Layout (bg 596×839, y-up from bg bottom):
 * - EquipNode 572×100, top @ contentTop (770)
 * - ItemChangeNode 596×670, bottom @ 0
 *   - top half: 背包 + weight
 *   - bottom half: 物品存放点 + 全部拿取
 */

import { HAND_ITEM_ID } from '../../data/itemConfig';
import { getSiteConfig } from '../../data/siteConfig';
import { getSession } from '../../session/sessionStore';
import { gameBusOff, gameBusOn } from '../../systems/gameBus';
import {
    type EquipPos,
    getBagCapacity,
    getBagWeight,
    transferAll,
    transferItems,
} from '../../systems/inventory';
import { addAtlasButton } from '../atlasButton';
import type { NodeMountContext, NodeMountResult } from '../navigation';
import {
    UI_FONT_FAMILY,
    UI_FONT_SIZE,
    UI_TEXT_RESOLUTION,
} from '../uiFont';
import {
    ITEM_GRID_COLUMNS,
    mountItemGrid,
    transferFailMessage,
} from './itemGrid';

/** Empty-slot placeholder frames (equipNode.updateTabView). */
const EMPTY_SLOT_FRAME: Record<EquipPos, string> = {
    0: 'icon_tab_gun.png',
    1: 'icon_tab_weapon.png',
    2: 'icon_tab_equip.png',
    3: 'icon_tab_tool.png',
};

export function mountSiteStorageNode (ctx: NodeMountContext): NodeMountResult
{
    const siteId = Number(ctx.userData);
    const cfg = getSiteConfig(siteId);
    // Original: title = site.getName()
    ctx.setTitle(cfg?.name ?? `地点${siteId}`);
    ctx.setLeftEnabled(true);
    ctx.setRightEnabled(false);

    const bgLeft = ctx.width / 2 - ctx.bgWidth / 2;
    const bgBottom = ctx.bgBottomY;
    const contentTopY = bgBottom - 770;

    // ---------- EquipNode: 572×100, top at contentTop ----------
    const equipW = 572;
    const equipH = 100;
    const tabBgW = 110;
    const tabBgH = 73;
    const tabCount = 4;
    const pad = (equipW - tabCount * tabBgW) / (tabCount + 1);
    const equipLeft = ctx.width / 2 - equipW / 2;
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

    // ---------- ItemChangeNode full 596×670, bottom at y=0 ----------
    // Phaser: bottom edge at bgBottom, height 670 → top at bgBottom - 670
    const changeH = 670;
    const changeBottomY = bgBottom;
    const changeTopY = changeBottomY - changeH;
    const halfH = changeH / 2;
    const sectionH = 45;
    const gridWidth = 550;
    const gridLeft = bgLeft + (ctx.bgWidth - gridWidth) / 2;

    // Top half: bag
    const bagSectionCy = changeTopY + sectionH / 2;
    addSectionBar(ctx, bgLeft, bagSectionCy, ctx.bgWidth, '背包');

    const weightText = ctx.scene.add
        .text(bgLeft + ctx.bgWidth - 18, bagSectionCy, '', {
            fontFamily: UI_FONT_FAMILY,
            resolution: UI_TEXT_RESOLUTION,
            fontSize: `${UI_FONT_SIZE.COMMON_2 + 4}px`,
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
            const res = transferItems('bag', 'site', itemId, 1, siteId);
            if (!res.ok)
            {
                ctx.showToast(transferFailMessage(res));
            }
            refresh();
        },
    });

    // Bottom half: 物品存放点 (string 1032)
    const siteSectionCy = changeTopY + halfH + sectionH / 2;
    addSectionBar(ctx, bgLeft, siteSectionCy, ctx.bgWidth, '物品存放点');

    // 全部拿取 on section right (original withTakeAll)
    const takeAll = addAtlasButton(ctx.scene, bgLeft + ctx.bgWidth - 20 - 79, siteSectionCy, {
        atlas: 'ui',
        frame: 'btn_common_black_normal.png',
        label: '全部拿取',
        labelColor: '#f5f0e6',
        labelSizeTier: 'COMMON_3',
        onClick: () =>
        {
            const { moved, blocked } = transferAll('site', 'bag', siteId);
            if (blocked > 0)
            {
                ctx.showToast(`拿取${moved}，负重不足剩余${blocked}`);
            }
            refresh();
        },
    });
    ctx.scene.children.remove(takeAll);
    ctx.content.add(takeAll);

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

    const siteGrid = mountItemGrid(ctx.scene, ctx.content, {
        x: gridLeft,
        y: changeTopY + halfH + sectionH + 4,
        width: gridWidth,
        height: halfH - sectionH - 14,
        columns: ITEM_GRID_COLUMNS,
        getCounts: () => getSession()?.map.sites[siteId]?.storage ?? {},
        emptyText: '',
        compact: true,
        onTap: (itemId) =>
        {
            const res = transferItems('site', 'bag', itemId, 1, siteId);
            if (!res.ok)
            {
                ctx.showToast(transferFailMessage(res));
            }
            refresh();
        },
    });

    const refresh = () =>
    {
        const live = getSession();
        if (!live)
        {
            return;
        }
        const cur = getBagWeight(live);
        const max = getBagCapacity(live);
        weightText.setText(`重量 ${cur}/${max}`);
        weightText.setColor(cur >= max ? '#ff3333' : '#111111');
        bagGrid.refresh();
        siteGrid.refresh();
    };
    refresh();
    const onSession = () => refresh();
    gameBusOn('session_updated', onSession);

    return {
        onLeft: () => ctx.back(),
        destroy: () =>
        {
            gameBusOff('session_updated', onSession);
            bagGrid.destroy();
            siteGrid.destroy();
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
        bar.setDisplaySize(Math.min(width - 12, 584), 45);
        ctx.content.add(bar);
    }
    else
    {
        ctx.content.add(
            ctx.scene.add.rectangle(cx, centerY, width - 12, 45, 0xe8e0d0),
        );
    }
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
