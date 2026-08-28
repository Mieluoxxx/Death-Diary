/**
 * Take-all button — original ItemChangeNode withTakeAll:
 * black common button + '全部拿取' + hand icon, shared by
 * workLootNode / siteStorageNode. Position and onClick stay with callers;
 * guide highlight (workLootNode) is attached by the caller.
 */

import type { Scene } from 'phaser';
import { type AtlasButton, addAtlasButton } from './atlasButton';

export function addTakeAllButton(
    scene: Scene,
    x: number,
    y: number,
    onClick: () => void,
): AtlasButton {
    const btn = addAtlasButton(scene, x, y, {
        atlas: 'ui',
        frame: 'btn_common_black_normal.png',
        label: '全部拿取',
        labelColor: '#f5f0e6',
        labelSizeTier: 'COMMON_3',
        onClick,
    });
    if (btn.list[1] && 'setOrigin' in btn.list[1]) {
        const label = btn.list[1] as Phaser.GameObjects.Text;
        label.setOrigin(0.3, 0.5);
        label.setX(18);
    }
    if (scene.textures.exists('ui') && scene.textures.get('ui').has('btn_icon_take_all.png')) {
        const hand = scene.add.image(-52, 0, 'ui', 'btn_icon_take_all.png').setOrigin(0.5);
        btn.add(hand);
        const bg = btn.list[0];
        if (bg) {
            btn.sendToBack(bg);
        }
        btn.bringToTop(hand);
        if (btn.list[1] && btn.list[1] !== hand && btn.list[1] !== bg) {
            btn.bringToTop(btn.list[1]);
        }
    }
    return btn;
}
