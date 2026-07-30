import { loadInitialItems } from './game/data/initialItems';
import StartGame from './game/main';
import { initializeCloudSave } from './game/session/cloudSave';
import { getSession, initializeSessionStore, setSession } from './game/session/sessionStore';

document.addEventListener('DOMContentLoaded', () => {
    void loadInitialItems();

    void initializeSessionStore().then(() => {
        const game = StartGame('game-container');
        void initializeCloudSave({
            getLocalSession: getSession,
            applyRemoteSession: setSession,
        }).finally(() => {
            // A remote-only save can enable Continue after MainMenu has rendered.
            if (game.scene.isActive('MainMenu')) {
                game.scene.getScene('MainMenu').scene.restart();
            }
        });
    });
});
