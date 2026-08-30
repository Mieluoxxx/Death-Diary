/**
 * Quantity slider dialog — original ItemChangeNode.showItemSliderDialog.
 * Long press on a transfer grid opens this to pick how many to move (1..max).
 */

import type { GameObjects, Scene } from 'phaser';
import { ITEM_STRINGS } from '../data/buildStrings';
import { getItemDef } from '../data/itemConfig';
import { playEffect, Sound } from '../systems/audioManager';
import { type AtlasButton, addAtlasButton } from './atlasButton';
import { uiTextStyle, uiWordWrap } from './uiFont';

export function openQuantityDialog(
    scene: Scene,
    itemId: number,
    max: number,
    onConfirm: (amount: number) => void,
): GameObjects.Container {
    // Original Dialog.show() plays POPUP on open.
    playEffect(Sound.POPUP);
    const existing = scene.children.list.find(
        (child) => (child as GameObjects.Container).name === 'quantityDialog',
    );
    existing?.destroy(true);

    const { width, height } = scene.scale;
    const root = scene.add.container(0, 0).setDepth(320).setName('quantityDialog');
    // Original Dialog mask: black + setOpacity(200) ≈ 0.78.
    root.add(
        scene.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.78).setInteractive(),
    );

    // Original DialogBig: 448x625, title 90px, action 72px.
    const panelW = 448;
    const panelH = 625;
    const cocosBgBottom = 29 + (839 - panelH) / 2;
    const bgBottom = height - cocosBgBottom;
    const bgTop = bgBottom - panelH;
    const cx = width / 2;
    const cy = bgTop + panelH / 2;
    if (scene.textures.exists('ui') && scene.textures.get('ui').has('dialog_big_bg.png')) {
        root.add(scene.add.image(cx, cy, 'ui', 'dialog_big_bg.png').setDisplaySize(panelW, panelH));
    } else {
        root.add(scene.add.rectangle(cx, cy, panelW, panelH, 0xe8e0d0).setStrokeStyle(2, 0x222222));
    }

    const item = getItemDef(itemId);
    const textLeft = cx - panelW / 2 + 20;
    const iconFrame = `icon_item_${itemId}.png`;
    let titleX = textLeft;
    if (scene.textures.exists('icon') && scene.textures.get('icon').has(iconFrame)) {
        const icon = scene.add.image(textLeft, bgTop + 41, 'icon', iconFrame).setOrigin(0, 0.5);
        root.add(icon);
        titleX += icon.displayWidth + 8;
    }
    // DialogCommon title: y = titleNode.height/2 → center baseline bgTop+45.
    const title = scene.add
        .text(titleX, bgTop + 45, item.name, {
            ...uiTextStyle('COMMON_1'),
            color: '#111111',
        })
        .setOrigin(0, 0.5);
    root.add(title);
    // DialogCommon txt_1/txt_2 (COMMON_3): top-anchored 2px below the title,
    // weight first, count 35px after txt_1.
    const infoStyle = {
        ...uiTextStyle('COMMON_3'),
        color: '#111111',
    };
    const infoY = bgTop + 45 + title.height / 2 + 2;
    const weightText = scene.add.text(titleX, infoY, '', infoStyle).setOrigin(0, 0);
    const countText = scene.add.text(titleX, infoY, '', infoStyle).setOrigin(0, 0);
    root.add(weightText);
    root.add(countText);

    const description = ITEM_STRINGS[String(itemId)]?.des;
    const digFrame = `dig_item_${itemId}.png`;
    // DialogBig: dig top = contentNode top - 5 → bgTop+95 (625-90-72 content, 90 below bgTop).
    let descriptionY = bgTop + 95;
    if (scene.textures.exists('dig_item') && scene.textures.get('dig_item').has(digFrame)) {
        const dig = scene.add.image(cx, bgTop + 95, 'dig_item', digFrame).setOrigin(0.5, 0);
        if (dig.width > panelW - 40) dig.setScale((panelW - 40) / dig.width);
        root.add(dig);
        descriptionY = dig.y + dig.displayHeight + 12;
    }
    if (description) {
        root.add(
            scene.add
                .text(textLeft, descriptionY, description, {
                    ...uiTextStyle('COMMON_3'),
                    color: '#111111',
                    wordWrap: uiWordWrap(panelW - 40),
                    lineSpacing: 4,
                })
                .setOrigin(0, 0),
        );
    }

    const trackY = bgBottom - 112;
    const trackW = 316;
    let fill: Phaser.GameObjects.Image | Phaser.GameObjects.Rectangle;
    if (
        scene.textures.exists('ui') &&
        scene.textures.get('ui').has('slider_bg.png') &&
        scene.textures.get('ui').has('slider_content.png')
    ) {
        root.add(scene.add.image(cx, trackY, 'ui', 'slider_bg.png'));
        // Original ControlSlider: fill grows from the track's left edge.
        fill = scene.add.image(0, trackY, 'ui', 'slider_content.png').setOrigin(0, 0.5);
    } else {
        root.add(scene.add.rectangle(cx, trackY, trackW, 15, 0x777777));
        fill = scene.add.rectangle(0, trackY, trackW, 15, 0x555555).setOrigin(0, 0.5);
    }
    root.add(fill);
    const fillH = fill.height;

    let value = 1;
    const cap =
        scene.textures.exists('ui') && scene.textures.get('ui').has('slider_cap.png')
            ? scene.add.image(cx - trackW / 2, trackY, 'ui', 'slider_cap.png')
            : scene.add.circle(cx - trackW / 2, trackY, 18, 0x222222);
    cap.setInteractive({ draggable: true, useHandCursor: true });
    scene.input.setDraggable(cap);
    root.add(cap);

    const update = (pointerX: number) => {
        const ratio = Math.max(0, Math.min(1, (pointerX - (cx - trackW / 2)) / trackW));
        value = Math.max(1, Math.round(1 + ratio * (max - 1)));
        const valueRatio = max <= 1 ? 0 : (value - 1) / (max - 1);
        cap.setX(cx - trackW / 2 + valueRatio * trackW);
        // Original ControlSlider: fill width = valueRatio × track, left-aligned.
        if (valueRatio <= 0) {
            fill.setVisible(false);
        } else {
            fill.setVisible(true);
            fill.setPosition(cx - trackW / 2, trackY);
            fill.setDisplaySize(Math.max(valueRatio * trackW, 2), fillH);
        }
        weightText.setText(`重量 ${item.weight * value}`);
        countText.setText(`数量 ${value}/${max}`);
        countText.setX(weightText.x + weightText.width + 35);
    };
    update(cx - trackW / 2);
    cap.on('drag', (_pointer: Phaser.Input.Pointer, dragX: number) => update(dragX));
    const trackHit = scene.add
        .rectangle(cx, trackY, trackW + 36, 52, 0xffffff, 0.001)
        .setInteractive({ useHandCursor: true });
    trackHit.on('pointerdown', (pointer: Phaser.Input.Pointer) => update(pointer.x));
    root.add(trackHit);
    root.bringToTop(cap);

    root.list[0]?.on('pointerup', (pointer: Phaser.Input.Pointer) => {
        if (
            pointer.x < cx - panelW / 2 ||
            pointer.x > cx + panelW / 2 ||
            pointer.y < bgTop ||
            pointer.y > bgBottom
        ) {
            root.destroy(true);
        }
    });

    const confirm: AtlasButton = addAtlasButton(scene, cx, bgBottom - 36, {
        atlas: 'ui',
        frame: 'btn_common_black_normal.png',
        label: '确定',
        labelColor: '#f5f0e6',
        onClick: () => {
            root.destroy(true);
            onConfirm(value);
        },
    });
    confirm.setName('quantityDialogConfirm');
    root.add(confirm);
    return root;
}
