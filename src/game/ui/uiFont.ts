/**
 * Port of Buried-City uiUtil.fontFamily / fontSize.
 *
 * Web Cocos used empty LabelTTF family → system CJK UI face.
 * On Linux/WSL those faces (PingFang / YaHei / Heiti) are often missing,
 * so Phaser Text renders CJK as tofu boxes (□).
 *
 * Default stack leads with the bundled native pack face
 * `FZDaHei-B02S` (public/fonts/fzdh.ttf via style.css @font-face),
 * then system CJK fallbacks.
 */

/** Bundled face from public/fonts/fzdh.ttf (@font-face in style.css). */
export const UI_FONT_FACE_NAME = 'FZDaHei-B02S';

/**
 * CSS / Phaser font-family.
 * Prefer bundled TTF so Linux/WSL/headless Chromium still draw CJK.
 */
export const UI_FONT_FAMILY = `"${UI_FONT_FACE_NAME}", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Noto Sans CJK SC", "Source Han Sans SC", "WenQuanYi Micro Hei", sans-serif`;

export const UI_FONT_SIZE = {
    /** uiUtil.fontSize.COMMON_1 */
    COMMON_1: 32,
    /** uiUtil.fontSize.COMMON_2 */
    COMMON_2: 24,
    /** uiUtil.fontSize.COMMON_3 */
    COMMON_3: 20,
} as const;

export type UiFontSizeKey = keyof typeof UI_FONT_SIZE;

/**
 * Phaser Text canvas DPI. Cocos LabelTTF on retina is sharp; Phaser defaults
 * to resolution 1 which looks soft/chunky when the game canvas is FIT-scaled.
 */
export const UI_TEXT_RESOLUTION =
    typeof window !== 'undefined' ? Math.min(window.devicePixelRatio || 1, 2) : 1;

/**
 * Effective label size after uiUtil.createSpriteBtn's `fontSize -= 4`.
 * Big white menu buttons: COMMON_1 → 28. Common buttons: COMMON_2 → 20.
 */
export function spriteBtnFontSize(tier: UiFontSizeKey = 'COMMON_2'): number {
    return UI_FONT_SIZE[tier] - 4;
}

/** Phaser Text style fragment with family + px size. */
export function uiTextStyle(
    size: number | UiFontSizeKey = 'COMMON_2',
    extra: Phaser.Types.GameObjects.Text.TextStyle = {},
): Phaser.Types.GameObjects.Text.TextStyle {
    const fontSizePx = typeof size === 'number' ? size : UI_FONT_SIZE[size];

    return {
        fontFamily: UI_FONT_FAMILY,
        resolution: UI_TEXT_RESOLUTION,
        fontSize: `${fontSizePx}px`,
        ...extra,
    };
}

/**
 * Style for labels drawn on atlas sprite buttons (createSpriteBtn parity).
 * Pass the same tier the original fontInfo.fontSize used (before -4).
 */
export function uiSpriteBtnTextStyle(
    tier: UiFontSizeKey = 'COMMON_2',
    extra: Phaser.Types.GameObjects.Text.TextStyle = {},
): Phaser.Types.GameObjects.Text.TextStyle {
    return uiTextStyle(spriteBtnFontSize(tier), extra);
}

/**
 * Phaser basic wordWrap only breaks on spaces, so CJK (中文/日文) never wraps.
 * Advanced wrap measures text and splits long "words" by character — matches
 * Cocos LabelTTF dimensions wrapping.
 */
export function uiWordWrap(width: number): {
    width: number;
    useAdvancedWrap: true;
} {
    return {
        width,
        useAdvancedWrap: true,
    };
}

/**
 * Ensure the bundled CJK face is loaded before Preloader draws text.
 * Falls back after timeout so Boot never hangs if the TTF fails.
 */
export async function ensureUiFontLoaded(timeoutMs = 4000): Promise<boolean> {
    if (typeof document === 'undefined' || !document.fonts) {
        return true;
    }

    try {
        const face = UI_FONT_FACE_NAME;
        const loads = [20, 24, 28, 32].map((px) => document.fonts.load(`${px}px "${face}"`));
        await Promise.race([
            Promise.all(loads).then(() => true),
            new Promise<boolean>((resolve) => {
                window.setTimeout(() => resolve(document.fonts.check(`24px "${face}"`)), timeoutMs);
            }),
        ]);
        return document.fonts.check(`24px "${face}"`);
    } catch {
        return false;
    }
}

/**
 * Phaser Text bakes glyphs into a canvas texture at creation time. If the
 * bundled face is still loading then (slow CDN, cold cache), those early Text
 * objects are stuck with the fallback family — same fontFamily string, wrong
 * glyphs. Once document.fonts reports the face loaded, redraw every Text
 * object across all scenes so early text converges to the UI face.
 */
export function scheduleTextRedrawOnFontReady(game: Phaser.Game): void {
    if (typeof document === 'undefined' || !document.fonts) {
        return;
    }
    const redraw = () => {
        for (const scene of game.scene.getScenes(true)) {
            for (const child of scene.children.list) {
                if (child.type === 'Text') {
                    (child as Phaser.GameObjects.Text).updateText();
                }
            }
        }
    };
    document.fonts.ready.then(() => {
        // Give the FontFace a beat to actually rasterize before redrawing.
        setTimeout(redraw, 0);
    });
}
