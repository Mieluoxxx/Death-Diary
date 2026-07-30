import { Scene } from 'phaser';
import { HOME_ATLAS_KEYS } from '../assets/atlasManifest';
import { applyLinearFilter, queuePreloadAtlases } from '../assets/loadAtlas';
import { queueGameAudio } from '../systems/audioManager';
import { UI_FONT_FAMILY, UI_TEXT_RESOLUTION, uiWordWrap } from '../ui/uiFont';

/**
 * Port of Buried-City StoryScene.js StoryLayer.
 * dig_start art + poem (1195–1201); stays visible until Home assets are ready.
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
    private introReady = false;
    private homeReady = false;
    private didContinue = false;
    private retryEnabled = false;
    private loadingLabel: Phaser.GameObjects.Text | null = null;

    constructor() {
        super('Story');
    }

    create() {
        this.introReady = false;
        this.homeReady = false;
        this.didContinue = false;
        this.retryEnabled = false;

        const { width, height } = this.scale;
        this.add.rectangle(width / 2, height / 2, width, height, 0x000000);

        // dig_start: Cocos bottom-left y = height - 322 → Phaser top-left y = 322
        const artY = 322;
        if (this.textures.exists('ui') && this.textures.get('ui').has('dig_start.png')) {
            this.add.image(width / 2, artY, 'ui', 'dig_start.png');
        } else {
            this.add.rectangle(width / 2, artY, Math.min(520, width - 80), 180, 0x1a1a1a);
        }

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

        this.loadingLabel = this.add
            .text(width / 2, height - 80, '正在加载避难所…', {
                fontFamily: UI_FONT_FAMILY,
                resolution: UI_TEXT_RESOLUTION,
                fontSize: '18px',
                color: '#888888',
            })
            .setOrigin(0.5)
            .setAlpha(0);

        if (!this.anims.exists('story-home-loading')) {
            this.anims.create({
                key: 'story-home-loading',
                frames: [1, 2, 3, 4].map((index) => ({
                    key: 'ui',
                    frame: `loading_anim_${index}.png`,
                })),
                frameRate: 8,
                repeat: -1,
            });
        }
        const spinner = this.add
            .sprite(width / 2, height - 135, 'ui', 'loading_anim_1.png')
            .setScale(0.55)
            .setAlpha(0)
            .play('story-home-loading');

        this.add
            .rectangle(width / 2, height / 2, width, height, 0x000000, 0)
            .setInteractive({ useHandCursor: true })
            .setDepth(1000)
            .on('pointerdown', () => {
                if (this.retryEnabled) {
                    this.startHomeLoad();
                }
            });

        this.tweens.add({
            targets: [poem, author, this.loadingLabel, spinner],
            alpha: 1,
            duration: 1000,
            onComplete: () => {
                this.introReady = true;
                this.tryContinue();
            },
        });

        this.startHomeLoad();
    }

    private startHomeLoad(): void {
        this.retryEnabled = false;
        this.loadingLabel?.setText('正在加载避难所…');

        let failed = false;
        const onError = () => {
            failed = true;
        };
        const cleanup = () => {
            this.load.off('loaderror', onError);
            this.load.off('complete', onComplete);
        };
        const finish = () => {
            cleanup();
            const atlasesReady = HOME_ATLAS_KEYS.every((key) => this.textures.exists(key));
            if (failed || !atlasesReady) {
                this.loadingLabel?.setText('资源加载失败，点击重试');
                this.retryEnabled = true;
                return;
            }
            applyLinearFilter(this, HOME_ATLAS_KEYS);
            this.homeReady = true;
            this.tryContinue();
        };
        const onComplete = () => {
            finish();
        };

        this.load.on('loaderror', onError);
        this.load.once('complete', onComplete);
        const queued = queuePreloadAtlases(this, HOME_ATLAS_KEYS) + queueGameAudio(this);
        if (queued === 0) {
            finish();
            return;
        }
        this.load.start();
    }

    private tryContinue(): void {
        if (!this.introReady || !this.homeReady || this.didContinue) {
            return;
        }
        this.didContinue = true;
        this.scene.start('Home');
    }
}
