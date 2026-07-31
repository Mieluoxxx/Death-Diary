import type { GameObjects, Scene } from 'phaser';
import { skipGuide } from '../systems/userGuide';
import { addAtlasButton } from './atlasButton';
import { UI_FONT_FAMILY, UI_TEXT_RESOLUTION, uiWordWrap } from './uiFont';

export type GuideWarnHandle = { destroy: () => void };

type BoundsTarget = GameObjects.GameObject & {
    getBounds: (output?: Phaser.Geom.Rectangle) => Phaser.Geom.Rectangle;
};

/** Port of uiUtil.createIconWarn: target center + original (30, -34 Cocos) offset. */
export function addGuideWarn(scene: Scene, target: BoundsTarget): GuideWarnHandle | null {
    if (!target.active) {
        return null;
    }
    const root = scene.add.container(0, 0);
    const syncPosition = () => {
        if (!target.active || !root.active) {
            return;
        }
        const bounds = target.getBounds();
        root.setPosition(bounds.centerX + 30, bounds.centerY + 34);
    };
    syncPosition();
    scene.events.on('postupdate', syncPosition);
    root.setDepth(290);
    root.setName('guideWarn');

    if (scene.textures.exists('icon') && scene.textures.get('icon').has('icon_warn.png')) {
        root.add(scene.add.image(0, 0, 'icon', 'icon_warn.png'));
    } else {
        root.add(scene.add.circle(0, 0, 20, 0xffcc33));
        root.add(
            scene.add
                .text(0, 0, '!', {
                    fontFamily: UI_FONT_FAMILY,
                    resolution: UI_TEXT_RESOLUTION,
                    fontSize: '24px',
                    color: '#111111',
                })
                .setOrigin(0.5),
        );
    }

    const tween = scene.tweens.add({
        targets: root,
        alpha: { from: 0.25, to: 1 },
        scale: { from: 0.8, to: 1 },
        duration: 1500,
        ease: 'Sine.InOut',
        yoyo: true,
        repeat: -1,
    });
    let destroyed = false;
    const destroy = () => {
        if (destroyed) {
            return;
        }
        destroyed = true;
        scene.events.off('postupdate', syncPosition);
        tween.destroy();
        if (root.active) {
            root.destroy(true);
        }
    };
    target.once('destroy', destroy);
    return { destroy };
}

export function showGuideDialog(
    scene: Scene,
    options: {
        text: string;
        picture: 'guide_pic_1.png' | 'guide_pic_2.png';
        pictureBelow?: boolean;
        onDismiss: () => void;
    },
): GameObjects.Container {
    const existing = scene.children.list.find(
        (child) => (child as GameObjects.Container).name === 'guideDialog',
    );
    existing?.destroy(true);

    const { width, height } = scene.scale;
    const root = scene.add.container(0, 0).setDepth(300).setName('guideDialog');
    const blocker = scene.add
        .rectangle(width / 2, height / 2, width, height, 0x000000, 0.78)
        .setInteractive();
    root.add(blocker);

    const panelW = Math.min(560, width - 48);
    const panelH = 560;
    const panelX = width / 2;
    const panelY = height / 2;
    if (scene.textures.exists('ui') && scene.textures.get('ui').has('guide_bg.png')) {
        root.add(
            scene.add.image(panelX, panelY, 'ui', 'guide_bg.png').setDisplaySize(panelW, panelH),
        );
    } else {
        root.add(
            scene.add
                .rectangle(panelX, panelY, panelW, panelH, 0xe8e0d0)
                .setStrokeStyle(2, 0x222222),
        );
    }

    const pictureY = options.pictureBelow ? panelY + 120 : panelY - 120;
    const textY = options.pictureBelow ? panelY - 165 : panelY - 15;
    if (scene.textures.exists('guide') && scene.textures.get('guide').has(options.picture)) {
        const picture = scene.add.image(panelX, pictureY, 'guide', options.picture);
        const maxW = panelW - 70;
        picture.setScale(Math.min(1, maxW / Math.max(1, picture.width)));
        root.add(picture);
    }

    root.add(
        scene.add
            .text(panelX, textY, options.text, {
                fontFamily: UI_FONT_FAMILY,
                resolution: UI_TEXT_RESOLUTION,
                fontSize: '22px',
                color: '#111111',
                lineSpacing: 8,
                align: 'left',
                wordWrap: uiWordWrap(panelW - 80),
            })
            .setOrigin(0.5, 0),
    );

    root.add(
        scene.add
            .text(panelX, panelY + panelH / 2 - 42, '点击继续', {
                fontFamily: UI_FONT_FAMILY,
                resolution: UI_TEXT_RESOLUTION,
                fontSize: '18px',
                color: '#555555',
            })
            .setOrigin(0.5),
    );

    let dismissed = false;
    const dismiss = () => {
        if (dismissed) {
            return;
        }
        dismissed = true;
        root.destroy(true);
        options.onDismiss();
    };

    const skipScale = 0.9;
    const skip = addAtlasButton(scene, 0, 0, {
        atlas: 'ui',
        frame: 'btn_common_black_normal.png',
        label: '跳过引导',
        labelColor: '#f4efe5',
        labelSizeTier: 'COMMON_2',
        onClick: () => {
            if (dismissed) {
                return;
            }
            dismissed = true;
            root.destroy(true);
            skipGuide();
        },
    });
    skip.setScale(skipScale);
    skip.setPosition(
        panelX + panelW / 2 - 20 - (skip.hitTarget.displayWidth * skipScale) / 2,
        panelY - panelH / 2 + 20 + (skip.hitTarget.displayHeight * skipScale) / 2,
    );
    root.add(skip);

    blocker.on('pointerup', dismiss);
    return root;
}
