/**
 * Port of Buried-City uiUtil.showBuildDialog.
 * Upgrade-row icon opens: dig art + build copy + "建造需要" cost list.
 */
import type { GameObjects, Scene } from 'phaser';
import { buildLevelDes, buildLevelName } from '../data/buildStrings';
import { getBuildLevel, getStorageCount } from '../session/sessionStore';
import { playPopup } from '../systems/audioManager';
import { BuildUpgradeType, canUpgradeBuild } from '../systems/buildSystem';
import { addAtlasButton } from './atlasButton';
import { uiTextStyle, uiWordWrap } from './uiFont';

const DIALOG_FRAME = 'dialog_big_bg.png';
const FALLBACK_FRAME = 'dialog_small_2_bg.png';
const DIALOG_WIDTH = 448;
const DIALOG_HEIGHT = 625;
const TITLE_HEIGHT = 90;
const ACTION_HEIGHT = 72;
const LEFT_EDGE = 20;
const LAYER_NAME = 'buildDialog';

/**
 * Original: show next level when not max, else current max level.
 */
function detailLevel(bid: number): number {
    const level = getBuildLevel(bid);
    const check = canUpgradeBuild(bid);
    if (check.type === BuildUpgradeType.MAX_LEVEL) {
        return Math.max(0, level);
    }
    return check.nextLevel ?? Math.max(0, level + 1);
}

export function openBuildDetailDialog(scene: Scene, bid: number): GameObjects.Container {
    const existing = scene.children.list.find(
        (child) => (child as GameObjects.Container).name === LAYER_NAME,
    );
    if (existing) {
        existing.destroy(true);
    }

    const level = detailLevel(bid);
    const title = buildLevelName(bid, level);
    const description = buildLevelDes(bid, level);
    const { width, height } = scene.scale;

    const root = scene.add.container(0, 0);
    root.setDepth(260);
    root.setName(LAYER_NAME);
    playPopup();

    const dim = scene.add
        .rectangle(width / 2, height / 2, width, height, 0x000000, 0.72)
        .setInteractive();
    root.add(dim);

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

    const iconFrame = `build_${bid}_${level}.png`;
    let titleX = textLeft;
    if (scene.textures.exists('build') && scene.textures.get('build').has(iconFrame)) {
        const icon = scene.add
            .image(textLeft, titleTopY + 28, 'build', iconFrame)
            .setOrigin(0, 0.5)
            .setScale(0.55);
        root.add(icon);
        titleX = textLeft + icon.displayWidth + 10;
    }

    root.add(
        scene.add
            .text(titleX, titleTopY + 18, title, {
                ...uiTextStyle('COMMON_1'),
                color: '#111111',
                wordWrap: uiWordWrap(bgLeft + DIALOG_WIDTH - LEFT_EDGE - titleX),
                maxLines: 1,
            })
            .setOrigin(0, 0.5),
    );

    const digFrame = `dig_build_${bid}_${level}.png`;
    let cursorY = contentTopY + 8;
    if (scene.textures.exists('dig_build') && scene.textures.get('dig_build').has(digFrame)) {
        const dig = scene.add
            .image(bgCenterX, contentTopY + 12, 'dig_build', digFrame)
            .setOrigin(0.5, 0);
        const maxW = textWidth;
        if (dig.width > maxW) {
            dig.setScale(maxW / dig.width);
        }
        root.add(dig);
        cursorY = dig.y + dig.displayHeight + 12;
    } else if (scene.textures.exists('build') && scene.textures.get('build').has(iconFrame)) {
        const big = scene.add
            .image(bgCenterX, contentTopY + 12, 'build', iconFrame)
            .setOrigin(0.5, 0)
            .setScale(1.6);
        root.add(big);
        cursorY = big.y + big.displayHeight + 12;
    }

    const des = scene.add
        .text(textLeft, cursorY, description, {
            ...uiTextStyle('COMMON_3'),
            color: '#111111',
            wordWrap: uiWordWrap(textWidth),
            lineSpacing: 4,
        })
        .setOrigin(0, 0);
    root.add(des);
    cursorY = des.y + des.height + 16;

    // Original only shows "建造需要" when upgradeConfig exists (not max level).
    const check = canUpgradeBuild(bid);
    if (check.type !== BuildUpgradeType.MAX_LEVEL) {
        const costs = check.cost ?? check.nextConfig?.cost ?? [];
        if (costs.length > 0) {
            const needLabel = scene.add
                .text(textLeft, cursorY, '建造需要:', {
                    ...uiTextStyle('COMMON_3'),
                    color: '#111111',
                })
                .setOrigin(0, 0);
            root.add(needLabel);
            cursorY = needLabel.y + needLabel.height + 10;

            // 3 columns, matching original ItemRichText col=3 scale 0.5.
            const colW = textWidth / 3;
            costs.forEach((cost, index) => {
                const col = index % 3;
                const row = Math.floor(index / 3);
                const cellX = textLeft + col * colW;
                const cellY = cursorY + row * 42;
                const have = getStorageCount(cost.itemId);
                const ok = have >= cost.num;
                const frame = `icon_item_${cost.itemId}.png`;
                if (scene.textures.exists('icon') && scene.textures.get('icon').has(frame)) {
                    root.add(
                        scene.add
                            .image(cellX, cellY + 12, 'icon', frame)
                            .setOrigin(0, 0.5)
                            .setScale(0.4),
                    );
                }
                root.add(
                    scene.add
                        .text(cellX + 40, cellY + 12, `x${cost.num}`, {
                            ...uiTextStyle('COMMON_3'),
                            color: ok ? '#111111' : '#cc2222',
                        })
                        .setOrigin(0, 0.5),
                );
            });
        }
    }

    const dismiss = () => {
        root.destroy(true);
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

    if (
        scene.textures.exists('ui') &&
        scene.textures.get('ui').has('btn_common_black_normal.png')
    ) {
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
    } else {
        const fallback = scene.add
            .rectangle(bgCenterX, actionCenterY, 158, 45, 0x222222)
            .setInteractive({ useHandCursor: true });
        const fallbackText = scene.add
            .text(bgCenterX, actionCenterY, '知道了', {
                ...uiTextStyle(20),
                color: '#f5f0e6',
            })
            .setOrigin(0.5);
        fallback.on('pointerup', dismiss);
        root.add([fallback, fallbackText]);
    }

    return root;
}
