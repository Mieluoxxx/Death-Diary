import { Scene, GameObjects } from 'phaser';
import {
    getSession,
    type RoleKey,
    type SessionState,
} from '../session/sessionStore';
import { addTopFrame, type TopFrameHandle } from '../ui/topFrame';
import { openSettingLayer } from '../ui/settingLayer';
import { getLanguage, t } from '../settings/settingsStore';
import { UI_FONT_FAMILY, UI_TEXT_RESOLUTION, uiWordWrap } from '../ui/uiFont';
import { gameBusOn, gameBusOff, gameBusClear } from '../systems/gameBus';
import {
    startSurvivalLoop,
    stopSurvivalLoop,
    debugSkipGameHours,
} from '../systems/survivalLoop';
import { tickTimeClock } from '../systems/timeClock';

/**
 * Port of Buried-City MainScene + HomeNode (web vertical slice).
 *
 * Cocos homeBg: child of bottom frame, anchor bottom-center, local y-up.
 * Building positions are centers in homeBg local space (bottom-left origin).
 * Phaser: home bottom edge at height - 18; local → screen:
 *   x = homeLeft + localX, y = homeBottom - localY.
 *
 * A-slice: survival clock runs while Home is active; TopFrame refreshes live.
 */
type BuildSpot = { bid: number; x: number; y: number };

const COMMON_BUILDS: BuildSpot[] = [
    { bid: 1, x: 70, y: 352 },
    { bid: 2, x: 412, y: 780 },
    { bid: 3, x: 230, y: 530 },
    { bid: 4, x: 477, y: 562 },
    { bid: 6, x: 165, y: 224 },
    { bid: 8, x: 112, y: 780 },
    { bid: 9, x: 80, y: 590 },
    { bid: 10, x: 468, y: 398 },
    { bid: 13, x: 125, y: 52 },
    { bid: 14, x: 425, y: 216 },
    { bid: 15, x: 270, y: 656 },
];

function buildsForRole (role: RoleKey): BuildSpot[]
{
    const spots = [...COMMON_BUILDS];
    if (role === 'LUO')
    {
        spots.push(
            { bid: 16, x: 480, y: 656 },
            { bid: 17, x: 430, y: 82 },
            { bid: 5, x: 310, y: 318 },
        );
    }
    else if (role === 'YAZI')
    {
        spots.push(
            { bid: 7, x: 503, y: 657 },
            { bid: 19, x: 430, y: 82 },
            { bid: 18, x: 310, y: 318 },
        );
    }
    else
    {
        spots.push(
            { bid: 7, x: 503, y: 657 },
            { bid: 11, x: 430, y: 82 },
            { bid: 5, x: 310, y: 318 },
        );
    }
    spots.push({ bid: 12, x: 349, y: 110 });
    return spots;
}

const BUILD_NAME_KEYS: Record<number, string> = {
    1: 'build_tool',
    2: 'build_fence',
    3: 'build_well',
    4: 'build_farm',
    5: 'build_kitchen',
    6: 'build_workshop',
    7: 'build_cellar',
    8: 'build_bathroom',
    9: 'build_bed',
    10: 'build_fireplace',
    11: 'build_booth',
    12: 'build_doghouse',
    13: 'build_storage',
    14: 'build_gate',
    15: 'build_radio',
    16: 'build_minefield',
    17: 'build_lathe',
    18: 'build_power',
    19: 'build_electric',
};

export class HomeScene extends Scene
{
    private toastText: GameObjects.Text | null = null;
    private topFrame: TopFrameHandle | null = null;
    private deathOverlay: GameObjects.Container | null = null;
    private boundRefresh: (() => void) | null = null;
    private boundDied: (() => void) | null = null;

    constructor ()
    {
        super('Home');
    }

    create ()
    {
        const session = getSession();
        if (!session)
        {
            this.scene.start('MainMenu');
            return;
        }

        const { width, height } = this.scale;
        this.toastText = null;
        this.topFrame = null;
        this.deathOverlay = null;

        this.add.rectangle(width / 2, height / 2, width, height, 0x000000);

        if (this.textures.exists('ui') && this.textures.get('ui').has('frame_bg_bottom.png'))
        {
            this.add
                .image(width / 2, height - 18, 'ui', 'frame_bg_bottom.png')
                .setOrigin(0.5, 1)
                .setDepth(0);
        }

        this.placeHomeContent(session, width, height);

        this.topFrame = addTopFrame(this, session, {
            onSettings: () => openSettingLayer(this, { fromGame: true }),
        });

        // Survival heartbeat: clock + hourly attr ticks (player.start subset).
        startSurvivalLoop();

        this.boundRefresh = () =>
        {
            this.topFrame?.refresh();
        };
        this.boundDied = () =>
        {
            this.topFrame?.refresh();
            this.showDeathOverlay();
        };

        gameBusOn('session_updated', this.boundRefresh);
        gameBusOn('time_tick', this.boundRefresh);
        gameBusOn('logChanged', this.boundRefresh);
        gameBusOn('player_died', this.boundDied);

        if (session.isDead)
        {
            this.showDeathOverlay();
        }

        // Debug: long-press bottom-left corner skips +3 game hours (dev aid for A-slice).
        this.installDebugSkipHotkey();

        this.events.once('shutdown', () => this.teardownSurvival());
    }

    update (_time: number, deltaMs: number): void
    {
        // Settings / death overlay → freeze simulation (do not advance clock).
        const settingsOpen = this.children.list.some(
            (child) => (child as GameObjects.Container).name === 'settingLayer',
        );
        if (settingsOpen || this.deathOverlay)
        {
            return;
        }
        tickTimeClock(deltaMs / 1000);
    }

    private teardownSurvival (): void
    {
        if (this.boundRefresh)
        {
            gameBusOff('session_updated', this.boundRefresh);
            gameBusOff('time_tick', this.boundRefresh);
            gameBusOff('logChanged', this.boundRefresh);
            this.boundRefresh = null;
        }
        if (this.boundDied)
        {
            gameBusOff('player_died', this.boundDied);
            this.boundDied = null;
        }
        stopSurvivalLoop();
        // Clear bus so menu does not keep Home listeners if any leaked.
        gameBusClear();
        this.topFrame = null;
        this.deathOverlay = null;
    }

    private placeHomeContent (session: SessionState, width: number, height: number): void
    {
        const lan = getLanguage();
        const homeBottom = height - 18;
        let homeWidth = 596;

        if (this.textures.exists('home') && this.textures.get('home').has('home_bg.png'))
        {
            const homeBg = this.add
                .image(width / 2, homeBottom, 'home', 'home_bg.png')
                .setOrigin(0.5, 1)
                .setDepth(1);
            homeWidth = homeBg.displayWidth;
        }
        else
        {
            this.add
                .rectangle(width / 2, homeBottom - 420, homeWidth, 840, 0x3a342c)
                .setDepth(1);
        }

        const homeLeft = width / 2 - homeWidth / 2;
        const spots = buildsForRole(session.role);

        spots.forEach((spot) =>
        {
            const level = session.buildLevels[spot.bid] ?? 0;
            const safeLevel = Math.max(0, level);
            const frame = `icon_start_build_${spot.bid}_${safeLevel}.png`;
            const px = homeLeft + spot.x;
            const py = homeBottom - spot.y;

            let btn: GameObjects.Image | GameObjects.Rectangle;
            if (this.textures.exists('home') && this.textures.get('home').has(frame))
            {
                btn = this.add.image(px, py, 'home', frame).setDepth(2);
            }
            else
            {
                btn = this.add
                    .rectangle(px, py, 48, 48, level >= 0 ? 0x888888 : 0x333333)
                    .setDepth(2);
            }

            btn.setInteractive({ useHandCursor: true });
            btn.on('pointerdown', () => btn.setAlpha(0.7));
            btn.on('pointerout', () => btn.setAlpha(1));
            btn.on('pointerup', () =>
            {
                btn.setAlpha(1);
                const nameKey = BUILD_NAME_KEYS[spot.bid] ?? `build_${spot.bid}`;
                const name = t(nameKey, lan);
                this.showToast(`${name} (Lv.${safeLevel}) — ${t('buildSoon', lan)}`);
            });
        });
    }

    private showDeathOverlay (): void
    {
        if (this.deathOverlay)
        {
            return;
        }
        const { width, height } = this.scale;
        const overlay = this.add.container(0, 0);
        overlay.setDepth(300);
        this.deathOverlay = overlay;

        overlay.add(
            this.add
                .rectangle(width / 2, height / 2, width, height, 0x000000, 0.72)
                .setInteractive(),
        );
        overlay.add(
            this.add
                .text(width / 2, height / 2 - 40, '你死了', {
                    fontFamily: UI_FONT_FAMILY,
                    resolution: UI_TEXT_RESOLUTION,
                    fontSize: '42px',
                    color: '#f0e6d2',
                })
                .setOrigin(0.5),
        );
        overlay.add(
            this.add
                .text(width / 2, height / 2 + 24, '点击返回主菜单', {
                    fontFamily: UI_FONT_FAMILY,
                    resolution: UI_TEXT_RESOLUTION,
                    fontSize: '20px',
                    color: '#cccccc',
                })
                .setOrigin(0.5),
        );

        overlay.on('pointerup', () =>
        {
            // Keep session so Continue can show death state; new game overwrites.
            this.scene.start('MainMenu');
        });
        // Hit via dim rectangle
        const dim = overlay.list[0] as GameObjects.Rectangle;
        dim.on('pointerup', () =>
        {
            this.scene.start('MainMenu');
        });
    }

    private installDebugSkipHotkey (): void
    {
        // Keyboard: press "]" to skip +3 game hours (dev / QA for survival tick).
        // Use string key — avoid bare `Phaser` global (not imported at runtime).
        const keyboard = this.input.keyboard;
        if (!keyboard)
        {
            return;
        }
        const skipKey = keyboard.addKey('CLOSED_BRACKET');
        skipKey.on('down', () =>
        {
            debugSkipGameHours(3);
            const live = getSession();
            if (live)
            {
                const hourText = String(live.hour).padStart(2, '0');
                const minuteText = String(live.minute).padStart(2, '0');
                this.showToast(`调试：快进 3 小时 → 第${live.day}天 ${hourText}:${minuteText}`);
            }
            this.topFrame?.refresh();
        });
    }

    private showToast (message: string): void
    {
        const { width, height } = this.scale;
        if (this.toastText)
        {
            this.toastText.destroy();
        }
        this.toastText = this.add
            .text(width / 2, height * 0.42, message, {
                fontFamily: UI_FONT_FAMILY,
                resolution: UI_TEXT_RESOLUTION,
                fontSize: '18px',
                color: '#111111',
                backgroundColor: '#f0e6d2',
                padding: { x: 16, y: 10 },
                align: 'center',
                wordWrap: uiWordWrap(400),
            })
            .setOrigin(0.5)
            .setDepth(100);

        this.time.delayedCall(1600, () =>
        {
            this.toastText?.destroy();
            this.toastText = null;
        });
    }
}
