/**
 * Single source of truth for which frame atlases exist and when they load.
 *
 * - Disk truth: public/source-art/frames/<atlas>/*.png
 * - Derived: tools/gen_frame_multiatlas.mjs → multiatlas JSON + frames.gen.ts
 *
 * Add a folder under frames/, then list it in exactly one loading tier.
 */
export const ATLAS_MANIFEST = {
    /** Cold-start shell: MainMenu plus the immediately reachable role picker. */
    preload: ['menu', 'ui', 'icon', 'npc'],
    /**
     * Loaded by the scene that first needs each atlas. Keeping every on-disk atlas
     * here preserves generation/type coverage without blocking the main menu.
     */
    lazy: [
        'medal',
        'home',
        'dig_build',
        'build',
        'gate',
        'map',
        'site',
        'dig_monster',
        'dig_item',
        'dig_work',
        'weather',
        'day',
        'day2',
        'end',
        'guide',
        'new_site',
        'rank',
    ],
} as const;

/** Remaining assets required before Home can render its complete interactive shell. */
export const HOME_ATLAS_KEYS = [
    'home',
    'dig_build',
    'build',
    'gate',
    'map',
    'site',
    'dig_monster',
    'dig_item',
    'dig_work',
    'weather',
    'guide',
] as const;

export type ManifestPreloadAtlas = (typeof ATLAS_MANIFEST.preload)[number];
export type ManifestLazyAtlas = (typeof ATLAS_MANIFEST.lazy)[number];
export type ManifestAtlas = ManifestPreloadAtlas | ManifestLazyAtlas;
