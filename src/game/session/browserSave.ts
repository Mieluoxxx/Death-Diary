const DATABASE_NAME = 'death-diary';
const DATABASE_VERSION = 1;
const SAVE_STORE = 'save-data';
const ACTIVE_SAVE_KEY = 'active-session';

let databasePromise: Promise<IDBDatabase> | null = null;

function transactionDone(transaction: IDBTransaction): Promise<void> {
    const { promise, resolve, reject } = Promise.withResolvers<void>();
    transaction.addEventListener('complete', () => resolve(), { once: true });
    transaction.addEventListener(
        'abort',
        () => reject(transaction.error ?? new Error('IndexedDB transaction aborted.')),
        { once: true },
    );
    transaction.addEventListener(
        'error',
        () => reject(transaction.error ?? new Error('IndexedDB transaction failed.')),
        { once: true },
    );
    return promise;
}

function openDatabase(): Promise<IDBDatabase> {
    if (databasePromise) {
        return databasePromise;
    }

    const { promise, resolve, reject } = Promise.withResolvers<IDBDatabase>();
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.addEventListener('upgradeneeded', () => {
        const database = request.result;
        if (!database.objectStoreNames.contains(SAVE_STORE)) {
            database.createObjectStore(SAVE_STORE);
        }
    });
    request.addEventListener('success', () => {
        const database = request.result;
        database.addEventListener('versionchange', () => database.close());
        resolve(database);
    });
    request.addEventListener(
        'error',
        () => reject(request.error ?? new Error('Unable to open IndexedDB.')),
        { once: true },
    );
    request.addEventListener(
        'blocked',
        () => reject(new Error('IndexedDB upgrade is blocked by another tab.')),
        { once: true },
    );
    const opening = promise.catch((error) => {
        databasePromise = null;
        throw error;
    });
    databasePromise = opening;
    return opening;
}

export async function readBrowserSave(): Promise<string | null> {
    const database = await openDatabase();
    const transaction = database.transaction(SAVE_STORE, 'readonly');
    const done = transactionDone(transaction);
    const request = transaction.objectStore(SAVE_STORE).get(ACTIVE_SAVE_KEY);
    const { promise, resolve, reject } = Promise.withResolvers<unknown>();
    request.addEventListener('success', () => resolve(request.result), { once: true });
    request.addEventListener(
        'error',
        () => reject(request.error ?? new Error('Unable to read browser save.')),
        { once: true },
    );
    const value = await promise;
    await done;
    return typeof value === 'string' ? value : null;
}

export async function writeBrowserSave(json: string): Promise<void> {
    const database = await openDatabase();
    const transaction = database.transaction(SAVE_STORE, 'readwrite');
    const done = transactionDone(transaction);
    transaction.objectStore(SAVE_STORE).put(json, ACTIVE_SAVE_KEY);
    await done;
}
