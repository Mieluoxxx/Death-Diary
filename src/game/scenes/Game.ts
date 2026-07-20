import { Scene } from 'phaser';
import { UI_FONT_FAMILY, UI_TEXT_RESOLUTION } from '../ui/uiFont';

export class Game extends Scene
{
    constructor ()
    {
        super('Game');
    }

    create ()
    {
        const { width, height } = this.scale;
        this.cameras.main.setBackgroundColor(0x1a1a1a);

        const role = (this.registry.get('chosenRole') as string | undefined) ?? 'STRANGER';
        const talent = this.registry.get('chosenTalent');
        const talentLabel = talent === undefined || talent === null ? '—' : String(talent);

        this.add
            .text(width / 2, height / 2, `局内场景（占位）\n角色: ${role}\n天赋: ${talentLabel}\n\n点击返回主菜单`, {
                fontFamily: UI_FONT_FAMILY, resolution: UI_TEXT_RESOLUTION,
                fontSize: '24px',
                color: '#ffffff',
                align: 'center',
            })
            .setOrigin(0.5);

        this.input.once('pointerdown', () =>
        {
            this.scene.start('MainMenu');
        });
    }
}
