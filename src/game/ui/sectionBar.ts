/**
 * Shared frame_section_bg row used by ItemChangeNode halves
 * (gate / site storage / work loot).
 */

import type { NodeMountContext } from './navigation';
import { UI_FONT_FAMILY, UI_FONT_SIZE, UI_TEXT_RESOLUTION } from './uiFont';

export function addSectionBar(
    ctx: NodeMountContext,
    left: number,
    centerY: number,
    width: number,
    title: string,
): void {
    const cx = left + width / 2;
    if (
        ctx.scene.textures.exists('ui') &&
        ctx.scene.textures.get('ui').has('frame_section_bg.png')
    ) {
        const bar = ctx.scene.add.image(cx, centerY, 'ui', 'frame_section_bg.png');
        bar.setDisplaySize(Math.min(width - 12, 584), 45);
        ctx.content.add(bar);
    } else {
        ctx.content.add(ctx.scene.add.rectangle(cx, centerY, width - 12, 45, 0xe8e0d0));
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
