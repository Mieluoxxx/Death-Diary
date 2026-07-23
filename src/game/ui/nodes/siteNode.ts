/**
 * SiteNode — site dig art + progress, enter room (battle/work), site storage.
 * dig illustration: site_dig_{id}.png (original site entry layout).
 */

import { getSiteConfig } from '../../data/siteConfig';
import {
    currentRoom,
    getSite,
    leaveSite,
    siteStorageCount,
} from '../../systems/mapSystem';
import type { NodeMountContext, NodeMountResult } from '../navigation';
import { NavNode } from '../navigation';
import {
    UI_FONT_FAMILY,
    UI_FONT_SIZE,
    UI_TEXT_RESOLUTION,
    uiWordWrap,
} from '../uiFont';
import { addAtlasButton } from '../atlasButton';

export function mountSiteNode (ctx: NodeMountContext): NodeMountResult
{
    const siteId = Number(ctx.userData);
    const cfg = getSiteConfig(siteId);
    ctx.setTitle(cfg?.name ?? `地点${siteId}`);
    ctx.setLeftEnabled(true);
    ctx.setRightEnabled(false);

    const site = getSite(siteId);
    const contentTop = ctx.toScreenY(770);
    const digFrame = `site_dig_${siteId}.png`;
    let belowDigY = contentTop + 24;

    if (ctx.scene.textures.exists('site') && ctx.scene.textures.get('site').has(digFrame))
    {
        const dig = ctx.scene.add
            .image(ctx.width / 2, contentTop - 12, 'site', digFrame)
            .setOrigin(0.5, 0)
            .setScale(0.9);
        ctx.content.add(dig);
        belowDigY = dig.y + dig.displayHeight + 12;
    }

    const progress =
        site && site.rooms.length > 0
            ? `进度 ${Math.min(site.step, site.rooms.length)}/${site.rooms.length}`
            : '无房间';
    const ended = site?.ended ? '（已探索完毕）' : '';

    ctx.content.add(
        ctx.scene.add
            .text(ctx.width / 2, belowDigY, `${progress}${ended}`, {
                fontFamily: UI_FONT_FAMILY,
                resolution: UI_TEXT_RESOLUTION,
                fontSize: `${UI_FONT_SIZE.COMMON_2}px`,
                color: '#f0e6d2',
            })
            .setOrigin(0.5, 0),
    );

    let desBottom = belowDigY + 36;
    if (cfg)
    {
        const des = ctx.scene.add
            .text(ctx.width / 2, belowDigY + 36, cfg.des, {
                fontFamily: UI_FONT_FAMILY,
                resolution: UI_TEXT_RESOLUTION,
                fontSize: `${UI_FONT_SIZE.COMMON_3}px`,
                color: '#cccccc',
                align: 'center',
                wordWrap: uiWordWrap(500),
            })
            .setOrigin(0.5, 0);
        ctx.content.add(des);
        desBottom = des.y + des.height + 16;
    }

    const room = currentRoom(siteId);
    let roomLabel = '无更多房间';
    if (room?.type === 'battle')
    {
        roomLabel = `当前：战斗房（难度${room.difficulty}，${room.monsters.length}只）`;
    }
    else if (room?.type === 'work')
    {
        const n = (room.loot ?? []).reduce((s, r) => s + r.num, 0);
        roomLabel = `当前：搜刮房（约${n}件物资）`;
    }
    else if (site?.ended)
    {
        roomLabel = '地点已清空';
    }

    ctx.content.add(
        ctx.scene.add
            .text(ctx.width / 2, desBottom, roomLabel, {
                fontFamily: UI_FONT_FAMILY,
                resolution: UI_TEXT_RESOLUTION,
                fontSize: `${UI_FONT_SIZE.COMMON_3}px`,
                color: '#ffffff',
            })
            .setOrigin(0.5, 0),
    );

    const btnY = Math.min(desBottom + 80, ctx.bgBottomY - 160);
    const storageN = siteStorageCount(siteId);

    if (room && !site?.ended)
    {
        const exploreBtn = addAtlasButton(ctx.scene, ctx.width / 2, btnY, {
            atlas: 'ui',
            frame: 'btn_common_white_normal.png',
            label: room.type === 'battle' ? '进入战斗' : '开始搜刮',
            onClick: () =>
            {
                ctx.forward(NavNode.BATTLE_AND_WORK, siteId);
            },
        });
        ctx.content.add(exploreBtn);
    }

    const storageBtn = addAtlasButton(ctx.scene, ctx.width / 2, btnY + 90, {
        atlas: 'ui',
        frame: 'btn_common_black_normal.png',
        label: `地点仓库（${storageN}）`,
        labelColor: '#eee',
        onClick: () =>
        {
            ctx.forward(NavNode.SITE_STORAGE, siteId);
        },
    });
    ctx.content.add(storageBtn);

    return {
        onLeft: () =>
        {
            leaveSite();
            ctx.back();
        },
    };
}
