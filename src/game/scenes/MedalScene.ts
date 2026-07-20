import { Scene } from 'phaser';
import { addAtlasButton } from '../ui/atlasButton';
import {
    getCompletedMedalId,
    getMedalMap,
    getNowMedalId,
    getStarFrameForMedal,
    initMedal,
    markMedalWarned,
    type MedalId,
    type MedalSeriesIndex,
} from '../medal/medalStore';
import { getLanguage, t, type LangCode } from '../settings/settingsStore';
import { UI_FONT_FAMILY, UI_TEXT_RESOLUTION, uiWordWrap } from '../ui/uiFont';

/**
 * Port of Buried-City medalLayer / medalScene.
 *
 * Cocos bottom-left y → Phaser top-left: phaserY = height - cocosY.
 * Each series is a medalNode at cocosY = 750 / 470 / 190; children are relative.
 */
export class MedalScene extends Scene
{
    constructor ()
    {
        super('Medal');
    }

    create ()
    {
        initMedal();

        const { width, height } = this.scale;
        const lan = getLanguage();
        // Convert Cocos (bottom-left origin) absolute y to Phaser (top-left) y
        const toPhaserY = (cocosY: number) => height - cocosY;

        if (this.textures.exists('medal') && this.textures.get('medal').has('medalBg.png'))
        {
            this.add.image(width / 2, height / 2, 'medal', 'medalBg.png');
        }
        else
        {
            this.add.rectangle(width / 2, height / 2, width, height, 0xcfc6b4);
        }

        // title Cocos y = 1070
        this.add
            .text(width / 2, toPhaserY(1070), t('medalWall', lan), {
                fontFamily: UI_FONT_FAMILY, resolution: UI_TEXT_RESOLUTION,
                fontSize: '48px',
                color: '#111111',
            })
            .setOrigin(0.5);

        // medalNode.y = 750, 470, 190
        ([1, 2, 3] as MedalSeriesIndex[]).forEach((seriesIndex, rowIndex) =>
        {
            const nodeCocosY = 750 - rowIndex * 280;
            this.placeMedalNode(seriesIndex, nodeCocosY, lan, toPhaserY);
        });

        // back button Cocos y = 50 (near bottom)
        const hasBlack = this.textures.exists('ui')
            && this.textures.get('ui').has('btn_common_black_normal.png');
        const backFrame = hasBlack ? 'btn_common_black_normal.png' : 'btn_big_white_normal.png';

        if (this.textures.exists('ui') && this.textures.get('ui').has(backFrame))
        {
            addAtlasButton(this, width / 2, toPhaserY(50), {
                atlas: 'ui',
                frame: backFrame,
                label: t('back', lan),
                labelColor: hasBlack ? '#f5f0e6' : '#111111',
                onClick: () =>
                {
                    this.scene.start('MainMenu');
                },
            });
        }
        else
        {
            const fallback = this.add
                .rectangle(width / 2, toPhaserY(50), 280, 56, 0x222222)
                .setInteractive({ useHandCursor: true });
            this.add
                .text(width / 2, toPhaserY(50), t('back', lan), {
                    fontFamily: UI_FONT_FAMILY, resolution: UI_TEXT_RESOLUTION,
                    fontSize: '20px',
                    color: '#f5f0e6',
                })
                .setOrigin(0.5);
            fallback.on('pointerup', () => this.scene.start('MainMenu'));
        }
    }

    private placeMedalNode (
        seriesIndex: MedalSeriesIndex,
        nodeCocosY: number,
        lan: LangCode,
        toPhaserY: (cocosY: number) => number,
    ): void
    {
        const map = getMedalMap();
        const nowMedalId = getNowMedalId(seriesIndex);
        const medalInfo = map[nowMedalId];
        const strings = this.medalStrings(nowMedalId, lan);
        const leftEdge = 50;

        // Absolute Cocos position → Phaser
        const absX = (localX: number) => leftEdge + localX;
        const absY = (localCocosY: number) => toPhaserY(nodeCocosY + localCocosY);

        // Icon at local (75, 128)
        const iconFrame = `medalIcon_${seriesIndex}.png`;
        if (this.textures.exists('medal') && this.textures.get('medal').has(iconFrame))
        {
            const icon = this.add.image(absX(75), absY(128), 'medal', iconFrame);

            const completedId = getCompletedMedalId(seriesIndex);
            if (completedId)
            {
                const completedInfo = map[completedId];
                if (completedInfo.completed === 1 && !completedInfo.warned)
                {
                    markMedalWarned(completedId);
                    if (this.textures.get('medal').has('medalWarn.png'))
                    {
                        // Cocos: (icon.width, icon.height - 10) from icon bottom-left
                        this.add
                            .image(
                                icon.x + icon.displayWidth * 0.5,
                                icon.y - icon.displayHeight * 0.5 + 10,
                                'medal',
                                'medalWarn.png',
                            )
                            .setOrigin(1, 0);
                    }
                }
            }
        }

        // Stars under icon local (75, 16)
        const starFrame = getStarFrameForMedal(nowMedalId, medalInfo.completed === 1);
        if (this.textures.exists('medal') && this.textures.get('medal').has(starFrame))
        {
            this.add.image(absX(75), absY(16), 'medal', starFrame);
        }

        // Progress label local (490, 189)
        const progressRatio = Math.min(1, medalInfo.aimCompleted / Math.max(1, medalInfo.aim));
        this.add
            .text(absX(490), absY(189), `${medalInfo.aimCompleted}/${medalInfo.aim}`, {
                fontFamily: UI_FONT_FAMILY, resolution: UI_TEXT_RESOLUTION,
                fontSize: '16px',
                color: '#111111',
            })
            .setOrigin(0.5);

        // Progress bar local (218, 160), left-anchored
        const barX = absX(218);
        const barY = absY(160);
        if (this.textures.exists('ui') && this.textures.get('ui').has('pb_bg.png'))
        {
            const pbBg = this.add.image(barX, barY, 'ui', 'pb_bg.png').setOrigin(0, 0.5);
            if (this.textures.get('ui').has('pb.png') && progressRatio > 0)
            {
                const fill = this.add.image(barX, barY, 'ui', 'pb.png').setOrigin(0, 0.5);
                fill.setCrop(0, 0, Math.max(1, fill.width * progressRatio), fill.height);
            }
            else if (progressRatio > 0)
            {
                this.add
                    .rectangle(
                        barX,
                        barY,
                        Math.max(4, pbBg.displayWidth * progressRatio),
                        12,
                        0x3a7a3a,
                    )
                    .setOrigin(0, 0.5);
            }
        }
        else
        {
            const barWidth = 280;
            this.add.rectangle(barX, barY, barWidth, 14, 0xbbbbbb).setOrigin(0, 0.5);
            this.add
                .rectangle(barX, barY, Math.max(2, barWidth * progressRatio), 14, 0x3a7a3a)
                .setOrigin(0, 0.5);
        }

        // Title / condition / des stacked from local (218, 120), top-left anchor
        const textX = absX(218);
        let textY = absY(120);

        const title = this.add
            .text(textX, textY, strings.name, {
                fontFamily: UI_FONT_FAMILY,
                resolution: UI_TEXT_RESOLUTION,
                fontSize: '18px',
                color: '#111111',
                wordWrap: uiWordWrap(320),
            })
            .setOrigin(0, 0);
        textY += title.height + 4;

        const condition = this.add
            .text(textX, textY, strings.condition, {
                fontFamily: UI_FONT_FAMILY,
                resolution: UI_TEXT_RESOLUTION,
                fontSize: '16px',
                color: '#111111',
                wordWrap: uiWordWrap(320),
            })
            .setOrigin(0, 0);
        textY += condition.height + 4;

        this.add
            .text(textX, textY, strings.des, {
                fontFamily: UI_FONT_FAMILY,
                resolution: UI_TEXT_RESOLUTION,
                fontSize: '16px',
                color: '#333333',
                wordWrap: uiWordWrap(320),
            })
            .setOrigin(0, 0);
    }

    private medalStrings (
        medalId: MedalId,
        lan: LangCode,
    ): { name: string; condition: string; des: string }
    {
        return {
            name: t(`m_${medalId}_name`, lan),
            condition: t(`m_${medalId}_condition`, lan),
            des: t(`m_${medalId}_des`, lan),
        };
    }
}
