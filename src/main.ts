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

async function initializeApplication(): Promise<void> {
    void loadInitialItems();
    await initializeSessionStore();

    const game = StartGame('game-container');
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
