/**
 * Port of Buried-City uiUtil.fontFamily / fontSize.
 *
 * Original web build (localhost:4444) sets fontFamily.normal to "" when
 * `cc.sys.isNative` is false, so LabelTTF uses the browser system Chinese
 * UI face (PingFang SC on macOS, Microsoft YaHei on Windows).
 *
 * Native packs use TTF family "FZDaHei-B02S" (res/font/fzdh.ttf). That face
 * is still bundled under public/fonts for optional native-look mode, but the
 * default Phaser UI stack matches the web original so side-by-side with
 * Cocos web stays consistent.
 *
 * Size tiers match uiUtil.fontSize (design 640×1136).
 * createSpriteBtn always does `fontSize -= 4` after picking the tier.
 */

/** CSS / Phaser font-family matching web original (empty → system CJK UI). */
export const UI_FONT_FAMILY =
    '"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Heiti SC", sans-serif';

/**
 * Optional native pack face (public/fonts/fzdh.ttf via @font-face).
 * Not used by default UI; kept for native-parity experiments.
 */
export const UI_FONT_FACE_NAME = 'FZDaHei-B02S';

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
    typeof window !== 'undefined'
        ? Math.min(window.devicePixelRatio || 1, 2)
        : 1;


/**
 * Effective label size after uiUtil.createSpriteBtn's `fontSize -= 4`.
 * Big white menu buttons: COMMON_1 → 28. Common buttons: COMMON_2 → 20.
 */
export function spriteBtnFontSize (
    tier: UiFontSizeKey = 'COMMON_2',
): number
{
    return UI_FONT_SIZE[tier] - 4;
}

/** Phaser Text style fragment with family + px size. */
export function uiTextStyle (
    size: number | UiFontSizeKey = 'COMMON_2',
    extra: Phaser.Types.GameObjects.Text.TextStyle = {},
): Phaser.Types.GameObjects.Text.TextStyle
{
    const fontSizePx =
        typeof size === 'number' ? size : UI_FONT_SIZE[size];

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
export function uiSpriteBtnTextStyle (
    tier: UiFontSizeKey = 'COMMON_2',
    extra: Phaser.Types.GameObjects.Text.TextStyle = {},
): Phaser.Types.GameObjects.Text.TextStyle
{
    return uiTextStyle(spriteBtnFontSize(tier), extra);
}

/**
 * Phaser basic wordWrap only breaks on spaces, so CJK (中文/日文) never wraps.
 * Advanced wrap measures text and splits long "words" by character — matches
 * Cocos LabelTTF dimensions wrapping.
 */
export function uiWordWrap (width: number): {
    width: number;
    useAdvancedWrap: true;
}
{
    return {
        width,
        useAdvancedWrap: true,
    };
}

/**
 * System UI faces need no async load. Kept so Boot can still await a stable
 * first frame before Preloader draws text.
 */
export async function ensureUiFontLoaded (timeoutMs = 4000): Promise<boolean>
{
    if (typeof document === 'undefined' || !document.fonts)
    {
        return true;
    }

    try
    {
        // Warm the first family in the stack (PingFang SC on Apple).
        const primaryFace = 'PingFang SC';
        const loads = [20, 24, 28, 32].map((px) =>
            document.fonts.load(`${px}px "${primaryFace}"`),
        );
        await Promise.race([
            Promise.all(loads).then(() => true),
            new Promise<boolean>((resolve) =>
            {
                window.setTimeout(() => resolve(true), timeoutMs);
            }),
        ]);
        return true;
    }
    catch
    {
        return true;
    }
}
