import { type Scene, Textures } from 'phaser';
import type { AtlasKey } from './frames.gen';

const LINEAR = Textures.LINEAR;

/** Public paths used by Phaser Loader (under vite `public/`). */
export function atlasJsonUrl(key: AtlasKey): string {
    return `source-art/multiatlas/${key}.json`;
}

export function atlasImagePath(key: AtlasKey): string {
    return `source-art/frames/${key}/`;
}

/**
 * Ensure a manifest atlas is loaded and LINEAR-filtered.
 * No-op if the texture key already exists.
 */
export function loadAtlas(scene: Scene, key: AtlasKey): Promise<void> {
    if (scene.textures.exists(key)) {
        scene.textures.get(key).setFilter(LINEAR);
        return Promise.resolve();
    }

    const { promise, resolve, reject } = Promise.withResolvers<void>();

    const onComplete = () => {
        cleanup();
        if (scene.textures.exists(key)) {
            scene.textures.get(key).setFilter(LINEAR);
        }
        resolve();
    };

    const onError = (file: { key?: string; src?: string }) => {
        const hint = file?.key ?? file?.src ?? key;
        cleanup();
        reject(new Error(`Failed to load atlas "${key}" (${String(hint)})`));
    };

    const cleanup = () => {
        scene.load.off('complete', onComplete);
        scene.load.off('loaderror', onError);
    };

    scene.load.once('complete', onComplete);
    scene.load.once('loaderror', onError);
    scene.load.multiatlas(key, atlasJsonUrl(key), atlasImagePath(key));
    scene.load.start();

    return promise;
}

/** Queue atlases during a scene load, skipping textures already resident. */
export function queuePreloadAtlases(scene: Scene, keys: readonly AtlasKey[]): number {
    let queued = 0;
    for (const key of keys) {
        if (!scene.textures.exists(key)) {
            scene.load.multiatlas(key, atlasJsonUrl(key), atlasImagePath(key));
            queued += 1;
        }
    }
    return queued;
}

/** Apply LINEAR filter to every loaded key in the list. */
export function applyLinearFilter(scene: Scene, keys: readonly string[]): void {
    for (const key of keys) {
        if (scene.textures.exists(key)) {
            scene.textures.get(key).setFilter(LINEAR);
        }
    }
}
