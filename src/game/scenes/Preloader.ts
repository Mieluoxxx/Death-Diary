import { Scene } from 'phaser';
import { PRELOAD_ATLAS_KEYS } from '../assets/frames.gen';
import { applyLinearFilter, queuePreloadAtlases } from '../assets/loadAtlas';
import { bindAudio, queueStartupAudio } from '../systems/audioManager';
import { uiTextStyle } from '../ui/uiFont';

export class Preloader extends Scene {
    constructor() {
        super('Preloader');
    }

    init() {
        const { width, height } = this.scale;

        this.add.rectangle(width / 2, height / 2, width, height, 0x000000);

        this.add.rectangle(width / 2, height / 2, 320, 24).setStrokeStyle(1, 0xffffff);
        const bar = this.add
            .rectangle(width / 2 - 150, height / 2, 4, 16, 0xffffff)
            .setOrigin(0, 0.5);

        this.add
            .text(width / 2, height / 2 - 40, '加载资源…', {
                ...uiTextStyle(18),
                color: '#cccccc',
            })
            .setOrigin(0.5);

        this.load.on('progress', (progress: number) => {
            bar.width = 4 + 296 * progress;
        });
    }

    preload() {
        // First wave: MainMenu and Choose are fully resident before interaction.
        queuePreloadAtlases(this, PRELOAD_ATLAS_KEYS);
        queueStartupAudio(this);
    }

    create() {
        // Hand-painted frames: LINEAR (smooth) filtering, not NEAREST pixel-art.
        applyLinearFilter(this, PRELOAD_ATLAS_KEYS);
        bindAudio(this);

        this.scene.start('MainMenu');
    }
}
