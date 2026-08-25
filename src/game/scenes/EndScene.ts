/**
 * Port of Buried-City EndScene / EndLayer (accept death settlement).
 *
 * Original places labels as children of end_bg with Cocos y-up local coords
 * on a 640×1136 art (anchor center). Convert:
 *   screenX = bg.x - bgW/2 + localX
 *   screenY = bg.y + bgH/2 - localY   (flip y-up → Phaser y-down)
 */

import { Scene } from 'phaser';
import { loadAtlas } from '../assets/loadAtlas';
import { getSession } from '../session/sessionStore';
import { survivalClockParts } from '../systems/deathSystem';
import { stopSurvivalLoop } from '../systems/survivalLoop';
import { addAtlasButton } from '../ui/atlasButton';
import { UI_FONT_FAMILY, UI_FONT_SIZE, UI_TEXT_RESOLUTION } from '../ui/uiFont';

/** Design size of end_bg.png (matches game resolution). */
const END_BG_W = 640;
const END_BG_H = 1136;

export class EndScene extends Scene {
    constructor() {
        super('End');
    }

    async create(): Promise<void> {
        const session = getSession();
        if (!session) {
            this.scene.start('MainMenu');
            return;
        }

        stopSurvivalLoop();

        const { width, height } = this.scale;
        this.add.rectangle(width / 2, height / 2, width, height, 0x000000);

        try {
            await loadAtlas(this, 'end');
        } catch {
            // Fall through with solid bg.
        }

        const parts = survivalClockParts(session);
        const bgCenterX = width / 2;
        const bgCenterY = height / 2;

        if (this.textures.exists('end') && this.textures.get('end').has('end_bg.png')) {
            const bg = this.add.image(bgCenterX, bgCenterY, 'end', 'end_bg.png');
            // end_bg is exactly 640×1136 — FIT canvas is the same; no extra scale.
            // If window letterboxes via Scale.FIT, scene coords stay design space.
            const scaleX = bg.displayWidth / END_BG_W;
            const scaleY = bg.displayHeight / END_BG_H;

            /** Map Cocos-local (x right, y up from bg bottom-left) → Phaser screen. */
            const toScreen = (localX: number, localYUp: number) => {
                const x = bg.x - bg.displayWidth / 2 + localX * scaleX;
                const y = bg.y + bg.displayHeight / 2 - localYUp * scaleY;
                return { x, y };
            };

            // Original: label1 "你存活了" at (42, 736), anchor left, COMMON_1
            const titlePos = toScreen(42, 736);
            this.add
                .text(titlePos.x, titlePos.y, '你存活了', {
                    fontFamily: UI_FONT_FAMILY,
                    resolution: UI_TEXT_RESOLUTION,
                    fontSize: `${UI_FONT_SIZE.COMMON_1}px`,
                    color: '#ffffff',
                })
                .setOrigin(0, 0.5);

            // Original numbers: day(132,630) hour(320,630) minute(508,630), size 110, black
            const numStyle = {
                fontFamily: UI_FONT_FAMILY,
                resolution: UI_TEXT_RESOLUTION,
                fontSize: `${Math.round(110 * Math.min(scaleX, scaleY))}px`,
                color: '#111111',
            } as const;

            const dayPos = toScreen(132, 630);
            const hourPos = toScreen(320, 630);
            const minutePos = toScreen(508, 630);

            this.add.text(dayPos.x, dayPos.y, parts.day, numStyle).setOrigin(0.5);
            this.add.text(hourPos.x, hourPos.y, parts.hour, numStyle).setOrigin(0.5);
            this.add.text(minutePos.x, minutePos.y, parts.minute, numStyle).setOrigin(0.5);

            // Original home btn at center-x of panel band: leftEdge + (right-left)/4*2, y=432
            // leftEdge=42, rightEdge=598 → x = 42 + 556/2 = 320
            const homePos = toScreen(320, 432);
            if (this.textures.get('end').has('btn_home.png')) {
                const home = this.add
                    .image(homePos.x, homePos.y, 'end', 'btn_home.png')
                    .setInteractive({ useHandCursor: true });
                home.setScale(scaleX, scaleY);
                home.on('pointerdown', () => home.setAlpha(0.7));
                home.on('pointerout', () => home.setAlpha(1));
                home.on('pointerup', () => {
                    home.setAlpha(1);
                    this.scene.start('MainMenu');
                });
            } else {
                this.addMenuButton(homePos.x, homePos.y);
            }
        } else {
            this.add
                .text(bgCenterX, bgCenterY - 160, '你存活了', {
                    fontFamily: UI_FONT_FAMILY,
                    resolution: UI_TEXT_RESOLUTION,
                    fontSize: `${UI_FONT_SIZE.COMMON_1}px`,
                    color: '#ffffff',
                })
                .setOrigin(0.5);

            this.add
                .text(
                    bgCenterX,
                    bgCenterY - 40,
                    `${parts.day} 天  ${parts.hour} 时  ${parts.minute} 分`,
                    {
                        fontFamily: UI_FONT_FAMILY,
                        resolution: UI_TEXT_RESOLUTION,
                        fontSize: '40px',
                        color: '#ffffff',
                    },
                )
                .setOrigin(0.5);

            this.addMenuButton(bgCenterX, bgCenterY + 120);
        }
    }

    private addMenuButton(x: number, y: number): void {
        if (
            this.textures.exists('ui') &&
            this.textures.get('ui').has('btn_common_white_normal.png')
        ) {
            addAtlasButton(this, x, y, {
                atlas: 'ui',
                frame: 'btn_common_white_normal.png',
                label: '返回主菜单',
                labelColor: '#111111',
                labelSizeTier: 'COMMON_2',
                onClick: () => this.scene.start('MainMenu'),
            });
            return;
        }

        const btn = this.add
            .rectangle(x, y, 220, 52, 0xf0e6d2)
            .setInteractive({ useHandCursor: true });
        this.add
            .text(x, y, '返回主菜单', {
                fontFamily: UI_FONT_FAMILY,
                resolution: UI_TEXT_RESOLUTION,
                fontSize: '20px',
                color: '#111111',
            })
            .setOrigin(0.5);
        btn.on('pointerup', () => this.scene.start('MainMenu'));
    }
}
