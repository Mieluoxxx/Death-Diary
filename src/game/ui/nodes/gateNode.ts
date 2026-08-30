/**
 * GateNode — EquipNode dropdown + ItemChangeNode bag/storage.
 *
 * Equip: shared mountEquipStrip (original createDropDownView).
 * ItemChange: bag ↔ home storage.
 */

import { getSession } from '../../session/sessionStore';
import { playEffect, Sound } from '../../systems/audioManager';
import { gameBusOff, gameBusOn } from '../../systems/gameBus';
import { getBagCapacity, getBagWeight, transferItems } from '../../systems/inventory';
import { playerOut } from '../../systems/mapSystem';
import { mountEquipStrip } from '../equipStrip';
import type { NodeMountContext, NodeMountResult } from '../navigation';
import { NavNode } from '../navigation';
import { openQuantityDialog } from '../quantityDialog';
import { addSectionBar } from '../sectionBar';
import { UI_FONT_SIZE, uiTextStyle } from '../uiFont';
import { ITEM_GRID_COLUMNS, mountItemGrid, transferFailMessage } from './itemGrid';

export function mountGateNode(ctx: NodeMountContext): NodeMountResult {
    ctx.setTitle('大门');
    ctx.setLeftEnabled(true);
    ctx.setRightEnabled(true);
    // Original GateNode._init: door close + ItemChangeNode exchange open.
    playEffect(Sound.CLOSE_DOOR);
    playEffect(Sound.EXCHANGE);
    const contentTop = ctx.toScreenY(770);
    const panelLeft = ctx.width / 2 - ctx.bgWidth / 2;
    const panelWidth = ctx.bgWidth;

    const equip = mountEquipStrip(ctx, {
        topY: contentTop,
        onChanged: () => refresh(),
    });

    // ItemChangeNode 50/50 bag vs storage.
    const changeTop = equip.bottomY;
    const changeBottom = ctx.bgBottomY - 6;
    const changeH = Math.max(400, changeBottom - changeTop);
    const halfH = changeH / 2;
    const sectionH = 45;
    const gridWidth = 550;
    const gridLeft = panelLeft + (panelWidth - gridWidth) / 2;

    const bagSectionY = changeTop + sectionH / 2;
    addSectionBar(ctx, panelLeft, bagSectionY, panelWidth, '背包');
    const weightText = ctx.scene.add
        .text(panelLeft + panelWidth - 18, bagSectionY, '', {
            ...uiTextStyle(UI_FONT_SIZE.COMMON_2 + 4),
            color: '#111111',
        })
        .setOrigin(1, 0.5);
    ctx.content.add(weightText);

    const bagGrid = mountItemGrid(ctx.scene, ctx.content, {
        x: gridLeft,
        y: changeTop + sectionH + 4,
        width: gridWidth,
        height: halfH - sectionH - 10,
        columns: ITEM_GRID_COLUMNS,
        getCounts: () => getSession()?.bag ?? {},
        emptyText: '',
        compact: true,
        onTap: (itemId) => {
            equip.closeDropDown();
            const res = transferItems('bag', 'storage', itemId, 1);
            if (!res.ok) {
                ctx.showToast(transferFailMessage(res));
            }
            refresh();
        },
        onInspect: (itemId) => {
            equip.closeDropDown();
            openQuantityDialog(ctx.scene, itemId, getSession()?.bag?.[itemId] ?? 1, (amount) => {
                const res = transferItems('bag', 'storage', itemId, amount);
                if (!res.ok) {
                    ctx.showToast(transferFailMessage(res));
                }
                refresh();
            });
        },
    });

    const storageSectionY = changeTop + halfH + sectionH / 2;
    addSectionBar(ctx, panelLeft, storageSectionY, panelWidth, '仓库');

    const storageGrid = mountItemGrid(ctx.scene, ctx.content, {
        x: gridLeft,
        y: changeTop + halfH + sectionH + 4,
        width: gridWidth,
        height: halfH - sectionH - 10,
        columns: ITEM_GRID_COLUMNS,
        getCounts: () => getSession()?.storage ?? {},
        emptyText: '',
        compact: true,
        onTap: (itemId) => {
            equip.closeDropDown();
            const res = transferItems('storage', 'bag', itemId, 1);
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
                getSession()?.storage?.[itemId] ?? 1,
                (amount) => {
                    const res = transferItems('storage', 'bag', itemId, amount);
                    if (!res.ok) {
                        ctx.showToast(transferFailMessage(res));
                    }
                    refresh();
                },
            );
        },
    });

    function refresh(): void {
        const live = getSession();
        if (!live) {
            return;
        }
        const cur = getBagWeight(live);
        const max = getBagCapacity(live);
        weightText.setText(`重量 ${cur}/${max}`);
        weightText.setColor(cur >= max ? '#aa0000' : '#111111');
        equip.refresh();
        bagGrid.refresh();
        storageGrid.refresh();
    }

    refresh();
    const onSession = () => refresh();
    gameBusOn('session_updated', onSession);

    return {
        onLeft: () => {
            equip.closeDropDown();
            ctx.back();
        },
        onRight: () => {
            equip.closeDropDown();
            playEffect(Sound.FOOT_STEP);
            playerOut();
            ctx.forward(NavNode.GATE_OUT);
        },
        destroy: () => {
            gameBusOff('session_updated', onSession);
            equip.destroy();
            bagGrid.destroy();
            storageGrid.destroy();
        },
    };
}
