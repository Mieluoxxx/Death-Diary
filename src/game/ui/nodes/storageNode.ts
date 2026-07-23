/**
 * StorageNode — home warehouse browse (P0).
 */

import { getSession } from '../../session/sessionStore';
import { getBagCapacity, getBagWeight, listItems } from '../../systems/inventory';
import { gameBusOn, gameBusOff } from '../../systems/gameBus';
import type { NodeMountContext, NodeMountResult } from '../navigation';
import { mountItemGrid, resolveItemName } from './itemGrid';
import { UI_FONT_FAMILY, UI_FONT_SIZE, UI_TEXT_RESOLUTION } from '../uiFont';

export function mountStorageNode (ctx: NodeMountContext): NodeMountResult
{
    ctx.setTitle('仓库');
    ctx.setRightEnabled(false);
    ctx.setLeftEnabled(true);

    const topY = ctx.toScreenY(770);
    const info = ctx.scene.add
        .text(ctx.width / 2, topY + 12, '', {
            fontFamily: UI_FONT_FAMILY,
            resolution: UI_TEXT_RESOLUTION,
            fontSize: `${UI_FONT_SIZE.COMMON_3}px`,
            color: '#cccccc',
            align: 'center',
        })
        .setOrigin(0.5, 0);
    ctx.content.add(info);

    const grid = mountItemGrid(ctx.scene, ctx.content, {
        x: ctx.width / 2 - ctx.bgWidth / 2 + 16,
        y: topY + 48,
        width: ctx.bgWidth - 32,
        height: 520,
        getCounts: () => getSession()?.storage ?? {},
        emptyText: '仓库空空如也',
        onTap: (itemId) =>
        {
            const n = getSession()?.storage[itemId] ?? 0;
            ctx.showToast(`${resolveItemName(itemId)} ×${n}`);
        },
    });

    const refreshInfo = () =>
    {
        const live = getSession();
        if (!live)
        {
            return;
        }
        const kinds = listItems(live.storage).length;
        info.setText(
            `物资种类 ${kinds}　|　背包负重 ${getBagWeight(live)}/${getBagCapacity(live)}`,
        );
        grid.refresh();
    };
    refreshInfo();

    const onSession = () => refreshInfo();
    gameBusOn('session_updated', onSession);

    return {
        onLeft: () => ctx.back(),
        destroy: () =>
        {
            gameBusOff('session_updated', onSession);
            grid.destroy();
        },
    };
}
