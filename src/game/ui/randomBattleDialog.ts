/**
 * Port of Buried-City RandomBattleDialog (roadside encounter).
 *
 * DialogBig flow:
 *   begin  → 遭遇僵尸! + dig + equip/threat + [战斗] [躲避]
 *   process → battle logs + pb (monster count or dodge %)
 *   end    → fight summary / dodge auto-dismiss after short delay
 *
 * Timer is paused for the whole dialog (original cc.timer.pause in show).
 */
import type { GameObjects, Scene } from 'phaser';
import { getItemDef, HAND_ITEM_ID } from '../data/itemConfig';
import { appendSessionLog, getSession } from '../session/sessionStore';
import { checkMonsterKilled as medalCheckMonsterKilled } from '../medal/medalStore';
import {
    type BattleLogEntry,
    type BattleSumRes,
    clearBattle,
    getActiveBattle,
    getDodgeProgress,
    startBattle,
    tickBattle,
} from '../systems/battleSystem';
import { EquipPosMap } from '../systems/inventory';
import { isLowVigour } from '../systems/playerAttrs';
import { pauseTimeClock, resumeTimeClock } from '../systems/timeClock';
import { addAtlasButton } from './atlasButton';
import { uiTextStyle, uiWordWrap } from './uiFont';

const DIALOG_FRAME = 'dialog_big_bg.png';
const DIALOG_WIDTH = 448;
const DIALOG_HEIGHT = 625;
const TITLE_HEIGHT = 90;
const ACTION_HEIGHT = 72;
const LEFT_EDGE = 20;
const LOG_LINES = 5;

/** string_zh 3009 by difficulty-1. */
const BATTLE_DES: string[] = [
    '前方发现僵尸！',
    '前方发现僵尸！',
    '一些游荡的僵尸注意到了你。',
    '一些游荡的僵尸注意到了你。',
    '一大群僵尸被惊动了，正准备向你扑来',
    '一大群僵尸被惊动了，正准备向你扑来',
    '一大群僵尸被惊动了，正准备向你扑来',
    '尸群带着死亡的恐怖气息向你靠拢',
    '你被一群僵尸包围了',
    '尸群带着死亡的恐怖气息向你靠拢',
    '尸群带着死亡的恐怖气息向你靠拢',
    '你被一群僵尸包围了',
];

export type RandomBattleInfo = {
    difficulty: number;
    monsters: number[];
};

export type RandomBattleDialogHandle = {
    root: GameObjects.Container;
    destroy: () => void;
};

function hasFrame(scene: Scene, atlas: string, frame: string): boolean {
    return scene.textures.exists(atlas) && scene.textures.get(atlas).has(frame);
}

/**
 * Open roadside encounter dialog. Calls onDone after fight/dodge resolves
 * (and end summary is dismissed). Does not call onDone if destroyed early.
 */
export function openRandomBattleDialog(
    scene: Scene,
    info: RandomBattleInfo,
    onDone?: () => void,
): RandomBattleDialogHandle {
    const existing = scene.children.list.find(
        (child) => (child as GameObjects.Container).name === 'randomBattleDialog',
    );
    if (existing) {
        existing.destroy(true);
    }

    const difficulty = Math.max(1, Math.min(12, info.difficulty));
    const monsters = info.monsters.slice();
    const { width, height } = scene.scale;

    const root = scene.add.container(0, 0);
    root.setDepth(240);
    root.setName('randomBattleDialog');

    // Original RandomBattleDialog.show → cc.timer.pause.
    // startBattle also pauses; hold an extra ref so endBattle's resume does not
    // unpause the world until this dialog dismisses.
    pauseTimeClock();
    let closed = false;
    let processTimer: Phaser.Time.TimerEvent | null = null;
    let endDelay: Phaser.Time.TimerEvent | null = null;

    const dismiss = (finished: boolean) => {
        if (closed) {
            return;
        }
        closed = true;
        processTimer?.remove(false);
        endDelay?.remove(false);
        processTimer = null;
        endDelay = null;
        if (getActiveBattle()) {
            clearBattle();
        }
        root.destroy(true);
        resumeTimeClock();
        if (finished) {
            onDone?.();
        }
    };

    const dim = scene.add
        .rectangle(width / 2, height / 2, width, height, 0x000000, 200 / 255)
        .setInteractive();
    root.add(dim);

    const cocosBgBottom = 29 + (839 - DIALOG_HEIGHT) / 2;
    const bgBottomY = height - cocosBgBottom;
    const bgTopY = bgBottomY - DIALOG_HEIGHT;
    const bgCenterX = width / 2;
    const bgCenterY = bgTopY + DIALOG_HEIGHT / 2;
    const bgLeft = bgCenterX - DIALOG_WIDTH / 2;

    if (hasFrame(scene, 'ui', DIALOG_FRAME)) {
        root.add(scene.add.image(bgCenterX, bgCenterY, 'ui', DIALOG_FRAME));
    } else {
        root.add(
            scene.add
                .rectangle(bgCenterX, bgCenterY, DIALOG_WIDTH, DIALOG_HEIGHT, 0xe8e0d0)
                .setStrokeStyle(2, 0x333333),
        );
    }

    const titleTopY = bgTopY;
    const contentTopY = bgTopY + TITLE_HEIGHT;
    const contentBottomY = bgBottomY - ACTION_HEIGHT;
    const actionCenterY = bgBottomY - ACTION_HEIGHT / 2;
    const textLeft = bgLeft + LEFT_EDGE;
    const textWidth = DIALOG_WIDTH - LEFT_EDGE * 2;

    // Title: warning icon + 遭遇僵尸！
    let titleTextX = textLeft;
    if (hasFrame(scene, 'icon', 'icon_warning_monster.png')) {
        const warn = scene.add
            .image(textLeft, titleTopY + TITLE_HEIGHT / 2, 'icon', 'icon_warning_monster.png')
            .setOrigin(0, 0.5)
            .setScale(0.55);
        root.add(warn);
        titleTextX = textLeft + warn.displayWidth + 8;
    }
    root.add(
        scene.add
            .text(titleTextX, titleTopY + TITLE_HEIGHT / 2, '遭遇僵尸！', {
                ...uiTextStyle('COMMON_1'),
                color: '#111111',
            })
            .setOrigin(0, 0.5),
    );

    // Mutable content / action layers (cleared between begin/process/end).
    const contentLayer = scene.add.container(0, 0);
    const actionLayer = scene.add.container(0, 0);
    root.add(contentLayer);
    root.add(actionLayer);

    const clearLayer = (layer: GameObjects.Container) => {
        layer.removeAll(true);
    };

    const placeDig = (): number => {
        const digFrame = `monster_dig_${difficulty}.png`;
        const digTop = contentTopY + 8;
        let below = digTop + 120;

        if (hasFrame(scene, 'dig_monster', digFrame)) {
            const dig = scene.add
                .image(bgCenterX, digTop, 'dig_monster', digFrame)
                .setOrigin(0.5, 0);
            const maxW = DIALOG_WIDTH - 40;
            if (dig.width > maxW) {
                dig.setScale(maxW / dig.width);
            }
            contentLayer.add(dig);
            below = dig.y + dig.displayHeight + 6;

            if (hasFrame(scene, 'dig_monster', 'monster_dig_mid_bg.png')) {
                const mid = scene.add
                    .image(
                        bgCenterX,
                        dig.y + dig.displayHeight / 2,
                        'dig_monster',
                        'monster_dig_mid_bg.png',
                    )
                    .setOrigin(0.5)
                    .setScale(0.8);
                contentLayer.add(mid);
                // dig on top of mid
                contentLayer.bringToTop(dig);
            }
        }
        return below;
    };

    const makeBlackBtn = (x: number, label: string, onClick: () => void) => {
        if (hasFrame(scene, 'ui', 'btn_common_black_normal.png')) {
            const btn = addAtlasButton(scene, x, actionCenterY, {
                atlas: 'ui',
                frame: 'btn_common_black_normal.png',
                label,
                labelColor: '#f5f0e6',
                labelSizeTier: 'COMMON_2',
                onClick,
            });
            actionLayer.add(btn);
            return;
        }
        const bg = scene.add
            .rectangle(x, actionCenterY, 140, 44, 0x222222)
            .setInteractive({ useHandCursor: true });
        const text = scene.add
            .text(x, actionCenterY, label, {
                ...uiTextStyle(20),
                color: '#f5f0e6',
            })
            .setOrigin(0.5);
        bg.on('pointerup', onClick);
        actionLayer.add([bg, text]);
    };

    const showBegin = () => {
        clearLayer(contentLayer);
        clearLayer(actionLayer);

        const belowDig = placeDig();
        const desText = BATTLE_DES[difficulty - 1] ?? BATTLE_DES[0]!;
        const des = scene.add
            .text(textLeft, belowDig, desText, {
                ...uiTextStyle('COMMON_3'),
                color: '#111111',
                wordWrap: uiWordWrap(textWidth),
            })
            .setOrigin(0, 0);
        contentLayer.add(des);

        // Log / equip band under des (original uses log area).
        let cursorY = Math.min(des.y + des.height + 16, contentBottomY - 160);
        const session = getSession();

        let hasWeapon = false;
        if (session) {
            for (const id of [session.equip[EquipPosMap.GUN], session.equip[EquipPosMap.WEAPON]]) {
                if (id && id !== HAND_ITEM_ID) {
                    const slot = getItemDef(id).slot;
                    if (slot === 'gun' || slot === 'weapon') {
                        hasWeapon = true;
                    }
                }
            }
        }

        const equipLabel = scene.add
            .text(textLeft, cursorY, '你的装备:', {
                ...uiTextStyle('COMMON_3'),
                color: '#111111',
            })
            .setOrigin(0, 0);
        contentLayer.add(equipLabel);

        let iconX = equipLabel.x + equipLabel.width + 8;
        const iconY = cursorY + equipLabel.height / 2;
        const equipIds = session
            ? [
                  session.equip[EquipPosMap.GUN],
                  session.equip[EquipPosMap.WEAPON],
                  session.equip[EquipPosMap.EQUIP],
                  session.equip[EquipPosMap.TOOL],
              ]
            : [];
        for (const id of equipIds) {
            if (!id || id === HAND_ITEM_ID) {
                continue;
            }
            const frame = `icon_item_${id}.png`;
            if (hasFrame(scene, 'icon', frame)) {
                const icon = scene.add
                    .image(iconX, iconY, 'icon', frame)
                    .setOrigin(0, 0.5)
                    .setScale(0.4);
                contentLayer.add(icon);
                iconX += icon.displayWidth + 4;
            }
        }
        if (!hasWeapon && hasFrame(scene, 'gate', 'icon_tab_hand.png')) {
            contentLayer.add(
                scene.add
                    .image(iconX, iconY, 'gate', 'icon_tab_hand.png')
                    .setOrigin(0, 0.5)
                    .setScale(0.65),
            );
        }

        cursorY += equipLabel.height + 12;
        contentLayer.add(
            scene.add
                .text(textLeft, cursorY, `威胁等级: ${difficulty}`, {
                    ...uiTextStyle('COMMON_3'),
                    color: '#b01010',
                })
                .setOrigin(0, 0),
        );
        cursorY += 22;

        if (!hasWeapon) {
            const warn = scene.add
                .text(textLeft, cursorY, '你没有装备任何武器，只能徒手进攻！', {
                    ...uiTextStyle('COMMON_3'),
                    color: '#b01010',
                    wordWrap: uiWordWrap(textWidth),
                })
                .setOrigin(0, 0);
            contentLayer.add(warn);
            cursorY += warn.height + 8;
        }
        if (session && isLowVigour(session)) {
            contentLayer.add(
                scene.add
                    .text(textLeft, cursorY, '你的精力值过低，攻击速度降为50%！', {
                        ...uiTextStyle('COMMON_3'),
                        color: '#b01010',
                        wordWrap: uiWordWrap(textWidth),
                    })
                    .setOrigin(0, 0),
            );
        }

        makeBlackBtn(bgCenterX - 90, '战斗', () => showProcess(false));
        makeBlackBtn(bgCenterX + 90, '躲避', () => showProcess(true));
    };

    const placeProgressBar = (
        isDodge: boolean,
        totalMon: number,
    ): {
        setPct: (pct: number) => void;
        setCount: (alive: number, total: number) => void;
    } => {
        const pbY = actionCenterY;
        let fill: GameObjects.Image | GameObjects.Rectangle | null = null;
        let fillMax = 264;
        let bgCenter = bgCenterX;
        let bgTop = pbY - 10;

        if (hasFrame(scene, 'ui', 'pb_bg.png')) {
            const bg = scene.add.image(bgCenterX, pbY, 'ui', 'pb_bg.png').setOrigin(0.5, 0.5);
            actionLayer.add(bg);
            bgCenter = bg.x;
            bgTop = bg.y - bg.displayHeight / 2;
            fillMax = hasFrame(scene, 'ui', 'pb.png')
                ? scene.textures.get('ui').get('pb.png').width
                : bg.width - 4;
            if (hasFrame(scene, 'ui', 'pb.png')) {
                fill = scene.add.image(bg.x - fillMax / 2, bg.y, 'ui', 'pb.png').setOrigin(0, 0.5);
                fill.setCrop(0, 0, 1, fill.height);
                fill.setVisible(false);
                actionLayer.add(fill);
            }
        } else {
            actionLayer.add(scene.add.rectangle(bgCenterX, pbY, 268, 17, 0x333333).setOrigin(0.5));
            fill = scene.add.rectangle(bgCenterX - 132, pbY, 1, 13, 0xc4a35a).setOrigin(0, 0.5);
            actionLayer.add(fill);
            bgTop = pbY - 8;
        }

        const countLabel = !isDodge
            ? scene.add
                  .text(bgCenter + 134, bgTop - 4, `僵尸数量:${totalMon}/${totalMon}`, {
                      ...uiTextStyle('COMMON_3'),
                      color: '#111111',
                  })
                  .setOrigin(1, 1)
            : null;
        if (countLabel) {
            actionLayer.add(countLabel);
        }

        return {
            setPct: (pct: number) => {
                const p = Math.max(0, Math.min(1, pct));
                if (!fill) {
                    return;
                }
                if (
                    'setCrop' in fill &&
                    typeof fill.setCrop === 'function' &&
                    hasFrame(scene, 'ui', 'pb.png')
                ) {
                    const img = fill as GameObjects.Image;
                    const w = Math.max(1, Math.round(fillMax * p));
                    img.setCrop(0, 0, w, img.height);
                    img.setVisible(p > 0);
                } else {
                    (fill as GameObjects.Rectangle).width = Math.max(1, fillMax * p);
                }
            },
            setCount: (alive: number, total: number) => {
                countLabel?.setText(`僵尸数量:${alive}/${total}`);
            },
        };
    };

    const showProcess = (isDodge: boolean) => {
        clearLayer(contentLayer);
        clearLayer(actionLayer);

        // Keep dig visible during process (original keeps dig_des, clears des string).
        placeDig();

        clearBattle();
        startBattle(monsters, { isDodge });

        const logTop = contentTopY + 150;
        const logBottom = contentBottomY - 8;
        const lineH = Math.min(40, (logBottom - logTop) / LOG_LINES);
        const logLabels: GameObjects.Text[] = [];
        const logBuf: BattleLogEntry[] = [];

        for (let i = 0; i < LOG_LINES; i++) {
            // i=0 is newest at top of stack visually near bottom of log area in original;
            // original: log_0 at bottom-ish of log, updates shift. Match battleNode: unshift newest.
            const y = logBottom - i * lineH;
            const label = scene.add
                .text(textLeft, y, '', {
                    ...uiTextStyle('COMMON_3'),
                    color: '#111111',
                    wordWrap: uiWordWrap(textWidth),
                })
                .setOrigin(0, 1);
            contentLayer.add(label);
            logLabels.push(label);
        }

        const paintLogs = () => {
            for (let i = 0; i < LOG_LINES; i++) {
                const entry = logBuf[i];
                const label = logLabels[i]!;
                if (entry) {
                    label.setText(entry.text);
                    label.setColor(
                        entry.color && entry.color !== '#ffffff' ? entry.color : '#111111',
                    );
                } else {
                    label.setText('');
                }
            }
        };

        const totalMon = monsters.length;
        const bar = placeProgressBar(isDodge, totalMon);
        bar.setPct(0);
        if (!isDodge) {
            bar.setCount(totalMon, totalMon);
        }

        let lastEntryLen = 0;
        let lastAlive = totalMon;
        const seed = getActiveBattle();
        if (seed) {
            for (const e of seed.sum.entries) {
                logBuf.unshift(e);
            }
            if (logBuf.length > LOG_LINES) {
                logBuf.length = LOG_LINES;
            }
            lastEntryLen = seed.sum.entries.length;
            paintLogs();
        }

        const finishWithResult = (result: BattleSumRes) => {
            processTimer?.remove(false);
            processTimer = null;

            // Roadside kills count toward the medals too (original BattleDialog
            // gameEnd listener fires for every encounter, dodge included).
            medalCheckMonsterKilled(result.monsterKilled ?? 0);

            if (result.isDodge && result.win) {
                // Original: log 1114, dismiss, cb — after ~2s
                appendSessionLog('你成功地躲开了僵尸，继续前进');
                endDelay = scene.time.delayedCall(1200, () => {
                    clearBattle();
                    dismiss(true);
                });
                return;
            }

            // Fight path: show end summary inside dialog.
            showEnd(result);
        };

        processTimer = scene.time.addEvent({
            delay: 100,
            loop: true,
            callback: () => {
                if (closed || !scene.sys.isActive()) {
                    processTimer?.remove(false);
                    return;
                }
                const battle = getActiveBattle();
                if (battle) {
                    while (lastEntryLen < battle.sum.entries.length) {
                        logBuf.unshift(battle.sum.entries[lastEntryLen]!);
                        if (logBuf.length > LOG_LINES) {
                            logBuf.length = LOG_LINES;
                        }
                        lastEntryLen += 1;
                    }
                    paintLogs();

                    if (isDodge) {
                        bar.setPct(getDodgeProgress());
                    } else {
                        const alive = battle.monsters.filter((m) => !m.dead && m.hp > 0).length;
                        if (alive !== lastAlive) {
                            lastAlive = alive;
                            bar.setCount(alive, totalMon);
                            bar.setPct(totalMon > 0 ? (totalMon - alive) / totalMon : 0);
                        }
                    }
                }
                const result = tickBattle(0.1);
                if (result) {
                    const b = getActiveBattle();
                    if (b) {
                        while (lastEntryLen < b.sum.entries.length) {
                            logBuf.unshift(b.sum.entries[lastEntryLen]!);
                            if (logBuf.length > LOG_LINES) {
                                logBuf.length = LOG_LINES;
                            }
                            lastEntryLen += 1;
                        }
                        paintLogs();
                        if (isDodge) {
                            bar.setPct(1);
                        } else {
                            bar.setCount(0, totalMon);
                            bar.setPct(1);
                        }
                    }
                    // Original waits ~2s after battle end before next view.
                    endDelay = scene.time.delayedCall(1500, () => {
                        finishWithResult(result);
                    });
                    processTimer?.remove(false);
                    processTimer = null;
                }
            },
        });
    };

    const showEnd = (result: BattleSumRes) => {
        clearLayer(contentLayer);
        clearLayer(actionLayer);
        const belowDig = placeDig();

        if (result.win) {
            appendSessionLog('你成功地消灭了僵尸，继续前进');
        }

        const title = result.win
            ? '你成功的逃出了僵尸的围攻！'
            : result.escaped
              ? '你逃离了战斗'
              : '战斗失败';
        const des = scene.add
            .text(textLeft, belowDig, title, {
                ...uiTextStyle('COMMON_3'),
                color: '#111111',
                wordWrap: uiWordWrap(textWidth),
            })
            .setOrigin(0, 0);
        contentLayer.add(des);

        let y = des.y + des.height + 16;
        const costParts: string[] = [];
        if ((result.bulletsUsed ?? 0) > 0) {
            costParts.push(`子弹×${result.bulletsUsed}`);
        }
        if ((result.toolsUsed ?? 0) > 0 && result.toolItemId) {
            costParts.push(`${getItemDef(result.toolItemId).name}×${result.toolsUsed}`);
        }
        contentLayer.add(
            scene.add
                .text(
                    textLeft,
                    y,
                    costParts.length ? `消耗: ${costParts.join('，')}` : '消耗: 无',
                    {
                        ...uiTextStyle('COMMON_3'),
                        color: '#111111',
                    },
                )
                .setOrigin(0, 0),
        );
        y += 26;
        contentLayer.add(
            scene.add
                .text(textLeft, y, `损失: 生命 ${result.playerHarm ?? 0}`, {
                    ...uiTextStyle('COMMON_3'),
                    color: '#111111',
                })
                .setOrigin(0, 0),
        );

        makeBlackBtn(bgCenterX, '继续', () => {
            clearBattle();
            dismiss(true);
        });
    };

    showBegin();

    return {
        root,
        destroy: () => dismiss(false),
    };
}
