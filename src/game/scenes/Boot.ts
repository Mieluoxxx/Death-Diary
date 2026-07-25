import { Scene } from 'phaser';
import { ensureUiFontLoaded } from '../ui/uiFont';

export class Boot extends Scene {
    constructor() {
        super('Boot');
    }

    preload() {
        // Minimal boot — menu assets load in Preloader
    }

    create() {
        // Must load FZDaHei (public/fonts/fzdh.ttf) before any Phaser Text,
        // or CJK becomes tofu on Linux/WSL without system Chinese fonts.
        void ensureUiFontLoaded().finally(() => {
            this.scene.start('Preloader');
        });
    }
}
