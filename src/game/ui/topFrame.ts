import type { GameObjects, Scene } from 'phaser';
import {
    attrRatio,
    formatClock,
    getSession,
    type ItemCounts,
    type SessionState,
} from '../session/sessionStore';
import { getLanguage } from '../settings/settingsStore';
import { openStatusDialog, type StatusQuickItem } from './dialogSmall';
import { openItemDialog } from './itemDialog';
import { openSettingLayer } from './settingLayer';
import { mountScrollViewport } from './scrollViewport';
import {
    ATTR_STATUS_ID,
    type AttrKey,
    formatAttrValue,
    formatCurrentValue,
    formatStatusValue,
    getStatusCopy,
    type StatusInfoId,
} from './statusCopy';
import { UI_FONT_FAMILY, UI_FONT_SIZE, UI_TEXT_RESOLUTION, uiWordWrap } from './uiFont';

/**
 * Port of Buried-City TopFrameNode + StatusButton + AttrButton (web slice).
 * Supports live refresh from survival clock / attr bus.
 */

const FRAME_WIDTH = 596;
const FRAME_HEIGHT = 245;
const LINE_WIDTH = 584;
const LINE_HEIGHT = 50;
const ICON_SCALE = 0.5;
const ICON_DISPLAY = 84 * ICON_SCALE;

const FIRST_LINE_LOCAL_Y = 190;
const SECOND_LINE_LOCAL_Y = 134;
const THIRD_LINE_LOCAL_Y = 6;
const THIRD_LINE_HEIGHT = 122;

type AttrKeyLocal = AttrKey;

export type TopFrameHandle = {
    root: GameObjects.Container;
    /** Re-read session and update day/clock/attrs/log labels. */
    refresh: () => void;
    destroy: () => void;
};

function sizeStatusIcon (image: GameObjects.Image): GameObjects.Image
{
    image.setScale(ICON_SCALE);
    return image;
}

/** Original topFrame getItemsByType prefix filter for attr quick-use. */
function countsByPrefix (counts: ItemCounts, prefix: string): StatusQuickItem[]
{
    const out: StatusQuickItem[] = [];
    for (const [idText, num] of Object.entries(counts))
    {
        if (num <= 0)
        {
            continue;
        }
        if (!idText.startsWith(prefix))
        {
            continue;
        }
        const itemId = Number(idText);
        if (!Number.isFinite(itemId))
        {
            continue;
        }
        out.push({ itemId, num });
    }
    out.sort((a, b) => a.itemId - b.itemId);
    return out;
}

function quickItemsForAttr (attr: AttrKeyLocal, session: SessionState): StatusQuickItem[]
{
    // Original: at home → storage; outdoors → bag.
    const bag = session.isAtHome ? session.storage : session.bag;
    if (attr === 'starve')
    {
        return countsByPrefix(bag, '1103');
    }
    if (attr === 'infect')
    {
        // Medicines except bandage.
        return countsByPrefix(bag, '1104').filter((row) => row.itemId !== 1104011);
    }
    if (attr === 'injury')
    {
        // Bandage only.
        return countsByPrefix(bag, '1104').filter((row) => row.itemId === 1104011);
    }
    return [];
}


type AttrFillEntry = {
    fill: GameObjects.Image;
    base: GameObjects.Image;
    reverse: boolean;
    /** Displayed fill ratio currently on screen (0–1). */
    displayRatio: number;
    tweenProxy: { ratio: number } | null;
};

const ATTR_FILL_TWEEN_MS = 420;

function applyBottomFillCrop (image: GameObjects.Image, fillPct: number): void
{
    const clamped = Math.max(0, Math.min(1, fillPct));
    const frame = image.frame;
    const sourceWidth = frame.realWidth;
    const sourceHeight = frame.realHeight;

    if (clamped <= 0)
    {
        image.setVisible(false);
        return;
    }

    image.setVisible(true);
    if (clamped >= 1)
    {
        image.setCrop();
        return;
    }

    const cropHeight = Math.max(1, Math.round(sourceHeight * clamped));
    const cropY = sourceHeight - cropHeight;
    image.setCrop(0, cropY, sourceWidth, cropHeight);
}

/**
 * Port of AttrButton.warnChange — brief up/down chevron beside the attr icon.
 */
function playAttrChangeWarn (
    scene: Scene,
    baseIcon: GameObjects.Image,
    wentUp: boolean,
): void
{
    const frameName = wentUp ? 'icon_status_up.png' : 'icon_status_down.png';
    if (!(scene.textures.exists('icon') && scene.textures.get('icon').has(frameName)))
    {
        return;
    }

    const warnName = `attrWarn_${baseIcon.name}`;
    const hostContainer = baseIcon.parentContainer;
    const searchList = hostContainer ? hostContainer.list : scene.children.list;
    for (const child of [...searchList])
    {
        if ((child as GameObjects.Image).name === warnName)
        {
            child.destroy();
        }
    }

    const warnX = baseIcon.x + baseIcon.displayWidth * 0.5 + 3;
    const warnY = baseIcon.y + (wentUp ? -baseIcon.displayHeight * 0.25 : baseIcon.displayHeight * 0.25);
    const warn = scene.add
        .image(warnX, warnY, 'icon', frameName)
        .setOrigin(0, 0.5)
        .setScale(ICON_SCALE)
        .setDepth((baseIcon.depth || 0) + 1)
        .setName(warnName);

    if (hostContainer)
    {
        hostContainer.add(warn);
    }

    scene.tweens.add({
        targets: warn,
        alpha: 0,
        duration: 1000,
        onComplete: () =>
        {
            warn.destroy();
        },
    });
}

function animateAttrFill (
    scene: Scene,
    entry: AttrFillEntry,
    targetRatio: number,
    showWarn: boolean,
): void
{
    const clampedTarget = Math.max(0, Math.min(1, targetRatio));
    const fromRatio = entry.displayRatio;
    if (Math.abs(clampedTarget - fromRatio) < 0.001)
    {
        applyBottomFillCrop(entry.fill, clampedTarget);
        entry.displayRatio = clampedTarget;
        return;
    }

    if (showWarn)
    {
        playAttrChangeWarn(scene, entry.base, clampedTarget > fromRatio);
    }

    // Kill previous fill tween for this entry.
    if (entry.tweenProxy)
    {
        scene.tweens.killTweensOf(entry.tweenProxy);
    }

    const proxy = { ratio: fromRatio };
    entry.tweenProxy = proxy;
    scene.tweens.add({
        targets: proxy,
        ratio: clampedTarget,
        duration: ATTR_FILL_TWEEN_MS,
        ease: 'Sine.easeOut',
        onUpdate: () =>
        {
            entry.displayRatio = proxy.ratio;
            applyBottomFillCrop(entry.fill, proxy.ratio);
        },
        onComplete: () =>
        {
            entry.displayRatio = clampedTarget;
            entry.tweenProxy = null;
            applyBottomFillCrop(entry.fill, clampedTarget);
        },
    });
}

export function addTopFrame (
    scene: Scene,
    session: SessionState,
    opts?: { onSettings?: () => void },
): TopFrameHandle
{
    const { width } = scene.scale;
    const lan = getLanguage();
    const root = scene.add.container(0, 0);
    root.setDepth(50);

    const topY = 18;
    const bgLeft = width / 2 - FRAME_WIDTH / 2;

    if (scene.textures.exists('ui') && scene.textures.get('ui').has('frame_bg_top.png'))
    {
        root.add(
            scene.add
                .image(width / 2, topY, 'ui', 'frame_bg_top.png')
                .setOrigin(0.5, 0),
        );
    }
    else
    {
        root.add(
            scene.add
                .rectangle(width / 2, topY + FRAME_HEIGHT / 2, FRAME_WIDTH, FRAME_HEIGHT, 0x2a2a2a)
                .setOrigin(0.5, 0.5),
        );
    }

    const firstLineCenterY =
        topY + FRAME_HEIGHT - FIRST_LINE_LOCAL_Y - LINE_HEIGHT / 2;
    const secondLineCenterY =
        topY + FRAME_HEIGHT - SECOND_LINE_LOCAL_Y - LINE_HEIGHT / 2;
    const thirdLineLeft = bgLeft + 6;
    const thirdLineTopY = topY + FRAME_HEIGHT - THIRD_LINE_LOCAL_Y - THIRD_LINE_HEIGHT;
    const thirdLineCenterY = thirdLineTopY + THIRD_LINE_HEIGHT / 2;

    const contentLeft = bgLeft + 6;
    const cellW = LINE_WIDTH / 6;

    const labelStyle = {
        fontFamily: UI_FONT_FAMILY,
        resolution: UI_TEXT_RESOLUTION,
        fontSize: `${UI_FONT_SIZE.COMMON_2}px`,
        color: '#ffffff',
    };

    // Live-updatable labels / fill icons
    let dayLabel: GameObjects.Text | null = null;
    let clockLabel: GameObjects.Text | null = null;
    let tempLabel: GameObjects.Text | null = null;
    let seasonIcon: GameObjects.Image | null = null;
    let weatherIcon: GameObjects.Image | null = null;
    const attrFills = new Map<AttrKeyLocal, AttrFillEntry>();
    const logLineTexts: GameObjects.Text[] = [];

    const makeCellHit = (
        cellIndex: number,
        lineCenterY: number,
        lineHeight: number,
        onClick: () => void,
    ): void =>
    {
        const cellCenterX = contentLeft + cellW * (cellIndex + 0.5);
        const hit = scene.add
            .rectangle(cellCenterX, lineCenterY, cellW, lineHeight, 0x000000, 0)
            .setInteractive({ useHandCursor: true });
        hit.on('pointerup', onClick);
        root.add(hit);
    };

    const openStatus = (
        stringId: StatusInfoId,
        iconFrame: string,
        value: string,
    ): void =>
    {
        const live = getSession() ?? session;
        const copy = getStatusCopy(stringId, lan);
        openStatusDialog(scene, {
            iconFrame,
            iconAtlas: 'icon',
            title: copy.title,
            currentLine: formatCurrentValue(value, lan),
            description: copy.des,
        });
        void live;
    };

    const placeStatusCell = (
        cellIndex: number,
        lineCenterY: number,
        iconFrame: string,
        label: string | null,
        onClick?: () => void,
        atlas: 'icon' | 'ui' = 'icon',
        track?: 'day' | 'clock' | 'temp' | 'season' | 'weather',
    ): void =>
    {
        const cellLeft = contentLeft + cellW * cellIndex;
        const cellCenterX = cellLeft + cellW / 2;
        const hasLabel = label !== null && label !== '';

        if (scene.textures.exists(atlas) && scene.textures.get(atlas).has(iconFrame))
        {
            if (!hasLabel)
            {
                const image = sizeStatusIcon(
                    scene.add.image(cellCenterX, lineCenterY, atlas, iconFrame),
                );
                root.add(image);
                if (track === 'season')
                {
                    seasonIcon = image;
                }
                if (track === 'weather')
                {
                    weatherIcon = image;
                }
            }
            else
            {
                const probe = scene.add.text(0, 0, label, labelStyle).setVisible(false);
                const labelWidth = probe.width;
                probe.destroy();

                const edgePadding = (cellW - ICON_DISPLAY - labelWidth) / 2;
                const iconX = cellLeft + edgePadding;
                const labelX = cellLeft + cellW - edgePadding;

                root.add(
                    sizeStatusIcon(
                        scene.add
                            .image(iconX, lineCenterY, atlas, iconFrame)
                            .setOrigin(0, 0.5),
                    ),
                );
                const text = scene.add
                    .text(labelX, lineCenterY, label, labelStyle)
                    .setOrigin(1, 0.5);
                root.add(text);
                if (track === 'day')
                {
                    dayLabel = text;
                }
                if (track === 'clock')
                {
                    clockLabel = text;
                }
                if (track === 'temp')
                {
                    tempLabel = text;
                }
            }
        }
        else if (hasLabel)
        {
            const text = scene.add
                .text(cellCenterX, lineCenterY, label, labelStyle)
                .setOrigin(0.5, 0.5);
            root.add(text);
            if (track === 'day')
            {
                dayLabel = text;
            }
            if (track === 'clock')
            {
                clockLabel = text;
            }
            if (track === 'temp')
            {
                tempLabel = text;
            }
        }

        if (onClick)
        {
            makeCellHit(cellIndex, lineCenterY, LINE_HEIGHT, onClick);
        }
    };

    const placeAttrCell = (
        cellIndex: number,
        attr: AttrKeyLocal,
        reverse: boolean,
        onClick: () => void,
    ): void =>
    {
        const cellLeft = contentLeft + cellW * cellIndex;
        const baseFrame = `icon_${attr}_1.png`;
        const fillFrame = `icon_${attr}_0.png`;

        if (scene.textures.exists('icon') && scene.textures.get('icon').has(baseFrame))
        {
            const edgePadding = (cellW - ICON_DISPLAY) / 2;
            const iconCenterX = cellLeft + edgePadding + ICON_DISPLAY / 2;

            const base = sizeStatusIcon(
                scene.add.image(iconCenterX, secondLineCenterY, 'icon', baseFrame),
            );
            base.setName(`attrBase_${attr}`);
            root.add(base);

            if (scene.textures.get('icon').has(fillFrame))
            {
                const fill = sizeStatusIcon(
                    scene.add.image(iconCenterX, secondLineCenterY, 'icon', fillFrame),
                );
                fill.setName(`attrFill_${attr}`);
                root.add(fill);
                const rawRatio = attrRatio(session, attr);
                const displayRatio = reverse ? 1 - rawRatio : rawRatio;
                applyBottomFillCrop(fill, displayRatio);
                attrFills.set(attr, {
                    fill,
                    base,
                    reverse,
                    displayRatio,
                    tweenProxy: null,
                });
            }
        }

        makeCellHit(cellIndex, secondLineCenterY, LINE_HEIGHT, onClick);
    };

    // ── firstLine ──
    const dayIcon = 'icon_day.png';
    const seasonFrame = `icon_season_${session.season}.png`;
    const timeIcon = 'icon_time.png';
    const weatherFrame = `icon_weather_${session.weatherId}.png`;
    const tempIcon = 'icon_temperature_0.png';

    placeStatusCell(0, firstLineCenterY, dayIcon, String(session.day), () =>
    {
        const live = getSession() ?? session;
        openStatus(1, dayIcon, formatStatusValue(1, live, lan));
    }, 'icon', 'day');
    placeStatusCell(1, firstLineCenterY, seasonFrame, null, () =>
    {
        const live = getSession() ?? session;
        const frame = `icon_season_${live.season}.png`;
        openStatus(2, frame, formatStatusValue(2, live, lan));
    }, 'icon', 'season');
    placeStatusCell(2, firstLineCenterY, timeIcon, formatClock(session), () =>
    {
        const live = getSession() ?? session;
        openStatus(4, timeIcon, formatStatusValue(4, live, lan));
    }, 'icon', 'clock');
    placeStatusCell(3, firstLineCenterY, weatherFrame, null, () =>
    {
        const live = getSession() ?? session;
        const frame = `icon_weather_${live.weatherId}.png`;
        openStatus(11, frame, formatStatusValue(11, live, lan));
    }, 'icon', 'weather');
    placeStatusCell(4, firstLineCenterY, tempIcon, String(session.temperature), () =>
    {
        const live = getSession() ?? session;
        openStatus(3, tempIcon, formatStatusValue(3, live, lan));
    }, 'icon', 'temp');

    // settings
    {
        const cellIndex = 5;
        const cellCenterX = contentLeft + cellW * (cellIndex + 0.5);
        if (scene.textures.exists('ui') && scene.textures.get('ui').has('btn_game_setting.png'))
        {
            const settingsBtn = sizeStatusIcon(
                scene.add.image(cellCenterX, firstLineCenterY, 'ui', 'btn_game_setting.png'),
            );
            root.add(settingsBtn);
        }
        makeCellHit(cellIndex, firstLineCenterY, LINE_HEIGHT, () =>
        {
            const already = scene.children.list.some(
                (child) => (child as GameObjects.Container).name === 'settingLayer',
            );
            if (already)
            {
                return;
            }
            if (opts?.onSettings)
            {
                opts.onSettings();
                return;
            }
            openSettingLayer(scene, { fromGame: true });
        });
    }

    // ── secondLine attrs ──
    const attrDefs: Array<{ key: AttrKeyLocal; reverse: boolean }> = [
        { key: 'injury', reverse: true },
        { key: 'infect', reverse: true },
        { key: 'starve', reverse: false },
        { key: 'vigour', reverse: false },
        { key: 'spirit', reverse: false },
        { key: 'hp', reverse: false },
    ];
    attrDefs.forEach((def, index) =>
    {
        placeAttrCell(index, def.key, def.reverse, () =>
        {
            const live = getSession() ?? session;
            const stringId = ATTR_STATUS_ID[def.key];
            const copy = getStatusCopy(stringId, lan);
            const quickItems = quickItemsForAttr(def.key, live);
            openStatusDialog(scene, {
                iconFrame: `icon_${def.key}_0.png`,
                iconAtlas: 'icon',
                title: copy.title,
                currentLine: formatCurrentValue(formatAttrValue(def.key, live), lan),
                description: copy.des,
                quickItems,
                onQuickItemTap: (itemId) =>
                {
                    // Original: tap strip cell → showItemDialog(..., source 'top').
                    openItemDialog(scene, itemId, {
                        from: 'top',
                        onToast: (msg) =>
                        {
                            // Lightweight feedback; status strip refreshes on reopen.
                            void msg;
                        },
                    });
                },
            });
        });
    });

    // ── thirdLine logs ──
    for (let lineIndex = 0; lineIndex < 4; lineIndex++)
    {
        const cocosBottomY = THIRD_LINE_LOCAL_Y + lineIndex * 30 + 4;
        const phaserBottomY = topY + FRAME_HEIGHT - cocosBottomY;
        const lineText = scene.add
            .text(thirdLineLeft, phaserBottomY, '', {
                fontFamily: UI_FONT_FAMILY,
                resolution: UI_TEXT_RESOLUTION,
                fontSize: `${UI_FONT_SIZE.COMMON_3}px`,
                color: '#ffffff',
                wordWrap: uiWordWrap(580),
            })
            .setOrigin(0, 1);
        root.add(lineText);
        logLineTexts.push(lineText);
    }

    const fillLogLines = (live: SessionState): void =>
    {
        const recent = live.logs.slice(-4);
        // Newest at bottom of strip (index 0 in original was lastLog only).
        // Match original single lastLog on first slot; show history upward.
        const lines = ['', '', '', ''];
        if (recent.length === 0 && live.lastLog)
        {
            lines[0] = live.lastLog;
        }
        else
        {
            // oldest of the 4 → top visually (higher lineIndex = higher on screen in Cocos local)
            // phaser: lineIndex 0 is lowest? cocosBottomY = 6 + i*30 → lineIndex 0 is near bottom of strip
            // Put newest at lineIndex 0 (bottom of strip area in local coords = top of third line stack...)
            // Original only showed lastLog on first slot. Show newest first.
            for (let i = 0; i < 4; i++)
            {
                const entry = recent[recent.length - 1 - i];
                lines[i] = entry ? entry.text : '';
            }
        }
        logLineTexts.forEach((textObj, index) =>
        {
            textObj.setText(lines[index] ?? '');
        });
    };
    fillLogLines(session);

    let logPanel: GameObjects.Container | null = null;
    const logHit = scene.add
        .rectangle(
            contentLeft + LINE_WIDTH / 2,
            thirdLineCenterY,
            LINE_WIDTH,
            THIRD_LINE_HEIGHT,
            0x000000,
            0,
        )
        .setInteractive({ useHandCursor: true });
    root.add(logHit);
    logHit.on('pointerup', () =>
    {
        if (logPanel)
        {
            logPanel.destroy(true);
            logPanel = null;
            return;
        }
        const live = getSession() ?? session;
        logPanel = openLogPanel(scene, live, () =>
        {
            logPanel = null;
        });
    });

    const refresh = (): void =>
    {
        const live = getSession();
        if (!live)
        {
            return;
        }
        dayLabel?.setText(String(live.day));
        clockLabel?.setText(formatClock(live));
        tempLabel?.setText(String(Math.round(live.temperature)));
        if (seasonIcon && scene.textures.exists('icon'))
        {
            const frame = `icon_season_${live.season}.png`;
            if (scene.textures.get('icon').has(frame))
            {
                seasonIcon.setFrame(frame);
            }
        }
        if (weatherIcon && scene.textures.exists('icon'))
        {
            const frame = `icon_weather_${live.weatherId}.png`;
            if (scene.textures.get('icon').has(frame))
            {
                weatherIcon.setFrame(frame);
            }
        }
        attrFills.forEach((entry, attrKey) =>
        {
            const rawRatio = attrRatio(live, attrKey);
            const targetRatio = entry.reverse ? 1 - rawRatio : rawRatio;
            // Animate fill + up/down chevron when the displayed amount changes.
            animateAttrFill(scene, entry, targetRatio, true);
        });
        fillLogLines(live);
    };

    return {
        root,
        refresh,
        destroy: () =>
        {
            attrFills.forEach((entry) =>
            {
                if (entry.tweenProxy)
                {
                    scene.tweens.killTweensOf(entry.tweenProxy);
                    entry.tweenProxy = null;
                }
            });
            if (logPanel)
            {
                logPanel.destroy(true);
                logPanel = null;
            }
            root.destroy(true);
        },
    };
}

function openLogPanel (
    scene: Scene,
    live: SessionState,
    onClosed: () => void,
): GameObjects.Container
{
    const { width, height } = scene.scale;
    const panel = scene.add.container(0, 0);
    panel.setDepth(120);
    panel.setName('logPanel');

    const dim = scene.add
        .rectangle(width / 2, height / 2, width, height, 0x000000, 200 / 255)
        .setInteractive();
    panel.add(dim);

    // Original: frame_bg_bottom anchor bottom-center @ (winW/2, 18).
    const bottomY = height - 18;
    let frameW = 596;
    let frameH = 839;
    if (scene.textures.exists('ui') && scene.textures.get('ui').has('frame_bg_bottom.png'))
    {
        const frame = scene.add
            .image(width / 2, bottomY, 'ui', 'frame_bg_bottom.png')
            .setOrigin(0.5, 1);
        panel.add(frame);
        frameW = frame.displayWidth;
        frameH = frame.displayHeight;
    }
    else
    {
        panel.add(
            scene.add
                .rectangle(width / 2, bottomY, frameW, frameH, 0x1a1a1a)
                .setOrigin(0.5, 1)
                .setStrokeStyle(2, 0x888888),
        );
    }

    // Original LogView: size (bg.width, bg.height - 20) at (7, 5) in frame-local.
    const viewW = Math.max(100, frameW - 14);
    const viewH = Math.max(120, frameH - 20);
    const viewLeft = width / 2 - frameW / 2 + 7;
    const viewTop = bottomY - 5 - viewH;

    const scroll = mountScrollViewport(scene, panel, {
        x: viewLeft,
        y: viewTop,
        width: viewW,
        height: viewH,
        axis: 'y',
        inputBlocker: true,
    });

    const entries = live.logs.length > 0
        ? live.logs
        : (live.lastLog
            ? [{ text: live.lastLog, timeLabel: '' }]
            : []);

    // Oldest at top, newest at bottom (Phaser y-down). Stick to bottom after layout.
    let cursorY = 0;
    const textWidth = viewW - 20;
    if (entries.length === 0)
    {
        scroll.content.add(
            scene.add
                .text(10, 10, '—', {
                    fontFamily: UI_FONT_FAMILY,
                    resolution: UI_TEXT_RESOLUTION,
                    fontSize: `${UI_FONT_SIZE.COMMON_3}px`,
                    color: '#888888',
                })
                .setOrigin(0, 0),
        );
        cursorY = 40;
    }
    else
    {
        for (const entry of entries)
        {
            const timeLabel = entry.timeLabel
                ? scene.add
                    .text(10, cursorY, entry.timeLabel, {
                        fontFamily: UI_FONT_FAMILY,
                        resolution: UI_TEXT_RESOLUTION,
                        fontSize: `${UI_FONT_SIZE.COMMON_2}px`,
                        color: '#ffffff',
                        wordWrap: uiWordWrap(textWidth),
                    })
                    .setOrigin(0, 0)
                : null;
            if (timeLabel)
            {
                scroll.content.add(timeLabel);
                cursorY += timeLabel.height + 2;
            }

            const body = scene.add
                .text(10, cursorY, entry.text, {
                    fontFamily: UI_FONT_FAMILY,
                    resolution: UI_TEXT_RESOLUTION,
                    fontSize: `${UI_FONT_SIZE.COMMON_3}px`,
                    color: '#ffffff',
                    wordWrap: uiWordWrap(textWidth),
                })
                .setOrigin(0, 0);
            scroll.content.add(body);
            cursorY += body.height + 10;
        }
    }

    const contentH = Math.max(viewH, cursorY + 8);
    scroll.setContentSize(contentH);
    // Newest at bottom of panel.
    scroll.setOffset(Math.min(0, viewH - contentH));

    const close = () =>
    {
        scroll.destroy();
        panel.destroy(true);
        onClosed();
    };
    // Tap dim (outside) closes; taps on the scroll well are swallowed by ScrollViewport.
    dim.on('pointerup', (pointer: Phaser.Input.Pointer) =>
    {
        if (scroll.inView(pointer.x, pointer.y))
        {
            return;
        }
        close();
    });

    return panel;
}
