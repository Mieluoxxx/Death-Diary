/**
 * Item detail dialog — port of uiUtil.showItemDialog subset.
 * Storage/bag: use food / medicine / buff when applicable.
 */

import type { GameObjects, Scene } from 'phaser';
import { ITEM_STRINGS, itemName } from '../data/buildStrings';
import { getItemDef } from '../data/itemConfig';
import { playPopup } from '../systems/audioManager';
import { advanceGuide, GuideStep, isGuideStep } from '../systems/userGuide';
import { addAtlasButton } from './atlasButton';
import type { ItemDetailModel } from './itemDetailContext';
import { UI_FONT_FAMILY, UI_FONT_SIZE, UI_TEXT_RESOLUTION, uiWordWrap } from './uiFont';
import { addGuideWarn } from './userGuideUi';

const DIALOG_FRAME = 'dialog_big_bg.png';
const FALLBACK_FRAME = 'dialog_small_2_bg.png';
const DIALOG_WIDTH = 448;
const DIALOG_HEIGHT = 625;
const TITLE_HEIGHT = 90;
const ACTION_HEIGHT = 72;
const LEFT_EDGE = 20;

export type { ItemDetailModel } from './itemDetailContext';

function itemDescription(itemId: number): string {
    const copy = ITEM_STRINGS[String(itemId)];
    if (copy?.des) {
        return copy.des;
    }

    const def = getItemDef(itemId);
    const parts = [`重量 ${def.weight}`];
    if (def.slot) {
        parts.push(`槽位 ${def.slot}`);
    }
    return parts.join(' · ');
}

export function openItemDetailDialog(scene: Scene, model: ItemDetailModel): GameObjects.Container {
    const existing = scene.children.list.find(
        (child) => (child as GameObjects.Container).name === 'itemDialog',
    );
    if (existing) {
        existing.destroy(true);
    }

    const { itemId, quantity: count, primaryAction } = model;
    const title = itemName(itemId);
    const description = itemDescription(itemId) || getItemDef(itemId).name;
    const { width, height } = scene.scale;

    const root = scene.add.container(0, 0);
    root.setDepth(260);
    root.setName('itemDialog');
    playPopup();

    const dim = scene.add
        .rectangle(width / 2, height / 2, width, height, 0x000000, 0.72)
        .setInteractive();
    root.add(dim);

    // Original Dialog: centered in the 839px gameplay field above 29px bottom chrome.
    const cocosBgBottom = 29 + (839 - DIALOG_HEIGHT) / 2;
    const bgBottomY = height - cocosBgBottom;
    const bgTopY = bgBottomY - DIALOG_HEIGHT;
    const bgCenterX = width / 2;
    const bgCenterY = bgTopY + DIALOG_HEIGHT / 2;
    const bgLeft = bgCenterX - DIALOG_WIDTH / 2;

    let panel: GameObjects.Image | GameObjects.Rectangle;
    if (scene.textures.exists('ui') && scene.textures.get('ui').has(DIALOG_FRAME)) {
        panel = scene.add.image(bgCenterX, bgCenterY, 'ui', DIALOG_FRAME).setOrigin(0.5);
    } else if (scene.textures.exists('ui') && scene.textures.get('ui').has(FALLBACK_FRAME)) {
        panel = scene.add.image(bgCenterX, bgCenterY, 'ui', FALLBACK_FRAME).setOrigin(0.5);
        panel.setDisplaySize(DIALOG_WIDTH, DIALOG_HEIGHT);
    } else {
        panel = scene.add
            .rectangle(bgCenterX, bgCenterY, DIALOG_WIDTH, DIALOG_HEIGHT, 0xe8e0d0)
            .setStrokeStyle(2, 0x333333);
    }
    root.add(panel);

    const textLeft = bgLeft + LEFT_EDGE;
    const textWidth = DIALOG_WIDTH - LEFT_EDGE * 2;
    const titleTopY = bgTopY + 16;
    const contentTopY = bgTopY + TITLE_HEIGHT;
    const actionCenterY = bgBottomY - ACTION_HEIGHT / 2;

    const iconFrame = `icon_item_${itemId}.png`;
    let titleX = textLeft;
    if (scene.textures.exists('icon') && scene.textures.get('icon').has(iconFrame)) {
        const icon = scene.add
            .image(textLeft, titleTopY + 28, 'icon', iconFrame)
            .setOrigin(0, 0.5)
            .setScale(0.7);
        root.add(icon);
        titleX = textLeft + icon.displayWidth + 10;
    }

    root.add(
        scene.add
            .text(titleX, titleTopY, title, {
                fontFamily: UI_FONT_FAMILY,
                resolution: UI_TEXT_RESOLUTION,
                fontSize: `${UI_FONT_SIZE.COMMON_1}px`,
                color: '#111111',
                wordWrap: uiWordWrap(bgLeft + DIALOG_WIDTH - LEFT_EDGE - titleX),
                maxLines: 1,
            })
            .setOrigin(0, 0),
    );

    root.add(
        scene.add
            .text(titleX, titleTopY + 40, `库存:${count}`, {
                fontFamily: UI_FONT_FAMILY,
                resolution: UI_TEXT_RESOLUTION,
                fontSize: `${UI_FONT_SIZE.COMMON_3}px`,
                color: '#111111',
            })
            .setOrigin(0, 0),
    );

    const digFrame = `dig_item_${itemId}.png`;
    let desY = contentTopY + 8;
    if (scene.textures.exists('dig_item') && scene.textures.get('dig_item').has(digFrame)) {
        const dig = scene.add
            .image(bgCenterX, contentTopY + 70, 'dig_item', digFrame)
            .setOrigin(0.5, 0);
        const maxW = textWidth;
        if (dig.width > maxW) {
            dig.setScale(maxW / dig.width);
        }
        root.add(dig);
        desY = dig.y + dig.displayHeight + 12;
    } else if (scene.textures.exists('icon') && scene.textures.get('icon').has(iconFrame)) {
        // Soft fallback art when dig atlas missing.
        const big = scene.add
            .image(bgCenterX, contentTopY + 20, 'icon', iconFrame)
            .setOrigin(0.5, 0)
            .setScale(1.4);
        root.add(big);
        desY = big.y + big.displayHeight + 12;
    }

    root.add(
        scene.add
            .text(textLeft, desY, description, {
                fontFamily: UI_FONT_FAMILY,
                resolution: UI_TEXT_RESOLUTION,
                fontSize: `${UI_FONT_SIZE.COMMON_3}px`,
                color: '#111111',
                wordWrap: uiWordWrap(textWidth),
                lineSpacing: 4,
            })
            .setOrigin(0, 0),
    );

    const dismiss = () => {
        root.destroy(true);
        model.onClose?.();
    };

    dim.on('pointerup', (pointer: Phaser.Input.Pointer) => {
        const inside =
            pointer.x >= bgLeft &&
            pointer.x <= bgLeft + DIALOG_WIDTH &&
            pointer.y >= bgTopY &&
            pointer.y <= bgBottomY;
        if (!inside) {
            dismiss();
        }
    });

    const onPrimaryAction = () => {
        if (!primaryAction) {
            return;
        }
        const result = primaryAction.run();
        if (result.msg) {
            model.onToast?.(result.msg);
        }
        if (result.ok) {
            if (itemId === 1103083) {
                advanceGuide(GuideStep.STORAGE_EAT);
            }
            // 原版先关闭详情框，再让来源列表按最新库存重绘。
            dismiss();
            model.onUseSuccess?.();
        }
    };

    const hasBtnAtlas =
        scene.textures.exists('ui') && scene.textures.get('ui').has('btn_common_black_normal.png');

    if (primaryAction && hasBtnAtlas) {
        root.add(
            addAtlasButton(scene, bgCenterX - 90, actionCenterY, {
                atlas: 'ui',
                frame: 'btn_common_black_normal.png',
                label: '返回',
                labelColor: '#f5f0e6',
                labelSizeTier: 'COMMON_2',
                onClick: dismiss,
            }),
        );
        const primaryBtn = addAtlasButton(scene, bgCenterX + 90, actionCenterY, {
            atlas: 'ui',
            frame: 'btn_common_black_normal.png',
            label: primaryAction.label,
            labelColor: '#f5f0e6',
            labelSizeTier: 'COMMON_2',
            onClick: onPrimaryAction,
        });
        root.add(primaryBtn);
        if (itemId === 1103083 && isGuideStep(GuideStep.STORAGE_EAT)) {
            addGuideWarn(scene, primaryBtn, { x: 18, y: -42 });
        }
    } else if (hasBtnAtlas) {
        root.add(
            addAtlasButton(scene, bgCenterX, actionCenterY, {
                atlas: 'ui',
                frame: 'btn_common_black_normal.png',
                label: '知道了',
                labelColor: '#f5f0e6',
                labelSizeTier: 'COMMON_2',
                onClick: dismiss,
            }),
        );
    } else if (primaryAction) {
        const useBtn = scene.add
            .rectangle(bgCenterX - 90, actionCenterY, 140, 45, 0x222222)
            .setInteractive({ useHandCursor: true });
        const useText = scene.add
            .text(bgCenterX - 90, actionCenterY, '返回', {
                fontFamily: UI_FONT_FAMILY,
                resolution: UI_TEXT_RESOLUTION,
                fontSize: '20px',
                color: '#f5f0e6',
            })
            .setOrigin(0.5);
        useBtn.on('pointerup', dismiss);
        const closeBtn = scene.add
            .rectangle(bgCenterX + 90, actionCenterY, 140, 45, 0x222222)
            .setInteractive({ useHandCursor: true });
        const closeText = scene.add
            .text(bgCenterX + 90, actionCenterY, primaryAction.label, {
                fontFamily: UI_FONT_FAMILY,
                resolution: UI_TEXT_RESOLUTION,
                fontSize: '20px',
                color: '#f5f0e6',
            })
            .setOrigin(0.5);
        closeBtn.on('pointerup', onPrimaryAction);
        root.add([useBtn, useText, closeBtn, closeText]);
    } else {
        const fallback = scene.add
            .rectangle(bgCenterX, actionCenterY, 158, 45, 0x222222)
            .setInteractive({ useHandCursor: true });
        const fallbackText = scene.add
            .text(bgCenterX, actionCenterY, '知道了', {
                fontFamily: UI_FONT_FAMILY,
                resolution: UI_TEXT_RESOLUTION,
                fontSize: '20px',
                color: '#f5f0e6',
            })
            .setOrigin(0.5);
        fallback.on('pointerup', dismiss);
        root.add([fallback, fallbackText]);
    }

    return root;
}
