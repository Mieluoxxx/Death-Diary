/**
 * Single source of truth for which frame atlases exist and when they load.
 *
 * - Disk truth: public/source-art/frames/<atlas>/*.png
 * - Derived: tools/gen_frame_multiatlas.mjs → multiatlas JSON + frames.gen.ts
 *
 * Add a folder under frames/, then list it here (preload or lazy). Nothing else.
 */
export const ATLAS_MANIFEST = {
    /** Cold-start: Preloader always loads these. */
    preload: [
        'menu',
        'ui',
        'icon',
        'medal',
        'npc',
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
    ],
    /**
     * On disk for future scenes — generate multiatlas JSON, load on demand via loadAtlas().
     * ART.md "not preloaded yet" set.
     */
    lazy: ['day', 'day2', 'end', 'guide', 'new_site', 'rank'],
} as const;

export type ManifestPreloadAtlas = (typeof ATLAS_MANIFEST.preload)[number];
export type ManifestLazyAtlas = (typeof ATLAS_MANIFEST.lazy)[number];
export type ManifestAtlas = ManifestPreloadAtlas | ManifestLazyAtlas;
