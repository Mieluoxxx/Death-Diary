import StartGame from './game/main';
import { initializeCloudSave } from './game/session/cloudSave';
import { getSession, setSession } from './game/session/sessionStore';

document.addEventListener('DOMContentLoaded', () => {
    void initializeCloudSave({
        getLocalSession: getSession,
        applyRemoteSession: setSession,
    }).finally(() => {
        StartGame('game-container');
    });
});
