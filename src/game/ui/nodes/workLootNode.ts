/**
 * WorkRoomStorageNode — temp loot → bag, leftovers flush to site storage.
 */

import { getSession } from '../../session/sessionStore';
import {
    getBagCapacity,
    getBagWeight,
    transferAll,
    transferItems,
} from '../../systems/inventory';
import { flushTempToSite } from '../../systems/mapSystem';
import { gameBusOn, gameBusOff } from '../../systems/gameBus';
import type { NodeMountContext, NodeMountResult } from '../navigation';
import {
    mountItemGrid,
    transferFailMessage,
} from './itemGrid';
import { UI_FONT_FAMILY, UI_TEXT_RESOLUTION } from '../uiFont';
import { addAtlasButton } from '../atlasButton';

export function mountWorkLootNode (ctx: NodeMountContext): NodeMountResult
{
    const siteId = Number(ctx.userData);
    ctx.setTitle('搜刮收获');
    ctx.setLeftEnabled(true);
    ctx.setRightEnabled(false);

    const topY = ctx.toScreenY(770);
    const info = ctx.scene.add
        .text(ctx.width / 2, topY + 10, '', {
            fontFamily: UI_FONT_FAMILY,
            resolution: UI_TEXT_RESOLUTION,
            fontSize: '14px',
            color: '#cccccc',
        })
        .setOrigin(0.5, 0);
    ctx.content.add(info);

    const lootGrid = mountItemGrid(ctx.scene, ctx.content, {
        x: ctx.width / 2 - ctx.bgWidth / 2 + 16,
        y: topY + 48,
        width: ctx.bgWidth - 32,
        height: 400,
        getCounts: () => getSession()?.tempLoot ?? {},
        emptyText: '已全部拿走',
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

    const takeAll = addAtlasButton(ctx.scene, ctx.width / 2, topY + 480, {
        atlas: 'ui',
        frame: 'btn_common_white_normal.png',
        label: '全部拿走',
        onClick: () =>
        {
            const { moved, blocked } = transferAll('temp', 'bag', siteId);
            if (blocked > 0)
            {
                ctx.showToast(`拿取${moved}，负重不足剩余${blocked}`);
            }
            else
            {
                ctx.showToast(`拿走${moved}件`);
            }
            refresh();
        },
    });
    ctx.scene.children.remove(takeAll);
    ctx.content.add(takeAll);

    const refresh = () =>
    {
        const live = getSession();
        if (!live)
        {
            return;
        }
        info.setText(`点选装入背包　负重 ${getBagWeight(live)}/${getBagCapacity(live)}`);
        lootGrid.refresh();
    };
    refresh();
    const onSession = () => refresh();
    gameBusOn('session_updated', onSession);

    const leave = () =>
    {
        flushTempToSite(siteId);
        ctx.back();
    };

    return {
        onLeft: leave,
        destroy: () =>
        {
            gameBusOff('session_updated', onSession);
            lootGrid.destroy();
        },
    };
}
