import type { GameObjects, Scene } from 'phaser';
import type { NpcReward } from '../data/npcConfig';
import { getSiteConfig } from '../data/siteConfig';
import { getSession } from '../session/sessionStore';
import { playEffect, Sound } from '../systems/audioManager';
import { declineNpcHelp, giveNpcHelpItems, type NpcVisit } from '../systems/npcSystem';
import { pauseTimeClock, resumeTimeClock } from '../systems/timeClock';
import { addAtlasButton } from './atlasButton';
import { addNpcHearts } from './npcHearts';
import { UI_FONT_SIZE, uiTextStyle, uiWordWrap } from './uiFont';

const DIALOG_FRAME = 'dialog_big_bg.png';
const DIALOG_WIDTH = 448;
const DIALOG_HEIGHT = 625;
const TITLE_HEIGHT = 90;
const ACTION_HEIGHT = 72;
const LEFT_EDGE = 20;

function hasFrame(scene: Scene, atlas: string, frame: string): boolean {
    return scene.textures.exists(atlas) && scene.textures.get(atlas).has(frame);
}

function addFallbackButton(
    scene: Scene,
    parent: GameObjects.Container,
    x: number,
    y: number,
    label: string,
    onClick: () => void,
    enabled: boolean,
): void {
    const button = scene.add
        .rectangle(x, y, 140, 44, enabled ? 0x222222 : 0x555555)
        .setInteractive({ useHandCursor: enabled });
    const text = scene.add
        .text(x, y, label, {
            ...uiTextStyle('COMMON_2'),
            color: enabled ? '#f5f0e6' : '#999999',
        })
        .setOrigin(0.5);
    if (enabled) {
        button.on('pointerup', onClick);
    }
    parent.add([button, text]);
}

function addButton(
    scene: Scene,
    parent: GameObjects.Container,
    x: number,
    y: number,
    label: string,
    onClick: () => void,
    enabled = true,
): void {
    if (hasFrame(scene, 'ui', 'btn_common_black_normal.png')) {
        parent.add(
            addAtlasButton(scene, x, y, {
                atlas: 'ui',
                frame: 'btn_common_black_normal.png',
                label,
                labelColor: '#f5f0e6',
                labelSizeTier: 'COMMON_2',
                enabled,
                onClick: enabled ? onClick : undefined,
            }),
        );
        return;
    }
    addFallbackButton(scene, parent, x, y, label, onClick, enabled);
}

/** Original ItemRichText form (gifts/help): 3-column grid of icon + "xN". */
function addItemGrid(
    scene: Scene,
    parent: GameObjects.Container,
    items: readonly { itemId: number; num: number }[],
    x: number,
    y: number,
    width: number,
    colorOf: (item: { itemId: number; num: number }) => string = () => '#111111',
): number {
    const col = 3;
    const colWidth = width / col;
    let cursor = y;
    for (let start = 0; start < items.length; start += col) {
        const row = items.slice(start, start + col);
        let rowHeight: number = UI_FONT_SIZE.COMMON_3;
        const cells: Array<{ itemId: number; num: number; icon: GameObjects.Image | null }> = [];
        for (const reward of row) {
            const frame = `icon_item_${reward.itemId}.png`;
            const icon = hasFrame(scene, 'icon', frame)
                ? (scene.add.image(0, 0, 'icon', frame).setScale(0.5) as GameObjects.Image)
                : null;
            if (icon) {
                rowHeight = Math.max(rowHeight, icon.displayHeight);
            }
            cells.push({ itemId: reward.itemId, num: reward.num, icon });
        }
        for (let c = 0; c < cells.length; c += 1) {
            const cell = cells[c]!;
            const centerY = cursor + rowHeight / 2;
            const left = x + c * colWidth;
            if (cell.icon) {
                cell.icon.setPosition(left + 10, centerY).setOrigin(0, 0.5);
                parent.add(cell.icon);
            }
            parent.add(
                scene.add
                    .text(left + colWidth - 10, centerY, `x${cell.num}`, {
                        ...uiTextStyle('COMMON_3'),
                        color: colorOf(cell),
                    })
                    .setOrigin(1, 0.5),
            );
        }
        cursor += rowHeight;
    }
    return cursor;
}

/** Original NpcDialog flow used by NPCManager.visitPlayer. */
export function openNpcVisitDialog(scene: Scene, visit: NpcVisit): GameObjects.Container {
    const existing = scene.children.list.find(
        (child) => (child as GameObjects.Container).name === 'npcVisitDialog',
    );
    if (existing) {
        existing.destroy(true);
    }

    const { width, height } = scene.scale;
    const cocosBgBottom = 29 + (839 - DIALOG_HEIGHT) / 2;
    const bgBottomY = height - cocosBgBottom;
    const bgTopY = bgBottomY - DIALOG_HEIGHT;
    const bgCenterX = width / 2;
    const bgCenterY = bgTopY + DIALOG_HEIGHT / 2;
    const bgLeft = bgCenterX - DIALOG_WIDTH / 2;
    const textLeft = bgLeft + LEFT_EDGE;
    const textWidth = DIALOG_WIDTH - LEFT_EDGE * 2;
    const contentTopY = bgTopY + TITLE_HEIGHT;
    const actionCenterY = bgBottomY - ACTION_HEIGHT / 2;

    pauseTimeClock();

    const reputation = getSession()?.npcs[visit.npcId].reputation ?? 0;

    // Original NpcDialog title bar: icon + name (left) and a heart strip pinned to
    // the right edge. Each gift batch builds a fresh dialog (showNpcSendGiftDialog
    // chains batches via npc.sendGift() recursion).
    const buildFrame = (): { root: GameObjects.Container; topY: number } => {
        playEffect(Sound.NPC_KNOCK);

        const root = scene.add.container(0, 0).setDepth(260).setName('npcVisitDialog');

        const dim = scene.add
            .rectangle(width / 2, height / 2, width, height, 0x000000, 0.72)
            .setInteractive();
        root.add(dim);

        if (hasFrame(scene, 'ui', DIALOG_FRAME)) {
            root.add(scene.add.image(bgCenterX, bgCenterY, 'ui', DIALOG_FRAME).setOrigin(0.5));
        } else {
            root.add(
                scene.add
                    .rectangle(bgCenterX, bgCenterY, DIALOG_WIDTH, DIALOG_HEIGHT, 0xe8e0d0)
                    .setStrokeStyle(2, 0x333333),
            );
        }

        let titleX = textLeft;
        if (hasFrame(scene, 'icon', 'icon_npc.png')) {
            const icon = scene.add
                .image(textLeft, bgTopY + TITLE_HEIGHT / 2, 'icon', 'icon_npc.png')
                .setOrigin(0, 0.5)
                .setScale(0.55);
            root.add(icon);
            titleX += icon.displayWidth + 8;
        }
        root.add(
            scene.add
                .text(titleX, bgTopY + 20, visit.name, {
                    ...uiTextStyle('COMMON_1'),
                    color: '#111111',
                    wordWrap: uiWordWrap(bgLeft + DIALOG_WIDTH - LEFT_EDGE - titleX),
                    maxLines: 1,
                })
                .setOrigin(0, 0),
        );
        addNpcHearts(
            scene,
            root,
            bgLeft + DIALOG_WIDTH - LEFT_EDGE,
            bgTopY + TITLE_HEIGHT / 2,
            reputation,
            'npcVisitHearts',
        );

        let topY = contentTopY + 12;
        const portraitFrame = `npc_dig_${visit.npcId}.png`;
        if (hasFrame(scene, 'npc', portraitFrame)) {
            const portrait = scene.add
                .image(bgCenterX, topY, 'npc', portraitFrame)
                .setOrigin(0.5, 0);
            if (portrait.displayWidth > textWidth) portrait.setScale(textWidth / portrait.width);
            root.add(portrait);
            topY += portrait.displayHeight + 12;
        }
        return { root, topY };
    };

    if (visit.kind === 'help') {
        const { root, topY } = buildFrame();
        let cursorY = topY;
        root.add(
            scene.add
                .text(textLeft, cursorY, '实在不好意思开口，你能帮个忙吗？', {
                    ...uiTextStyle('COMMON_3'),
                    color: '#111111',
                    wordWrap: uiWordWrap(textWidth),
                })
                .setOrigin(0, 0),
        );
        cursorY += UI_FONT_SIZE.COMMON_3 + 28;
        root.add(
            scene.add
                .text(textLeft, cursorY, '对方需要', {
                    ...uiTextStyle('COMMON_3'),
                    color: '#111111',
                })
                .setOrigin(0, 0),
        );
        cursorY += UI_FONT_SIZE.COMMON_3 + 10;

        // Original needHelp rolls a random multi-item request from npcGiftConfig.
        const needs = visit.need ?? [];
        const canAgree =
            needs.length > 0 &&
            needs.every((item) => (getSession()?.storage[item.itemId] ?? 0) >= item.num);
        if (needs.length > 0) {
            // Original help list is the same ItemRichText grid as gifts (icon +
            // "xN"); items the player lacks render red. No inventory row exists.
            cursorY = addItemGrid(scene, root, needs, textLeft, cursorY, textWidth, (item) =>
                (getSession()?.storage[item.itemId] ?? 0) >= item.num ? '#111111' : '#b00000',
            );
        }

        let closed = false;
        const dismiss = () => {
            if (closed) return;
            closed = true;
            root.destroy(true);
            resumeTimeClock();
        };
        addButton(scene, root, bgCenterX - 90, actionCenterY, '拒绝', () => {
            declineNpcHelp(visit.npcId);
            dismiss();
        });
        addButton(
            scene,
            root,
            bgCenterX + 90,
            actionCenterY,
            '同意',
            () => {
                const result = giveNpcHelpItems(visit.npcId, 'storage', needs);
                if (!result.ok) return;
                dismiss();
            },
            canAgree,
        );
        return root;
    }

    // Original showNpcSendGiftDialog: item batch and site batch are separate
    // NpcDialogs; tapping 知道了 dismisses and chains into the next batch.
    const items = visit.deliveredRewards.filter(
        (reward): reward is Extract<NpcReward, { kind: 'item' }> => reward.kind === 'item',
    );
    const sites = visit.deliveredRewards.filter(
        (reward): reward is Extract<NpcReward, { kind: 'site' }> => reward.kind === 'site',
    );

    const openGiftBatch = (
        mode: 'item' | 'site',
        next: (() => void) | null,
    ): GameObjects.Container => {
        const { root, topY } = buildFrame();

        if (mode === 'item') {
            root.add(
                scene.add
                    .text(
                        textLeft,
                        topY,
                        '我想你一定需要这个吧？不用谢，大家要一起熬过这个难关。',
                        {
                            ...uiTextStyle('COMMON_3'),
                            color: '#111111',
                            wordWrap: uiWordWrap(textWidth),
                        },
                    )
                    .setOrigin(0, 0),
            );
            // Original 1069 label above the ItemRichText gift list.
            const listY = topY + UI_FONT_SIZE.COMMON_3 + 24;
            root.add(
                scene.add
                    .text(textLeft, listY, '你得到', {
                        ...uiTextStyle('COMMON_3'),
                        color: '#111111',
                    })
                    .setOrigin(0, 0),
            );
            addItemGrid(
                scene,
                root,
                items,
                textLeft,
                listY + UI_FONT_SIZE.COMMON_3 + 10,
                textWidth,
            );
        } else {
            const names = sites.map(
                (reward) => getSiteConfig(reward.siteId)?.name ?? `地点${reward.siteId}`,
            );
            root.add(
                scene.add
                    .text(
                        textLeft,
                        topY,
                        `我知道一个地方，里面应该还有一些东西，你可能会需要${names
                            .map((name) => `（新地点${name}解锁）`)
                            .join('')}`,
                        {
                            ...uiTextStyle('COMMON_3'),
                            color: '#111111',
                            wordWrap: uiWordWrap(textWidth),
                        },
                    )
                    .setOrigin(0, 0),
            );
        }

        let closed = false;
        const dismiss = () => {
            if (closed) return;
            closed = true;
            root.destroy(true);
            // Only the final batch resumes the (ref-counted) clock.
            if (!next) {
                resumeTimeClock();
            }
        };
        addButton(scene, root, bgCenterX, actionCenterY, '知道了', () => {
            dismiss();
            next?.();
        });
        return root;
    };

    return openGiftBatch(
        items.length > 0 ? 'item' : 'site',
        items.length > 0 && sites.length > 0 ? () => openGiftBatch('site', null) : null,
    );
}
