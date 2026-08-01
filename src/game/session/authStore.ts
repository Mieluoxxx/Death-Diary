export type AccountUser = {
    userId: string;
    username: string;
    kind: 'account';
};

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? '';
const CACHED_ACCOUNT_KEY = 'death_diary_cached_account_v1';
const REQUEST_TIMEOUT_MS = 5_000;

let currentAccount: AccountUser | null = loadCachedAccount();

function loadCachedAccount(): AccountUser | null {
    try {
        const raw = localStorage.getItem(CACHED_ACCOUNT_KEY);
        if (!raw) {
            return null;
        }
        const value = JSON.parse(raw) as Partial<AccountUser>;
        return typeof value.userId === 'string' &&
            typeof value.username === 'string' &&
            value.kind === 'account'
            ? (value as AccountUser)
            : null;
    } catch {
        return null;
    }
}

function rememberAccount(account: AccountUser | null): void {
    currentAccount = account;
    try {
        if (account) {
            localStorage.setItem(CACHED_ACCOUNT_KEY, JSON.stringify(account));
        } else {
            localStorage.removeItem(CACHED_ACCOUNT_KEY);
        }
    } catch {
        // The account remains usable for this page lifetime when localStorage is unavailable.
    }
    window.dispatchEvent(new CustomEvent('account-status-changed', { detail: account }));
}

async function accountRequest(path: string, init: RequestInit = {}): Promise<Response> {
    return fetch(`${API_BASE}${path}`, {
        ...init,
        credentials: 'include',
        headers: {
            Accept: 'application/json',
            ...init.headers,
        },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
}

async function parseAccountResponse(response: Response): Promise<AccountUser> {
    if (!response.ok) {
        let message = `账号请求失败（${response.status}）。`;
        try {
            const body = (await response.json()) as { error?: { message?: string } };
            if (body.error?.message) {
                message = body.error.message;
            }
        } catch {
            // Keep the status-based message for malformed error responses.
        }
        throw new Error(message);
    }
    const body = (await response.json()) as Partial<AccountUser>;
    if (
        typeof body.userId !== 'string' ||
        typeof body.username !== 'string' ||
        body.kind !== 'account'
    ) {
        throw new Error('服务器返回了无效的账号信息。');
    }
    return body as AccountUser;
}

export async function initializeAccount(): Promise<void> {
    try {
        const response = await accountRequest('/api/v1/me');
        if (response.status === 401) {
            rememberAccount(null);
            return;
        }
        const account = await parseAccountResponse(response);
        rememberAccount(account);
    } catch {
        // Keep the cached account profile so an authenticated player can continue offline.
    }
}

export function getCurrentAccount(): AccountUser | null {
    return currentAccount;
}

export function activateAccount(account: AccountUser): void {
    rememberAccount(account);
}

export function getActiveSaveProfile(): string {
    return currentAccount ? `user:${currentAccount.userId}` : 'local';
}

export async function registerAccount(username: string, password: string): Promise<AccountUser> {
    return parseAccountResponse(
        await accountRequest('/api/v1/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password }),
        }),
    );
}

export async function loginAccount(username: string, password: string): Promise<AccountUser> {
    return parseAccountResponse(
        await accountRequest('/api/v1/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password }),
        }),
    );
}

export async function cancelAccountAuthentication(): Promise<void> {
    const response = await accountRequest('/api/v1/logout', { method: 'POST' });
    if (!response.ok && response.status !== 401) {
        throw new Error(`退出失败（${response.status}）。`);
    }
}

export async function logoutAccount(): Promise<void> {
    if (currentAccount) {
        const response = await accountRequest('/api/v1/logout', { method: 'POST' });
        if (!response.ok && response.status !== 401) {
            throw new Error(`退出失败（${response.status}）。`);
        }
    }
    rememberAccount(null);
}
