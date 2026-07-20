import { Scene, Textures } from 'phaser';
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
        this.load.atlas('menu', 'atlases/menu.png', 'atlases/menu.json');
        this.load.atlas('ui', 'atlases/ui.png', 'atlases/ui.json');
        this.load.atlas('icon', 'atlases/icon.png', 'atlases/icon.json');
        this.load.atlas('medal', 'atlases/medal.png', 'atlases/medal.json');
        this.load.atlas('npc', 'atlases/npc.png', 'atlases/npc.json');
        this.load.atlas('home', 'atlases/home.png', 'atlases/home.json');
    }

    create ()
    {
        // Hand-painted atlases: LINEAR (smooth) filtering, not NEAREST pixel-art.
        const atlasKeys = ['menu', 'ui', 'icon', 'medal', 'npc', 'home'];
        for (const key of atlasKeys)
        {
            if (this.textures.exists(key))
            {
                this.textures.get(key).setFilter(Textures.LINEAR);
            }
        }

        this.scene.start('MainMenu');
    }
}
