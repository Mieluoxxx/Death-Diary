/**
 * SiteStorageNode — bag ↔ site storage.
 */

import { getSession } from '../../session/sessionStore';
import { gameBusOff, gameBusOn } from '../../systems/gameBus';
import {
    getBagCapacity,
    getBagWeight,
    transferAll,
    transferItems,
} from '../../systems/inventory';
import { addAtlasButton } from '../atlasButton';
import type { NodeMountContext, NodeMountResult } from '../navigation';
import { UI_FONT_FAMILY, UI_TEXT_RESOLUTION } from '../uiFont';
import {
    mountItemGrid,
    transferFailMessage,
} from './itemGrid';

export function mountSiteStorageNode (ctx: NodeMountContext): NodeMountResult
{
    const siteId = Number(ctx.userData);
    ctx.setTitle('地点仓库');
    ctx.setLeftEnabled(true);
    ctx.setRightEnabled(false);

    const topY = ctx.toScreenY(770);
    const info = ctx.scene.add
        .text(ctx.width / 2, topY + 8, '', {
            fontFamily: UI_FONT_FAMILY,
            resolution: UI_TEXT_RESOLUTION,
            fontSize: '14px',
            color: '#cccccc',
        })
        .setOrigin(0.5, 0);
    ctx.content.add(info);

    const colW = (ctx.bgWidth - 48) / 2;
    const leftX = ctx.width / 2 - ctx.bgWidth / 2 + 16;
    const rightX = leftX + colW + 16;
    const colTop = topY + 36;

    ctx.content.add(
        ctx.scene.add
            .text(leftX + colW / 2, colTop, '背包', {
                fontFamily: UI_FONT_FAMILY,
                resolution: UI_TEXT_RESOLUTION,
                fontSize: '14px',
                color: '#fff',
            })
            .setOrigin(0.5, 0),
    );
    ctx.content.add(
        ctx.scene.add
            .text(rightX + colW / 2, colTop, '地点仓库', {
                fontFamily: UI_FONT_FAMILY,
                resolution: UI_TEXT_RESOLUTION,
                fontSize: '14px',
                color: '#fff',
            })
            .setOrigin(0.5, 0),
    );

    const bagGrid = mountItemGrid(ctx.scene, ctx.content, {
        x: leftX,
        y: colTop + 24,
        width: colW,
        height: 400,
        columns: 2,
        getCounts: () => getSession()?.bag ?? {},
        emptyText: '空',
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

    const siteGrid = mountItemGrid(ctx.scene, ctx.content, {
        x: rightX,
        y: colTop + 24,
        width: colW,
        height: 400,
        columns: 2,
        getCounts: () => getSession()?.map.sites[siteId]?.storage ?? {},
        emptyText: '空',
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

    const takeAll = addAtlasButton(ctx.scene, ctx.width / 2, topY + 500, {
        atlas: 'ui',
        frame: 'btn_common_white_normal.png',
        label: '全部装入背包',
        onClick: () =>
        {
            const { moved, blocked } = transferAll('site', 'bag', siteId);
            if (blocked > 0)
            {
                ctx.showToast(`装入${moved}，超重${blocked}`);
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
        info.setText(`负重 ${getBagWeight(live)}/${getBagCapacity(live)}`);
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
