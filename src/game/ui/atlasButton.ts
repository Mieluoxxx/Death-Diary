import type { GameObjects, Scene } from 'phaser';
import { uiSpriteBtnTextStyle } from './uiFont';

export type AtlasButton = GameObjects.Container & {
    setLabel: (label: string) => void;
};

export function addAtlasButton(
    scene: Scene,
    x: number,
    y: number,
    opts: {
        atlas: string;
        frame: string;
        label?: string;
        labelColor?: string;
        /** Original fontInfo.fontSize tier before createSpriteBtn's -4. */
        labelSizeTier?: 'COMMON_1' | 'COMMON_2' | 'COMMON_3';
        enabled?: boolean;
        onClick?: () => void;
    },
): AtlasButton {
    const enabled = opts.enabled !== false;
    const labelSizeTier = opts.labelSizeTier ?? 'COMMON_2';
    const img = scene.add.image(0, 0, opts.atlas, opts.frame);
    img.setInteractive({ useHandCursor: enabled });

    const parts: GameObjects.GameObject[] = [img];
    let labelText: GameObjects.Text | null = null;

    if (opts.label) {
        labelText = scene.add
            .text(
                0,
                0,
                opts.label,
                uiSpriteBtnTextStyle(labelSizeTier, {
                    color: opts.labelColor ?? (enabled ? '#111' : '#666'),
                }),
            )
            .setOrigin(0.5);
        parts.push(labelText);
    }

    const c = scene.add.container(x, y, parts) as AtlasButton;

    if (enabled && opts.onClick) {
        img.on('pointerdown', () => {
            img.setAlpha(0.7);
        });
        img.on('pointerup', () => {
            img.setAlpha(1);
            opts.onClick?.();
        });
        img.on('pointerout', () => img.setAlpha(1));
    } else {
        img.setAlpha(0.45);
    }

    c.setLabel = (label: string) => {
        if (labelText) {
            labelText.setText(label);
            return;
        }

        labelText = scene.add
            .text(
                0,
                0,
                label,
                uiSpriteBtnTextStyle(labelSizeTier, {
                    color: opts.labelColor ?? (enabled ? '#111' : '#666'),
                }),
            )
            .setOrigin(0.5);
        c.add(labelText);
    };

    return c;
}
