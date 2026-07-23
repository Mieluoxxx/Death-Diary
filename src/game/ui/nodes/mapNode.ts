/**
 * MapNode — satellite map_bg + site markers + actor (match Cocos MapView).
 *
 * Original (Buried-City MapNode.js):
 * - Empty title; no left/right chrome
 * - ScrollView size = bgRect − 12 → 584×827; map_bg is 584×827 so 1:1 fill
 * - Position: ((bgW − viewW) / 2 + 1, 6) on bottom frame (y-up from bg bottom)
 * - Entity: site_big_bg / site_bg + site_{id} + highlight layer; pos = baseSite.pos
 * - Actor: map_actor.png at player.map.pos, 1:1 (30×30)
 * - Path: map_line.png segments along travel vector
 * - Dialog: DialogBig + site_dig + travel time (showSiteDialog / showHomeDialog)
 */

import { GameObjects } from 'phaser';
import {
    HOME_SITE_ID,
    getSiteConfig,
    mapDistance,
    travelTimeSeconds,
} from '../../data/siteConfig';
import { getSession } from '../../session/sessionStore';
import { travelTo } from '../../systems/mapSystem';
import type { NodeMountContext, NodeMountResult } from '../navigation';
import { NavNode } from '../navigation';
import {
    UI_FONT_FAMILY,
    UI_FONT_SIZE,
    UI_TEXT_RESOLUTION,
    uiWordWrap,
} from '../uiFont';
import { addAtlasButton } from '../atlasButton';

/** map_bg source size (original). */
const MAP_W = 584;
const MAP_H = 827;
/** Original map_line.png width. */
const LINE_W = 15;
const DIALOG_FRAME = 'dialog_big_bg.png';
const DIALOG_W = 448;
const DIALOG_H = 625;

function formatTravelTime (seconds: number): string
{
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (h > 0)
    {
        return m > 0 ? `${h}小时${m}分` : `${h}小时`;
    }
    return `${Math.max(1, m)}分钟`;
}

function hasFrame (ctx: NodeMountContext, atlas: string, frame: string): boolean
{
    return ctx.scene.textures.exists(atlas) && ctx.scene.textures.get(atlas).has(frame);
}

export function mountMapNode (ctx: NodeMountContext): NodeMountResult
{
    // Original MapNode: empty title, no left/right chrome.
    ctx.setTitle('');
    ctx.setLeftEnabled(false);
    ctx.setRightEnabled(false);

    const session = getSession();
    if (!session)
    {
        return {};
    }

    // 1:1 fill of bottom-frame interior (bgRect − 12).
    const drawW = MAP_W;
    const drawH = MAP_H;
    // Cocos: ((bgW - viewW)/2 + 1, 6) from bg bottom-left; Phaser top-left.
    const mapOriginX = ctx.width / 2 - ctx.bgWidth / 2 + (ctx.bgWidth - drawW) / 2 + 1;
    const mapOriginY = ctx.bgBottomY - 6 - drawH;

    // Clip to the map viewport (original ScrollView clipping).
    const maskShape = ctx.scene.make.graphics({ x: 0, y: 0 });
    maskShape.fillStyle(0xffffff);
    maskShape.fillRect(mapOriginX, mapOriginY, drawW, drawH);
    const mask = maskShape.createGeometryMask();
    maskShape.setVisible(false);
    ctx.content.add(maskShape);

    const mapLayer = ctx.scene.add.container(0, 0);
    mapLayer.setMask(mask);
    ctx.content.add(mapLayer);

    if (hasFrame(ctx, 'map', 'map_bg.png'))
    {
        mapLayer.add(
            ctx.scene.add
                .image(mapOriginX, mapOriginY, 'map', 'map_bg.png')
                .setOrigin(0, 0),
        );
    }
    else
    {
        mapLayer.add(
            ctx.scene.add
                .rectangle(mapOriginX + drawW / 2, mapOriginY + drawH / 2, drawW, drawH, 0x1a1a1a)
                .setOrigin(0.5),
        );
    }

    // Original MapView.updateWeather: weather overlay except cloudy (id 0).
    const weatherId = session.weatherId ?? 0;
    if (weatherId > 0)
    {
        const weatherFrame = `weather_${weatherId}.png`;
        if (hasFrame(ctx, 'weather', weatherFrame))
        {
            mapLayer.add(
                ctx.scene.add
                    .image(mapOriginX, mapOriginY, 'weather', weatherFrame)
                    .setOrigin(0, 0)
                    .setDisplaySize(drawW, drawH)
                    .setName('weather'),
            );
        }
    }

    // Cocos map bottom-left origin → Phaser top-left (no extra scale).
    const toScreen = (mapX: number, mapY: number) => ({
        x: mapOriginX + mapX,
        y: mapOriginY + (MAP_H - mapY),
    });

    type Marker = {
        siteId: number;
        root: GameObjects.Container;
        highlight: GameObjects.Image | null;
        setHighlight: (on: boolean) => void;
    };
    const markers = new Map<number, Marker>();
    let pathLine: GameObjects.Container | null = null;
    let actorImg: GameObjects.Image | GameObjects.Arc | null = null;
    let moving = false;
    let destroyed = false;

    for (const siteId of session.map.unlocked)
    {
        const cfg = getSiteConfig(siteId);
        if (!cfg)
        {
            continue;
        }
        const pos = toScreen(cfg.coordinate.x, cfg.coordinate.y);
        const isHome = siteId === HOME_SITE_ID;
        const bgFrame = isHome ? 'site_big_bg.png' : 'site_bg.png';
        const hlFrame = isHome ? 'site_highlight_big_bg.png' : 'site_highlight_bg.png';
        const iconFrame = `site_${siteId}.png`;

        const marker = ctx.scene.add.container(pos.x, pos.y);
        mapLayer.add(marker);

        if (hasFrame(ctx, 'site', bgFrame))
        {
            marker.add(ctx.scene.add.image(0, 0, 'site', bgFrame));
        }
        else
        {
            marker.add(ctx.scene.add.circle(0, 0, isHome ? 55 : 28, 0xffffff));
        }

        let highlight: GameObjects.Image | null = null;
        if (hasFrame(ctx, 'site', hlFrame))
        {
            highlight = ctx.scene.add.image(0, 0, 'site', hlFrame).setVisible(false);
            marker.add(highlight);
        }

        if (hasFrame(ctx, 'site', iconFrame))
        {
            marker.add(ctx.scene.add.image(0, 0, 'site', iconFrame));
        }

        const hitR = isHome ? 55 : 28;
        const hit = ctx.scene.add
            .circle(0, 0, hitR, 0xffffff, 0.001)
            .setInteractive({ useHandCursor: true });
        marker.add(hit);

        const setHighlight = (on: boolean) =>
        {
            highlight?.setVisible(on);
        };

        hit.on('pointerdown', () =>
        {
            if (!moving)
            {
                setHighlight(true);
            }
        });
        hit.on('pointerout', () =>
        {
            if (!moving)
            {
                setHighlight(false);
            }
        });
        hit.on('pointerup', () =>
        {
            if (moving)
            {
                return;
            }
            setHighlight(false);
            onSiteTap(siteId);
        });

        markers.set(siteId, { siteId, root: marker, highlight, setHighlight });
    }

    // Actor on top of markers (original red pin on current pos) — 1:1, no upscale.
    const actorPos = toScreen(session.map.pos.x, session.map.pos.y);
    if (hasFrame(ctx, 'map', 'map_actor.png'))
    {
        actorImg = ctx.scene.add.image(actorPos.x, actorPos.y, 'map', 'map_actor.png');
        mapLayer.add(actorImg);
    }
    else
    {
        actorImg = ctx.scene.add.circle(actorPos.x, actorPos.y, 8, 0xff0000);
        mapLayer.add(actorImg);
    }

    function clearPath (): void
    {
        pathLine?.destroy(true);
        pathLine = null;
    }

    /** Cocos MapView.makeLine — map_line.png tiles along vector, rotated. */
    function makeLine (start: { x: number; y: number }, end: { x: number; y: number }): void
    {
        clearPath();
        if (!hasFrame(ctx, 'map', 'map_line.png'))
        {
            return;
        }
        const dx = end.x - start.x;
        const dy = end.y - start.y;
        const length = Math.sqrt(dx * dx + dy * dy);
        if (length < 1)
        {
            return;
        }
        const num = Math.ceil(length / LINE_W);
        pathLine = ctx.scene.add.container(start.x, start.y);
        for (let i = 0; i < num; i++)
        {
            pathLine.add(
                ctx.scene.add
                    .image(i * LINE_W, 0, 'map', 'map_line.png')
                    .setOrigin(0, 0.5),
            );
        }
        // Cocos: angle from +x, y-up → clockwise when y≥0 uses 360−angle.
        // Phaser y-down: atan2(dy, dx) already screen-space degrees.
        const angleDeg = (Math.atan2(dy, dx) * 180) / Math.PI;
        pathLine.setAngle(angleDeg);
        mapLayer.add(pathLine);
        if (actorImg)
        {
            mapLayer.bringToTop(actorImg);
        }
    }

    function onSiteTap (siteId: number): void
    {
        const live = getSession();
        const cfg = getSiteConfig(siteId);
        if (!live || !cfg || moving)
        {
            return;
        }
        const dist = mapDistance(live.map.pos, cfg.coordinate);
        const seconds = Math.max(1, Math.round(travelTimeSeconds(dist)));
        const timeLabel = formatTravelTime(seconds);

        // Already standing on site — enter without dialog (same as near-zero dist).
        if (dist < 8)
        {
            enterSite(siteId);
            return;
        }

        showTravelDialog(siteId, cfg.name, cfg.des, timeLabel, () =>
        {
            startTravel(siteId);
        });
    }

    function startTravel (siteId: number): void
    {
        const live = getSession();
        const cfg = getSiteConfig(siteId);
        if (!live || !cfg || !actorImg || moving || destroyed)
        {
            return;
        }
        moving = true;
        markers.get(siteId)?.setHighlight(true);

        const from = { x: actorImg.x, y: actorImg.y };
        const to = toScreen(cfg.coordinate.x, cfg.coordinate.y);
        makeLine(from, to);

        // Visual trip length ≈ original dialog time scaled for UX (cap).
        const dist = mapDistance(live.map.pos, cfg.coordinate);
        const realSec = travelTimeSeconds(dist);
        const animMs = Math.min(2200, Math.max(450, realSec * 8));

        ctx.scene.tweens.add({
            targets: actorImg,
            x: to.x,
            y: to.y,
            duration: animMs,
            ease: 'Linear',
            onComplete: () =>
            {
                if (destroyed)
                {
                    return;
                }
                clearPath();
                markers.get(siteId)?.setHighlight(false);
                moving = false;
                if (!travelTo(siteId))
                {
                    ctx.showToast('无法前往');
                    return;
                }
                enterSite(siteId);
            },
        });
    }

    function showTravelDialog (
        siteId: number,
        name: string,
        des: string,
        timeLabel: string,
        onOk: () => void,
    ): void
    {
        const { width, height } = ctx.scene.scale;
        const overlay = ctx.scene.add.container(0, 0);
        overlay.setDepth(200);
        overlay.setName('mapTravelDialog');
        ctx.content.add(overlay);

        // Dim ~ Cocos LayerColor opacity 200
        overlay.add(
            ctx.scene.add
                .rectangle(width / 2, height / 2, width, height, 0x000000, 200 / 255)
                .setInteractive(),
        );

        // Same bottom-frame dialog placement as DialogBig / openStatusDialog.
        const cocosBgBottom = 29 + (839 - DIALOG_H) / 2;
        const bgBottomY = height - cocosBgBottom;
        const bgTopY = bgBottomY - DIALOG_H;
        const bgCenterX = width / 2;
        const bgCenterY = bgTopY + DIALOG_H / 2;
        const bgLeft = bgCenterX - DIALOG_W / 2;

        if (hasFrame(ctx, 'ui', DIALOG_FRAME))
        {
            overlay.add(
                ctx.scene.add
                    .image(bgCenterX, bgCenterY, 'ui', DIALOG_FRAME)
                    .setOrigin(0.5),
            );
        }
        else
        {
            overlay.add(
                ctx.scene.add
                    .rectangle(bgCenterX, bgCenterY, DIALOG_W, DIALOG_H, 0xe8e0d0)
                    .setStrokeStyle(2, 0x333333),
            );
        }

        const leftEdge = 20;
        const textLeft = bgLeft + leftEdge;
        const textWidth = DIALOG_W - leftEdge * 2;
        const titleBandH = 90;
        const actionBandH = 72;
        const titleY = bgTopY + titleBandH / 2;
        const contentTop = bgTopY + titleBandH;
        const contentBottom = bgBottomY - actionBandH;
        const actionY = bgBottomY - actionBandH / 2;

        // Title icon (site_*)
        const iconFrame = `site_${siteId}.png`;
        let titleTextX = textLeft;
        if (hasFrame(ctx, 'site', iconFrame))
        {
            const icon = ctx.scene.add
                .image(textLeft, titleY, 'site', iconFrame)
                .setOrigin(0, 0.5)
                .setScale(0.7);
            overlay.add(icon);
            titleTextX = textLeft + icon.displayWidth + 8;
        }

        overlay.add(
            ctx.scene.add
                .text(titleTextX, titleY - 10, name, {
                    fontFamily: UI_FONT_FAMILY,
                    resolution: UI_TEXT_RESOLUTION,
                    fontSize: `${UI_FONT_SIZE.COMMON_1}px`,
                    color: '#111111',
                })
                .setOrigin(0, 0.5),
        );

        // dig illustration (original dig_des scale 0.8)
        const digFrame = `site_dig_${siteId}.png`;
        let digBottom = contentTop + 12;
        if (hasFrame(ctx, 'site', digFrame))
        {
            const dig = ctx.scene.add
                .image(bgCenterX, contentTop + 8, 'site', digFrame)
                .setOrigin(0.5, 0)
                .setScale(0.8);
            overlay.add(dig);
            digBottom = dig.y + dig.displayHeight + 8;
        }

        // Description
        const desText = ctx.scene.add
            .text(textLeft, digBottom, des, {
                fontFamily: UI_FONT_FAMILY,
                resolution: UI_TEXT_RESOLUTION,
                fontSize: `${UI_FONT_SIZE.COMMON_3}px`,
                color: '#111111',
                wordWrap: uiWordWrap(textWidth),
            })
            .setOrigin(0, 0);
        overlay.add(desText);

        // Travel time (original log band)
        overlay.add(
            ctx.scene.add
                .text(textLeft, contentBottom - 28, `行程 ${timeLabel}`, {
                    fontFamily: UI_FONT_FAMILY,
                    resolution: UI_TEXT_RESOLUTION,
                    fontSize: `${UI_FONT_SIZE.COMMON_3}px`,
                    color: '#111111',
                })
                .setOrigin(0, 1),
        );

        const close = () => overlay.destroy(true);

        const cancel = addAtlasButton(ctx.scene, bgCenterX - 100, actionY, {
            atlas: 'ui',
            frame: 'btn_common_white_normal.png',
            label: '取消',
            onClick: close,
        });
        overlay.add(cancel);

        const ok = addAtlasButton(ctx.scene, bgCenterX + 100, actionY, {
            atlas: 'ui',
            frame: 'btn_common_black_normal.png',
            label: siteId === HOME_SITE_ID ? '回家' : '出发',
            labelColor: '#eee',
            onClick: () =>
            {
                close();
                onOk();
            },
        });
        overlay.add(ok);
    }

    function enterSite (siteId: number): void
    {
        if (siteId === HOME_SITE_ID)
        {
            const live = getSession();
            if (live && !live.isAtHome)
            {
                travelTo(HOME_SITE_ID);
            }
            ctx.rootTo(NavNode.HOME);
            return;
        }
        const live = getSession();
        if (!live || live.nowSiteId !== siteId)
        {
            travelTo(siteId);
        }
        ctx.forward(NavNode.SITE, siteId);
    }

    return {
        destroy: () =>
        {
            destroyed = true;
            clearPath();
            mask.destroy();
            maskShape.destroy();
        },
    };
}
