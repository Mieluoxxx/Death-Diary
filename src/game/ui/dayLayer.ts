import type { GameObjects, Scene } from 'phaser';
import { loadAtlas } from '../assets/loadAtlas';
import { getItemDef } from '../data/itemConfig';
import { getSession } from '../session/sessionStore';
import { playEffect, Sound } from '../systems/audioManager';
import type { NightRaidResult } from '../systems/nightRaidSystem';
import { resumeTimeClock } from '../systems/timeClock';
import { UI_FONT_SIZE, uiTextStyle, uiWordWrap } from './uiFont';

/**
 * Port of Buried-City DayLayer (DayScene.js).
 * Full-screen day-end plate: peace / win / lose / bomb / electric art,
 * fade-in cascade, tap anywhere to dismiss + resume timer.
 */

const LAYER_NAME = 'dayLayer';

function pickBgFrame(res: NightRaidResult): { atlas: 'day' | 'day2'; frame: string } {
    if (!res.happened) {
        return { atlas: 'day', frame: 'day_scene_peace.png' };
    }
    if (res.defend) {
        if (res.defendKind === 'electric') {
            return { atlas: 'day2', frame: 'day_scene_win_electric.png' };
        }
        return { atlas: 'day', frame: 'day_scene_win_bomb.png' };
    }
    if (res.win) {
        return { atlas: 'day', frame: 'day_scene_win.png' };
    }
    return { atlas: 'day', frame: 'day_scene_lose.png' };
}

function nextDisplayDay(): number {
    const session = getSession();
    return session?.day ?? 1;
}

function itemLabel(itemId: number): string {
    const def = getItemDef(itemId);
    if (def.name && !def.name.startsWith('物品')) {
        return def.name;
    }
    return `物品${itemId}`;
}

/**
 * Show the day-end layer. Ensures day/day2 atlases are loaded first.
 * Dismiss: pointer up on full-screen hit → destroy + resumeTimeClock.
 */
export async function openDayLayer(
    scene: Scene,
    res: NightRaidResult,
): Promise<GameObjects.Container> {
    const existing = scene.children.list.find(
        (child) => (child as GameObjects.Container).name === LAYER_NAME,
    );
    if (existing) {
        existing.destroy(true);
    }

    await Promise.all([loadAtlas(scene, 'day'), loadAtlas(scene, 'day2')]);

    if (res.happened) {
        playEffect(Sound.UNDER_ATTACK_MIDNIGHT);
    }

    const { width, height } = scene.scale;
    const root = scene.add.container(0, 0);
    root.setDepth(300);
    root.setName(LAYER_NAME);

    const dim = scene.add
        .rectangle(width / 2, height / 2, width, height, 0x000000, 0)
        .setInteractive();
    root.add(dim);

    const { atlas, frame } = pickBgFrame(res);
    let bg: GameObjects.Image | GameObjects.Rectangle;
    if (scene.textures.exists(atlas) && scene.textures.get(atlas).has(frame)) {
        bg = scene.add.image(width / 2, height / 2, atlas, frame).setAlpha(0);
    } else {
        bg = scene.add.rectangle(width / 2, height / 2, 640, 1136, 0x1a1a1a).setAlpha(0);
    }
    root.add(bg);

    // Content in original bg local coords (640×1136, bottom-left y-up).
    const bgLeft = width / 2 - 320;
    const bgBottom = height / 2 + 568;
    const toY = (cocosY: number) => bgBottom - cocosY;
    const contentWidth = 640 - 2 * 64;

    const dayLabel = scene.add
        .text(width / 2, toY(922), `第${nextDisplayDay()}天`, {
            ...uiTextStyle(60),
            color: '#ffffff',
        })
        .setOrigin(0.5)
        .setAlpha(0);
    root.add(dayLabel);

    const fadeTargets: GameObjects.GameObject[] = [];

    if (!res.happened) {
        const peace = scene.add
            .text(width / 2, toY(624), '今天晚上很平静。', {
                ...uiTextStyle('COMMON_1'),
                color: '#ffffff',
                align: 'center',
                wordWrap: uiWordWrap(contentWidth),
            })
            .setOrigin(0.5)
            .setAlpha(0);
        root.add(peace);
        fadeTargets.push(peace);
    } else if (res.win || res.defend) {
        const ok = scene.add
            .text(
                width / 2,
                toY(624),
                '僵尸潮爆发，小镇到处都是暴躁的僵尸。凭借坚固的防御，你的小屋挺过了冲击，没有任何损失。',
                {
                    ...uiTextStyle('COMMON_1'),
                    color: '#ffffff',
                    align: 'center',
                    wordWrap: uiWordWrap(contentWidth),
                },
            )
            .setOrigin(0.5)
            .setAlpha(0);
        root.add(ok);
        fadeTargets.push(ok);
    } else {
        // Match Buried-City DayScene lose layout (cocos y-up):
        // - "你的损失:" at (64, 550), bottom-left anchor
        // - narrative body bottom = title.y + titleH/2 + 40
        // - lost items top = title.y - titleH/2 - 20  (gap below title)
        const lossTitle = scene.add
            .text(bgLeft + 64, toY(550), '你的损失:', {
                ...uiTextStyle('COMMON_1'),
                color: '#ffffff',
            })
            .setOrigin(0, 1)
            .setAlpha(0);
        root.add(lossTitle);
        fadeTargets.push(lossTitle);

        const titleH = Math.max(lossTitle.height, UI_FONT_SIZE.COMMON_1);
        // Cocos title center = 550 + titleH/2 → Phaser y = toY(550) - titleH/2
        const titleCenterY = toY(550) - titleH / 2;

        const body = scene.add
            .text(
                width / 2,
                titleCenterY - 40,
                '僵尸潮爆发，小镇到处都是暴躁的僵尸。几个僵尸突破了防御，进到家中大肆破坏。',
                {
                    ...uiTextStyle('COMMON_1'),
                    color: '#ffffff',
                    align: 'center',
                    wordWrap: uiWordWrap(contentWidth),
                },
            )
            .setOrigin(0.5, 1)
            .setAlpha(0);
        root.add(body);
        fadeTargets.push(body);

        const items = res.items ?? [];
        // Cocos: richText.y = title.y - titleH/2 - 20 (top anchor) → below title by titleH/2+20.
        let cursorX = bgLeft + 64;
        let cursorY = toY(550) + titleH / 2 + 20;
        const rowMaxX = bgLeft + 640 - 64;
        const itemScale = 0.8;
        const rowStep = Math.max(56, Math.round(64 * itemScale) + 12);

        for (const it of items) {
            const iconFrame = `icon_item_${it.itemId}.png`;
            let cellW = 0;
            let rowMidY = cursorY;

            if (scene.textures.exists('icon') && scene.textures.get('icon').has(iconFrame)) {
                const icon = scene.add
                    .image(cursorX, cursorY, 'icon', iconFrame)
                    .setOrigin(0, 0)
                    .setScale(itemScale)
                    .setAlpha(0);
                root.add(icon);
                fadeTargets.push(icon);
                cellW = icon.displayWidth + 4;
                rowMidY = cursorY + icon.displayHeight / 2;
            }

            const label = scene.add
                .text(cursorX + cellW, rowMidY, `${itemLabel(it.itemId)}×${it.num}`, {
                    ...uiTextStyle('COMMON_1'),
                    color: '#ffffff',
                })
                .setOrigin(0, 0.5)
                .setAlpha(0);
            root.add(label);
            fadeTargets.push(label);

            // If no icon, still advance past the text baseline using label height.
            if (cellW === 0) {
                rowMidY = cursorY + label.height / 2;
                label.setY(rowMidY);
            }

            cursorX += cellW + label.width + 24;
            if (cursorX > rowMaxX - 100) {
                cursorX = bgLeft + 64;
                cursorY += rowStep;
            }
        }

        if (items.length === 0) {
            const empty = scene.add
                .text(bgLeft + 64, cursorY, '（仓库空无一物）', {
                    ...uiTextStyle('COMMON_2'),
                    color: '#aaaaaa',
                })
                .setOrigin(0, 0)
                .setAlpha(0);
            root.add(empty);
            fadeTargets.push(empty);
        }
    }

    let canDismiss = false;
    const dismiss = () => {
        if (!canDismiss) {
            return;
        }
        root.destroy(true);
        resumeTimeClock();
    };

    dim.on('pointerup', dismiss);

    scene.tweens.add({
        targets: dim,
        fillAlpha: 200 / 255,
        duration: 800,
        onComplete: () => {
            scene.tweens.add({
                targets: bg,
                alpha: 1,
                duration: 800,
                onComplete: () => {
                    scene.tweens.add({
                        targets: dayLabel,
                        alpha: 1,
                        duration: 700,
                    });
                    for (const target of fadeTargets) {
                        scene.tweens.add({
                            targets: target,
                            alpha: 1,
                            duration: 700,
                        });
                    }
                    scene.time.delayedCall(700, () => {
                        canDismiss = true;
                    });
                },
            });
        },
    });

    return root;
}
