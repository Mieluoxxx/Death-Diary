import { Scene } from 'phaser';
import { ensureUiFontLoaded } from '../ui/uiFont';

export class Boot extends Scene
{
    constructor ()
    {
        super('Boot');
    }

    preload ()
    {
        // Minimal boot — menu assets load in Preloader
    }

    create ()
    {
        // Warm system CJK UI face (web original uses empty LabelTTF family).
        void ensureUiFontLoaded().finally(() =>
        {
            this.scene.start('Preloader');
        });
    }
}
