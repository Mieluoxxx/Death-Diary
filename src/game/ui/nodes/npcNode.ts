/**
 * NpcNode — placeholder until trade/dialog is ported.
 */

import { getNpcCopy } from '../../data/npcConfig';
import type { NodeMountContext, NodeMountResult } from '../navigation';
import { UI_FONT_FAMILY, UI_FONT_SIZE, UI_TEXT_RESOLUTION, uiWordWrap } from '../uiFont';

export function mountNpcNode (ctx: NodeMountContext): NodeMountResult
{
    const npcId = typeof ctx.userData === 'number' ? ctx.userData : Number(ctx.userData);
    const copy = getNpcCopy(Number.isFinite(npcId) ? npcId : 0);
    ctx.setTitle(`${copy.name}家`);
    ctx.setLeftEnabled(true);
    ctx.setRightEnabled(false);

    const { width } = ctx;
    const y = ctx.toScreenY(700);
    ctx.content.add(
        ctx.scene.add
            .text(width / 2, y, copy.des || '（NPC 对话尚未接入）', {
                fontFamily: UI_FONT_FAMILY,
                resolution: UI_TEXT_RESOLUTION,
                fontSize: `${UI_FONT_SIZE.COMMON_2}px`,
                color: '#dddddd',
                align: 'center',
                wordWrap: uiWordWrap(ctx.bgWidth - 60),
            })
            .setOrigin(0.5, 0),
    );

    return {
        onLeft: () => ctx.back(),
    };
}
