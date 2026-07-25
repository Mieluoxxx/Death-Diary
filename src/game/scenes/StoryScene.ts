import { Scene } from 'phaser';
import { UI_FONT_FAMILY, UI_TEXT_RESOLUTION, uiWordWrap } from '../ui/uiFont';

/**
 * Port of Buried-City StoryScene.js StoryLayer.
 * dig_start art + poem (1195–1201), click → Home.
 */
const LINES = [
    '被欲望所驱使',
    '它们粗暴地撕咬与吞噬',
    '',
    '虚空临近',
    '它们在最后的盛宴中狂舞',
    '',
    '它们把你逼到绝境',
    '然后发出邀请',
];

export class StoryScene extends Scene {
    private canContinue = false;
    private didContinue = false;

    constructor() {
        super('Story');
    }

    create() {
        this.canContinue = false;
        this.didContinue = false;

        const { width, height } = this.scale;
        this.add.rectangle(width / 2, height / 2, width, height, 0x000000);

        // dig_start: Cocos bottom-left y = height - 322 → Phaser top-left y = 322
        const artY = 322;
        if (this.textures.exists('ui') && this.textures.get('ui').has('dig_start.png')) {
            this.add.image(width / 2, artY, 'ui', 'dig_start.png');
        } else {
            this.add.rectangle(width / 2, artY, Math.min(520, width - 80), 180, 0x1a1a1a);
        }

        // text node: Cocos y = height - 550, anchor top → Phaser top at 550
        const textTop = 550;
        const poem = this.add
            .text(width / 2, textTop, LINES.join('\n'), {
                fontFamily: UI_FONT_FAMILY,
                resolution: UI_TEXT_RESOLUTION,
                fontSize: '20px',
                color: '#ffffff',
                align: 'left',
                lineSpacing: 8,
                wordWrap: uiWordWrap(300),
            })
            .setOrigin(0.5, 0)
            .setAlpha(0);

        const author = this.add
            .text(width / 2 + 80, textTop + poem.height + 12, '——Cissy Liu', {
                fontFamily: UI_FONT_FAMILY,
                resolution: UI_TEXT_RESOLUTION,
                fontSize: '18px',
                color: '#ffffff',
            })
            .setOrigin(1, 0)
            .setAlpha(0);

        const hint = this.add
            .text(width / 2, height - 80, '点击继续', {
                fontFamily: UI_FONT_FAMILY,
                resolution: UI_TEXT_RESOLUTION,
                fontSize: '18px',
                color: '#888888',
            })
            .setOrigin(0.5)
            .setAlpha(0);

        // Full-screen hit target (matches original Button covering winSize).
        // Depth high so it always receives clicks after fade-in.
        const hitArea = this.add
            .rectangle(width / 2, height / 2, width, height, 0x000000, 0)
            .setInteractive({ useHandCursor: true })
            .setDepth(1000);

        hitArea.on('pointerdown', () => {
            this.tryContinue();
        });

        // Also accept keyboard (Enter / Space) after fade.
        if (this.input.keyboard) {
            this.input.keyboard.once('keydown-ENTER', () => this.tryContinue());
            this.input.keyboard.once('keydown-SPACE', () => this.tryContinue());
        }

        // fade-in then enable click (parity with StoryLayer)
        this.tweens.add({
            targets: [poem, author, hint],
            alpha: 1,
            duration: 1000,
            onComplete: () => {
                this.canContinue = true;
            },
        });
    }

    private tryContinue(): void {
        if (!this.canContinue || this.didContinue) {
            return;
        }
        this.didContinue = true;
        // Session was created in ChooseScene; Home requires it.
        this.scene.start('Home');
    }
}
