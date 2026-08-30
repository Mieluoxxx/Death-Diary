/**
 * SiteNode — port of Buried-City siteNode.js entry layout.
 *
 * Cocos coords are y-up from bottom-frame bg (596×839). Convert with
 * phaserY = bgBottomY - cocosY (no content-nudge; chrome is absolute).
 *
 * - Title left of bar (host setTitle align left)
 * - Progress right of title + 存放物品 top-right (shared siteChrome)
 * - dig at cocos y = contentTopLine(770) - 50, anchor top
 * - des under dig by 40px
 * - Buttons at cocos y=100: 物品存放点 | 进入副本
 */

import { getSiteConfig } from '../../data/siteConfig';
import { getSite, leaveSite, siteStorageCount } from '../../systems/mapSystem';
import { advanceGuide, GuideStep, isGuideStep } from '../../systems/userGuide';
import { addAtlasButton } from '../atlasButton';
import type { NodeMountContext, NodeMountResult } from '../navigation';
import { NavNode } from '../navigation';
import { formatSiteProgress, mountSiteChromeCaptions } from '../siteChrome';
import { uiTextStyle, uiWordWrap } from '../uiFont';
import { addGuideWarn } from '../userGuideUi';

const LEFT_EDGE = 40;
/** BottomFrame contentTopLineHeight */
const CONTENT_TOP = 770;

export function mountSiteNode(ctx: NodeMountContext): NodeMountResult {
    const siteId = Number(ctx.userData);
    const cfg = getSiteConfig(siteId);
    const site = getSite(siteId);

    ctx.setTitle(cfg?.name ?? `地点${siteId}`, { align: 'left' });
    ctx.setLeftEnabled(true);
    ctx.setRightEnabled(false);

    // Absolute chrome coords (ignore content toScreenY nudge).
    const fromBottom = (cocosY: number) => ctx.bgBottomY - cocosY;
    const leftEdge = ctx.width / 2 - ctx.bgWidth / 2 + LEFT_EDGE;
    const rightEdge = ctx.width / 2 + ctx.bgWidth / 2 - LEFT_EDGE;

    const siteName = cfg?.name ?? `地点${siteId}`;
    const progress =
        site && site.rooms.length > 0
            ? formatSiteProgress(site.step, site.rooms.length)
            : formatSiteProgress(0, 0);
    mountSiteChromeCaptions(ctx, {
        siteName,
        progress,
        storageN: siteStorageCount(siteId),
    });

    // dig: (bgW/2, contentTop - 50), anchor top-center
    const digTop = fromBottom(CONTENT_TOP - 50);
    const digFrame = `site_dig_${siteId}.png`;
    let digBottom = digTop + 200;

    if (ctx.scene.textures.exists('site') && ctx.scene.textures.get('site').has(digFrame)) {
        const dig = ctx.scene.add.image(ctx.width / 2, digTop, 'site', digFrame).setOrigin(0.5, 0);
        ctx.content.add(dig);
        digBottom = dig.y + dig.displayHeight;
    }

    // des: under dig by 40, white COMMON_2, width = rightEdge - leftEdge
    if (cfg) {
        ctx.content.add(
            ctx.scene.add
                .text(ctx.width / 2, digBottom + 40, cfg.des, {
                    ...uiTextStyle('COMMON_2'),
                    color: '#ffffff',
                    align: 'center',
                    wordWrap: uiWordWrap(rightEdge - leftEdge),
                })
                .setOrigin(0.5, 0),
        );
    }

    // Twin buttons: (bgW/4, 100) and (3*bgW/4, 100) from bg bottom.
    const btnY = fromBottom(100);
    const leftBtnX = ctx.width / 2 - ctx.bgWidth / 4;
    const rightBtnX = ctx.width / 2 + ctx.bgWidth / 4;
    const siteEnded = Boolean(site?.ended);

    const storageBtn = addAtlasButton(ctx.scene, leftBtnX, btnY, {
        atlas: 'ui',
        frame: 'btn_common_white_normal.png',
        label: '物品存放点',
        onClick: () => {
            ctx.forward(NavNode.SITE_STORAGE, siteId);
        },
    });
    ctx.content.add(storageBtn);

    if (
        site?.haveNewItems &&
        ctx.scene.textures.exists('map') &&
        ctx.scene.textures.get('map').has('map_actor.png')
    ) {
        ctx.content.add(
            ctx.scene.add
                .image(leftBtnX + 70, btnY - 18, 'map', 'map_actor.png')
                .setOrigin(0.5)
                .setDepth(2),
        );
    }

    const enterBtn = addAtlasButton(ctx.scene, rightBtnX, btnY, {
        atlas: 'ui',
        frame: 'btn_common_white_normal.png',
        label: '进入副本',
        enabled: !siteEnded,
        onClick: () => {
            if (siteEnded) {
                return;
            }
            advanceGuide(GuideStep.ENTER_SITE);
            ctx.forward(NavNode.BATTLE_AND_WORK, siteId);
        },
    });
    ctx.content.add(enterBtn);
    const guideWarn = isGuideStep(GuideStep.ENTER_SITE) ? addGuideWarn(ctx.scene, enterBtn) : null;

    return {
        destroy: () => guideWarn?.destroy(),
        onLeft: () => {
            leaveSite();
            ctx.back();
        },
    };
}
