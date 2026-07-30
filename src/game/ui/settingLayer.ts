import { GameObjects, type Scene } from 'phaser';
import { exportSessionJson, importSessionJson } from '../session/sessionStore';
import {
    getLanguage,
    getMusicOn,
    getSfxOn,
    LAN_SUPPORTS,
    LANG_NAMES,
    type LangCode,
    setLanguage,
    t,
} from '../settings/settingsStore';
import { playClick, setMusicEnabled, setSfxEnabled } from '../systems/audioManager';
import { addAtlasButton } from './atlasButton';
import { UI_FONT_FAMILY, UI_TEXT_RESOLUTION } from './uiFont';

type SelectorKind = 'music' | 'sfx' | 'language' | null;

type MenuHostScene = Scene & {
    refreshLocalizedCopy?: (lan: LangCode) => void;
};

export type SettingLayerOptions = {
    /**
     * Opened from in-game top bar (Home).
     * Shows "返回菜单" and Confirm only dismisses the overlay
     * (matches Buried-City SettingLayer fromGame).
     */
    fromGame?: boolean;
};

function downloadSaveJson(json: string): void {
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    const timestamp = new Date().toISOString().replaceAll(':', '-').replaceAll('.', '-');
    anchor.href = url;
    anchor.download = `death-diary-save-${timestamp}.json`;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
}

function chooseSaveJson(): Promise<string | null> {
    const { promise, resolve, reject } = Promise.withResolvers<string | null>();
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.addEventListener(
        'change',
        () => {
            const file = input.files?.[0];
            input.remove();
            if (!file) {
                resolve(null);
                return;
            }
            file.text().then(resolve, reject);
        },
        { once: true },
    );
    input.addEventListener(
        'cancel',
        () => {
            input.remove();
            resolve(null);
        },
        { once: true },
    );
    input.click();
    return promise;
}

/**
 * Port of Buried-City SettingLayer (menu + in-game).
 *
 * Menu host:
 *  1. Open settings
 *  2. Pick language (pending) + live-preview MainMenu copy
 *  3. Confirm → persist language, rebuild host scene
 *
 * In-game (fromGame):
 *  - Extra "返回菜单" → MainMenu (session kept for Continue)
 *  - Confirm only closes the overlay
 */
export function openSettingLayer(
    scene: Scene,
    opts: SettingLayerOptions = {},
): GameObjects.Container {
    const fromGame = Boolean(opts.fromGame);
    const { width, height } = scene.scale;
    const root = scene.add.container(0, 0);
    root.setDepth(200);
    root.setName('settingLayer');

    const dim = scene.add
        .rectangle(width / 2, height / 2, width, height, 0x000000, 220 / 255)
        .setInteractive();
    root.add(dim);

    let musicOn = getMusicOn();
    let sfxOn = getSfxOn();
    const savedLan = getLanguage();
    let pendingLan: LangCode = savedLan;

    let selector: GameObjects.Container | null = null;
    let selectorKind: SelectorKind = null;

    const labelStyle = {
        fontFamily: UI_FONT_FAMILY,
        resolution: UI_TEXT_RESOLUTION,
        fontSize: '20px',
        color: '#ffffff',
    };
    const py = (cocosY: number) => height - cocosY;

    const musicLabel = scene.add
        .text(width / 2, py(980), t('music', pendingLan), labelStyle)
        .setOrigin(0.5);
    const sfxLabel = scene.add
        .text(width / 2, py(860), t('sfx', pendingLan), labelStyle)
        .setOrigin(0.5);
    const lanLabel = scene.add
        .text(width / 2, py(720), t('language', pendingLan), labelStyle)
        .setOrigin(0.5);
    root.add([musicLabel, sfxLabel, lanLabel]);
    const saveLabel = scene.add
        .text(width / 2, py(570), t('saveData', pendingLan), labelStyle)
        .setOrigin(0.5);
    const saveStatus = scene.add
        .text(width / 2, py(380), '', {
            ...labelStyle,
            fontSize: '18px',
        })
        .setOrigin(0.5);
    root.add([saveLabel, saveStatus]);

    type SettingBtn = GameObjects.Container & { setTitle: (s: string) => void };

    const makeSettingBtn = (
        parent: GameObjects.Container,
        x: number,
        y: number,
        title: string,
        withScroll: boolean,
        onClick: () => void,
    ): SettingBtn => {
        const c = scene.add.container(x, y) as SettingBtn;
        let bg: GameObjects.Image | GameObjects.Rectangle;

        if (scene.textures.exists('ui') && scene.textures.get('ui').has('btn_language_bg.png')) {
            bg = scene.add.image(0, 0, 'ui', 'btn_language_bg.png');
            c.add(bg);
            if (withScroll && scene.textures.get('ui').has('btn_language_scroll.png')) {
                c.add(scene.add.image(bg.width / 2 - 18, 0, 'ui', 'btn_language_scroll.png'));
            }
        } else {
            bg = scene.add.rectangle(0, 0, 272, 60, 0xe8e0d0);
            c.add(bg);
        }

        const label = scene.add
            .text(0, 0, title, {
                fontFamily: UI_FONT_FAMILY,
                resolution: UI_TEXT_RESOLUTION,
                fontSize: '20px',
                color: '#111111',
            })
            .setOrigin(0.5);
        c.add(label);

        const hit = scene.add
            .rectangle(0, 0, 272, 60, 0x000000, 0)
            .setInteractive({ useHandCursor: true });
        c.add(hit);
        hit.on('pointerdown', () => bg.setAlpha(0.5));
        hit.on('pointerout', () => bg.setAlpha(1));
        hit.on('pointerup', () => {
            bg.setAlpha(1);
            onClick();
        });

        c.setTitle = (s: string) => {
            label.setText(s);
        };

        parent.add(c);
        return c;
    };

    const closeSelector = () => {
        if (selector) {
            selector.destroy(true);
            selector = null;
            selectorKind = null;
        }
    };

    const previewHostLanguage = (lan: LangCode) => {
        if (fromGame) {
            return;
        }
        const host = scene as MenuHostScene;
        host.refreshLocalizedCopy?.(lan);
    };

    let confirmLabel: GameObjects.Text;
    let backToMenuLabel: GameObjects.Text | null = null;
    let exportSaveBtn: SettingBtn;
    let importSaveBtn: SettingBtn;

    const refreshSettingCopy = () => {
        musicLabel.setText(t('music', pendingLan));
        sfxLabel.setText(t('sfx', pendingLan));
        lanLabel.setText(t('language', pendingLan));
        musicBtn.setTitle(musicOn ? t('on', pendingLan) : t('off', pendingLan));
        sfxBtn.setTitle(sfxOn ? t('on', pendingLan) : t('off', pendingLan));
        lanBtn.setTitle(LANG_NAMES[pendingLan]);
        confirmLabel.setText(t('confirm', pendingLan));
        backToMenuLabel?.setText(t('backToMenu', pendingLan));
        saveLabel.setText(t('saveData', pendingLan));
        exportSaveBtn.setTitle(t('exportSave', pendingLan));
        importSaveBtn.setTitle(t('importSave', pendingLan));
        previewHostLanguage(pendingLan);
    };

    const showSaveStatus = (key: string, error = false) => {
        saveStatus.setColor(error ? '#ff7777' : '#ffffff');
        saveStatus.setText(t(key, pendingLan));
    };

    const openAudioSelector = (kind: 'music' | 'sfx') => {
        if (selectorKind === kind) {
            closeSelector();
            return;
        }
        closeSelector();
        selectorKind = kind;

        const nowOn = kind === 'music' ? musicOn : sfxOn;
        const anchorY = kind === 'music' ? py(930) : py(810);
        selector = scene.add.container(width / 2, anchorY + 60);
        root.add(selector);

        makeSettingBtn(
            selector,
            0,
            0,
            nowOn ? t('off', pendingLan) : t('on', pendingLan),
            false,
            () => {
                if (kind === 'music') {
                    musicOn = !musicOn;
                    setMusicEnabled(musicOn);
                } else {
                    sfxOn = !sfxOn;
                    setSfxEnabled(sfxOn);
                    if (sfxOn) {
                        playClick();
                    }
                }
                refreshSettingCopy();
                closeSelector();
            },
        );
    };

    const openLanguageSelector = () => {
        if (selectorKind === 'language') {
            closeSelector();
            return;
        }
        closeSelector();
        selectorKind = 'language';

        const others = LAN_SUPPORTS.filter((code) => code !== pendingLan);
        selector = scene.add.container(width / 2, py(670) + 30);
        root.add(selector);

        others.forEach((code, i) => {
            makeSettingBtn(selector!, 0, 30 + i * 62, LANG_NAMES[code], false, () => {
                pendingLan = code;
                refreshSettingCopy();
                closeSelector();
            });
        });
    };

    const musicBtn = makeSettingBtn(
        root,
        width / 2,
        py(930),
        musicOn ? t('on', pendingLan) : t('off', pendingLan),
        true,
        () => openAudioSelector('music'),
    );
    const sfxBtn = makeSettingBtn(
        root,
        width / 2,
        py(810),
        sfxOn ? t('on', pendingLan) : t('off', pendingLan),
        true,
        () => openAudioSelector('sfx'),
    );
    const lanBtn = makeSettingBtn(root, width / 2, py(670), LANG_NAMES[pendingLan], true, () =>
        openLanguageSelector(),
    );

    exportSaveBtn = makeSettingBtn(
        root,
        width / 2,
        py(510),
        t('exportSave', pendingLan),
        false,
        () => {
            const json = exportSessionJson();
            if (!json) {
                showSaveStatus('noSaveToExport', true);
                return;
            }
            downloadSaveJson(json);
            showSaveStatus('exportSaveSuccess');
        },
    );
    importSaveBtn = makeSettingBtn(
        root,
        width / 2,
        py(440),
        t('importSave', pendingLan),
        false,
        () => {
            void chooseSaveJson()
                .then(async (json) => {
                    if (json === null) {
                        return;
                    }
                    if (!window.confirm(t('importSaveConfirm', pendingLan))) {
                        return;
                    }
                    await importSessionJson(json);
                    showSaveStatus('importSaveSuccess');
                    scene.time.delayedCall(500, () => {
                        root.destroy(true);
                        if (fromGame) {
                            scene.scene.start('Home');
                        } else {
                            scene.scene.restart();
                        }
                    });
                })
                .catch(() => showSaveStatus('invalidSaveFile', true));
        },
    );

    // In-game only: 返回菜单 (Cocos y = 320)
    if (fromGame) {
        const homeBtn = addAtlasButton(scene, width / 2, py(320), {
            atlas: 'ui',
            frame: 'btn_big_white_normal.png',
            label: t('backToMenu', pendingLan),
            labelSizeTier: 'COMMON_1',
            onClick: () => {
                closeSelector();
                // Persist pending language if changed, then leave game.
                if (pendingLan !== savedLan) {
                    setLanguage(pendingLan);
                }
                root.destroy(true);
                // Navigation.stopMusic() equivalent before menu BGM.
                scene.scene.start('MainMenu');
            },
        });
        root.add(homeBtn);
        backToMenuLabel = homeBtn.list.find(
            (child) => child instanceof GameObjects.Text,
        ) as GameObjects.Text | null;
    }

    dim.on('pointerup', () => {
        closeSelector();
    });

    const confirm = addAtlasButton(scene, width / 2, py(150), {
        atlas: 'ui',
        frame: 'btn_big_white_normal.png',
        label: t('confirm', pendingLan),
        labelSizeTier: 'COMMON_1',
        onClick: () => {
            closeSelector();
            if (pendingLan !== savedLan) {
                setLanguage(pendingLan);
            }

            if (fromGame) {
                // Stay in game — only dismiss overlay (original closeSettings fromGame).
                // If language changed, rebuild Home so top bar / labels refresh.
                root.destroy(true);
                if (pendingLan !== savedLan) {
                    scene.scene.restart();
                }
                return;
            }

            root.destroy(true);
            scene.scene.restart();
        },
    });
    root.add(confirm);

    confirmLabel = confirm.list.find(
        (child) => child instanceof GameObjects.Text,
    ) as GameObjects.Text;
    if (!confirmLabel) {
        confirmLabel = scene.add
            .text(0, 0, t('confirm', pendingLan), {
                fontFamily: UI_FONT_FAMILY,
                resolution: UI_TEXT_RESOLUTION,
                fontSize: '28px',
                color: '#111',
            })
            .setOrigin(0.5);
        confirm.add(confirmLabel);
    }

    return root;
}
