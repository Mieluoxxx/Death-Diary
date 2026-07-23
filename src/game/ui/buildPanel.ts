/**
 * Port of Buried-City BuildNode layout (BottomFrameNode chrome).
 *
 * Original stack: TopFrame stays; bottom replaces Home with:
 *   frame_bg_bottom (596×839) @ (width/2, 18) anchor bottom-center
 *   title + back + shop on action bar (local y = 803)
 *   upgrade list row under content line (local y = 770)
 *   "操作" section + action rows (formulas / sleep / …)
 *
 * Phaser: screenY = (height - 18) - localY  (Cocos y-up on bg).
 * This slice: upgrade row fully wired; action list shows stubs for bed.
 */

import { Scene, GameObjects } from 'phaser';
import {
    buildLevelName,
    itemName,
} from '../data/buildStrings';
import {
    getBuildLevel,
    getStorageCount,
} from '../session/sessionStore';
import {
    BuildUpgradeType,
    canUpgradeBuild,
    getUpgradeProgress,
    isBuildUpgrading,
    startBuildUpgrade,
} from '../systems/buildSystem';
import { gameBusOn, gameBusOff } from '../systems/gameBus';
import { addAtlasButton } from './atlasButton';
import {
    UI_FONT_FAMILY,
    UI_FONT_SIZE,
    UI_TEXT_RESOLUTION,
    uiWordWrap,
} from './uiFont';

export type BuildPanelHandle = {
    root: GameObjects.Container;
    destroy: () => void;
};

const BG_WIDTH = 596;
const BG_HEIGHT = 839;
const BG_BOTTOM_OFFSET = 18;
const ACTION_BAR_LOCAL_Y = 803;
const CONTENT_TOP_LOCAL_Y = 770;
/** createCommonListItem height */
const UPGRADE_ROW_HEIGHT = 100;
const SECTION_HEIGHT = 45;
/** tableCellSizeForIndex height in BuildNode */
const ACTION_ROW_HEIGHT = 120;
/**
 * Visual nudge: frame_bg_bottom art has empty/transparent padding at the top
 * of the content well; raw Cocos localY math sits content a few px too high.
 */
const CONTENT_Y_NUDGE = 14;

export function openBuildPanel (
    scene: Scene,
    bid: number,
    opts?: {
        onClose?: () => void;
        onUpgraded?: (bid: number, level: number) => void;
    },
): BuildPanelHandle
{
    const existing = scene.children.list.find(
        (child) => (child as GameObjects.Container).name === 'buildPanel',
    );
    if (existing)
    {
        existing.destroy(true);
    }

    const { width, height } = scene.scale;
    const root = scene.add.container(0, 0);
    root.setDepth(140);
    root.setName('buildPanel');

    const bgBottomY = height - BG_BOTTOM_OFFSET;
    const bgLeft = width / 2 - BG_WIDTH / 2;
    const toScreenY = (localY: number) => bgBottomY - localY;
    const toScreenX = (localX: number) => bgLeft + localX;

    // Solid fill first: frame_bg_bottom has a transparent center (map shows through).
    // Original Navigation replaces HomeNode entirely so nothing peeks through.
    root.add(
        scene.add
            .rectangle(width / 2, bgBottomY - BG_HEIGHT / 2, BG_WIDTH, BG_HEIGHT, 0x000000)
            .setOrigin(0.5, 0.5),
    );

    // Bottom chrome — same sprite as Home bottom frame.
    if (scene.textures.exists('ui') && scene.textures.get('ui').has('frame_bg_bottom.png'))
    {
        root.add(
            scene.add
                .image(width / 2, bgBottomY, 'ui', 'frame_bg_bottom.png')
                .setOrigin(0.5, 1),
        );
    }

    // Divider under title bar.
    if (scene.textures.exists('ui') && scene.textures.get('ui').has('frame_line.png'))
    {
        root.add(
            scene.add.image(width / 2, toScreenY(CONTENT_TOP_LOCAL_Y), 'ui', 'frame_line.png'),
        );
    }

    // ── Title bar ──
    const titleY = toScreenY(ACTION_BAR_LOCAL_Y);
    const titleText = scene.add
        .text(width / 2, titleY, buildLevelName(bid, getBuildLevel(bid)), {
            fontFamily: UI_FONT_FAMILY,
            resolution: UI_TEXT_RESOLUTION,
            fontSize: `${UI_FONT_SIZE.COMMON_1}px`,
            color: '#ffffff',
        })
        .setOrigin(0.5);
    root.add(titleText);

    let closed = false;
    const closePanel = () =>
    {
        if (closed)
        {
            return;
        }
        closed = true;
        gameBusOff('build_upgrade_progress', onProgressBus);
        gameBusOff('build_upgraded', onUpgradedBus);
        gameBusOff('session_updated', onSession);
        root.destroy(true);
        opts?.onClose?.();
    };

    // Back (left)
    if (scene.textures.exists('ui') && scene.textures.get('ui').has('btn_back.png'))
    {
        const back = scene.add
            .image(toScreenX(60), titleY, 'ui', 'btn_back.png')
            .setInteractive({ useHandCursor: true });
        root.add(back);
        back.on('pointerdown', () => back.setAlpha(0.7));
        back.on('pointerout', () => back.setAlpha(1));
        back.on('pointerup', () =>
        {
            back.setAlpha(1);
            if (isBuildUpgrading(bid))
            {
                return;
            }
            closePanel();
        });
    }
    else
    {
        const back = scene.add
            .rectangle(toScreenX(60), titleY, 82, 39, 0x333333)
            .setInteractive({ useHandCursor: true });
        root.add(back);
        back.on('pointerup', closePanel);
    }

    // Shop (right) — deferred, visual parity only.
    if (scene.textures.exists('ui') && scene.textures.get('ui').has('btn_shop.png'))
    {
        const shop = scene.add.image(toScreenX(BG_WIDTH - 60), titleY, 'ui', 'btn_shop.png');
        root.add(shop);
        if (scene.textures.get('ui').has('btn_shop_highlight.png'))
        {
            const highlight = scene.add.image(shop.x, shop.y, 'ui', 'btn_shop_highlight.png');
            root.add(highlight);
            scene.tweens.add({
                targets: highlight,
                alpha: 0,
                duration: 1500,
                yoyo: true,
                repeat: -1,
            });
        }
    }

    // ── Upgrade row (createCommonListItem 600×100) ──
    // Cocos: upgradeView anchor top at contentTopLineHeight → hangs below the line.
    const rowTopY = toScreenY(CONTENT_TOP_LOCAL_Y) + CONTENT_Y_NUDGE;
    const rowCenterY = rowTopY + UPGRADE_ROW_HEIGHT / 2;
    const row = scene.add.container(width / 2, rowCenterY);
    root.add(row);

    // Icon bg + build icon
    const iconBgX = -BG_WIDTH / 2 + 20 + 55;
    let iconBg: GameObjects.Image | GameObjects.Rectangle;
    // Icons sit a touch low in the row so they align with the white action button.
    const iconLocalY = 4;
    if (scene.textures.exists('ui') && scene.textures.get('ui').has('build_icon_bg.png'))
    {
        iconBg = scene.add.image(iconBgX, iconLocalY, 'ui', 'build_icon_bg.png');
    }
    else
    {
        iconBg = scene.add.rectangle(iconBgX, iconLocalY, 110, 73, 0x444444);
    }
    row.add(iconBg);

    // Placeholder; texture set in refreshUpgradeRow.
    const buildIcon = scene.add.image(iconBgX, iconLocalY, 'ui', 'build_icon_bg.png').setVisible(false);
    row.add(buildIcon);

    // Cost / condition text area (left of action button)
    const textLeft = iconBgX + 55 + 10;
    const costText = scene.add
        .text(textLeft, -22, '', {
            fontFamily: UI_FONT_FAMILY,
            resolution: UI_TEXT_RESOLUTION,
            fontSize: `${UI_FONT_SIZE.COMMON_3}px`,
            color: '#ffffff',
            wordWrap: uiWordWrap(260),
            lineSpacing: 2,
        })
        .setOrigin(0, 0);
    row.add(costText);

    // Material icon row (simple ItemRichText substitute)
    const itemIcons: GameObjects.Container = scene.add.container(textLeft, 10);
    row.add(itemIcons);

    // Progress bar (under materials, aligned to icon bottom)
    const pbY = 36;
    let pbBg: GameObjects.Image | GameObjects.Rectangle;
    let pbFill: GameObjects.Rectangle;
    if (scene.textures.exists('ui') && scene.textures.get('ui').has('pb_bg.png'))
    {
        pbBg = scene.add.image(textLeft, pbY, 'ui', 'pb_bg.png').setOrigin(0, 0.5);
        row.add(pbBg);
        const fillW = scene.textures.get('ui').has('pb.png')
            ? scene.textures.get('ui').get('pb.png').width
            : 264;
        pbFill = scene.add.rectangle(textLeft, pbY, 1, 13, 0x8fbf6a).setOrigin(0, 0.5);
        if (scene.textures.get('ui').has('pb.png'))
        {
            // use crop on pb sprite instead when available
            const pbImg = scene.add.image(textLeft, pbY, 'ui', 'pb.png').setOrigin(0, 0.5);
            row.add(pbImg);
            pbFill.setVisible(false);
            (pbFill as unknown as { _pbImg?: GameObjects.Image })._pbImg = pbImg;
        }
        row.add(pbFill);
        void fillW;
    }
    else
    {
        pbBg = scene.add.rectangle(textLeft, pbY, 268, 17, 0x555555).setOrigin(0, 0.5);
        pbFill = scene.add.rectangle(textLeft, pbY, 1, 13, 0x8fbf6a).setOrigin(0, 0.5);
        row.add(pbBg);
        row.add(pbFill);
    }

    // Action button "建造/升级"
    let actionBtnLabel = '升级';
    let actionBtn: ReturnType<typeof addAtlasButton> | GameObjects.Container | null = null;
    const actionX = BG_WIDTH / 2 - 10 - 79;
    if (scene.textures.exists('ui') && scene.textures.get('ui').has('btn_common_white_normal.png'))
    {
        actionBtn = addAtlasButton(scene, actionX, 0, {
            atlas: 'ui',
            frame: 'btn_common_white_normal.png',
            label: actionBtnLabel,
            labelSizeTier: 'COMMON_2',
            onClick: () => tryUpgrade(),
        });
        row.add(actionBtn);
    }

    // ── Section "操作" ──
    const sectionY = rowTopY + UPGRADE_ROW_HEIGHT + SECTION_HEIGHT / 2;
    if (scene.textures.exists('ui') && scene.textures.get('ui').has('frame_section_bg.png'))
    {
        root.add(scene.add.image(width / 2, sectionY, 'ui', 'frame_section_bg.png'));
    }
    else
    {
        root.add(scene.add.rectangle(width / 2, sectionY, 584, 45, 0xe8e0d0));
    }
    root.add(
        scene.add
            .text(bgLeft + 20, sectionY, '操作', {
                fontFamily: UI_FONT_FAMILY,
                resolution: UI_TEXT_RESOLUTION,
                fontSize: `${UI_FONT_SIZE.COMMON_2}px`,
                color: '#111111',
            })
            .setOrigin(0, 0.5),
    );

    // Action list (bed: 3 sleep rows locked until built; others: placeholder).
    const listTop = sectionY + SECTION_HEIGHT / 2 + 8;
    const actionListRoot = scene.add.container(width / 2, listTop);
    root.add(actionListRoot);

    const rebuildActionList = (level: number) =>
    {
        actionListRoot.removeAll(true);
        if (bid === 9)
        {
            // Original BedBuildActionType: SLEEP_1_HOUR / SLEEP_4_HOUR / SLEEP_ALL_NIGHT
            // strings: 1144("%s" hours) → 睡N个小时; 1145 → 睡到天亮; button 1018 → 睡觉
            // needBuild {bid:9, level:0}: unbuilt → red "你没有睡袋!"
            const sleepHints = ['睡1个小时', '睡4个小时', '睡到天亮'];
            sleepHints.forEach((hint, index) =>
            {
                // Cell center: original TableView cell height 120, top-down fill.
                const rowY = ACTION_ROW_HEIGHT / 2 + index * ACTION_ROW_HEIGHT;
                const row = scene.add.container(0, rowY);
                actionListRoot.add(row);

                const iconX = -BG_WIDTH / 2 + 20 + 55;
                const iconY = 4;
                if (scene.textures.exists('ui') && scene.textures.get('ui').has('build_icon_bg.png'))
                {
                    row.add(scene.add.image(iconX, iconY, 'ui', 'build_icon_bg.png'));
                }
                const actionFrame = `build_action_9_${index}.png`;
                if (scene.textures.exists('build') && scene.textures.get('build').has(actionFrame))
                {
                    row.add(scene.add.image(iconX, iconY, 'build', actionFrame));
                }
                else if (scene.textures.exists('build') && scene.textures.get('build').has('build_9_0.png'))
                {
                    row.add(scene.add.image(iconX, iconY, 'build', 'build_9_0.png').setScale(0.85));
                }

                // Hint: locked red OR duration label (white) when built.
                const hintText = level < 0 ? '你没有睡袋!' : hint;
                const hintColor = level < 0 ? '#ff5555' : '#ffffff';
                row.add(
                    scene.add
                        .text(-BG_WIDTH / 2 + 140, iconY - 10, hintText, {
                            fontFamily: UI_FONT_FAMILY,
                            resolution: UI_TEXT_RESOLUTION,
                            fontSize: `${UI_FONT_SIZE.COMMON_3}px`,
                            color: hintColor,
                        })
                        .setOrigin(0, 0.5),
                );

                // Progress bar under hint (original list item always has pb).
                if (scene.textures.exists('ui') && scene.textures.get('ui').has('pb_bg.png'))
                {
                    row.add(
                        scene.add
                            .image(-BG_WIDTH / 2 + 140, iconY + 22, 'ui', 'pb_bg.png')
                            .setOrigin(0, 0.5),
                    );
                }

                if (scene.textures.exists('ui') && scene.textures.get('ui').has('btn_common_white_normal.png'))
                {
                    const sleepBtn = addAtlasButton(scene, BG_WIDTH / 2 - 90, 0, {
                        atlas: 'ui',
                        frame: 'btn_common_white_normal.png',
                        label: '睡觉',
                        labelSizeTier: 'COMMON_2',
                        enabled: level >= 0,
                        onClick: level >= 0
                            ? () =>
                            {
                                // Sleep system deferred (timer + attr restore next pass).
                            }
                            : undefined,
                    });
                    row.add(sleepBtn);
                }
            });
            return;
        }

        actionListRoot.add(
            scene.add
                .text(0, 40, '制作/操作列表将在后续版本开放。', {
                    fontFamily: UI_FONT_FAMILY,
                    resolution: UI_TEXT_RESOLUTION,
                    fontSize: `${UI_FONT_SIZE.COMMON_3}px`,
                    color: '#cccccc',
                    align: 'center',
                    wordWrap: uiWordWrap(520),
                })
                .setOrigin(0.5, 0),
        );
    };

    const setProgress = (pct: number) =>
    {
        const clamped = Math.max(0, Math.min(100, pct));
        const maxW = 264;
        const w = Math.max(1, (maxW * clamped) / 100);
        const pbImg = (pbFill as unknown as { _pbImg?: GameObjects.Image })._pbImg;
        if (pbImg && scene.textures.exists('ui') && scene.textures.get('ui').has('pb.png'))
        {
            const frame = scene.textures.get('ui').get('pb.png');
            pbImg.setCrop(0, 0, Math.max(1, Math.floor(frame.width * clamped / 100)), frame.height);
            pbImg.setVisible(clamped > 0);
        }
        else
        {
            pbFill.width = w;
            pbFill.setVisible(clamped > 0);
        }
    };

    const clearItemIcons = () =>
    {
        itemIcons.removeAll(true);
    };

    const showCostIcons = (
        costs: Array<{ itemId: number; num: number; ok?: boolean }>,
    ) =>
    {
        clearItemIcons();
        let x = 0;
        costs.forEach((cost) =>
        {
            const frame = `icon_item_${cost.itemId}.png`;
            if (scene.textures.exists('icon') && scene.textures.get('icon').has(frame))
            {
                const icon = scene.add.image(x, 0, 'icon', frame).setScale(0.3).setOrigin(0, 0.5);
                itemIcons.add(icon);
                x += icon.displayWidth + 2;
            }
            const label = scene.add
                .text(x, 0, `x${cost.num}`, {
                    fontFamily: UI_FONT_FAMILY,
                    resolution: UI_TEXT_RESOLUTION,
                    fontSize: '16px',
                    color: cost.ok === false ? '#ff5555' : '#ffffff',
                })
                .setOrigin(0, 0.5);
            itemIcons.add(label);
            x += label.width + 12;
        });
    };

    const setActionEnabled = (enabled: boolean, label?: string) =>
    {
        if (label && actionBtn && 'setLabel' in actionBtn)
        {
            actionBtn.setLabel(label);
        }
        if (actionBtn)
        {
            actionBtn.setAlpha(enabled ? 1 : 0.45);
            // Disable hit via alpha gate in tryUpgrade.
        }
    };

    let actionEnabled = false;

    const refreshUpgradeRow = () =>
    {
        const level = getBuildLevel(bid);
        titleText.setText(buildLevelName(bid, level));

        if (isBuildUpgrading(bid))
        {
            costText.setText('');
            clearItemIcons();
            setProgress(getUpgradeProgress(bid));
            setActionEnabled(false, level < 0 ? '建造' : '升级');
            actionEnabled = false;
            rebuildActionList(level);
            return;
        }

        const check = canUpgradeBuild(bid);
        if (check.type === BuildUpgradeType.MAX_LEVEL)
        {
            // Show current max icon
            const iconFrame = `build_${bid}_${Math.max(0, level)}.png`;
            if (scene.textures.exists('build') && scene.textures.get('build').has(iconFrame))
            {
                buildIcon.setTexture('build', iconFrame).setVisible(true);
            }
            costText.setText('已升至最高级');
            costText.setColor('#ffffff');
            clearItemIcons();
            setProgress(0);
            setActionEnabled(false);
            actionEnabled = false;
            rebuildActionList(level);
            return;
        }

        const nextLevel = check.nextLevel ?? level + 1;
        const minutes = check.nextConfig?.createTime ?? 0;
        const iconFrame = `build_${bid}_${nextLevel}.png`;
        if (scene.textures.exists('build') && scene.textures.get('build').has(iconFrame))
        {
            buildIcon.setTexture('build', iconFrame).setVisible(true);
        }
        else
        {
            buildIcon.setVisible(false);
        }

        const btnLabel = level < 0
            ? `建造(${minutes}分)`
            : `升级(${minutes}分)`;

        if (check.type === BuildUpgradeType.CONDITION && check.condition)
        {
            const needName = buildLevelName(check.condition.bid, check.condition.level);
            costText.setText(`你没有${needName}!`);
            costText.setColor('#ff5555');
            clearItemIcons();
            setActionEnabled(false, btnLabel);
            actionEnabled = false;
        }
        else
        {
            costText.setText('');
            const costs = (check.cost ?? check.nextConfig?.cost ?? []).map((item) =>
            {
                const have = getStorageCount(item.itemId);
                return {
                    itemId: item.itemId,
                    num: item.num,
                    ok: have >= item.num,
                };
            });
            showCostIcons(costs);
            const can = check.type === BuildUpgradeType.UPGRADABLE;
            setActionEnabled(can, btnLabel);
            actionEnabled = can;
            if (!can)
            {
                // still show costs in red via ok flags
            }
        }

        setProgress(0);
        rebuildActionList(level);
    };

    const tryUpgrade = () =>
    {
        if (!actionEnabled || isBuildUpgrading(bid))
        {
            refreshUpgradeRow();
            return;
        }
        startBuildUpgrade(bid, {
            onProgress: setProgress,
            onComplete: () => refreshUpgradeRow(),
            onFail: (reason) =>
            {
                if (reason === 'vigour')
                {
                    costText.setText('精力不足，无法操作。');
                    costText.setColor('#ff5555');
                    clearItemIcons();
                }
                else
                {
                    refreshUpgradeRow();
                }
            },
        });
        refreshUpgradeRow();
    };

    const onProgressBus = (payload: { bid: number; percentage: number }) =>
    {
        if (payload.bid === bid)
        {
            setProgress(payload.percentage);
        }
    };
    const onUpgradedBus = (payload: { bid: number; level: number }) =>
    {
        if (payload.bid !== bid)
        {
            return;
        }
        refreshUpgradeRow();
        opts?.onUpgraded?.(payload.bid, payload.level);
    };
    const onSession = () => refreshUpgradeRow();

    gameBusOn('build_upgrade_progress', onProgressBus);
    gameBusOn('build_upgraded', onUpgradedBus);
    gameBusOn('session_updated', onSession);

    refreshUpgradeRow();

    // Silence unused helpers
    void itemName;

    return {
        root,
        destroy: closePanel,
    };
}
