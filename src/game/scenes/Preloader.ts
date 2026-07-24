import { Scene } from 'phaser';
import { PRELOAD_ATLAS_KEYS } from '../assets/frames.gen';
import { applyLinearFilter, queuePreloadAtlases } from '../assets/loadAtlas';
import { UI_FONT_FAMILY, UI_TEXT_RESOLUTION } from '../ui/uiFont';

export class Preloader extends Scene
{
    constructor ()
    {
        super('Preloader');
    }

    init ()
    {
        const { width, height } = this.scale;

        this.add.rectangle(width / 2, height / 2, width, height, 0x000000);

        this.add.rectangle(width / 2, height / 2, 320, 24).setStrokeStyle(1, 0xffffff);
        const bar = this.add.rectangle(width / 2 - 150, height / 2, 4, 16, 0xffffff).setOrigin(0, 0.5);

        this.add
            .text(width / 2, height / 2 - 40, '加载资源…', {
                fontFamily: UI_FONT_FAMILY, resolution: UI_TEXT_RESOLUTION,
                fontSize: '18px',
                color: '#cccccc',
            })
            .setOrigin(0.5);

        this.load.on('progress', (progress: number) =>
        {
            bar.width = 4 + (296 * progress);
        });
    }

    preload ()
    {
        // Policy: atlasManifest preload. JSON from gen_frame_multiatlas.mjs.
        queuePreloadAtlases(this, PRELOAD_ATLAS_KEYS);
    }

    create ()
    {
        // Hand-painted frames: LINEAR (smooth) filtering, not NEAREST pixel-art.
        applyLinearFilter(this, PRELOAD_ATLAS_KEYS);

        this.scene.start('MainMenu');
    }
}
