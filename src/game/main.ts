import { AUTO, Game, Scale } from 'phaser';
import { Boot } from './scenes/Boot';
import { ChooseScene } from './scenes/ChooseScene';
import { DeathScene } from './scenes/DeathScene';
import { EndScene } from './scenes/EndScene';
import { Game as MainGame } from './scenes/Game';
import { HomeScene } from './scenes/HomeScene';
import { MainMenu } from './scenes/MainMenu';
import { MedalScene } from './scenes/MedalScene';
import { ShopScene } from './scenes/ShopScene';
import { Preloader } from './scenes/Preloader';
import { StoryScene } from './scenes/StoryScene';

/**
 * Buried-City design: 640×1136 FIXED_HEIGHT / FIT.
 *
 * Original web Cocos uses Canvas + retina buffer (CSS size × devicePixelRatio),
 * so art stays soft and dense on HiDPI screens. Phaser previously forced
 * antialias:false (NEAREST) which made the same assets look harsh / rough when
 * FIT-scaled. Match original polish: linear filtering + crisp text resolution.
 */
const config: Phaser.Types.Core.GameConfig = {
    type: AUTO,
    width: 640,
    height: 1136,
    parent: 'game-container',
    backgroundColor: '#000000',
    scale: {
        mode: Scale.FIT,
        autoCenter: Scale.CENTER_BOTH,
    },
    render: {
        // LINEAR texture filter — hand-painted HD atlases, not pixel art.
        antialias: true,
        antialiasGL: true,
        // Sub-pixel placement keeps scaled sprites from looking stair-stepped.
        roundPixels: false,
        powerPreference: 'high-performance',
    },
    scene: [
        Boot,
        Preloader,
        MainMenu,
        MedalScene,
        ShopScene,
        ChooseScene,
        StoryScene,
        HomeScene,
        DeathScene,
        EndScene,
        MainGame,
    ],
};

const StartGame = (parent: string) =>
{
    return new Game({ ...config, parent });
};

export default StartGame;
