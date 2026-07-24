import type { GameObjects, Scene } from 'phaser';
import { getLanguage, t } from '../settings/settingsStore';
import { addAtlasButton } from './atlasButton';
import { UI_FONT_FAMILY, UI_FONT_SIZE, UI_TEXT_RESOLUTION, uiWordWrap } from './uiFont';

/**
 * Port of Buried-City DialogSmall used by topFrame status dialogs.
 *
 * Layout (dialog_small_2_bg 448×420):
 *   bgNode at ((winW-448)/2, 29 + (839-420)/2)  [Cocos y-up from bottom]
 *   titleNode: height 90, top of bg
 *   contentNode: between title and action
 *   actionNode: height 72, bottom of bg
 *   leftEdge 20
 *
 * title: icon (optional) + title COMMON_1 + txt_1 COMMON_3 "当前:%s"
 * content: des COMMON_3 black, word wrap
 * action: single black "知道了" button
 */

const DIALOG_FRAME = 'dialog_small_2_bg.png';
const DIALOG_WIDTH = 448;
const DIALOG_HEIGHT = 420;
const TITLE_HEIGHT = 90;
const ACTION_HEIGHT = 72;
const LEFT_EDGE = 20;
const ICON_SCALE = 0.5;

export type StatusDialogConfig = {
    iconFrame?: string | null;
    iconAtlas?: 'icon' | 'ui';
    title: string;
    /** Already formatted value line, e.g. "当前:1" */
    currentLine: string;
    description: string;
};

export function openStatusDialog (
    scene: Scene,
    config: StatusDialogConfig,
): GameObjects.Container
{
    // Avoid stacking identical overlays.
    const existing = scene.children.list.find(
        (child) => (child as GameObjects.Container).name === 'statusDialog',
    );
    if (existing)
    {
        existing.destroy(true);
    }

    const { width, height } = scene.scale;
    const lan = getLanguage();
    const root = scene.add.container(0, 0);
    root.setDepth(150);
    root.setName('statusDialog');

    // Dim — Cocos LayerColor opacity ~200
    const dim = scene.add
        .rectangle(width / 2, height / 2, width, height, 0x000000, 200 / 255)
        .setInteractive();
    root.add(dim);

    // Cocos: bg at ((winW-w)/2, 29+(839-h)/2) y-up from bottom
    // → Phaser y of bg bottom = height - (29 + (839 - DIALOG_HEIGHT) / 2)
    const cocosBgBottom = 29 + (839 - DIALOG_HEIGHT) / 2;
    const bgBottomY = height - cocosBgBottom;
    const bgTopY = bgBottomY - DIALOG_HEIGHT;
    const bgCenterX = width / 2;
    const bgCenterY = bgTopY + DIALOG_HEIGHT / 2;
    const bgLeft = bgCenterX - DIALOG_WIDTH / 2;

    let panel: GameObjects.Image | GameObjects.Rectangle;
    if (scene.textures.exists('ui') && scene.textures.get('ui').has(DIALOG_FRAME))
    {
        panel = scene.add
            .image(bgCenterX, bgCenterY, 'ui', DIALOG_FRAME)
            .setOrigin(0.5, 0.5);
    }
    else
    {
        panel = scene.add
            .rectangle(bgCenterX, bgCenterY, DIALOG_WIDTH, DIALOG_HEIGHT, 0xe8e0d0)
            .setStrokeStyle(2, 0x333333);
    }
    root.add(panel);

    // Bands match DialogSmall.initContentSize: title 90 / action 72 / content rest.
    const titleTopY = bgTopY;
    const titleBottomY = bgTopY + TITLE_HEIGHT;
    const contentTopY = titleBottomY;
    const contentBottomY = bgBottomY - ACTION_HEIGHT;
    const contentHeight = contentBottomY - contentTopY;
    const actionCenterY = bgBottomY - ACTION_HEIGHT / 2;
    const textLeft = bgLeft + LEFT_EDGE;
    const textWidth = DIALOG_WIDTH - LEFT_EDGE * 2;

    let titleTextX = textLeft;
    let iconDisplayWidth = 0;
    const iconAtlas = config.iconAtlas ?? 'icon';
    if (
        config.iconFrame
        && scene.textures.exists(iconAtlas)
        && scene.textures.get(iconAtlas).has(config.iconFrame)
    )
    {
        const icon = scene.add
            .image(textLeft, titleTopY + TITLE_HEIGHT / 2 - 4, iconAtlas, config.iconFrame)
            .setOrigin(0, 0.5)
            .setScale(ICON_SCALE);
        root.add(icon);
        iconDisplayWidth = icon.displayWidth;
        titleTextX = textLeft + iconDisplayWidth;
    }

    // Title + "当前:x" stay inside the 90px title band (original titleNode).
    const titleWrapWidth = Math.max(80, bgLeft + DIALOG_WIDTH - LEFT_EDGE - titleTextX);
    const titleText = scene.add
        .text(titleTextX, titleTopY + 14, config.title, {
            fontFamily: UI_FONT_FAMILY,
            resolution: UI_TEXT_RESOLUTION,
            fontSize: `${UI_FONT_SIZE.COMMON_1}px`,
            color: '#111111',
            wordWrap: uiWordWrap(titleWrapWidth),
            maxLines: 1,
        })
        .setOrigin(0, 0);
    root.add(titleText);

    // Clamp title if it somehow exceeds band height.
    const titleMaxBottom = titleBottomY - 22;
    if (titleText.y + titleText.height > titleMaxBottom)
    {
        titleText.setFontSize(UI_FONT_SIZE.COMMON_2);
    }

    const currentY = Math.min(
        titleText.y + titleText.height + 2,
        titleBottomY - UI_FONT_SIZE.COMMON_3 - 4,
    );
    const currentText = scene.add
        .text(titleTextX, currentY, config.currentLine, {
            fontFamily: UI_FONT_FAMILY,
            resolution: UI_TEXT_RESOLUTION,
            fontSize: `${UI_FONT_SIZE.COMMON_3}px`,
            color: '#111111',
            wordWrap: uiWordWrap(titleWrapWidth),
            maxLines: 1,
        })
        .setOrigin(0, 0);
    root.add(currentText);

    // Description only in contentNode (height = dialog - title - action).
    const desPadTop = 5;
    const desMaxHeight = Math.max(40, contentHeight - desPadTop - 8);
    // Line height ≈ fontSize + lineSpacing; cap lines so copy stays in content band.
    const desLineHeight = UI_FONT_SIZE.COMMON_3 + 4;
    const desMaxLines = Math.max(1, Math.floor(desMaxHeight / desLineHeight));
    const des = scene.add
        .text(textLeft, contentTopY + 5, config.description, {
            fontFamily: UI_FONT_FAMILY,
            resolution: UI_TEXT_RESOLUTION,
            fontSize: `${UI_FONT_SIZE.COMMON_3}px`,
            color: '#111111',
            // Critical: useAdvancedWrap breaks CJK by character (basic wrap only uses spaces).
            wordWrap: uiWordWrap(textWidth),
            align: 'left',
            lineSpacing: 4,
            maxLines: desMaxLines,
        })
        .setOrigin(0, 0);

    // Safety clip if metrics still exceed content height.
    if (des.height > desMaxHeight)
    {
        const cropWidth = Math.max(1, Math.ceil(des.width));
        des.setCrop(0, 0, cropWidth, desMaxHeight);
    }

    root.add(des);

    const dismiss = () =>
    {
        root.destroy(true);
    };

    // Tap outside panel dismisses (autoDismiss true for status dialogs)
    dim.on('pointerup', (pointer: Phaser.Input.Pointer) =>
    {
        const localX = pointer.x;
        const localY = pointer.y;
        const inside =
            localX >= bgLeft
            && localX <= bgLeft + DIALOG_WIDTH
            && localY >= bgTopY
            && localY <= bgBottomY;
        if (!inside)
        {
            dismiss();
        }
    });

    // Action button: "知道了"
    const okLabel = t('gotIt', lan);
    if (
        scene.textures.exists('ui')
        && scene.textures.get('ui').has('btn_common_black_normal.png')
    )
    {
        const okBtn = addAtlasButton(scene, bgCenterX, actionCenterY, {
            atlas: 'ui',
            frame: 'btn_common_black_normal.png',
            label: okLabel,
            labelColor: '#f5f0e6',
            labelSizeTier: 'COMMON_2',
            onClick: dismiss,
        });
        root.add(okBtn);
    }
    else
    {
        const fallback = scene.add
            .rectangle(bgCenterX, actionCenterY, 158, 45, 0x222222)
            .setInteractive({ useHandCursor: true });
        const fallbackText = scene.add
            .text(bgCenterX, actionCenterY, okLabel, {
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
