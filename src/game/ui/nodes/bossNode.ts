/**
 * BossNode — port of Buried-City bossSiteNode.js (site 61 · 081研究所).
 *
 * 61 is the boss-chain hub: an inset scene (new_site_bg) with 12 sub-site
 * buttons (301-312) placed at their siteConfig coordinates. Those coordinates
 * are inset-scene local coords (children sit on the bg sprite whose Cocos
 * anchor is (0.5, 0), so the child origin is the bg's bottom-center) — sub
 * sites never render on the map (original map.forEach filters siteId < 300).
 *
 * Button states (original updateBtn parity):
 *  - locked : not in session.map.unlocked → tinted dark + icon_room_lock, no input
 *  - active : unlocked and step < rooms.length → icon_room_active pulsing (fade 1.5s yoyo)
 *  - cleared: unlocked and fully cleared → plain button, no badge
 *
 * Original hides both bottom-frame buttons (uiConfig leftBtn/rightBtn: false);
 * the exit button (boss_sub_site_exit.png @ 506.5, 50.5) inside the bg goes back.
 * Tapping an unlocked sub site forwards to the plain SITE node (no travel);
 * room progression there is parameterized by siteId, so nowSiteId stays 61.
 */

import {
    BOSS_SITE_ID,
    BOSS_SUB_SITE_IDS,
    getSiteConfig,
} from '../../data/siteConfig';
import {
    ensureSite,
    getSite,
    leaveSite,
    siteStorageCount,
} from '../../systems/mapSystem';
import { getSession } from '../../session/sessionStore';
import type { NodeMountContext, NodeMountResult } from '../navigation';
import { NavNode } from '../navigation';
import { formatSiteProgress, mountSiteChromeCaptions } from '../siteChrome';

export type BossSubSiteStatus = 'locked' | 'active' | 'cleared';

/** Pure status mapping (original updateBtn parity) — exported for tests. */
export function bossSubSiteStatus(
    siteId: number,
    unlockedIds: readonly number[],
    site: { step: number; rooms: unknown[] } | null,
): BossSubSiteStatus {
    if (!unlockedIds.includes(siteId)) {
        return 'locked';
    }
    if (site && site.rooms.length > 0 && site.step < site.rooms.length) {
        return 'active';
    }
    return 'cleared';
}

function hasFrame(ctx: NodeMountContext, atlas: string, frame: string): boolean {
    return ctx.scene.textures.exists(atlas) && ctx.scene.textures.get(atlas).has(frame);
}

export function mountBossNode(ctx: NodeMountContext): NodeMountResult {
    const siteId = Number(ctx.userData) || BOSS_SITE_ID;
    const cfg = getSiteConfig(siteId);
    const session = getSession();
    const unlocked = session?.map.unlocked ?? [];

    // Original unlockSite constructs the Site (rooms generated at unlock) —
    // mirror that for every unlocked sub site so badges pulse and battle can
    // start. ensureSite is idempotent and has no map.pos/log side effects
    // (those live in enterSite).
    for (const id of BOSS_SUB_SITE_IDS) {
        if (unlocked.includes(id)) {
            ensureSite(id);
        }
    }

    ctx.setTitle(cfg?.name ?? '081研究所', { align: 'left' });
    // Original uiConfig: leftBtn/rightBtn both false — exit lives inside the bg.
    ctx.setLeftEnabled(false);
    ctx.setRightEnabled(false);

    // Aggregated progress (original BossSite.getProgressStr) + storage sum.
    const done = BOSS_SUB_SITE_IDS.filter((id) => unlocked.includes(id)).length;
    const storageN = BOSS_SUB_SITE_IDS.reduce((sum, id) => sum + siteStorageCount(id), 0);
    mountSiteChromeCaptions(ctx, {
        siteName: cfg?.name ?? `地点${siteId}`,
        progress: formatSiteProgress(done, BOSS_SUB_SITE_IDS.length),
        storageN,
    });

    // Inset scene bg: anchor bottom-center (Cocos anchor (0.5, 0) at rect bottom).
    const bgCenterX = ctx.width / 2;
    let bgW = ctx.bgWidth;
    if (hasFrame(ctx, 'new_site', 'new_site_bg.png')) {
        const bg = ctx.scene.add
            .image(bgCenterX, ctx.bgBottomY, 'new_site', 'new_site_bg.png')
            .setOrigin(0.5, 1);
        ctx.content.add(bg);
        bgW = bg.width;
    }
    // Cocos child origin = parent anchor point (bottom-center), y-up.
    const toInner = (x: number, y: number) => ({
        x: bgCenterX + (x - bgW / 2),
        y: ctx.bgBottomY - y,
    });

    const pulsingBadges: Phaser.GameObjects.Image[] = [];
    for (const subId of BOSS_SUB_SITE_IDS) {
        const subCfg = getSiteConfig(subId);
        const frame = `boss_sub_site_${subId}.png`;
        if (!subCfg || !hasFrame(ctx, 'new_site', frame)) {
            continue;
        }
        const status = bossSubSiteStatus(subId, unlocked, getSite(subId));
        const { x, y } = toInner(subCfg.coordinate.x, subCfg.coordinate.y);
        const btn = ctx.scene.add.image(x, y, 'new_site', frame);
        ctx.content.add(btn);

        if (status === 'locked') {
            btn.setTint(0x4a4a4a);
        }

        // Status badge at button center (original warn.x/y = btn center).
        if (status === 'locked' && hasFrame(ctx, 'icon', 'icon_room_lock.png')) {
            ctx.content.add(
                ctx.scene.add.image(x, y, 'icon', 'icon_room_lock.png'),
            );
        } else if (status === 'active' && hasFrame(ctx, 'icon', 'icon_room_active.png')) {
            const badge = ctx.scene.add.image(x, y, 'icon', 'icon_room_active.png');
            ctx.content.add(badge);
            pulsingBadges.push(badge);
        }

        if (status !== 'locked') {
            const hit = ctx.scene.add
                .circle(x, y, Math.max(btn.width, btn.height) / 2, 0xffffff, 0.001)
                .setInteractive({ useHandCursor: true });
            hit.on('pointerup', () => {
                ctx.forward(NavNode.SITE, subId);
            });
            ctx.content.add(hit);
        }
    }

    // Exit button inside the bg (original: (506.5, 50.5), white type).
    if (hasFrame(ctx, 'new_site', 'boss_sub_site_exit.png')) {
        const { x, y } = toInner(506.5, 50.5);
        const exit = ctx.scene.add
            .image(x, y, 'new_site', 'boss_sub_site_exit.png')
            .setInteractive({ useHandCursor: true });
        exit.on('pointerup', () => {
            // Original onClickLeftBtn calls player.outSite() — travel arrival
            // has set isAtSite/nowSiteId=61.
            leaveSite();
            ctx.back();
        });
        ctx.content.add(exit);
    }

    // Original: fadeOut(1.5) + fadeIn(1.5) repeatForever.
    for (const badge of pulsingBadges) {
        ctx.scene.tweens.add({
            targets: badge,
            alpha: { from: 1, to: 0.15 },
            duration: 1500,
            yoyo: true,
            repeat: -1,
        });
    }

    return {
        destroy: () => {
            for (const badge of pulsingBadges) {
                ctx.scene.tweens.killTweensOf(badge);
            }
        },
    };
}
