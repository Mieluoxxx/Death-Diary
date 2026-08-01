import { type GameObjects, Scene } from 'phaser';
import { loadInitialItems } from '../data/initialItems';
import { getCurrentAccount } from '../session/authStore';
import { hasSession } from '../session/sessionStore';
import { getCloudSaveStatus, syncCloudSaveCheckpoint } from '../session/cloudSave';
import { getLanguage, type LangCode, t } from '../settings/settingsStore';
import { applyMainPageMusic, stopMusic } from '../systems/audioManager';
import { type AtlasButton, addAtlasButton } from '../ui/atlasButton';
import { openAccountLayer } from '../ui/accountLayer';
import { openSettingLayer } from '../ui/settingLayer';
import { UI_FONT_FAMILY, UI_TEXT_RESOLUTION } from '../ui/uiFont';

/**
 * Port of Buried-City MenuScene.js MenuLayer layout.
 * Design coords: 640×1136 FIXED_HEIGHT.
 */
export class MainMenu extends Scene {
    private logoImage: GameObjects.Image | null = null;
    private newGameBtn: AtlasButton | GameObjects.Text | null = null;
    private continueBtn: AtlasButton | GameObjects.Text | null = null;
    private rankingBtn: AtlasButton | GameObjects.Text | null = null;
    private versionText: GameObjects.Text | null = null;
    private cloudStatusText: GameObjects.Text | null = null;
    private transitionPending = false;

    constructor() {
        super('MainMenu');
    }

    create() {
        this.logoImage = null;
        this.newGameBtn = null;
        this.continueBtn = null;
        this.rankingBtn = null;
        this.versionText = null;
        this.cloudStatusText = null;
        this.transitionPending = false;

        const { width, height } = this.scale;
        const bgCenterX = width / 2;
        const bgCenterY = height / 2;
        const lan = getLanguage();
        const logoFrame = this.logoFrameForLanguage(lan);

        if (this.textures.exists('menu') && this.textures.get('menu').has('menu_bg.png')) {
            this.add.image(bgCenterX, bgCenterY, 'menu', 'menu_bg.png');
        } else {
            this.add.rectangle(bgCenterX, bgCenterY, width, height, 0x1a1a1a);
        }

        // logo.y = 938 in Cocos bottom-left local coords → Phaser top-left
        const logoY = height - 938;
        if (this.textures.exists('menu') && this.textures.get('menu').has(logoFrame)) {
            this.logoImage = this.add.image(bgCenterX, logoY, 'menu', logoFrame);
        } else if (
            this.textures.exists('menu') &&
            this.textures.get('menu').has('top_logo_zh.png')
        ) {
            this.logoImage = this.add.image(bgCenterX, logoY, 'menu', 'top_logo_zh.png');
        } else {
            this.add
                .text(bgCenterX, 160, '死亡日记', {
                    fontFamily: UI_FONT_FAMILY,
                    resolution: UI_TEXT_RESOLUTION,
                    fontSize: '42px',
                    color: '#f0e6d2',
                })
                .setOrigin(0.5);
        }

        const canContinue = hasSession();

        // MenuLayer: btn1 y = bg.height/2 - 126, etc. (Cocos y-up from bg center)
        const btn1Y = bgCenterY + 126;
        const btn2Y = bgCenterY + 236;
        const btn3Y = bgCenterY + 346;

        this.newGameBtn = this.placeBigWhite(bgCenterX, btn1Y, t('newGame', lan), true, () => {
            this.startNewGame();
        });
        this.continueBtn = this.placeBigWhite(
            bgCenterX,
            btn2Y,
            t('continue', lan),
            canContinue,
            () => {
                this.continueGame();
            },
        );
        this.rankingBtn = this.placeBigWhite(bgCenterX, btn3Y, t('ranking', lan), true, () => {
            // Rank scene deferred — label parity only
        });

        // setting top-right: bg.width - 106 + 15, bg.height - 106 + 15
        if (this.textures.exists('ui') && this.textures.get('ui').has('btn_game_setting.png')) {
            const settingsBtn = this.add
                .image(width - 91, 91, 'ui', 'btn_game_setting.png')
                .setInteractive({ useHandCursor: true });
            settingsBtn.on('pointerdown', () => {
                settingsBtn.setAlpha(0.7);
            });
            settingsBtn.on('pointerup', () => {
                settingsBtn.setAlpha(1);
                openSettingLayer(this);
            });
            settingsBtn.on('pointerout', () => settingsBtn.setAlpha(1));
        }

        const cloudStatusBg = this.add
            .rectangle(132, 74, 224, 48, 0x111111, 0.82)
            .setStrokeStyle(1, 0xd8cdb9)
            .setInteractive({ useHandCursor: true });
        this.cloudStatusText = this.add
            .text(132, 74, '', {
                fontFamily: UI_FONT_FAMILY,
                resolution: UI_TEXT_RESOLUTION,
                fontSize: '17px',
                color: '#f0e6d2',
            })
            .setOrigin(0.5);
        cloudStatusBg.on('pointerup', () => {
            openAccountLayer(this, () => this.scene.restart());
        });
        const refreshCloudStatus = () => this.refreshCloudStatus();
        window.addEventListener('account-status-changed', refreshCloudStatus);
        window.addEventListener('cloud-save-status', refreshCloudStatus);
        window.addEventListener('session-profile-changed', refreshCloudStatus);
        this.events.once('shutdown', () => {
            window.removeEventListener('account-status-changed', refreshCloudStatus);
            window.removeEventListener('cloud-save-status', refreshCloudStatus);
            window.removeEventListener('session-profile-changed', refreshCloudStatus);
        });
        void syncCloudSaveCheckpoint();
        this.refreshCloudStatus(lan);

        // bottom row: rate / cart / medal / contact
        const bottomY = height - 106;
        this.placeIconBtn(106, bottomY, 'btn_rate.png');
        this.placeIconBtn(bgCenterX - 72, bottomY, 'btn_cart.png', () => {
            this.scene.start('Shop');
        });
        this.placeIconBtn(bgCenterX + 72, bottomY, 'icon_medal.png', () => {
            this.scene.start('Medal');
        });
        this.placeIconBtn(width - 106, bottomY, 'btn_contact.png');

        this.versionText = this.add
            .text(16, height - 20, `${t('version', lan)} 1.4.0`, {
                fontFamily: UI_FONT_FAMILY,
                resolution: UI_TEXT_RESOLUTION,
                fontSize: '20px',
                color: '#888',
            })
            .setOrigin(0, 1);

        applyMainPageMusic();
    }

    /**
     * Live-preview menu copy while settings language is pending (before Confirm).
     * Confirm still persists + restarts for a clean global apply.
     */
    refreshLocalizedCopy(lan: LangCode = getLanguage()): void {
        this.setMenuButtonLabel(this.newGameBtn, t('newGame', lan));
        this.setMenuButtonLabel(this.continueBtn, t('continue', lan));
        this.setMenuButtonLabel(this.rankingBtn, t('ranking', lan));

        if (this.versionText) {
            this.versionText.setText(`${t('version', lan)} 1.4.0`);
        }
        this.refreshCloudStatus(lan);

        if (this.logoImage && this.textures.exists('menu')) {
            const logoFrame = this.logoFrameForLanguage(lan);
            if (this.textures.get('menu').has(logoFrame)) {
                this.logoImage.setFrame(logoFrame);
            }
        }
    }

    private startNewGame(): void {
        if (this.transitionPending) {
            return;
        }
        this.transitionPending = true;
        void loadInitialItems();
        stopMusic();
        this.scene.start('Choose');
    }

    private continueGame(): void {
        if (this.transitionPending) {
            return;
        }
        this.transitionPending = true;
        stopMusic();
        this.scene.start('Home');
    }

    private refreshCloudStatus(lan: LangCode = getLanguage()): void {
        if (!this.cloudStatusText) {
            return;
        }
        if (!getCurrentAccount()) {
            this.cloudStatusText.setText(t(hasSession() ? 'deviceOnlySave' : 'protectSave', lan));
            this.cloudStatusText.setColor('#d8b878');
            return;
        }
        const state = getCloudSaveStatus().state;
        if (state === 'pending' || state === 'syncing') {
            this.cloudStatusText.setText(t('cloudPending', lan));
            this.cloudStatusText.setColor('#d8b878');
            return;
        }
        if (state === 'offline') {
            this.cloudStatusText.setText(t('cloudOffline', lan));
            this.cloudStatusText.setColor('#d8b878');
            return;
        }
        if (state === 'conflict') {
            this.cloudStatusText.setText(t('cloudConflict', lan));
            this.cloudStatusText.setColor('#ff8888');
            return;
        }
        this.cloudStatusText.setText(t('cloudSynced', lan));
        this.cloudStatusText.setColor('#a8e6a3');
    }

    private logoFrameForLanguage(lan: LangCode): string {
        return lan === 'zh' || lan === 'zh-Hant' ? 'top_logo_zh.png' : 'top_logo_en.png';
    }

    private setMenuButtonLabel(button: AtlasButton | GameObjects.Text | null, label: string): void {
        if (!button) {
            return;
        }

        if ('setLabel' in button) {
            button.setLabel(label);
            return;
        }

        button.setText(label);
    }

    private placeBigWhite(
        x: number,
        y: number,
        label: string,
        enabled: boolean,
        onClick: () => void,
    ): AtlasButton | GameObjects.Text {
        const has =
            this.textures.exists('ui') && this.textures.get('ui').has('btn_big_white_normal.png');

        if (has) {
            return addAtlasButton(this, x, y, {
                atlas: 'ui',
                frame: 'btn_big_white_normal.png',
                label,
                // createBigBtnWhite: COMMON_1 then createSpriteBtn -= 4 → 28px
                labelSizeTier: 'COMMON_1',
                enabled,
                onClick: enabled ? onClick : undefined,
            });
        }

        const bg = this.add
            .rectangle(x, y, 320, 64, enabled ? 0xe8e0d0 : 0x555)
            .setInteractive({ useHandCursor: enabled });
        const text = this.add
            .text(x, y, label, {
                fontFamily: UI_FONT_FAMILY,
                resolution: UI_TEXT_RESOLUTION,
                fontSize: '28px',
                color: enabled ? '#111' : '#666',
            })
            .setOrigin(0.5);
        if (enabled) {
            bg.on('pointerdown', onClick);
        }

        return text;
    }

    private placeIconBtn(x: number, y: number, frame: string, onClick?: () => void): void {
        if (!(this.textures.exists('ui') && this.textures.get('ui').has(frame))) {
            return;
        }

        const icon = this.add.image(x, y, 'ui', frame);
        if (!onClick) {
            return;
        }

        icon.setInteractive({ useHandCursor: true });
        icon.on('pointerdown', () => {
            icon.setAlpha(0.7);
        });
        icon.on('pointerup', () => {
            icon.setAlpha(1);
            onClick();
        });
        icon.on('pointerout', () => icon.setAlpha(1));
    }
}
