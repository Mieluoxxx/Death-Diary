import { Scene, GameObjects } from 'phaser';
import {
    getSession,
    type RoleKey,
    type SessionState,
} from '../session/sessionStore';
import { addTopFrame, type TopFrameHandle } from '../ui/topFrame';
import { openSettingLayer } from '../ui/settingLayer';
import { openBuildPanel, type BuildPanelHandle } from '../ui/buildPanel';
import { createNavigationHost, NavNode, type NavHostHandle } from '../ui/navigation';
import { UI_FONT_FAMILY, UI_TEXT_RESOLUTION, uiWordWrap } from '../ui/uiFont';
import { gameBusOn, gameBusOff, gameBusClear } from '../systems/gameBus';
import {
    startSurvivalLoop,
    stopSurvivalLoop,
    debugSkipGameHours,
} from '../systems/survivalLoop';
import { tickTimeClock } from '../systems/timeClock';
import { clearActiveUpgrades, homeBuildFrame } from '../systems/buildSystem';
import { isDogHouseUnlocked, unlockDogHouse } from '../systems/iapStore';
import type { NightRaidResult } from '../systems/nightRaidSystem';

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

export class HomeScene extends Scene
{
    private toastText: GameObjects.Text | null = null;
    private topFrame: TopFrameHandle | null = null;
    private deathOverlay: GameObjects.Container | null = null;
    private buildPanel: BuildPanelHandle | null = null;
    private navHost: NavHostHandle | null = null;
    private buildButtons = new Map<number, GameObjects.Image | GameObjects.Rectangle>();
    private homeLayer: GameObjects.Container | null = null;
    private boundRefresh: (() => void) | null = null;
    private boundDied: (() => void) | null = null;
    private boundNightRaid: ((res: NightRaidResult) => void) | null = null;

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
        this.buildPanel = null;

        this.add.rectangle(width / 2, height / 2, width, height, 0x000000);

        if (this.textures.exists('ui') && this.textures.get('ui').has('frame_bg_bottom.png'))
        {
            this.add
                .image(width / 2, height - 18, 'ui', 'frame_bg_bottom.png')
                .setOrigin(0.5, 1)
                .setDepth(0);
        }

        this.placeHomeContent(session, width, height);

        this.navHost = createNavigationHost(this, {
            onHomeVisible: (visible) => this.setHomeMapVisible(visible),
            onToast: (msg) => this.showToast(msg),
        });

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
        this.boundNightRaid = (res) =>
        {
            this.showNightRaidDialog(res);
        };

        gameBusOn('session_updated', this.boundRefresh);
        gameBusOn('time_tick', this.boundRefresh);
        gameBusOn('logChanged', this.boundRefresh);
        gameBusOn('player_died', this.boundDied);
        gameBusOn('night_raid', this.boundNightRaid);

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
        this.navHost?.update(deltaMs);
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
        if (this.boundNightRaid)
        {
            gameBusOff('night_raid', this.boundNightRaid);
            this.boundNightRaid = null;
        }
        stopSurvivalLoop();
        clearActiveUpgrades();
        this.buildPanel?.destroy();
        this.buildPanel = null;
        this.navHost?.destroy();
        this.navHost = null;
        // Clear bus so menu does not keep Home listeners if any leaked.
        gameBusClear();
        this.topFrame = null;
        this.deathOverlay = null;
    }

    private placeHomeContent (session: SessionState, width: number, height: number): void
    {
        const homeBottom = height - 18;
        let homeWidth = 596;

        this.homeLayer?.destroy(true);
        this.homeLayer = this.add.container(0, 0).setDepth(1);

        if (this.textures.exists('home') && this.textures.get('home').has('home_bg.png'))
        {
            const homeBg = this.add
                .image(width / 2, homeBottom, 'home', 'home_bg.png')
                .setOrigin(0.5, 1);
            this.homeLayer.add(homeBg);
            homeWidth = homeBg.displayWidth;
        }
        else
        {
            this.homeLayer.add(
                this.add.rectangle(width / 2, homeBottom - 420, homeWidth, 840, 0x3a342c),
            );
        }

        const homeLeft = width / 2 - homeWidth / 2;
        const spots = buildsForRole(session.role);

        this.buildButtons.clear();
        spots.forEach((spot) =>
        {
            const level = session.buildLevels[spot.bid] ?? -1;
            const safeLevel = Math.max(0, level);
            const frame = homeBuildFrame(spot.bid, safeLevel);
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

            if (level < 0)
            {
                btn.setAlpha(0.55);
            }

            // Original: dog house locked until IAP 107.
            if (spot.bid === 12 && !isDogHouseUnlocked())
            {
                btn.setAlpha(0.4);
                btn.setInteractive({ useHandCursor: true });
                btn.on('pointerup', () =>
                {
                    this.promptDogHouseUnlock();
                });
                const lock = this.add
                    .text(px, py + 18, '锁', {
                        fontFamily: UI_FONT_FAMILY,
                        resolution: UI_TEXT_RESOLUTION,
                        fontSize: '16px',
                        color: '#ffd27a',
                    })
                    .setOrigin(0.5)
                    .setDepth(3);
                this.homeLayer?.add(btn);
                this.homeLayer?.add(lock);
                this.buildButtons.set(spot.bid, btn);
                return;
            }

            btn.setInteractive({ useHandCursor: true });
            btn.on('pointerdown', () => btn.setAlpha(level < 0 ? 0.4 : 0.7));
            btn.on('pointerout', () => btn.setAlpha(level < 0 ? 0.55 : 1));
            btn.on('pointerup', () =>
            {
                btn.setAlpha(level < 0 ? 0.55 : 1);
                this.openFacility(spot.bid);
            });
            this.homeLayer?.add(btn);
            this.buildButtons.set(spot.bid, btn);
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


    private promptDogHouseUnlock (): void
    {
        // Web slice: free unlock (no payment). Mirrors IAP 107 success path.
        unlockDogHouse();
        this.showToast('狗舍已解锁（IAP 107）。可建造狗舍。');
        const live = getSession();
        if (live)
        {
            const { width, height } = this.scale;
            this.placeHomeContent(live, width, height);
        }
    }

    private showNightRaidDialog (res: NightRaidResult): void
    {
        if (!res.happened)
        {
            return;
        }
        const { width, height } = this.scale;
        const existing = this.children.list.find(
            (c) => (c as GameObjects.Container).name === 'nightRaidDialog',
        );
        existing?.destroy(true);

        const root = this.add.container(0, 0).setDepth(280);
        root.setName('nightRaidDialog');
        const dim = this.add
            .rectangle(width / 2, height / 2, width, height, 0x000000, 0.72)
            .setInteractive();
        root.add(dim);

        const defended = Boolean(res.defend || res.win);
        const title = '僵尸夜袭！';
        const body = defended
            ? '僵尸潮爆发，小镇到处都是暴躁的僵尸。凭借坚固的防御，你的小屋挺过了冲击，没有任何损失。'
            : '僵尸潮爆发，小镇到处都是暴躁的僵尸。几个僵尸突破了防御，进到家中大肆破坏。';
        const lost = (res.items ?? [])
            .map((it) => `${it.itemId}×${it.num}`)
            .join('  ');

        root.add(
            this.add
                .text(width / 2, height / 2 - 120, title, {
                    fontFamily: UI_FONT_FAMILY,
                    resolution: UI_TEXT_RESOLUTION,
                    fontSize: '32px',
                    color: '#f0e6d2',
                })
                .setOrigin(0.5),
        );
        root.add(
            this.add
                .text(width / 2, height / 2 - 40, body, {
                    fontFamily: UI_FONT_FAMILY,
                    resolution: UI_TEXT_RESOLUTION,
                    fontSize: '18px',
                    color: '#dddddd',
                    align: 'center',
                    wordWrap: uiWordWrap(width - 80),
                })
                .setOrigin(0.5, 0),
        );
        if (!defended && lost)
        {
            root.add(
                this.add
                    .text(width / 2, height / 2 + 80, `你的损失: ${lost}`, {
                        fontFamily: UI_FONT_FAMILY,
                        resolution: UI_TEXT_RESOLUTION,
                        fontSize: '16px',
                        color: '#ffb0b0',
                        align: 'center',
                        wordWrap: uiWordWrap(width - 80),
                    })
                    .setOrigin(0.5, 0),
            );
        }
        if (typeof res.homeDef === 'number')
        {
            root.add(
                this.add
                    .text(
                        width / 2,
                        height / 2 + 140,
                        `防御 ${res.homeDef} / 攻势 ${res.attackStrength ?? '?'}`,
                        {
                            fontFamily: UI_FONT_FAMILY,
                            resolution: UI_TEXT_RESOLUTION,
                            fontSize: '14px',
                            color: '#aaaaaa',
                        },
                    )
                    .setOrigin(0.5),
            );
        }

        const close = () => root.destroy(true);
        dim.on('pointerup', close);
        root.add(
            this.add
                .text(width / 2, height / 2 + 180, '知道了', {
                    fontFamily: UI_FONT_FAMILY,
                    resolution: UI_TEXT_RESOLUTION,
                    fontSize: '20px',
                    color: '#111111',
                    backgroundColor: '#e0e0e0',
                    padding: { x: 16, y: 8 },
                })
                .setOrigin(0.5)
                .setInteractive({ useHandCursor: true })
                .on('pointerup', close),
        );

        this.topFrame?.refresh();
    }

    private openFacility (bid: number): void
    {
        // Radio is the web-slice cheat console (replaces original online board).
        // Always open it — do not gate behind bid-15 build level, or QA loses /list /get.
        if (bid === 15)
        {
            this.navHost?.forward(NavNode.RADIO, { bid: 15 });
            return;
        }
        if (bid === 13)
        {
            this.navHost?.forward(NavNode.STORAGE, { bid: 13 });
            return;
        }
        if (bid === 14)
        {
            this.navHost?.forward(NavNode.GATE, { bid: 14 });
            return;
        }

        if (this.buildPanel)
        {
            this.buildPanel.destroy();
            this.buildPanel = null;
        }
        // Match original Navigation: hide Home map while BuildNode is up.
        this.setHomeMapVisible(false);
        this.buildPanel = openBuildPanel(this, bid, {
            onClose: () =>
            {
                this.buildPanel = null;
                this.setHomeMapVisible(true);
            },
            onUpgraded: (upgradedBid, level) =>
            {
                this.refreshBuildIcon(upgradedBid, level);
            },
        });
    }

    private setHomeMapVisible (visible: boolean): void
    {
        this.homeLayer?.setVisible(visible);
        this.buildButtons.forEach((btn) =>
        {
            btn.setVisible(visible);
        });
    }

    private refreshBuildIcon (bid: number, level: number): void
    {
        const btn = this.buildButtons.get(bid);
        if (!btn || !(btn instanceof GameObjects.Image))
        {
            return;
        }
        const frame = homeBuildFrame(bid, level);
        if (this.textures.exists('home') && this.textures.get('home').has(frame))
        {
            btn.setFrame(frame);
            btn.setAlpha(level < 0 ? 0.55 : 1);
        }
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
