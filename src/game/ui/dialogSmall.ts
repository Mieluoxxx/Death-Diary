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

export type StatusQuickItem = {
    itemId: number;
    num: number;
};

export type StatusDialogConfig = {
    iconFrame?: string | null;
    iconAtlas?: 'icon' | 'ui';
    title: string;
    /** Already formatted value line, e.g. "当前:1" */
    currentLine: string;
    description: string;
    /**
     * Optional horizontal quick-use strip (original createItemListSliders).
     * Used by starve / infect / injury attr dialogs.
     */
    quickItems?: StatusQuickItem[];
    onQuickItemTap?: (itemId: number) => void;
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
    // Leave a bottom band for the quick-item strip when present (original 100px table).
    const hasQuickItems = (config.quickItems?.length ?? 0) > 0;
    const quickStripH = hasQuickItems ? 100 : 0;
    const desPadTop = 5;
    const desMaxHeight = Math.max(
        40,
        contentHeight - desPadTop - 8 - (hasQuickItems ? quickStripH + 4 : 0),
    );
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

    // Horizontal item strip (original TableView 400×100 at content bottom).
    // All items are laid out; overflow scrolls with drag/wheel under a FilterMask.
    let stripMaskRect: GameObjects.Rectangle | null = null;
    let stripListRoot: GameObjects.Container | null = null;
    if (hasQuickItems && config.quickItems)
    {
        const stripTop = contentBottomY - quickStripH;
        const cellSize = 84;
        const cellPitch = 100;
        const viewW = 400;
        const viewH = quickStripH;
        const viewLeft = bgLeft + 20;
        const viewCenterX = viewLeft + viewW / 2;
        const viewCenterY = stripTop + viewH / 2;

        stripListRoot = scene.add.container(viewLeft, stripTop);
        root.add(stripListRoot);

        stripMaskRect = scene.add
            .rectangle(viewCenterX, viewCenterY, viewW, viewH, 0xffffff)
            .setVisible(false);
        root.add(stripMaskRect);
        stripListRoot.enableFilters();
        stripListRoot.filters?.internal.addMask(
            stripMaskRect,
            false,
            scene.cameras.main,
            'world',
        );

        // Invisible drag surface so empty strip area also scrolls.
        const dragSurface = scene.add
            .rectangle(viewW / 2, viewH / 2, viewW, viewH, 0xffffff, 0.001)
            .setInteractive({ useHandCursor: false });
        stripListRoot.add(dragSurface);

        const cellHits: Array<{ hit: GameObjects.Rectangle; localX: number }> = [];
        let cursorX = 0;
        for (const row of config.quickItems)
        {
            const cellCenterX = cursorX + cellSize / 2;
            const cellCenterY = viewH / 2;

            if (scene.textures.exists('ui') && scene.textures.get('ui').has('item_bg.png'))
            {
                stripListRoot.add(
                    scene.add
                        .image(cellCenterX, cellCenterY, 'ui', 'item_bg.png')
                        .setDisplaySize(cellSize, cellSize),
                );
            }
            else
            {
                stripListRoot.add(
                    scene.add
                        .rectangle(cellCenterX, cellCenterY, cellSize, cellSize, 0x3a342c)
                        .setStrokeStyle(1, 0x222222),
                );
            }

            const iconFrame = `icon_item_${row.itemId}.png`;
            if (scene.textures.exists('icon') && scene.textures.get('icon').has(iconFrame))
            {
                stripListRoot.add(
                    scene.add
                        .image(cellCenterX, cellCenterY, 'icon', iconFrame)
                        .setDisplaySize(cellSize * 0.72, cellSize * 0.72),
                );
            }

            stripListRoot.add(
                scene.add
                    .text(
                        cellCenterX + cellSize / 2 - 4,
                        cellCenterY + cellSize / 2 - 4,
                        String(row.num),
                        {
                            fontFamily: UI_FONT_FAMILY,
                            resolution: UI_TEXT_RESOLUTION,
                            fontSize: `${UI_FONT_SIZE.COMMON_2}px`,
                            color: '#ffffff',
                            stroke: '#000000',
                            strokeThickness: 3,
                        },
                    )
                    .setOrigin(1, 1),
            );

            const hit = scene.add
                .rectangle(cellCenterX, cellCenterY, cellSize, cellSize, 0xffffff, 0.001)
                .setInteractive({ useHandCursor: true });
            const itemId = row.itemId;
            hit.on('pointerup', (pointer: Phaser.Input.Pointer) =>
            {
                // Ignore drag, or cells scrolled outside the strip viewport.
                if (
                    pointer.getDistance() > 8
                    || pointer.x < viewLeft
                    || pointer.x > viewLeft + viewW
                    || pointer.y < stripTop
                    || pointer.y > stripTop + viewH
                )
                {
                    return;
                }
                config.onQuickItemTap?.(itemId);
            });
            stripListRoot.add(hit);
            cellHits.push({ hit, localX: cellCenterX });

            cursorX += cellPitch;
        }

        const contentW = Math.max(viewW, config.quickItems.length * cellPitch);
        const minX = viewLeft - Math.max(0, contentW - viewW);
        const maxX = viewLeft;

        const syncCellInput = () =>
        {
            if (!stripListRoot)
            {
                return;
            }
            // Cell local X is relative to stripListRoot; world X = stripListRoot.x + localX.
            for (const entry of cellHits)
            {
                const worldX = stripListRoot.x + entry.localX;
                const half = cellSize / 2;
                const visible =
                    worldX + half > viewLeft && worldX - half < viewLeft + viewW;
                if (visible)
                {
                    if (!entry.hit.input?.enabled)
                    {
                        entry.hit.setInteractive({ useHandCursor: true });
                    }
                }
                else if (entry.hit.input?.enabled)
                {
                    entry.hit.disableInteractive();
                }
            }
        };

        const clampX = () =>
        {
            if (!stripListRoot)
            {
                return;
            }
            stripListRoot.x = Math.min(maxX, Math.max(minX, stripListRoot.x));
            syncCellInput();
        };
        syncCellInput();

        let dragging = false;
        let dragBaseX = viewLeft;
        let dragStartPointerX = 0;

        const onPointerDown = (pointer: Phaser.Input.Pointer) =>
        {
            if (
                pointer.x < viewLeft
                || pointer.x > viewLeft + viewW
                || pointer.y < stripTop
                || pointer.y > stripTop + viewH
            )
            {
                return;
            }
            dragging = true;
            dragBaseX = stripListRoot?.x ?? viewLeft;
            dragStartPointerX = pointer.x;
        };
        const onPointerMove = (pointer: Phaser.Input.Pointer) =>
        {
            if (!dragging || !pointer.isDown || !stripListRoot)
            {
                return;
            }
            stripListRoot.x = dragBaseX + (pointer.x - dragStartPointerX);
            clampX();
        };
        const onPointerUp = () =>
        {
            dragging = false;
        };
        const onWheel = (
            pointer: Phaser.Input.Pointer,
            _over: unknown,
            _dx: number,
            dy: number,
        ) =>
        {
            if (
                !stripListRoot
                || pointer.x < viewLeft
                || pointer.x > viewLeft + viewW
                || pointer.y < stripTop
                || pointer.y > stripTop + viewH
            )
            {
                return;
            }
            // Vertical wheel scrolls the strip sideways (common touchpad path).
            stripListRoot.x -= dy;
            clampX();
        };

        scene.input.on('pointerdown', onPointerDown);
        scene.input.on('pointermove', onPointerMove);
        scene.input.on('pointerup', onPointerUp);
        scene.input.on('wheel', onWheel);

        // Stash cleanup on root so dismiss can unhook listeners.
        (root as GameObjects.Container & {
            __stripCleanup?: () => void;
        }).__stripCleanup = () =>
        {
            scene.input.off('pointerdown', onPointerDown);
            scene.input.off('pointermove', onPointerMove);
            scene.input.off('pointerup', onPointerUp);
            scene.input.off('wheel', onWheel);
            stripListRoot?.filters?.internal.clear();
            stripMaskRect?.destroy();
            stripListRoot = null;
            stripMaskRect = null;
        };
    }


    const dismiss = () =>
    {
        const withCleanup = root as GameObjects.Container & {
            __stripCleanup?: () => void;
        };
        withCleanup.__stripCleanup?.();
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
