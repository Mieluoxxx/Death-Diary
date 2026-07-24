/**
 * Item detail dialog — port of uiUtil.showItemDialog subset.
 * Storage/bag: use food / medicine / buff when applicable.
 */

import type { GameObjects, Scene } from 'phaser';
import { itemName } from '../data/buildStrings';
import { isUsableItem } from '../data/itemEffects';
import { getItemDef } from '../data/itemConfig';
import { getSession } from '../session/sessionStore';
import { useItem, type ItemUseSource } from '../systems/itemUse';
import { addAtlasButton } from './atlasButton';
import { UI_FONT_FAMILY, UI_FONT_SIZE, UI_TEXT_RESOLUTION, uiWordWrap } from './uiFont';
const DIALOG_FRAME = 'dialog_big_bg.png';
const FALLBACK_FRAME = 'dialog_small_2_bg.png';
const DIALOG_WIDTH = 520;
const DIALOG_HEIGHT = 560;
const TITLE_HEIGHT = 100;
const ACTION_HEIGHT = 80;
const LEFT_EDGE = 24;

export type ItemDialogSource = 'storage' | 'bag' | 'site' | 'top' | 'bottom';

export type ItemDialogOptions = {
    from?: ItemDialogSource;
    showOnly?: boolean;
    onToast?: (msg: string) => void;
    onClose?: () => void;
};

function itemDescription (itemId: number): string
{
    // Prefer named copy table when present; fall back to generic weight line.
    // ITEM_STRINGS only exposes title via itemName today — use inline des lookup.
    try
    {
        // Dynamic require avoided; use getItemDef name + weight as baseline.
        const def = getItemDef(itemId);
        const parts = [`重量 ${def.weight}`];
        if (def.slot)
        {
            parts.push(`槽位 ${def.slot}`);
        }
        if (def.effectWeapon)
        {
            parts.push(`攻击 ${def.effectWeapon.atk}`);
        }
        if (def.effectArm)
        {
            parts.push(`防御 ${def.effectArm.def}`);
        }
        if (def.effectTool)
        {
            parts.push(`工作 ${def.effectTool.workingTime}s`);
        }
        return parts.join(' · ');
    }
    catch
    {
        return '';
    }
}

function countInSource (itemId: number, from: ItemDialogSource): number
{
    const session = getSession();
    if (!session)
    {
        return 0;
    }
    if (from === 'bag')
    {
        return session.bag[itemId] ?? 0;
    }
    if (from === 'top')
    {
        // Original topFrame: home → storage, outdoors → bag.
        const bag = session.isAtHome ? session.storage : session.bag;
        return bag[itemId] ?? 0;
    }
    // storage / site / bottom default to home warehouse for this slice.
    return session.storage[itemId] ?? 0;
}

export function openItemDialog (
    scene: Scene,
    itemId: number,
    options: ItemDialogOptions = {},
): GameObjects.Container
{
    const existing = scene.children.list.find(
        (child) => (child as GameObjects.Container).name === 'itemDialog',
    );
    if (existing)
    {
        existing.destroy(true);
    }

    const from = options.from ?? 'storage';
    const title = itemName(itemId);
    const count = countInSource(itemId, from);
    const description = itemDescription(itemId) || getItemDef(itemId).name;
    const { width, height } = scene.scale;

    const root = scene.add.container(0, 0);
    root.setDepth(260);
    root.setName('itemDialog');

    const dim = scene.add
        .rectangle(width / 2, height / 2, width, height, 0x000000, 0.72)
        .setInteractive();
    root.add(dim);

    const bgCenterX = width / 2;
    const bgCenterY = height / 2;
    const bgLeft = bgCenterX - DIALOG_WIDTH / 2;
    const bgTopY = bgCenterY - DIALOG_HEIGHT / 2;
    const bgBottomY = bgCenterY + DIALOG_HEIGHT / 2;

    let panel: GameObjects.Image | GameObjects.Rectangle;
    if (scene.textures.exists('ui') && scene.textures.get('ui').has(DIALOG_FRAME))
    {
        panel = scene.add.image(bgCenterX, bgCenterY, 'ui', DIALOG_FRAME).setOrigin(0.5);
    }
    else if (scene.textures.exists('ui') && scene.textures.get('ui').has(FALLBACK_FRAME))
    {
        panel = scene.add.image(bgCenterX, bgCenterY, 'ui', FALLBACK_FRAME).setOrigin(0.5);
        panel.setDisplaySize(DIALOG_WIDTH, DIALOG_HEIGHT);
    }
    else
    {
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
    if (scene.textures.exists('icon') && scene.textures.get('icon').has(iconFrame))
    {
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
            .text(titleX, titleTopY + 40, `当前:${count}`, {
                fontFamily: UI_FONT_FAMILY,
                resolution: UI_TEXT_RESOLUTION,
                fontSize: `${UI_FONT_SIZE.COMMON_3}px`,
                color: '#111111',
            })
            .setOrigin(0, 0),
    );

    const digFrame = `dig_item_${itemId}.png`;
    let desY = contentTopY + 8;
    if (scene.textures.exists('dig') && scene.textures.get('dig').has(digFrame))
    {
        const dig = scene.add
            .image(bgCenterX, contentTopY + 70, 'dig', digFrame)
            .setOrigin(0.5, 0);
        const maxW = textWidth;
        if (dig.width > maxW)
        {
            dig.setScale(maxW / dig.width);
        }
        root.add(dig);
        desY = dig.y + dig.displayHeight + 12;
    }
    else if (scene.textures.exists('icon') && scene.textures.get('icon').has(iconFrame))
    {
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

    const dismiss = () =>
    {
        root.destroy(true);
        options.onClose?.();
    };

    dim.on('pointerup', (pointer: Phaser.Input.Pointer) =>
    {
        const inside =
            pointer.x >= bgLeft
            && pointer.x <= bgLeft + DIALOG_WIDTH
            && pointer.y >= bgTopY
            && pointer.y <= bgBottomY;
        if (!inside)
        {
            dismiss();
        }
    });

    const canUse =
        !options.showOnly
        && (from === 'storage' || from === 'bag' || from === 'top')
        && isUsableItem(itemId)
        && count > 0;

    // top: use from storage at home, bag outdoors (mirrors original topFrame).
    let useFrom: ItemUseSource = 'storage';
    if (from === 'bag')
    {
        useFrom = 'bag';
    }
    else if (from === 'top')
    {
        const live = getSession();
        useFrom = live && !live.isAtHome ? 'bag' : 'storage';
    }

    const onUse = () =>
    {
        const result = useItem(itemId, useFrom);
        if (result.ok)
        {
            options.onToast?.(result.msg);
            dismiss();
        }
        else
        {
            options.onToast?.(result.msg);
        }
    };

    const hasBtnAtlas =
        scene.textures.exists('ui')
        && scene.textures.get('ui').has('btn_common_black_normal.png');

    if (canUse && hasBtnAtlas)
    {
        root.add(
            addAtlasButton(scene, bgCenterX - 90, actionCenterY, {
                atlas: 'ui',
                frame: 'btn_common_black_normal.png',
                label: '使用',
                labelColor: '#f5f0e6',
                labelSizeTier: 'COMMON_2',
                onClick: onUse,
            }),
        );
        root.add(
            addAtlasButton(scene, bgCenterX + 90, actionCenterY, {
                atlas: 'ui',
                frame: 'btn_common_black_normal.png',
                label: '关闭',
                labelColor: '#f5f0e6',
                labelSizeTier: 'COMMON_2',
                onClick: dismiss,
            }),
        );
    }
    else if (hasBtnAtlas)
    {
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
    }
    else if (canUse)
    {
        const useBtn = scene.add
            .rectangle(bgCenterX - 90, actionCenterY, 140, 45, 0x222222)
            .setInteractive({ useHandCursor: true });
        const useText = scene.add
            .text(bgCenterX - 90, actionCenterY, '使用', {
                fontFamily: UI_FONT_FAMILY,
                resolution: UI_TEXT_RESOLUTION,
                fontSize: '20px',
                color: '#f5f0e6',
            })
            .setOrigin(0.5);
        useBtn.on('pointerup', onUse);
        const closeBtn = scene.add
            .rectangle(bgCenterX + 90, actionCenterY, 140, 45, 0x222222)
            .setInteractive({ useHandCursor: true });
        const closeText = scene.add
            .text(bgCenterX + 90, actionCenterY, '关闭', {
                fontFamily: UI_FONT_FAMILY,
                resolution: UI_TEXT_RESOLUTION,
                fontSize: '20px',
                color: '#f5f0e6',
            })
            .setOrigin(0.5);
        closeBtn.on('pointerup', dismiss);
        root.add([useBtn, useText, closeBtn, closeText]);
    }
    else
    {
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
