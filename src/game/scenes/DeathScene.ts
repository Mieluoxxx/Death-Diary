/**
 * Port of Buried-City DeathNode (BottomFrameNode death page).
 * Title 死亡 + dig_death + survival line + revive / accept death.
 */

import { type GameObjects, Scene } from 'phaser';
import { getSession } from '../session/sessionStore';
import {
    consumeFirstAidKit,
    countFirstAidKits,
    formatSurvivalDuration,
    relivePlayer,
} from '../systems/deathSystem';
import { stopSurvivalLoop } from '../systems/survivalLoop';
import { addAtlasButton } from '../ui/atlasButton';
import { UI_FONT_FAMILY, UI_FONT_SIZE, UI_TEXT_RESOLUTION, uiWordWrap } from '../ui/uiFont';

const BG_WIDTH = 596;
const BG_BOTTOM_OFFSET = 18;
const BG_HEIGHT = 839;

export class DeathScene extends Scene {
    constructor() {
        super('Death');
    }

    create(): void {
        const session = getSession();
        if (!session) {
            this.scene.start('MainMenu');
            return;
        }

        stopSurvivalLoop();

        const { width, height } = this.scale;
        const bgBottomY = height - BG_BOTTOM_OFFSET;
        const bgCenterX = width / 2;
        const contentTopY = bgBottomY - BG_HEIGHT + 90;

        this.add.rectangle(width / 2, height / 2, width, height, 0x000000);

        // Top strip stays empty black — original keeps top frame gone after die/stop.
        if (this.textures.exists('ui') && this.textures.get('ui').has('frame_bg_bottom.png')) {
            this.add.image(bgCenterX, bgBottomY, 'ui', 'frame_bg_bottom.png').setOrigin(0.5, 1);
        } else {
            this.add
                .rectangle(bgCenterX, bgBottomY - BG_HEIGHT / 2, BG_WIDTH, BG_HEIGHT, 0x1a1a1a)
                .setOrigin(0.5);
        }

        // Title bar: 死亡
        this.add
            .text(bgCenterX, bgBottomY - 803, '死亡', {
                fontFamily: UI_FONT_FAMILY,
                resolution: UI_TEXT_RESOLUTION,
                fontSize: `${UI_FONT_SIZE.COMMON_1}px`,
                color: '#ffffff',
            })
            .setOrigin(0.5);

        if (this.textures.exists('ui') && this.textures.get('ui').has('frame_line.png')) {
            this.add.image(bgCenterX, bgBottomY - 770, 'ui', 'frame_line.png');
        }

        // dig_death illustration
        let digBottom = contentTopY + 20;
        if (this.textures.exists('ui') && this.textures.get('ui').has('dig_death.png')) {
            const dig = this.add
                .image(bgCenterX, contentTopY + 10, 'ui', 'dig_death.png')
                .setOrigin(0.5, 0);
            const maxW = BG_WIDTH - 48;
            if (dig.width > maxW) {
                dig.setScale(maxW / dig.width);
            }
            digBottom = dig.y + dig.displayHeight + 16;
        }

        const duration = formatSurvivalDuration(session);
        this.add
            .text(bgCenterX, digBottom, `在勉强生存了${duration}后，你终于倒下了`, {
                fontFamily: UI_FONT_FAMILY,
                resolution: UI_TEXT_RESOLUTION,
                fontSize: `${UI_FONT_SIZE.COMMON_2}px`,
                color: '#ffffff',
                align: 'center',
                wordWrap: uiWordWrap(BG_WIDTH - 80),
            })
            .setOrigin(0.5, 0);

        const kitCount = countFirstAidKits(session);
        const hasKit = kitCount > 0;
        const btnY = bgBottomY - 100;

        // Original: with kit → revive only; without → accept death (+ optional pay deferred).
        if (hasKit) {
            this.add
                .text(bgCenterX, btnY - 48, `你有${kitCount}个急救包`, {
                    fontFamily: UI_FONT_FAMILY,
                    resolution: UI_TEXT_RESOLUTION,
                    fontSize: `${UI_FONT_SIZE.COMMON_2}px`,
                    color: '#ffffff',
                })
                .setOrigin(0.5, 1);

            this.addWhiteButton(bgCenterX, btnY, '复活', () => {
                if (!consumeFirstAidKit()) {
                    return;
                }
                relivePlayer();
                this.scene.start('Home');
            });
        } else {
            this.add
                .text(bgCenterX, btnY - 48, '你有0个急救包', {
                    fontFamily: UI_FONT_FAMILY,
                    resolution: UI_TEXT_RESOLUTION,
                    fontSize: `${UI_FONT_SIZE.COMMON_2}px`,
                    color: '#aaaaaa',
                })
                .setOrigin(0.5, 1);

            // Accept death → EndScene. (IAP buy-first-aid deferred.)
            this.addWhiteButton(bgCenterX, btnY, '接受死亡', () => {
                this.scene.start('End');
            });
        }
    }

    private addWhiteButton(
        x: number,
        y: number,
        label: string,
        onClick: () => void,
    ): GameObjects.Container | GameObjects.Rectangle {
        if (
            this.textures.exists('ui') &&
            this.textures.get('ui').has('btn_common_white_normal.png')
        ) {
            return addAtlasButton(this, x, y, {
                atlas: 'ui',
                frame: 'btn_common_white_normal.png',
                label,
                labelColor: '#111111',
                labelSizeTier: 'COMMON_2',
                onClick,
            });
        }

        const btn = this.add
            .rectangle(x, y, 200, 52, 0xf0e6d2)
            .setInteractive({ useHandCursor: true });
        const text = this.add
            .text(x, y, label, {
                fontFamily: UI_FONT_FAMILY,
                resolution: UI_TEXT_RESOLUTION,
                fontSize: '22px',
                color: '#111111',
            })
            .setOrigin(0.5);
        btn.on('pointerup', onClick);
        void text;
        return btn;
    }
}
