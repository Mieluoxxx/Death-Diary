import { loadInitialItems } from './game/data/initialItems';
import StartGame from './game/main';
import { getCurrentAccount, initializeAccount } from './game/session/authStore';
import { initializeCloudSave } from './game/session/cloudSave';
import {
    activateSessionProfile,
    getSession,
    initializeSessionStore,
    setSession,
} from './game/session/sessionStore';
import { scheduleTextRedrawOnFontReady } from './game/ui/uiFont';

async function initializeApplication(): Promise<void> {
    void loadInitialItems();
    await initializeSessionStore();

    const game = StartGame('game-container');
    // E2E/debug hook: game instance for tests to inspect scenes (e.g. font checks).
    (window as unknown as { __deathDiaryGame?: unknown }).__deathDiaryGame = game;
    // Redraw every Text object once the bundled CJK face finishes loading,
    // so early-created text (which baked the fallback glyphs) converges to it.
    scheduleTextRedrawOnFontReady(game);
    const cachedAccount = getCurrentAccount();
    const couldContinue = getSession() !== null;
    void initializeAccount()
        .then(async () => {
            const account = getCurrentAccount();
            if (!account && cachedAccount) {
                await activateSessionProfile('local', getSession());
            } else if (account && cachedAccount?.userId !== account.userId) {
                await activateSessionProfile(`user:${account.userId}`, getSession());
            }
            if (account) {
                await initializeCloudSave({
                    getLocalSession: getSession,
                    applyRemoteSession: setSession,
                });
            }
            if (game.scene.isActive('MainMenu') && couldContinue !== (getSession() !== null)) {
                game.scene.getScene('MainMenu').scene.restart();
            }
        })
        .catch((error: unknown) => {
            console.warn('Unable to initialize account cloud save.', error);
        });
}

document.addEventListener('DOMContentLoaded', () => {
    void initializeApplication();
});
