import type { GameObjects, Scene } from 'phaser';
import type { PermanentIapId } from '../data/purchaseList';
import { getPurchaseConfig } from '../data/purchaseList';
import { getLanguage, t } from '../settings/settingsStore';
import { isIapUnlocked, unlockIap } from '../systems/iapStore';
import { addAtlasButton } from './atlasButton';
import { uiTextStyle, uiWordWrap } from './uiFont';

/**
 * Port of Buried-City PayDialog (DialogBig) used by shop pay item taps.
 * Web slice: free unlock on confirm (no payment bridge).
 *
 * dialog_big_bg 448×625:
 *   title band ~90, action band ~72, content middle.
 */

const DIALOG_FRAME = 'dialog_big_bg.png';
const DIALOG_WIDTH = 448;
const DIALOG_HEIGHT = 625;
const TITLE_HEIGHT = 90;
const ACTION_HEIGHT = 72;
const LEFT_EDGE = 20;

export type PayDialogResult = {
    purchaseId: PermanentIapId;
    unlocked: boolean;
};

function productIcon(purchaseId: PermanentIapId): {
    atlas: 'icon' | 'npc';
    frame: string;
    scale: number;
} {
    if (purchaseId === 108) {
        return { atlas: 'npc', frame: 'npc_dig_1.png', scale: 0.35 };
    }
    if (purchaseId === 109) {
        return { atlas: 'npc', frame: 'npc_dig_4.png', scale: 0.35 };
    }
    return { atlas: 'icon', frame: `icon_iap_${purchaseId}.png`, scale: 0.45 };
}

export function openPayDialog(
    scene: Scene,
    purchaseId: PermanentIapId,
    onResult?: (result: PayDialogResult) => void,
): GameObjects.Container {
    const existing = scene.children.list.find(
        (child) => (child as GameObjects.Container).name === 'payDialog',
    );
    if (existing) {
        existing.destroy(true);
    }

    const { width, height } = scene.scale;
    const lan = getLanguage();
    const root = scene.add.container(0, 0);
    root.setDepth(200);
    root.setName('payDialog');

    const dim = scene.add
        .rectangle(width / 2, height / 2, width, height, 0x000000, 200 / 255)
        .setInteractive();
    root.add(dim);

    // DialogBig placement mirrors status dialogs: content area above bottom chrome.
    const cocosBgBottom = 29 + (839 - DIALOG_HEIGHT) / 2;
    const bgBottomY = height - cocosBgBottom;
    const bgTopY = bgBottomY - DIALOG_HEIGHT;
    const bgCenterX = width / 2;
    const bgCenterY = bgTopY + DIALOG_HEIGHT / 2;
    const bgLeft = bgCenterX - DIALOG_WIDTH / 2;

    if (scene.textures.exists('ui') && scene.textures.get('ui').has(DIALOG_FRAME)) {
        root.add(scene.add.image(bgCenterX, bgCenterY, 'ui', DIALOG_FRAME));
    } else {
        root.add(
            scene.add
                .rectangle(bgCenterX, bgCenterY, DIALOG_WIDTH, DIALOG_HEIGHT, 0xe8e0d0)
                .setStrokeStyle(2, 0x333333),
        );
    }

    const titleTopY = bgTopY;
    const contentTopY = bgTopY + TITLE_HEIGHT;
    const contentBottomY = bgBottomY - ACTION_HEIGHT;
    const actionCenterY = bgBottomY - ACTION_HEIGHT / 2;
    const textLeft = bgLeft + LEFT_EDGE;
    const textWidth = DIALOG_WIDTH - LEFT_EDGE * 2;
    const already = isIapUnlocked(purchaseId);
    const priceStr = getPurchaseConfig(purchaseId).productPriceStr;
    const name = t(`p_${purchaseId}_name`, lan);
    const des = t(`p_${purchaseId}_des`, lan).replace(/\\n/g, '\n');
    const effect = t(`p_${purchaseId}_effect`, lan).replace(/\\n/g, '\n');
    const iconInfo = productIcon(purchaseId);

    // Title icon
    let titleTextX = textLeft;
    if (
        scene.textures.exists(iconInfo.atlas) &&
        scene.textures.get(iconInfo.atlas).has(iconInfo.frame)
    ) {
        const icon = scene.add
            .image(textLeft, titleTopY + TITLE_HEIGHT / 2, iconInfo.atlas, iconInfo.frame)
            .setOrigin(0, 0.5)
            .setScale(iconInfo.scale);
        root.add(icon);
        titleTextX = textLeft + icon.displayWidth + 8;
    }

    const titleWrap = Math.max(80, bgLeft + DIALOG_WIDTH - LEFT_EDGE - titleTextX - 90);
    root.add(
        scene.add
            .text(titleTextX, titleTopY + 18, name, {
                ...uiTextStyle('COMMON_2'),
                color: '#111111',
                wordWrap: uiWordWrap(titleWrap),
                maxLines: 2,
            })
            .setOrigin(0, 0),
    );

    // Price top-right of title band
    root.add(
        scene.add
            .text(bgLeft + DIALOG_WIDTH - LEFT_EDGE, titleTopY + TITLE_HEIGHT - 28, priceStr, {
                ...uiTextStyle('COMMON_2'),
                color: '#111111',
            })
            .setOrigin(1, 0.5),
    );

    if (
        purchaseId === 106 &&
        scene.textures.exists('icon') &&
        scene.textures.get('icon').has('icon_sale.png')
    ) {
        root.add(
            scene.add
                .image(bgLeft + DIALOG_WIDTH - 28, titleTopY + 24, 'icon', 'icon_sale.png')
                .setScale(0.55),
        );
    }

    // Content: des + effect (permanent packs only in main shop)
    let cursorY = contentTopY + 12;
    const desText = scene.add
        .text(textLeft, cursorY, des, {
            ...uiTextStyle('COMMON_3'),
            color: '#111111',
            wordWrap: uiWordWrap(textWidth),
            lineSpacing: 4,
        })
        .setOrigin(0, 0);
    root.add(desText);
    cursorY += desText.height + 12;

    if (effect.length > 0) {
        root.add(
            scene.add
                .text(textLeft, cursorY, effect, {
                    ...uiTextStyle('COMMON_3'),
                    color: '#b01010',
                    wordWrap: uiWordWrap(textWidth),
                    lineSpacing: 4,
                })
                .setOrigin(0, 0),
        );
    }

    // Soft clip content to content band
    const contentMaskShape = scene.add
        .rectangle(
            bgCenterX,
            (contentTopY + contentBottomY) / 2,
            DIALOG_WIDTH - 16,
            contentBottomY - contentTopY - 8,
            0xffffff,
            0,
        )
        .setVisible(false);
    root.add(contentMaskShape);

    const dismiss = (unlocked: boolean) => {
        root.destroy(true);
        onResult?.({ purchaseId, unlocked });
    };

    dim.on('pointerup', (pointer: Phaser.Input.Pointer) => {
        const inside =
            pointer.x >= bgLeft &&
            pointer.x <= bgLeft + DIALOG_WIDTH &&
            pointer.y >= bgTopY &&
            pointer.y <= bgBottomY;
        if (!inside) {
            dismiss(false);
        }
    });

    const btnY = actionCenterY;
    const backX = bgCenterX - 90;
    const buyX = bgCenterX + 90;
    const backLabel = t('return', lan);
    const buyLabel = t('unlock', lan);

    const makeBtn = (x: number, label: string, enabled: boolean, onClick: () => void) => {
        if (
            scene.textures.exists('ui') &&
            scene.textures.get('ui').has('btn_common_black_normal.png')
        ) {
            const btn = addAtlasButton(scene, x, btnY, {
                atlas: 'ui',
                frame: 'btn_common_black_normal.png',
                label,
                labelColor: '#f5f0e6',
                labelSizeTier: 'COMMON_2',
                enabled,
                onClick: enabled ? onClick : undefined,
            });
            root.add(btn);
            return;
        }

        const bg = scene.add
            .rectangle(x, btnY, 140, 44, enabled ? 0x222222 : 0x555555)
            .setInteractive({ useHandCursor: enabled });
        const text = scene.add
            .text(x, btnY, label, {
                ...uiTextStyle(20),
                color: '#f5f0e6',
            })
            .setOrigin(0.5);
        if (enabled) {
            bg.on('pointerup', onClick);
        }
        root.add([bg, text]);
    };

    makeBtn(backX, backLabel, true, () => dismiss(false));
    makeBtn(buyX, buyLabel, !already, () => {
        // Web: free unlock, same as paid success path.
        unlockIap(purchaseId);
        dismiss(true);
    });

    return root;
}
