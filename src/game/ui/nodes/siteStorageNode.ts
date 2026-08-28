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

import { getSiteConfig } from '../../data/siteConfig';
import { getSession } from '../../session/sessionStore';
import { Sound, playEffect } from '../../systems/audioManager';
import { gameBusOff, gameBusOn } from '../../systems/gameBus';
import { getBagCapacity, getBagWeight, transferAll, transferItems } from '../../systems/inventory';
import { mountEquipStrip } from '../equipStrip';
import { addTakeAllButton } from '../takeAllButton';
import type { NodeMountContext, NodeMountResult } from '../navigation';
import { openQuantityDialog } from '../quantityDialog';
import { addSectionBar } from '../sectionBar';
import { UI_FONT_FAMILY, UI_FONT_SIZE, UI_TEXT_RESOLUTION } from '../uiFont';
import { ITEM_GRID_COLUMNS, mountItemGrid, transferFailMessage } from './itemGrid';
export function mountSiteStorageNode(ctx: NodeMountContext): NodeMountResult {
    const siteId = Number(ctx.userData);
    const cfg = getSiteConfig(siteId);
    // Original: title = site.getName(), left-aligned like SiteNode.
    ctx.setTitle(cfg?.name ?? `地点${siteId}`, { align: 'left' });
    ctx.setLeftEnabled(true);
    ctx.setRightEnabled(false);
    playEffect(Sound.EXCHANGE);

    const bgLeft = ctx.width / 2 - ctx.bgWidth / 2;
    const bgBottom = ctx.bgBottomY;
    const contentTopY = bgBottom - 770;

    const equip = mountEquipStrip(ctx, {
        topY: contentTopY,
        onChanged: () => refresh(),
    });

    // ---------- ItemChangeNode full 596×670, bottom at y=0 ----------
    const changeH = 670;
    const changeBottomY = bgBottom;
    const changeTopY = changeBottomY - changeH;
    const halfH = changeH / 2;
    const sectionH = 45;
    const gridWidth = 550;
    const gridLeft = bgLeft + (ctx.bgWidth - gridWidth) / 2;

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
        onTap: (itemId) => {
            equip.closeDropDown();
            const res = transferItems('bag', 'site', itemId, 1, siteId);
            if (!res.ok) {
                ctx.showToast(transferFailMessage(res));
            }
            refresh();
        },
        onInspect: (itemId) => {
            equip.closeDropDown();
            openQuantityDialog(ctx.scene, itemId, getSession()?.bag?.[itemId] ?? 1, (amount) => {
                const res = transferItems('bag', 'site', itemId, amount, siteId);
                if (!res.ok) {
                    ctx.showToast(transferFailMessage(res));
                }
                refresh();
            });
        },
    });

    const siteSectionCy = changeTopY + halfH + sectionH / 2;
    addSectionBar(ctx, bgLeft, siteSectionCy, ctx.bgWidth, '物品存放点');

    const takeAll = addTakeAllButton(
        ctx.scene,
        bgLeft + ctx.bgWidth - 20 - 79,
        siteSectionCy,
        () => {
            equip.closeDropDown();
            const { moved, blocked } = transferAll('site', 'bag', siteId);
            if (blocked > 0) {
                ctx.showToast(`拿取${moved}，负重不足剩余${blocked}`);
            }
            refresh();
        },
    );
    ctx.scene.children.remove(takeAll);
    ctx.content.add(takeAll);

    const siteGrid = mountItemGrid(ctx.scene, ctx.content, {
        x: gridLeft,
        y: changeTopY + halfH + sectionH + 4,
        width: gridWidth,
        height: halfH - sectionH - 14,
        columns: ITEM_GRID_COLUMNS,
        getCounts: () => getSession()?.map.sites[siteId]?.storage ?? {},
        emptyText: '',
        compact: true,
        onTap: (itemId) => {
            equip.closeDropDown();
            const res = transferItems('site', 'bag', itemId, 1, siteId);
            if (!res.ok) {
                ctx.showToast(transferFailMessage(res));
            }
            refresh();
        },
        onInspect: (itemId) => {
            equip.closeDropDown();
            openQuantityDialog(
                ctx.scene,
                itemId,
                getSession()?.map.sites[siteId]?.storage?.[itemId] ?? 1,
                (amount) => {
                    const res = transferItems('site', 'bag', itemId, amount, siteId);
                    if (!res.ok) {
                        ctx.showToast(transferFailMessage(res));
                    }
                    refresh();
                },
            );
        },
    });

    const refresh = () => {
        const live = getSession();
        if (!live) {
            return;
        }
        const cur = getBagWeight(live);
        const max = getBagCapacity(live);
        weightText.setText(`重量 ${cur}/${max}`);
        weightText.setColor(cur >= max ? '#ff3333' : '#111111');
        equip.refresh();
        bagGrid.refresh();
        siteGrid.refresh();
    };
    refresh();
    const onSession = () => refresh();
    gameBusOn('session_updated', onSession);

    return {
        onLeft: () => {
            equip.closeDropDown();
            ctx.back();
        },
        destroy: () => {
            gameBusOff('session_updated', onSession);
            equip.destroy();
            bagGrid.destroy();
            siteGrid.destroy();
        },
    };
}
