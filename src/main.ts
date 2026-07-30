import { loadInitialItems } from './game/data/initialItems';
import StartGame from './game/main';
import { initializeCloudSave } from './game/session/cloudSave';
import { getSession, setSession } from './game/session/sessionStore';

document.addEventListener('DOMContentLoaded', () => {
    void Promise.all([
        loadInitialItems(),
        initializeCloudSave({
            getLocalSession: getSession,
            applyRemoteSession: setSession,
        }),
    ]).finally(() => {
        StartGame('game-container');
    });
});
