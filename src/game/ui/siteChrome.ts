/**
 * Shared site title-bar chrome used by SiteNode and BattleAndWorkNode.
 *
 * Layout (same row as host left-aligned title):
 *   [back]  加油站  进度:n/m  ..............  存放物品:n
 *
 * Title text itself is owned by the navigation host (`setTitle`);
 * this module only places the two flanking captions.
 */

import type { GameObjects } from 'phaser';
import type { NodeMountContext } from './navigation';
import { uiTextStyle } from './uiFont';

/** Cocos actionBarBaseHeight — title row y (from bg bottom). */
const ACTION_BAR_LOCAL_Y = 803;
/** Title left edge after back button (bg-local x). */
const TITLE_LOCAL_X = 111;
/** Content left/right inset matching BottomFrame leftEdge. */
const CONTENT_EDGE = 40;
/** Gap between site name and progress caption. */
const PROGRESS_GAP = 16;

export type SiteChromeCaptions = {
    progress: GameObjects.Text | null;
    storage: GameObjects.Text;
    destroy: () => void;
};

export type SiteChromeOptions = {
    siteName: string;
    /** Already formatted, e.g. "进度:1/2". Empty/omit → hide progress. */
    progress?: string;
    storageN: number;
};

/**
 * Place progress (right of title) + storage count (right edge) on the action bar.
 * Caller must still `ctx.setTitle(siteName, { align: 'left' })`.
 */
export function mountSiteChromeCaptions(
    ctx: NodeMountContext,
    opts: SiteChromeOptions,
): SiteChromeCaptions {
    const titleX = ctx.width / 2 - ctx.bgWidth / 2 + TITLE_LOCAL_X;
    // Absolute chrome — match siteNode (bgBottom - cocosY), no content-nudge.
    const titleY = ctx.bgBottomY - ACTION_BAR_LOCAL_Y;
    const rightX = ctx.width / 2 + ctx.bgWidth / 2 - CONTENT_EDGE + 20;

    const style = {
        ...uiTextStyle('COMMON_3'),
        color: '#ffffff',
    } as const;

    let progressText: GameObjects.Text | null = null;
    const progress = opts.progress ?? '';
    if (progress) {
        // Measure title width so progress starts after the name.
        const titleProbe = ctx.scene.add
            .text(0, 0, opts.siteName, {
                ...uiTextStyle('COMMON_1'),
            })
            .setVisible(false);
        const progressX = titleX + titleProbe.width + PROGRESS_GAP;
        titleProbe.destroy();

        progressText = ctx.scene.add
            .text(progressX, titleY, progress, style)
            .setOrigin(0, 0.5)
            .setDepth(5);
        ctx.content.add(progressText);
    }

    const storage = ctx.scene.add
        .text(rightX, titleY, `存放物品:${opts.storageN}`, style)
        .setOrigin(1, 0.5)
        .setDepth(5);
    ctx.content.add(storage);

    return {
        progress: progressText,
        storage,
        destroy: () => {
            progressText?.destroy();
            storage.destroy();
        },
    };
}

/** Format "进度:cur/total" for a site room list. */
export function formatSiteProgress(step: number, roomCount: number): string {
    if (roomCount <= 0) {
        return '进度:0/0';
    }
    return `进度:${Math.min(step, roomCount)}/${roomCount}`;
}
