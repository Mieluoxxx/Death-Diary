/**
 * Port of Buried-City BuildNode layout (BottomFrameNode chrome).
 *
 * Original stack: TopFrame stays; bottom replaces Home with:
 *   frame_bg_bottom (596×839) @ (width/2, 18) anchor bottom-center
 *   title + back + shop on action bar (local y = 803)
 *   upgrade list row under content line (local y = 770)
 *   "操作" section + scrollable action rows (formulas / sleep / rest / …)
 *
 * Phaser: screenY = (height - 18) - localY  (Cocos y-up on bg).
 * Upgrade row + craft/facility action list are fully wired.
 */

import type { GameObjects, Scene } from 'phaser';
import { buildLevelName } from '../data/buildStrings';
import { getBuildLevel, getStorageCount } from '../session/sessionStore';
import {
    BuildUpgradeType,
    canUpgradeBuild,
    getUpgradeProgress,
    isBuildUpgrading,
    startBuildUpgrade,
} from '../systems/buildSystem';
import { type CraftActionView, clickCraftAction, listCraftActions } from '../systems/craftSystem';
import {
    clickFacilityAction,
    type FacilityActionView,
    listFacilityActions,
} from '../systems/facilityAction';
import { gameBusOff, gameBusOn } from '../systems/gameBus';
import { addAtlasButton } from './atlasButton';
import { mountScrollViewport, type ScrollViewportHandle } from './scrollViewport';
import { UI_FONT_FAMILY, UI_FONT_SIZE, UI_TEXT_RESOLUTION, uiWordWrap } from './uiFont';

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

export function openBuildPanel(
    scene: Scene,
    bid: number,
    opts?: {
        onClose?: () => void;
        onUpgraded?: (bid: number, level: number) => void;
    },
): BuildPanelHandle {
    const existing = scene.children.list.find(
        (child) => (child as GameObjects.Container).name === 'buildPanel',
    );
    if (existing) {
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
    if (scene.textures.exists('ui') && scene.textures.get('ui').has('frame_bg_bottom.png')) {
        root.add(
            scene.add.image(width / 2, bgBottomY, 'ui', 'frame_bg_bottom.png').setOrigin(0.5, 1),
        );
    }

    // Divider under title bar.
    if (scene.textures.exists('ui') && scene.textures.get('ui').has('frame_line.png')) {
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
    let actionScroll: ScrollViewportHandle | null = null;
    const closePanel = () => {
        if (closed) {
            return;
        }
        closed = true;
        gameBusOff('progress', onProgressBus);
        gameBusOff('build_upgraded', onUpgradedBus);
        gameBusOff('session_updated', onSession);
        gameBusOff('craft_changed', onCraftChanged);
        gameBusOff('facility_changed', onFacilityChanged);
        actionScroll?.destroy();
        actionScroll = null;
        root.destroy(true);
        opts?.onClose?.();
    };

    // Back (left)
    if (scene.textures.exists('ui') && scene.textures.get('ui').has('btn_back.png')) {
        const back = scene.add
            .image(toScreenX(60), titleY, 'ui', 'btn_back.png')
            .setInteractive({ useHandCursor: true });
        root.add(back);
        back.on('pointerdown', () => back.setAlpha(0.7));
        back.on('pointerout', () => back.setAlpha(1));
        back.on('pointerup', () => {
            back.setAlpha(1);
            if (isBuildUpgrading(bid)) {
                return;
            }
            closePanel();
        });
    } else {
        const back = scene.add
            .rectangle(toScreenX(60), titleY, 82, 39, 0x333333)
            .setInteractive({ useHandCursor: true });
        root.add(back);
        back.on('pointerup', closePanel);
    }

    // Shop (right) — deferred, visual parity only.
    if (scene.textures.exists('ui') && scene.textures.get('ui').has('btn_shop.png')) {
        const shop = scene.add.image(toScreenX(BG_WIDTH - 60), titleY, 'ui', 'btn_shop.png');
        root.add(shop);
        if (scene.textures.get('ui').has('btn_shop_highlight.png')) {
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
    if (scene.textures.exists('ui') && scene.textures.get('ui').has('build_icon_bg.png')) {
        iconBg = scene.add.image(iconBgX, iconLocalY, 'ui', 'build_icon_bg.png');
    } else {
        iconBg = scene.add.rectangle(iconBgX, iconLocalY, 110, 73, 0x444444);
    }
    row.add(iconBg);

    // Placeholder; texture set in refreshUpgradeRow.
    const buildIcon = scene.add
        .image(iconBgX, iconLocalY, 'ui', 'build_icon_bg.png')
        .setVisible(false);
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
    if (scene.textures.exists('ui') && scene.textures.get('ui').has('pb_bg.png')) {
        pbBg = scene.add.image(textLeft, pbY, 'ui', 'pb_bg.png').setOrigin(0, 0.5);
        row.add(pbBg);
        const fillW = scene.textures.get('ui').has('pb.png')
            ? scene.textures.get('ui').get('pb.png').width
            : 264;
        pbFill = scene.add.rectangle(textLeft, pbY, 1, 13, 0x8fbf6a).setOrigin(0, 0.5);
        if (scene.textures.get('ui').has('pb.png')) {
            // use crop on pb sprite instead when available
            const pbImg = scene.add.image(textLeft, pbY, 'ui', 'pb.png').setOrigin(0, 0.5);
            row.add(pbImg);
            pbFill.setVisible(false);
            (pbFill as unknown as { _pbImg?: GameObjects.Image })._pbImg = pbImg;
        }
        row.add(pbFill);
        void fillW;
    } else {
        pbBg = scene.add.rectangle(textLeft, pbY, 268, 17, 0x555555).setOrigin(0, 0.5);
        pbFill = scene.add.rectangle(textLeft, pbY, 1, 13, 0x8fbf6a).setOrigin(0, 0.5);
        row.add(pbBg);
        row.add(pbFill);
    }

    // Action button "建造/升级"
    const actionBtnLabel = '升级';
    let actionBtn: ReturnType<typeof addAtlasButton> | GameObjects.Container | null = null;
    const actionX = BG_WIDTH / 2 - 10 - 79;
    if (
        scene.textures.exists('ui') &&
        scene.textures.get('ui').has('btn_common_white_normal.png')
    ) {
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
    if (scene.textures.exists('ui') && scene.textures.get('ui').has('frame_section_bg.png')) {
        root.add(scene.add.image(width / 2, sectionY, 'ui', 'frame_section_bg.png'));
    } else {
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
    // Scrollable action list (original TableView under "操作") via shared ScrollViewport.
    const listTop = sectionY + SECTION_HEIGHT / 2 + 8;
    const listViewH = Math.max(120, bgBottomY - listTop - 12);
    const listLeft = width / 2 - BG_WIDTH / 2;

    actionScroll = mountScrollViewport(scene, root, {
        x: listLeft,
        y: listTop,
        width: BG_WIDTH,
        height: listViewH,
        axis: 'y',
        inputBlocker: true,
    });

    // Rows are authored with x=0 as horizontal center.
    const actionListRoot = scene.add.container(BG_WIDTH / 2, 0);
    actionScroll.content.add(actionListRoot);

    const rebuildActionList = (level: number) => {
        if (!actionScroll || closed) {
            return;
        }
        const prevOffset = actionScroll.getOffset();
        actionScroll.syncMask();
        actionListRoot.removeAll(true);
        actionScroll.clearHits();

        const facilityActions = listFacilityActions(bid);
        const craftActions = listCraftActions(bid);

        if (facilityActions.length === 0 && craftActions.length === 0) {
            actionListRoot.add(
                scene.add
                    .text(0, 40, level < 0 ? '建造后解锁操作。' : '暂无操作。', {
                        fontFamily: UI_FONT_FAMILY,
                        resolution: UI_TEXT_RESOLUTION,
                        fontSize: `${UI_FONT_SIZE.COMMON_3}px`,
                        color: '#cccccc',
                        align: 'center',
                        wordWrap: uiWordWrap(520),
                    })
                    .setOrigin(0.5, 0),
            );
            actionScroll.setContentSize(listViewH);
            actionScroll.setOffset(0);
            return;
        }

        let rowIndex = 0;
        facilityActions.forEach((action) => {
            mountFacilityRow(
                scene,
                actionListRoot,
                action,
                rowIndex,
                (msg) => {
                    costText.setText(msg);
                    costText.setColor('#ff5555');
                    clearItemIcons();
                },
                () => Boolean(actionScroll?.didDrag()),
            );
            rowIndex += 1;
        });
        craftActions.forEach((action) => {
            mountCraftRow(
                scene,
                actionListRoot,
                action,
                rowIndex,
                (msg) => {
                    costText.setText(msg);
                    costText.setColor('#ff5555');
                    clearItemIcons();
                },
                () => Boolean(actionScroll?.didDrag()),
            );
            rowIndex += 1;
        });

        actionScroll.setContentSize(Math.max(listViewH, rowIndex * ACTION_ROW_HEIGHT));
        actionScroll.setOffset(prevOffset);
    };

    const setProgress = (pct: number) => {
        const clamped = Math.max(0, Math.min(100, pct));
        const maxW = 264;
        const w = Math.max(1, (maxW * clamped) / 100);
        const pbImg = (pbFill as unknown as { _pbImg?: GameObjects.Image })._pbImg;
        if (pbImg && scene.textures.exists('ui') && scene.textures.get('ui').has('pb.png')) {
            const frame = scene.textures.get('ui').get('pb.png');
            pbImg.setCrop(
                0,
                0,
                Math.max(1, Math.floor((frame.width * clamped) / 100)),
                frame.height,
            );
            pbImg.setVisible(clamped > 0);
        } else {
            pbFill.width = w;
            pbFill.setVisible(clamped > 0);
        }
    };

    const clearItemIcons = () => {
        itemIcons.removeAll(true);
    };

    const showCostIcons = (costs: Array<{ itemId: number; num: number; ok?: boolean }>) => {
        clearItemIcons();
        let x = 0;
        costs.forEach((cost) => {
            const frame = `icon_item_${cost.itemId}.png`;
            if (scene.textures.exists('icon') && scene.textures.get('icon').has(frame)) {
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

    const setActionEnabled = (enabled: boolean, label?: string) => {
        if (label && actionBtn && 'setLabel' in actionBtn) {
            actionBtn.setLabel(label);
        }
        if (actionBtn) {
            actionBtn.setAlpha(enabled ? 1 : 0.45);
            // Disable hit via alpha gate in tryUpgrade.
        }
    };

    let actionEnabled = false;

    const refreshUpgradeRow = () => {
        const level = getBuildLevel(bid);
        titleText.setText(buildLevelName(bid, level));

        if (isBuildUpgrading(bid)) {
            costText.setText('');
            clearItemIcons();
            setProgress(getUpgradeProgress(bid));
            setActionEnabled(false, level < 0 ? '建造' : '升级');
            actionEnabled = false;
            rebuildActionList(level);
            return;
        }

        const check = canUpgradeBuild(bid);
        if (check.type === BuildUpgradeType.MAX_LEVEL) {
            // Show current max icon
            const iconFrame = `build_${bid}_${Math.max(0, level)}.png`;
            if (scene.textures.exists('build') && scene.textures.get('build').has(iconFrame)) {
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
        if (scene.textures.exists('build') && scene.textures.get('build').has(iconFrame)) {
            buildIcon.setTexture('build', iconFrame).setVisible(true);
        } else {
            buildIcon.setVisible(false);
        }

        const btnLabel = level < 0 ? `建造(${minutes}分)` : `升级(${minutes}分)`;

        if (check.type === BuildUpgradeType.CONDITION && check.condition) {
            const needName = buildLevelName(check.condition.bid, check.condition.level);
            costText.setText(`你没有${needName}!`);
            costText.setColor('#ff5555');
            clearItemIcons();
            setActionEnabled(false, btnLabel);
            actionEnabled = false;
        } else {
            costText.setText('');
            const costs = (check.cost ?? check.nextConfig?.cost ?? []).map((item) => {
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
            if (!can) {
                // still show costs in red via ok flags
            }
        }

        setProgress(0);
        rebuildActionList(level);
    };

    const tryUpgrade = () => {
        if (!actionEnabled || isBuildUpgrading(bid)) {
            refreshUpgradeRow();
            return;
        }
        startBuildUpgrade(bid, {
            onProgress: setProgress,
            onComplete: () => refreshUpgradeRow(),
            onFail: (reason) => {
                if (reason === 'vigour') {
                    costText.setText('精力不足，无法操作。');
                    costText.setColor('#ff5555');
                    clearItemIcons();
                } else {
                    refreshUpgradeRow();
                }
            },
        });
        refreshUpgradeRow();
    };

    const onProgressBus = (payload: {
        channel: { kind: string; id: number; actionId?: number };
        percentage: number;
    }) => {
        if (payload.channel.id !== bid) {
            return;
        }
        if (payload.channel.kind === 'build_upgrade') {
            setProgress(payload.percentage);
            return;
        }
        if (payload.channel.kind === 'craft' || payload.channel.kind === 'facility') {
            // Rebuild action rows so per-row percentage / sleeping hint refresh.
            rebuildActionList(getBuildLevel(bid));
        }
    };
    const onUpgradedBus = (payload: { bid: number; level: number }) => {
        if (payload.bid !== bid) {
            return;
        }
        refreshUpgradeRow();
        opts?.onUpgraded?.(payload.bid, payload.level);
    };
    const onSession = () => refreshUpgradeRow();
    const onCraftChanged = (payload: { bid: number }) => {
        if (payload.bid === bid) {
            refreshUpgradeRow();
        }
    };
    const onFacilityChanged = (payload: { bid: number }) => {
        if (payload.bid === bid) {
            refreshUpgradeRow();
        }
    };

    gameBusOn('progress', onProgressBus);
    gameBusOn('build_upgraded', onUpgradedBus);
    gameBusOn('session_updated', onSession);
    gameBusOn('craft_changed', onCraftChanged);
    gameBusOn('facility_changed', onFacilityChanged);

    refreshUpgradeRow();

    return {
        root,
        destroy: closePanel,
    };
}

function mountCraftRow(
    scene: Scene,
    parent: GameObjects.Container,
    action: CraftActionView,
    index: number,
    onFail: (msg: string) => void,
    wasDragging: () => boolean,
): void {
    const rowY = ACTION_ROW_HEIGHT / 2 + index * ACTION_ROW_HEIGHT;
    const row = scene.add.container(0, rowY);
    parent.add(row);

    const iconX = -BG_WIDTH / 2 + 20 + 55;
    const iconY = 4;
    if (scene.textures.exists('ui') && scene.textures.get('ui').has('build_icon_bg.png')) {
        row.add(scene.add.image(iconX, iconY, 'ui', 'build_icon_bg.png'));
    }

    // Prefer produce icon; stove/trap fall back to build_action frames.
    // icon_item is 84²; build_action / build_* slots are 110×73 (same as build_icon_bg).
    // Scale item icons to ~slot width; keep action frames at 1.0 to fill the slot.
    const iconFrame = `icon_item_${action.produceItemId}.png`;
    const trapFrame = `build_action_${action.bid}_0.png`;
    if (
        action.kind !== 'stove' &&
        scene.textures.exists('icon') &&
        scene.textures.get('icon').has(iconFrame)
    ) {
        // 84 * 0.9 ≈ 76 — sits inside 110×73 slot without looking tiny.
        row.add(scene.add.image(iconX, iconY, 'icon', iconFrame).setScale(0.9));
    } else if (scene.textures.exists('build') && scene.textures.get('build').has(trapFrame)) {
        row.add(scene.add.image(iconX, iconY, 'build', trapFrame));
    } else if (
        scene.textures.exists('build') &&
        scene.textures.get('build').has(`build_${action.bid}_0.png`)
    ) {
        row.add(scene.add.image(iconX, iconY, 'build', `build_${action.bid}_0.png`));
    }

    const textLeft = -BG_WIDTH / 2 + 140;
    if (action.hint) {
        const color =
            action.hintColor === 'red'
                ? '#ff5555'
                : action.hintColor === 'white'
                  ? '#ffffff'
                  : '#cccccc';
        row.add(
            scene.add
                .text(textLeft, iconY - 18, action.hint, {
                    fontFamily: UI_FONT_FAMILY,
                    resolution: UI_TEXT_RESOLUTION,
                    fontSize: `${UI_FONT_SIZE.COMMON_3}px`,
                    color,
                })
                .setOrigin(0, 0.5),
        );
    } else if (action.step === 0 && !action.isActioning) {
        // Cost icons
        let cx = textLeft;
        action.costRows.forEach((cost) => {
            const frame = `icon_item_${cost.itemId}.png`;
            if (scene.textures.exists('icon') && scene.textures.get('icon').has(frame)) {
                const icon = scene.add
                    .image(cx, iconY - 10, 'icon', frame)
                    .setScale(0.28)
                    .setOrigin(0, 0.5);
                row.add(icon);
                cx += icon.displayWidth + 2;
            }
            row.add(
                scene.add
                    .text(cx, iconY - 10, `x${cost.num}`, {
                        fontFamily: UI_FONT_FAMILY,
                        resolution: UI_TEXT_RESOLUTION,
                        fontSize: '16px',
                        color: cost.ok ? '#ffffff' : '#ff5555',
                    })
                    .setOrigin(0, 0.5),
            );
            cx += 36;
        });
    }

    // Progress bar
    const pbY = iconY + 22;
    if (scene.textures.exists('ui') && scene.textures.get('ui').has('pb_bg.png')) {
        row.add(scene.add.image(textLeft, pbY, 'ui', 'pb_bg.png').setOrigin(0, 0.5));
        if (scene.textures.get('ui').has('pb.png') && action.percentage > 0) {
            const frame = scene.textures.get('ui').get('pb.png');
            const fill = scene.add.image(textLeft, pbY, 'ui', 'pb.png').setOrigin(0, 0.5);
            fill.setCrop(
                0,
                0,
                Math.max(1, Math.floor((frame.width * action.percentage) / 100)),
                frame.height,
            );
            row.add(fill);
        }
    } else {
        row.add(scene.add.rectangle(textLeft + 134, pbY, 268, 12, 0x444444).setOrigin(0.5, 0.5));
        if (action.percentage > 0) {
            row.add(
                scene.add
                    .rectangle(
                        textLeft,
                        pbY,
                        Math.max(2, (268 * action.percentage) / 100),
                        10,
                        0x8fbf6a,
                    )
                    .setOrigin(0, 0.5),
            );
        }
    }

    if (
        scene.textures.exists('ui') &&
        scene.textures.get('ui').has('btn_common_white_normal.png')
    ) {
        const btn = addAtlasButton(scene, BG_WIDTH / 2 - 90, 0, {
            atlas: 'ui',
            frame: 'btn_common_white_normal.png',
            label: action.actionLabel,
            labelSizeTier: 'COMMON_2',
            enabled: !action.actionDisabled,
            onClick: action.actionDisabled
                ? undefined
                : () => {
                      if (wasDragging()) {
                          return;
                      }
                      const res = clickCraftAction(action.bid, action.formulaId);
                      if (!res.ok) {
                          onFail(res.msg);
                      }
                  },
        });
        row.add(btn);
    }
}

function mountFacilityRow(
    scene: Scene,
    parent: GameObjects.Container,
    action: FacilityActionView,
    index: number,
    onFail: (msg: string) => void,
    wasDragging: () => boolean,
): void {
    const rowY = ACTION_ROW_HEIGHT / 2 + index * ACTION_ROW_HEIGHT;
    const row = scene.add.container(0, rowY);
    parent.add(row);

    const iconX = -BG_WIDTH / 2 + 20 + 55;
    const iconY = 4;
    if (scene.textures.exists('ui') && scene.textures.get('ui').has('build_icon_bg.png')) {
        row.add(scene.add.image(iconX, iconY, 'ui', 'build_icon_bg.png'));
    }
    // iconHint is typically build_action_* (110×73) — full size matches build_icon_bg.
    // Fallback build_{bid}_0 is the same atlas size.
    if (scene.textures.exists('build') && scene.textures.get('build').has(action.iconHint)) {
        row.add(scene.add.image(iconX, iconY, 'build', action.iconHint));
    } else if (
        scene.textures.exists('build') &&
        scene.textures.get('build').has(`build_action_${action.bid}_0.png`)
    ) {
        row.add(scene.add.image(iconX, iconY, 'build', `build_action_${action.bid}_0.png`));
    } else if (
        scene.textures.exists('build') &&
        scene.textures.get('build').has(`build_${action.bid}_0.png`)
    ) {
        row.add(scene.add.image(iconX, iconY, 'build', `build_${action.bid}_0.png`));
    }

    const textLeft = -BG_WIDTH / 2 + 140;
    if (action.hint) {
        const color =
            action.hintColor === 'red'
                ? '#ff5555'
                : action.hintColor === 'white'
                  ? '#ffffff'
                  : '#cccccc';
        row.add(
            scene.add
                .text(textLeft, iconY - 18, action.hint, {
                    fontFamily: UI_FONT_FAMILY,
                    resolution: UI_TEXT_RESOLUTION,
                    fontSize: `${UI_FONT_SIZE.COMMON_3}px`,
                    color,
                })
                .setOrigin(0, 0.5),
        );
    } else if (!action.isActioning && action.costRows.length > 0) {
        let cx = textLeft;
        action.costRows.forEach((cost) => {
            const frame = `icon_item_${cost.itemId}.png`;
            if (scene.textures.exists('icon') && scene.textures.get('icon').has(frame)) {
                const icon = scene.add
                    .image(cx, iconY - 10, 'icon', frame)
                    .setScale(0.28)
                    .setOrigin(0, 0.5);
                row.add(icon);
                cx += icon.displayWidth + 2;
            }
            row.add(
                scene.add
                    .text(cx, iconY - 10, `x${cost.num}`, {
                        fontFamily: UI_FONT_FAMILY,
                        resolution: UI_TEXT_RESOLUTION,
                        fontSize: '16px',
                        color: cost.ok ? '#ffffff' : '#ff5555',
                    })
                    .setOrigin(0, 0.5),
            );
            cx += 36;
        });
    }

    const pbY = iconY + 22;
    if (scene.textures.exists('ui') && scene.textures.get('ui').has('pb_bg.png')) {
        row.add(scene.add.image(textLeft, pbY, 'ui', 'pb_bg.png').setOrigin(0, 0.5));
        if (scene.textures.get('ui').has('pb.png') && action.percentage > 0) {
            const frame = scene.textures.get('ui').get('pb.png');
            const fill = scene.add.image(textLeft, pbY, 'ui', 'pb.png').setOrigin(0, 0.5);
            fill.setCrop(
                0,
                0,
                Math.max(1, Math.floor((frame.width * action.percentage) / 100)),
                frame.height,
            );
            row.add(fill);
        }
    }

    if (
        scene.textures.exists('ui') &&
        scene.textures.get('ui').has('btn_common_white_normal.png')
    ) {
        const btn = addAtlasButton(scene, BG_WIDTH / 2 - 90, 0, {
            atlas: 'ui',
            frame: 'btn_common_white_normal.png',
            label: action.actionLabel,
            labelSizeTier: 'COMMON_2',
            enabled: !action.actionDisabled,
            onClick: action.actionDisabled
                ? undefined
                : () => {
                      if (wasDragging()) {
                          return;
                      }
                      const res = clickFacilityAction(action.bid, action.actionId);
                      if (!res.ok) {
                          onFail(res.msg);
                      }
                  },
        });
        row.add(btn);
    }
}
