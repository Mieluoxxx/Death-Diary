/**
 * GateOutNode — original gate_out_bg + tip, then Map.
 * Port of Buried-City gateOutNode.js (auto-advance ~3s / tap).
 */

import type { NodeMountContext, NodeMountResult } from '../navigation';
import { NavNode } from '../navigation';
import {
    UI_FONT_FAMILY,
    UI_FONT_SIZE,
    UI_TEXT_RESOLUTION,
    uiWordWrap,
} from '../uiFont';

const TIPS = [
    '门外一片死寂，风里带着灰尘和焦味。',
    '你握紧了手中的东西，迈出了避难所。',
    '天空阴沉，远处偶尔传来不明声响。',
];

export function mountGateOutNode (ctx: NodeMountContext): NodeMountResult
{
    // Original: empty title, no chrome buttons, hide frame_line.
    ctx.setTitle('');
    ctx.setLeftEnabled(false);
    ctx.setRightEnabled(false);

    const bgCenterX = ctx.width / 2;
    const bgCenterY = ctx.bgBottomY - ctx.bgHeight / 2;

    if (ctx.scene.textures.exists('gate') && ctx.scene.textures.get('gate').has('gate_out_bg.png'))
    {
        ctx.content.add(
            ctx.scene.add
                .image(bgCenterX, bgCenterY, 'gate', 'gate_out_bg.png')
                .setOrigin(0.5),
        );
    }
    else
    {
        ctx.content.add(
            ctx.scene.add
                .rectangle(bgCenterX, bgCenterY, ctx.bgWidth, ctx.bgHeight, 0x111111)
                .setOrigin(0.5),
        );
    }

    const leftPadding = 30;
    const textWidth = ctx.bgWidth - leftPadding * 2;
    const textLeft = bgCenterX - ctx.bgWidth / 2 + leftPadding;
    // Cocos: labelTip at y=400 from bg bottom; tip just below.
    const labelY = ctx.bgBottomY - 400;
    const tip = TIPS[Math.floor(Math.random() * TIPS.length)] ?? TIPS[0]!;

    ctx.content.add(
        ctx.scene.add
            .text(textLeft, labelY, '你走出了避难所。', {
                fontFamily: UI_FONT_FAMILY,
                resolution: UI_TEXT_RESOLUTION,
                fontSize: `${UI_FONT_SIZE.COMMON_2}px`,
                color: '#f0e6d2',
                wordWrap: uiWordWrap(textWidth),
            })
            .setOrigin(0, 0),
    );

    ctx.content.add(
        ctx.scene.add
            .text(textLeft, labelY - 20, tip, {
                fontFamily: UI_FONT_FAMILY,
                resolution: UI_TEXT_RESOLUTION,
                fontSize: `${UI_FONT_SIZE.COMMON_2}px`,
                color: '#d8d0c0',
                wordWrap: uiWordWrap(textWidth),
            })
            .setOrigin(0, 1),
    );

    let done = false;
    const goMap = () =>
    {
        if (done)
        {
            return;
        }
        done = true;
        ctx.replace(NavNode.MAP);
    };

    const hit = ctx.scene.add
        .rectangle(bgCenterX, bgCenterY, ctx.bgWidth, ctx.bgHeight, 0x000000, 0.001)
        .setInteractive({ useHandCursor: true });
    ctx.content.add(hit);
    hit.on('pointerup', goMap);

    const timer = ctx.scene.time.delayedCall(3000, goMap);

    return {
        destroy: () =>
        {
            timer.remove(false);
        },
    };
}
