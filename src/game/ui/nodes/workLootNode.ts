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

import { getSession } from '../../session/sessionStore';
import { playEffect, Sound } from '../../systems/audioManager';
import { gameBusOff, gameBusOn } from '../../systems/gameBus';
import { getBagCapacity, getBagWeight, transferAll, transferItems } from '../../systems/inventory';
import { currentRoom, flushTempToSite, getSite } from '../../systems/mapSystem';
import { advanceGuide, GuideStep, isGuideStep, onGuideChanged } from '../../systems/userGuide';
import { addAtlasButton } from '../atlasButton';
import { mountEquipStrip } from '../equipStrip';
import { createItemDetailModel } from '../itemDetailContext';
import { openItemDetailDialog } from '../itemDialog';
import type { NodeMountContext, NodeMountResult } from '../navigation';
import { NavNode } from '../navigation';
import { addSectionBar } from '../sectionBar';
import { UI_FONT_FAMILY, UI_FONT_SIZE, UI_TEXT_RESOLUTION } from '../uiFont';
import { addGuideWarn, type GuideWarnHandle } from '../userGuideUi';
import { ITEM_GRID_COLUMNS, mountItemGrid, transferFailMessage } from './itemGrid';

const WORK_TITLES = ['箱子', '桌子', '柜子'];

export type WorkLootUserData = {
    siteId: number;
    workType: number;
};
export function mountWorkLootNode(ctx: NodeMountContext): NodeMountResult {
    const { siteId, workType } = ctx.userData as WorkLootUserData;
    const boxTitle = WORK_TITLES[Math.max(0, Math.min(2, workType))] ?? '箱子';

    ctx.setTitle(boxTitle);
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

    // ---------- ItemChangeNode smallSize 596×570, bottom at y=100 ----------
    const changeH = 570;
    const changeBottomY = bgBottom - 100;
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
        onTap: (itemId) => {
            equip.closeDropDown();
            const res = transferItems('bag', 'temp', itemId, 1, siteId);
            if (!res.ok) {
                ctx.showToast(transferFailMessage(res));
            }
            refresh();
        },
        onInspect: (itemId) => {
            equip.closeDropDown();
            openItemDetailDialog(
                ctx.scene,
                createItemDetailModel(
                    itemId,
                    { kind: 'bag' },
                    {
                        onToast: (msg) => ctx.showToast(msg),
                    },
                ),
            );
        },
    });

    const boxSectionCy = changeTopY + halfH + sectionH / 2;
    addSectionBar(ctx, bgLeft, boxSectionCy, ctx.bgWidth, boxTitle);

    const takeAll = addAtlasButton(ctx.scene, bgLeft + ctx.bgWidth - 20 - 79, boxSectionCy, {
        atlas: 'ui',
        frame: 'btn_common_black_normal.png',
        label: '全部拿取',
        labelColor: '#f5f0e6',
        labelSizeTier: 'COMMON_3',
        onClick: () => {
            equip.closeDropDown();
            const { moved, blocked } = transferAll('temp', 'bag', siteId);
            if (moved > 0) {
                advanceGuide(GuideStep.ALL_GET);
            }
            if (blocked > 0) {
                ctx.showToast(`拿取${moved}，负重不足剩余${blocked}`);
            }
            refresh();
        },
    });
    ctx.scene.children.remove(takeAll);
    ctx.content.add(takeAll);

    if (takeAll.list[1] && 'setOrigin' in takeAll.list[1]) {
        const label = takeAll.list[1] as Phaser.GameObjects.Text;
        label.setOrigin(0.3, 0.5);
        label.setX(18);
    }
    if (
        ctx.scene.textures.exists('ui') &&
        ctx.scene.textures.get('ui').has('btn_icon_take_all.png')
    ) {
        const hand = ctx.scene.add.image(-52, 0, 'ui', 'btn_icon_take_all.png').setOrigin(0.5);
        takeAll.add(hand);
        const bg = takeAll.list[0];
        if (bg) {
            takeAll.sendToBack(bg);
        }
        takeAll.bringToTop(hand);
        if (takeAll.list[1] && takeAll.list[1] !== hand && takeAll.list[1] !== bg) {
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
        onTap: (itemId) => {
            equip.closeDropDown();
            const res = transferItems('temp', 'bag', itemId, 1, siteId);
            if (!res.ok) {
                ctx.showToast(transferFailMessage(res));
            }
            refresh();
        },
        onInspect: (itemId) => {
            equip.closeDropDown();
            openItemDetailDialog(ctx.scene, createItemDetailModel(itemId, { kind: 'temp' }));
        },
    });

    const nextBtn = addAtlasButton(ctx.scene, ctx.width / 2, bgBottom - 60, {
        atlas: 'ui',
        frame: 'btn_common_white_normal.png',
        label: '下一个房间',
        onClick: () => {
            advanceGuide(GuideStep.BACK_ROOM);
            equip.closeDropDown();
            flushTempToSite(siteId);
            const next = currentRoom(siteId);
            const ended = Boolean(getSite(siteId)?.ended) || !next;
            if (ended) {
                ctx.back();
            } else {
                ctx.replace(NavNode.BATTLE_AND_WORK, siteId);
            }
        },
    });
    ctx.scene.children.remove(nextBtn);
    ctx.content.add(nextBtn);
    let guideWarn: GuideWarnHandle | null = null;
    const refreshGuide = () => {
        guideWarn?.destroy();
        guideWarn = null;
        if (isGuideStep(GuideStep.ALL_GET)) {
            guideWarn = addGuideWarn(ctx.scene, takeAll);
        } else if (isGuideStep(GuideStep.BACK_ROOM)) {
            guideWarn = addGuideWarn(ctx.scene, nextBtn);
        }
    };
    const stopGuideListener = onGuideChanged(refreshGuide);
    refreshGuide();

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
        lootGrid.refresh();
    };
    refresh();
    const onSession = () => refresh();
    gameBusOn('session_updated', onSession);

    return {
        onLeft: () => {
            equip.closeDropDown();
            flushTempToSite(siteId);
            ctx.back();
        },
        destroy: () => {
            stopGuideListener();
            guideWarn?.destroy();
            guideWarn = null;
            gameBusOff('session_updated', onSession);
            equip.destroy();
            bagGrid.destroy();
            lootGrid.destroy();
        },
    };
}
