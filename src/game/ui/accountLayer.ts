import type { GameObjects, Scene } from 'phaser';
import {
    activateAccount,
    cancelAccountAuthentication,
    getCurrentAccount,
    loginAccount,
    logoutAccount,
    registerAccount,
    type AccountUser,
} from '../session/authStore';
import {
    adoptCloudSaveForAccount,
    commitLocalSaveToAccount,
    disconnectCloudSave,
    getCloudSaveStatus,
    getPendingCloudConflict,
    inspectCloudSave,
    resolveCloudConflictWithLocal,
    resolveCloudConflictWithRemote,
    restartCloudSave,
    type CloudSaveSnapshot,
} from '../session/cloudSave';
import {
    activateSessionProfile,
    deleteSessionProfile,
    flushSessionSave,
    getSession,
    readSessionFromProfile,
    setSession,
    type SessionState,
} from '../session/sessionStore';
import { getLanguage, type LangCode, t } from '../settings/settingsStore';
import { UI_FONT_FAMILY } from './uiFont';

type AccountCopy = {
    protectTitle: string;
    protectBody: string;
    registerAndProtect: string;
    existingAccount: string;
    later: string;
    loginTitle: string;
    registerTitle: string;
    username: string;
    password: string;
    confirmPassword: string;
    login: string;
    register: string;
    back: string;
    accountTitle: string;
    cloudSave: string;
    accountEmptyTitle: string;
    accountEmptyBody: string;
    saveToAccount: string;
    chooseTitle: string;
    chooseBody: string;
    deviceSave: string;
    cloudCopy: string;
    useDevice: string;
    useCloud: string;
    cancelDecision: string;
    logout: string;
    logoutTitle: string;
    logoutBody: string;
    logoutKeep: string;
    logoutRemove: string;
    close: string;
    passwordMismatch: string;
    noSave: string;
    syncing: string;
    synced: string;
    offline: string;
    needsDecision: string;
    formatDay: (day: number) => string;
};

const COPY: Record<LangCode, AccountCopy> = {
    zh: {
        protectTitle: '存档入口',
        protectBody:
            '游戏会一直保存在当前设备。登录账号后，还会自动备份到云端，清除浏览器数据或更换设备后也能恢复。',
        registerAndProtect: '注册并备份存档',
        existingAccount: '已有账号，登录',
        later: '暂时不用',
        loginTitle: '登录账号',
        registerTitle: '注册并保护存档',
        username: '用户名',
        password: '密码（至少 8 个字符）',
        confirmPassword: '再次输入密码',
        login: '登录',
        register: '注册',
        back: '返回',
        accountTitle: '账号与云存档',
        cloudSave: '云存档',
        accountEmptyTitle: '这个账号还没有云存档',
        accountEmptyBody: '是否将当前进度保存到这个账号？以后将自动同步。',
        saveToAccount: '保存到这个账号',
        chooseTitle: '选择要继续使用的存档',
        chooseBody: '两个存档内容不同。选择前，两份存档都会被保留。',
        deviceSave: '当前设备',
        cloudCopy: '云端',
        useDevice: '使用本机并更新云端',
        useCloud: '使用云端并覆盖本机',
        cancelDecision: '暂不决定',
        logout: '退出账号',
        logoutTitle: '退出账号？',
        logoutBody: '云端存档不会被删除。请选择是否在这个设备上保留当前进度。',
        logoutKeep: '退出并保留本机存档',
        logoutRemove: '退出并清除此账号的本机存档',
        close: '关闭',
        passwordMismatch: '两次输入的密码不一致。',
        noSave: '暂无游戏存档',
        syncing: '正在同步…',
        synced: '已同步',
        offline: '离线，本机已保存',
        needsDecision: '需要选择存档',
        formatDay: (day) => `第 ${day} 天`,
    },
    'zh-Hant': {
        protectTitle: '存檔入口',
        protectBody:
            '遊戲會一直儲存在目前裝置。登入帳號後，也會自動備份到雲端，清除瀏覽器資料或更換裝置後仍可恢復。',
        registerAndProtect: '註冊並備份存檔',
        existingAccount: '已有帳號，登入',
        later: '暫時不用',
        loginTitle: '登入帳號',
        registerTitle: '註冊並保護存檔',
        username: '使用者名稱',
        password: '密碼（至少 8 個字元）',
        confirmPassword: '再次輸入密碼',
        login: '登入',
        register: '註冊',
        back: '返回',
        accountTitle: '帳號與雲端存檔',
        cloudSave: '雲端存檔',
        accountEmptyTitle: '這個帳號還沒有雲端存檔',
        accountEmptyBody: '是否將目前進度儲存到這個帳號？之後會自動同步。',
        saveToAccount: '儲存到這個帳號',
        chooseTitle: '選擇要繼續使用的存檔',
        chooseBody: '兩個存檔內容不同。選擇前，兩份存檔都會保留。',
        deviceSave: '目前裝置',
        cloudCopy: '雲端',
        useDevice: '使用本機並更新雲端',
        useCloud: '使用雲端並覆蓋本機',
        cancelDecision: '暫不決定',
        logout: '登出帳號',
        logoutTitle: '登出帳號？',
        logoutBody: '雲端存檔不會被刪除。請選擇是否在此裝置保留目前進度。',
        logoutKeep: '登出並保留本機存檔',
        logoutRemove: '登出並清除此帳號的本機存檔',
        close: '關閉',
        passwordMismatch: '兩次輸入的密碼不一致。',
        noSave: '暫無遊戲存檔',
        syncing: '正在同步…',
        synced: '已同步',
        offline: '離線，本機已儲存',
        needsDecision: '需要選擇存檔',
        formatDay: (day) => `第 ${day} 天`,
    },
    ja: {
        protectTitle: 'セーブ入り口',
        protectBody:
            'ゲームは常にこの端末に保存されます。ログインするとクラウドにも自動バックアップされ、別の端末でも復元できます。',
        registerAndProtect: '登録してバックアップ',
        existingAccount: 'アカウントでログイン',
        later: '後で',
        loginTitle: 'ログイン',
        registerTitle: '登録してセーブを保護',
        username: 'ユーザー名',
        password: 'パスワード（8文字以上）',
        confirmPassword: 'パスワードを再入力',
        login: 'ログイン',
        register: '登録',
        back: '戻る',
        accountTitle: 'アカウントとクラウドセーブ',
        cloudSave: 'クラウドセーブ',
        accountEmptyTitle: 'クラウドセーブがありません',
        accountEmptyBody: '現在の進行をこのアカウントに保存しますか？以後は自動同期されます。',
        saveToAccount: 'このアカウントに保存',
        chooseTitle: '使用するセーブを選択',
        chooseBody: '2つのセーブ内容が異なります。選択するまで両方とも保持されます。',
        deviceSave: 'この端末',
        cloudCopy: 'クラウド',
        useDevice: '端末版でクラウドを更新',
        useCloud: 'クラウド版で端末を上書き',
        cancelDecision: '後で決める',
        logout: 'ログアウト',
        logoutTitle: 'ログアウトしますか？',
        logoutBody:
            'クラウドセーブは削除されません。この端末に現在の進行を残すか選択してください。',
        logoutKeep: '端末に残してログアウト',
        logoutRemove: '端末のアカウントセーブを消去',
        close: '閉じる',
        passwordMismatch: 'パスワードが一致しません。',
        noSave: 'セーブはありません',
        syncing: '同期中…',
        synced: '同期済み',
        offline: 'オフライン・端末に保存済み',
        needsDecision: 'セーブを選択してください',
        formatDay: (day) => `${day}日目`,
    },
    en: {
        protectTitle: 'Save Entry',
        protectBody:
            'Your game is always saved on this device. Sign in to back it up automatically and restore it after clearing browser data or changing devices.',
        registerAndProtect: 'Register and back up',
        existingAccount: 'I already have an account',
        later: 'Not now',
        loginTitle: 'Log in',
        registerTitle: 'Register and protect save',
        username: 'Username',
        password: 'Password (8+ characters)',
        confirmPassword: 'Confirm password',
        login: 'Log in',
        register: 'Register',
        back: 'Back',
        accountTitle: 'Account & Cloud Save',
        cloudSave: 'Cloud save',
        accountEmptyTitle: 'This account has no cloud save',
        accountEmptyBody:
            'Save the current progress to this account? Future changes will sync automatically.',
        saveToAccount: 'Save to this account',
        chooseTitle: 'Choose which save to continue',
        chooseBody: 'These saves are different. Both remain backed up until you choose.',
        deviceSave: 'This device',
        cloudCopy: 'Cloud',
        useDevice: 'Use device and update cloud',
        useCloud: 'Use cloud and replace device',
        cancelDecision: 'Decide later',
        logout: 'Log out',
        logoutTitle: 'Log out?',
        logoutBody:
            'The cloud save will not be deleted. Choose whether to keep the current progress on this device.',
        logoutKeep: 'Log out and keep device save',
        logoutRemove: 'Log out and remove account save',
        close: 'Close',
        passwordMismatch: 'The passwords do not match.',
        noSave: 'No game save yet',
        syncing: 'Syncing…',
        synced: 'Synced',
        offline: 'Offline, saved on device',
        needsDecision: 'Choose a save',
        formatDay: (day) => `Day ${day}`,
    },
};

const BUTTON_STYLE = 'width:100%;padding:12px;margin:5px 0;font-size:18px;font-family:inherit';
const SECONDARY_STYLE = `${BUTTON_STYLE};background:#343434;color:#f4eee4;border:1px solid #777`;

export function openAccountLayer(scene: Scene, onChanged?: () => void): GameObjects.Container {
    const copy = COPY[getLanguage()];
    const { width, height } = scene.scale;
    const root = scene.add.container(0, 0).setDepth(300).setName('accountLayer');
    const dim = scene.add
        .rectangle(width / 2, height / 2, width, height, 0x000000, 0.9)
        .setInteractive();
    root.add(dim);

    const host = document.createElement('div');
    host.style.cssText = `width:min(540px,calc(100vw - 36px));max-height:min(880px,calc(100vh - 36px));overflow:auto;box-sizing:border-box;padding:26px;background:#171717;border:2px solid #d9cfbd;color:#f4eee4;font:18px ${UI_FONT_FAMILY};text-align:center;box-shadow:0 8px 32px #000`;
    const dom = scene.add.dom(width / 2, height / 2, host).setDepth(301);
    const controller = new AbortController();
    let username = '';
    let password = '';
    let confirmedPassword = '';
    let authMode: 'login' | 'register' | null = null;
    let pendingAccount: AccountUser | null = null;
    let pendingLocal: SessionState | null = null;
    let pendingRemote: CloudSaveSnapshot | null = null;
    let busy = false;
    let closed = false;

    const setBusy = (next: boolean) => {
        busy = next;
        host.querySelectorAll<HTMLButtonElement>('button').forEach((button) => {
            button.disabled = next;
        });
    };
    const showError = (error: unknown) => {
        const status = host.querySelector<HTMLElement>('[data-status]');
        if (status) {
            status.style.color = '#ff8a8a';
            status.textContent = error instanceof Error ? error.message : String(error);
        }
    };
    const close = () => {
        if (closed) {
            return;
        }
        closed = true;
        controller.abort();
        dom.destroy();
        root.destroy(true);
    };
    const button = (action: string, label: string, secondary = false) =>
        `<button type="button" data-action="${action}" style="${secondary ? SECONDARY_STYLE : BUTTON_STYLE}">${label}</button>`;
    const title = (text: string) => `<div style="font-size:27px;margin-bottom:14px">${text}</div>`;
    const saveSummary = (session: SessionState | null, updatedAt?: number) => {
        if (!session) {
            return `<div style="color:#aaa">${copy.noSave}</div>`;
        }
        const role = t(`role_${session.role.toLowerCase()}_name`);
        const updated = updatedAt
            ? `<div style="font-size:14px;color:#aaa;margin-top:5px">${new Date(updatedAt).toLocaleString()}</div>`
            : '';
        return `<div style="font-size:22px">${copy.formatDay(session.day)} · ${role}</div>${updated}`;
    };
    const renderIntro = () => {
        authMode = null;
        host.innerHTML = `${title(copy.protectTitle)}<div style="line-height:1.55;color:#d9cfbd;margin-bottom:18px">${copy.protectBody}</div>${button('show-register', copy.registerAndProtect)}${button('show-login', copy.existingAccount, true)}${button('close', copy.later, true)}<div data-status style="min-height:20px;margin-top:8px"></div>`;
    };
    const renderAuth = (mode: 'login' | 'register') => {
        authMode = mode;
        username = '';
        password = '';
        confirmedPassword = '';
        host.innerHTML = `${title(mode === 'login' ? copy.loginTitle : copy.registerTitle)}
            <input data-field="username" type="text" autocomplete="username" inputmode="text" enterkeyhint="next" maxlength="24" placeholder="${copy.username}" style="width:100%;box-sizing:border-box;padding:12px;margin:6px 0;font-family:inherit;font-size:18px" />
            <input data-field="password" type="password" autocomplete="${mode === 'login' ? 'current-password' : 'new-password'}" inputmode="text" enterkeyhint="${mode === 'login' ? 'done' : 'next'}" maxlength="128" placeholder="${copy.password}" style="width:100%;box-sizing:border-box;padding:12px;margin:6px 0;font-family:inherit;font-size:18px" />
            ${mode === 'register' ? `<input data-field="confirm" type="password" autocomplete="new-password" inputmode="text" enterkeyhint="done" maxlength="128" placeholder="${copy.confirmPassword}" style="width:100%;box-sizing:border-box;padding:12px;margin:6px 0;font-family:inherit;font-size:18px" />` : ''}
            ${button('submit-auth', mode === 'login' ? copy.login : copy.register)}${button('intro', copy.back, true)}<div data-status role="status" style="min-height:22px;margin-top:8px"></div>`;
        host.querySelector<HTMLInputElement>('[data-field="username"]')?.focus();
    };
    const cloudStatusText = () => {
        const state = getCloudSaveStatus().state;
        if (state === 'pending' || state === 'syncing') return copy.syncing;
        if (state === 'offline') return copy.offline;
        if (state === 'conflict') return copy.needsDecision;
        return copy.synced;
    };
    const renderAccount = () => {
        const account = getCurrentAccount();
        if (!account) {
            renderIntro();
            return;
        }
        host.innerHTML = `${title(copy.accountTitle)}<div style="font-size:22px;margin-bottom:8px" data-account-name></div><div style="color:#9fd29f;margin-bottom:20px">${copy.cloudSave}：${cloudStatusText()}</div>${getPendingCloudConflict() ? button('resolve-conflict', copy.needsDecision) : ''}${button('show-logout', copy.logout, true)}${button('close', copy.close, true)}<div data-status style="min-height:20px;margin-top:8px"></div>`;
        host.querySelector<HTMLElement>('[data-account-name]')!.textContent = account.username;
    };
    const renderAccountEmpty = () => {
        host.innerHTML = `${title(copy.accountEmptyTitle)}<div style="line-height:1.5;color:#d9cfbd;margin-bottom:15px">${copy.accountEmptyBody}</div><div style="padding:14px;border:1px solid #666;margin-bottom:12px">${saveSummary(pendingLocal)}</div>${button('save-local', copy.saveToAccount)}${button('cancel-pending', copy.cancelDecision, true)}<div data-status style="min-height:20px"></div>`;
        setBusy(false);
    };
    const renderCompare = (local: SessionState, remote: CloudSaveSnapshot) => {
        pendingLocal = local;
        pendingRemote = remote;
        host.innerHTML = `${title(copy.chooseTitle)}<div style="line-height:1.45;color:#d9cfbd;margin-bottom:14px">${copy.chooseBody}</div>
            <div style="padding:14px;border:1px solid #888;margin:8px 0"><div style="color:#d8b878;margin-bottom:8px">${copy.deviceSave}</div>${saveSummary(local)}${button('use-local', copy.useDevice)}</div>
            <div style="padding:14px;border:1px solid #888;margin:8px 0"><div style="color:#d8b878;margin-bottom:8px">${copy.cloudCopy}</div>${saveSummary(remote.session, remote.updatedAt)}${button('use-cloud', copy.useCloud)}</div>
            ${button(pendingAccount ? 'cancel-pending' : 'close', copy.cancelDecision, true)}<div data-status style="min-height:20px"></div>`;
        setBusy(false);
    };
    const renderLogout = () => {
        host.innerHTML = `${title(copy.logoutTitle)}<div style="line-height:1.5;color:#d9cfbd;margin-bottom:16px">${copy.logoutBody}</div>${button('logout-keep', copy.logoutKeep)}${button('logout-remove', copy.logoutRemove, true)}${button('account', copy.back, true)}<div data-status style="min-height:20px"></div>`;
    };
    const finishAccountActivation = async (account: AccountUser, session: SessionState | null) => {
        activateAccount(account);
        await activateSessionProfile(`user:${account.userId}`, session);
        void restartCloudSave({ getLocalSession: getSession, applyRemoteSession: setSession });
        pendingAccount = null;
        pendingLocal = null;
        pendingRemote = null;
        close();
        onChanged?.();
    };
    const cancelPendingAccount = async () => {
        await cancelAccountAuthentication();
        pendingAccount = null;
        pendingLocal = null;
        pendingRemote = null;
        renderIntro();
    };
    const completeAuthentication = async (account: AccountUser, registered: boolean) => {
        pendingAccount = account;
        const current = getSession();
        const cached = await readSessionFromProfile(`user:${account.userId}`);
        pendingLocal = current ?? cached;
        pendingRemote = await inspectCloudSave();
        if (registered) {
            if (pendingLocal) {
                await commitLocalSaveToAccount(account, pendingLocal, 0);
            }
            await finishAccountActivation(account, pendingLocal);
            return;
        }
        if (!pendingRemote) {
            if (pendingLocal) {
                renderAccountEmpty();
            } else {
                await finishAccountActivation(account, null);
            }
            return;
        }
        if (
            !pendingLocal ||
            JSON.stringify(pendingLocal) === JSON.stringify(pendingRemote.session)
        ) {
            const session = await adoptCloudSaveForAccount(account, pendingRemote);
            await finishAccountActivation(account, session);
            return;
        }
        renderCompare(pendingLocal, pendingRemote);
    };
    const submitAuthentication = async () => {
        if (!authMode || busy) return;
        if (authMode === 'register' && password !== confirmedPassword) {
            showError(copy.passwordMismatch);
            return;
        }
        setBusy(true);
        try {
            const account =
                authMode === 'register'
                    ? await registerAccount(username, password)
                    : await loginAccount(username, password);
            await completeAuthentication(account, authMode === 'register');
        } catch (error) {
            showError(error);
            setBusy(false);
        }
    };
    const resolveCurrentConflict = () => {
        const conflict = getPendingCloudConflict();
        if (conflict) renderCompare(conflict.local, conflict.remote);
        else renderAccount();
    };

    host.addEventListener(
        'input',
        (event) => {
            const input = event.target as HTMLInputElement;
            if (input.dataset.field === 'username') username = input.value;
            if (input.dataset.field === 'password') password = input.value;
            if (input.dataset.field === 'confirm') confirmedPassword = input.value;
        },
        { signal: controller.signal },
    );
    host.addEventListener(
        'keydown',
        (event) => {
            if (event.key === 'Enter' && (event.target as HTMLElement).tagName === 'INPUT') {
                event.preventDefault();
                void submitAuthentication();
            }
        },
        { signal: controller.signal },
    );
    host.addEventListener(
        'click',
        (event) => {
            const action = (event.target as HTMLElement).closest<HTMLButtonElement>('button')
                ?.dataset.action;
            if (!action || busy) return;
            if (action === 'close') close();
            if (action === 'intro') renderIntro();
            if (action === 'show-login') renderAuth('login');
            if (action === 'show-register') renderAuth('register');
            if (action === 'submit-auth') void submitAuthentication();
            if (action === 'account') renderAccount();
            if (action === 'resolve-conflict') resolveCurrentConflict();
            if (action === 'show-logout') renderLogout();
            if (action === 'cancel-pending') void cancelPendingAccount().catch(showError);
            if (action === 'save-local' && pendingAccount && pendingLocal) {
                setBusy(true);
                void commitLocalSaveToAccount(pendingAccount, pendingLocal, 0)
                    .then(() => finishAccountActivation(pendingAccount!, pendingLocal))
                    .catch((error) => {
                        showError(error);
                        setBusy(false);
                    });
            }
            if (action === 'use-local' && pendingLocal) {
                setBusy(true);
                const operation =
                    pendingAccount && pendingRemote
                        ? commitLocalSaveToAccount(
                              pendingAccount,
                              pendingLocal,
                              pendingRemote.revision,
                          ).then(() => finishAccountActivation(pendingAccount!, pendingLocal))
                        : resolveCloudConflictWithLocal().then(() => {
                              close();
                              onChanged?.();
                          });
                void operation.catch((error) => {
                    showError(error);
                    setBusy(false);
                });
            }
            if (action === 'use-cloud' && pendingRemote) {
                setBusy(true);
                const operation = pendingAccount
                    ? adoptCloudSaveForAccount(pendingAccount, pendingRemote).then((session) =>
                          finishAccountActivation(pendingAccount!, session),
                      )
                    : resolveCloudConflictWithRemote().then(() => {
                          close();
                          onChanged?.();
                      });
                void operation.catch((error) => {
                    showError(error);
                    setBusy(false);
                });
            }
            if (action === 'logout-keep' || action === 'logout-remove') {
                setBusy(true);
                void (async () => {
                    const account = getCurrentAccount();
                    const current = getSession();
                    await flushSessionSave();
                    await logoutAccount();
                    disconnectCloudSave();
                    if (action === 'logout-keep') {
                        await activateSessionProfile('local', current);
                    } else {
                        if (account) await deleteSessionProfile(`user:${account.userId}`);
                        await activateSessionProfile(
                            'local',
                            await readSessionFromProfile('local'),
                        );
                    }
                    close();
                    onChanged?.();
                })().catch((error) => {
                    showError(error);
                    setBusy(false);
                });
            }
        },
        { signal: controller.signal },
    );

    scene.events.once('shutdown', close);
    if (getPendingCloudConflict()) resolveCurrentConflict();
    else if (getCurrentAccount()) renderAccount();
    else renderIntro();
    return root;
}
