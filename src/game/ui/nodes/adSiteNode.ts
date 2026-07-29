import type { GameObjects } from 'phaser';

/**
 * AdSiteNode — free scrapyard (site 202).
 * Port of Buried-City adSiteNode.js with ads removed:
 * dig + des + play button claims a free gift once per day into site storage.
 */

import { AD_SITE_ID, getSiteConfig } from '../../data/siteConfig';
import { mutateSession } from '../../session/sessionStore';
import {
    canClaimScrapyardGift,
    claimScrapyardGift,
    getSite,
    leaveSite,
    scrapyardProgressStr,
    siteStorageCount,
} from '../../systems/mapSystem';
import { addAtlasButton } from '../atlasButton';
import type { NodeMountContext, NodeMountResult } from '../navigation';
import { NavNode } from '../navigation';
import { mountSiteChromeCaptions } from '../siteChrome';
import { UI_FONT_FAMILY, UI_FONT_SIZE, UI_TEXT_RESOLUTION, uiWordWrap } from '../uiFont';

const LEFT_EDGE = 40;
const CONTENT_TOP = 770;

function hasFrame(ctx: NodeMountContext, atlas: string, frame: string): boolean {
    return ctx.scene.textures.exists(atlas) && ctx.scene.textures.get(atlas).has(frame);
}

export function mountAdSiteNode(ctx: NodeMountContext): NodeMountResult {
    const siteId = Number(ctx.userData) || AD_SITE_ID;
    const cfg = getSiteConfig(siteId);
    const site = getSite(siteId);

    const siteName = cfg?.name ?? '???';
    ctx.setTitle(siteName, { align: 'left' });
    ctx.setLeftEnabled(true);
    ctx.setRightEnabled(false);

    const fromBottom = (cocosY: number) => ctx.bgBottomY - cocosY;
    const leftEdge = ctx.width / 2 - ctx.bgWidth / 2 + LEFT_EDGE;
    const rightEdge = ctx.width / 2 + ctx.bgWidth / 2 - LEFT_EDGE;

    const chrome = mountSiteChromeCaptions(ctx, {
        siteName,
        // Daily claim slot replaces dungeon rooms: 0/1 ready, 1/1 claimed.
        progress: scrapyardProgressStr(siteId),
        storageN: siteStorageCount(siteId),
    });

    const digTop = fromBottom(CONTENT_TOP - 50);
    const digFrame = `site_dig_${siteId}.png`;
    let digBottom = digTop + 200;
    let digCenterX = ctx.width / 2;
    let digCenterY = digTop + 100;

    if (hasFrame(ctx, 'site', digFrame)) {
        const dig = ctx.scene.add.image(ctx.width / 2, digTop, 'site', digFrame).setOrigin(0.5, 0);
        ctx.content.add(dig);
        digBottom = dig.y + dig.displayHeight;
        digCenterX = dig.x;
        digCenterY = dig.y + dig.displayHeight / 2;
    }

    if (cfg) {
        ctx.content.add(
            ctx.scene.add
                .text(ctx.width / 2, digBottom + 40, cfg.des, {
                    fontFamily: UI_FONT_FAMILY,
                    resolution: UI_TEXT_RESOLUTION,
                    fontSize: `${UI_FONT_SIZE.COMMON_2}px`,
                    color: '#ffffff',
                    align: 'center',
                    wordWrap: uiWordWrap(rightEdge - leftEdge),
                })
                .setOrigin(0.5, 0),
        );
    }

    let stopIcon: GameObjects.Image | null = null;
    let playHighlight: GameObjects.Image | null = null;
    let playBtn: GameObjects.Image | null = null;
    let notifyIcon: GameObjects.Image | null = null;

    if (hasFrame(ctx, 'icon', 'icon_ad_stop.png')) {
        stopIcon = ctx.scene.add.image(digCenterX, digCenterY, 'icon', 'icon_ad_stop.png');
        ctx.content.add(stopIcon);
    }
    if (hasFrame(ctx, 'icon', 'icon_ad_play_highlight.png')) {
        playHighlight = ctx.scene.add
            .image(digCenterX, digCenterY, 'icon', 'icon_ad_play_highlight.png')
            .setAlpha(1);
        ctx.content.add(playHighlight);
        ctx.scene.tweens.add({
            targets: playHighlight,
            alpha: 0.25,
            duration: 2000,
            yoyo: true,
            repeat: -1,
        });
    }
    if (hasFrame(ctx, 'icon', 'icon_ad_play.png')) {
        playBtn = ctx.scene.add
            .image(digCenterX, digCenterY, 'icon', 'icon_ad_play.png')
            .setInteractive({ useHandCursor: true });
        ctx.content.add(playBtn);
        playBtn.on('pointerup', () => {
            if (!canClaimScrapyardGift(siteId)) {
                ctx.showToast('今天已经领取过了');
                return;
            }
            const loot = claimScrapyardGift(siteId);
            if (loot.length === 0) {
                ctx.showToast('今天已经领取过了');
                return;
            }
            ctx.showToast('补给已放入存放点');
            refreshClaimUi();
        });
    }

    const btnY = fromBottom(100);
    const storageBtn = addAtlasButton(ctx.scene, ctx.width / 2, btnY, {
        atlas: 'ui',
        frame: 'btn_common_white_normal.png',
        label: '物品存放点',
        onClick: () => {
            mutateSession((live) => {
                const s = live.map.sites[siteId];
                if (s) {
                    s.haveNewItems = false;
                }
            });
            ctx.forward(NavNode.SITE_STORAGE, siteId);
        },
    });
    ctx.content.add(storageBtn);

    if (
        site?.haveNewItems &&
        hasFrame(ctx, 'map', 'map_actor.png')
    ) {
        notifyIcon = ctx.scene.add
            .image(ctx.width / 2 + 70, btnY - 18, 'map', 'map_actor.png')
            .setOrigin(0.5)
            .setDepth(2);
        ctx.content.add(notifyIcon);
    }

    function refreshClaimUi(): void {
        const canClaim = canClaimScrapyardGift(siteId);
        stopIcon?.setVisible(!canClaim);
        playHighlight?.setVisible(canClaim);
        playBtn?.setVisible(canClaim);
        if (playBtn) {
            if (canClaim) {
                playBtn.setInteractive({ useHandCursor: true });
                playBtn.setAlpha(1);
            } else {
                playBtn.disableInteractive();
                playBtn.setAlpha(0.45);
            }
        }
        chrome.progress?.setText(scrapyardProgressStr(siteId));
        chrome.storage.setText(`存放物品:${siteStorageCount(siteId)}`);
        if (notifyIcon) {
            notifyIcon.setVisible(Boolean(getSite(siteId)?.haveNewItems));
        }
    }

    refreshClaimUi();

    return {
        onLeft: () => {
            leaveSite();
            ctx.back();
        },
        destroy: () => {
            chrome.destroy();
        },
    };
}
