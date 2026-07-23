import { Scene, Textures } from 'phaser';
import { UI_FONT_FAMILY, UI_TEXT_RESOLUTION } from '../ui/uiFont';

/** Atlas keys used by the current vertical slice (must match multiatlas JSON). */
const ATLAS_KEYS = [
    'menu',
    'ui',
    'icon',
    'medal',
    'npc',
    'home',
    'dig_build',
    'build',
    'gate',
    'map',
    'site',
    'dig_monster',
    'dig_item',
    'dig_work',
    'weather',
] as const;

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
        // Single-frame original art: each PNG is one multi-atlas page.
        // JSON from tools/gen_frame_multiatlas.mjs; PNGs under public/source-art/frames/.
        for (const key of ATLAS_KEYS)
        {
            this.load.multiatlas(
                key,
                `source-art/multiatlas/${key}.json`,
                `source-art/frames/${key}/`,
            );
        }
    }

    create ()
    {
        // Hand-painted frames: LINEAR (smooth) filtering, not NEAREST pixel-art.
        for (const key of ATLAS_KEYS)
        {
            if (this.textures.exists(key))
            {
                this.textures.get(key).setFilter(Textures.LINEAR);
            }
        }

        this.scene.start('MainMenu');
    }
}
