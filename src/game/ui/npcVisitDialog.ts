import type { GameObjects, Scene } from 'phaser';
import { getItemDef } from '../data/itemConfig';
import { getSiteConfig } from '../data/siteConfig';
import { appendSessionLog, getSession } from '../session/sessionStore';
import { playPopup } from '../systems/audioManager';
import { gameBusEmit } from '../systems/gameBus';
import { giveNpcNeed, type NpcVisit } from '../systems/npcSystem';
import { pauseTimeClock, resumeTimeClock } from '../systems/timeClock';
import { addAtlasButton } from './atlasButton';
import { UI_FONT_FAMILY, UI_FONT_SIZE, UI_TEXT_RESOLUTION, uiWordWrap } from './uiFont';

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
            fontFamily: UI_FONT_FAMILY,
            resolution: UI_TEXT_RESOLUTION,
            fontSize: `${UI_FONT_SIZE.COMMON_2}px`,
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

function addRewardText(
    scene: Scene,
    parent: GameObjects.Container,
    visit: NpcVisit,
    x: number,
    y: number,
): number {
    let cursor = y;
    for (const reward of visit.deliveredRewards) {
        const text =
            reward.kind === 'item'
                ? `${getItemDef(reward.itemId).name} x${reward.num}`
                : `${getSiteConfig(reward.siteId)?.name ?? `地点${reward.siteId}`}（新地点解锁）`;
        parent.add(
            scene.add
                .text(x, cursor, text, {
                    fontFamily: UI_FONT_FAMILY,
                    resolution: UI_TEXT_RESOLUTION,
                    fontSize: `${UI_FONT_SIZE.COMMON_2}px`,
                    color: '#111111',
                    wordWrap: uiWordWrap(DIALOG_WIDTH - LEFT_EDGE * 2),
                })
                .setOrigin(0, 0),
        );
        cursor += UI_FONT_SIZE.COMMON_2 + 10;
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
    const root = scene.add.container(0, 0).setDepth(260).setName('npcVisitDialog');
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
    playPopup();

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
            .text(
                titleX,
                bgTopY + 57,
                `好感度 ${getSession()?.npcs[visit.npcId].reputation ?? 0}/10`,
                {
                    fontFamily: UI_FONT_FAMILY,
                    resolution: UI_TEXT_RESOLUTION,
                    fontSize: `${UI_FONT_SIZE.COMMON_3}px`,
                    color: '#111111',
                },
            )
            .setOrigin(0, 0),
    );

    let cursorY = contentTopY + 12;
    const portraitFrame = `npc_dig_${visit.npcId}.png`;
    if (hasFrame(scene, 'npc', portraitFrame)) {
        const portrait = scene.add
            .image(bgCenterX, cursorY, 'npc', portraitFrame)
            .setOrigin(0.5, 0);
        if (portrait.displayWidth > textWidth) portrait.setScale(textWidth / portrait.width);
        root.add(portrait);
        cursorY += portrait.displayHeight + 12;
    }

    if (visit.kind === 'help') {
        root.add(
            scene.add
                .text(textLeft, cursorY, '实在不好意思开口，你能帮个忙吗？', {
                    fontFamily: UI_FONT_FAMILY,
                    resolution: UI_TEXT_RESOLUTION,
                    fontSize: `${UI_FONT_SIZE.COMMON_3}px`,
                    color: '#111111',
                    wordWrap: uiWordWrap(textWidth),
                })
                .setOrigin(0, 0),
        );
        cursorY += UI_FONT_SIZE.COMMON_3 + 28;
        root.add(
            scene.add
                .text(textLeft, cursorY, '对方需要', {
                    fontFamily: UI_FONT_FAMILY,
                    resolution: UI_TEXT_RESOLUTION,
                    fontSize: `${UI_FONT_SIZE.COMMON_3}px`,
                    color: '#111111',
                })
                .setOrigin(0, 0),
        );
        cursorY += UI_FONT_SIZE.COMMON_3 + 10;

        const need = visit.need;
        const have = need ? (getSession()?.storage[need.itemId] ?? 0) : 0;
        if (need) {
            const itemFrame = `icon_item_${need.itemId}.png`;
            if (hasFrame(scene, 'icon', itemFrame)) {
                root.add(
                    scene.add
                        .image(textLeft, cursorY + 24, 'icon', itemFrame)
                        .setOrigin(0, 0.5)
                        .setScale(0.55),
                );
            }
            root.add(
                scene.add
                    .text(
                        textLeft + 48,
                        cursorY + 8,
                        `${getItemDef(need.itemId).name} x${need.num}`,
                        {
                            fontFamily: UI_FONT_FAMILY,
                            resolution: UI_TEXT_RESOLUTION,
                            fontSize: `${UI_FONT_SIZE.COMMON_2}px`,
                            color: have >= need.num ? '#111111' : '#b00000',
                        },
                    )
                    .setOrigin(0, 0),
            );
            root.add(
                scene.add
                    .text(textLeft + 48, cursorY + 38, `你的库存：${have}`, {
                        fontFamily: UI_FONT_FAMILY,
                        resolution: UI_TEXT_RESOLUTION,
                        fontSize: `${UI_FONT_SIZE.COMMON_3}px`,
                        color: have >= need.num ? '#111111' : '#b00000',
                    })
                    .setOrigin(0, 0),
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
            appendSessionLog(`你拒绝了${visit.name}的请求。`);
            gameBusEmit('session_updated');
            dismiss();
        });
        addButton(
            scene,
            root,
            bgCenterX + 90,
            actionCenterY,
            '同意',
            () => {
                const result = giveNpcNeed(visit.npcId);
                if (!result.ok) return;
                dismiss();
            },
            Boolean(need && have >= need.num),
        );
        return root;
    }

    root.add(
        scene.add
            .text(textLeft, cursorY, '我想你一定需要这个吧？不用谢，大家要一起熬过这个难关。', {
                fontFamily: UI_FONT_FAMILY,
                resolution: UI_TEXT_RESOLUTION,
                fontSize: `${UI_FONT_SIZE.COMMON_3}px`,
                color: '#111111',
                wordWrap: uiWordWrap(textWidth),
            })
            .setOrigin(0, 0),
    );
    addRewardText(scene, root, visit, textLeft, cursorY + UI_FONT_SIZE.COMMON_3 + 24);
    let closed = false;
    const dismiss = () => {
        if (closed) return;
        closed = true;
        root.destroy(true);
        resumeTimeClock();
    };
    addButton(scene, root, bgCenterX, actionCenterY, '知道了', dismiss);
    return root;
}
