import { GameObjects, Scene } from 'phaser';
import {
    createNewSession,
    type RoleKey as SessionRole,
    type TalentId as SessionTalent,
} from '../session/sessionStore';
import { getLanguage, type LangCode, t } from '../settings/settingsStore';
import { isRoleLuoUnlocked, isRoleYaziUnlocked, isTalentIapUnlocked } from '../systems/iapStore';
import { type AtlasButton, addAtlasButton } from '../ui/atlasButton';
import { UI_FONT_FAMILY, UI_TEXT_RESOLUTION, uiWordWrap } from '../ui/uiFont';

/**
 * Port of Buried-City ChooseScene.js / ChooseLayer + SlideView.
 *
 * Design: 640×1136 FIXED_HEIGHT.
 * Cocos bottom-left y → Phaser top-left: phaserY = height - cocosY.
 *
 * Roles / talents unlock via main-menu shop IAP (108/109, 101–104).
 */

type TalentId = 0 | 101 | 102 | 103 | 104;
type RoleKey = 'STRANGER' | 'LUO' | 'YAZI' | 'LOCKED';

/** Original RoleType ids used as npc_dig_*.png keys. */
const ROLE_NPC_ID: Record<Exclude<RoleKey, 'LOCKED'>, number> = {
    STRANGER: 6,
    LUO: 1,
    YAZI: 4,
};

const TALENT_IDS: TalentId[] = [0, 101, 102, 103, 104];

type RoleSlide = {
    key: RoleKey;
    digId: number;
    nameKey: string;
    desKey: string;
    unlocked: boolean;
};

type TalentNode = {
    id: TalentId;
    unlocked: boolean;
    root: GameObjects.Container;
    mark: GameObjects.Image | null;
};

export class ChooseScene extends Scene {
    private chosenTalent: TalentId = 0;
    private chosenRoleIndex = 0;
    private roleSlides: RoleSlide[] = [];
    private confirmBtn: AtlasButton | null = null;
    private slideTrack: GameObjects.Container | null = null;
    /** Name/title layer above frame_role_choose; x mirrors slideTrack. */
    private slideLabelTrack: GameObjects.Container | null = null;
    private indicatorDots: GameObjects.Image[] = [];
    private talentNodes: TalentNode[] = [];
    private isDraggingSlide = false;
    private dragStartX = 0;
    private trackStartX = 0;
    private cellWidth = 200;

    constructor() {
        super('Choose');
    }

    create() {
        const { width, height } = this.scale;
        const lan = getLanguage();
        const toPhaserY = (cocosY: number) => height - cocosY;
        const centerX = width / 2;

        this.chosenTalent = 0;
        this.chosenRoleIndex = 0;
        this.confirmBtn = null;
        this.slideTrack = null;
        this.slideLabelTrack = null;
        this.indicatorDots = [];
        this.talentNodes = [];
        this.isDraggingSlide = false;

        this.add.rectangle(centerX, height / 2, width, height, 0x050505);

        // titleRole: Cocos y = height - 50 → Phaser y = 50
        this.add
            .text(centerX, 50, t('chooseRole', lan), {
                fontFamily: UI_FONT_FAMILY,
                resolution: UI_TEXT_RESOLUTION,
                fontSize: '28px',
                color: '#ffffff',
            })
            .setOrigin(0.5, 0.5);

        this.roleSlides = this.buildRoleSlides();
        this.buildRoleSlider(centerX, toPhaserY(870), lan);

        // talent title: Cocos y = 616
        this.add
            .text(centerX, toPhaserY(616), t('chooseTalent', lan), {
                fontFamily: UI_FONT_FAMILY,
                resolution: UI_TEXT_RESOLUTION,
                fontSize: '26px',
                color: '#ffffff',
            })
            .setOrigin(0.5);

        this.buildTalentGrid(width, toPhaserY, lan);

        // buttons: Cocos y = 60
        const btnY = toPhaserY(60);
        addAtlasButton(this, width / 4, btnY, {
            atlas: 'ui',
            frame: 'btn_common_white_normal.png',
            label: t('back', lan),
            onClick: () => this.scene.start('MainMenu'),
        });
        this.confirmBtn = addAtlasButton(this, (width * 3) / 4, btnY, {
            atlas: 'ui',
            frame: 'btn_common_white_normal.png',
            label: t('confirm', lan),
            onClick: () => this.confirm(),
        });

        this.applyRoleIndex(0, false);
    }

    private buildRoleSlides(): RoleSlide[] {
        // Stranger free; Luo/Yazi via IAP 108/109 (shop).
        return [
            {
                key: 'STRANGER',
                digId: ROLE_NPC_ID.STRANGER,
                nameKey: 'role_stranger_name',
                desKey: 'role_stranger_des',
                unlocked: true,
            },
            {
                key: 'LUO',
                digId: ROLE_NPC_ID.LUO,
                nameKey: 'role_luo_name',
                desKey: 'role_luo_des',
                unlocked: isRoleLuoUnlocked(),
            },
            {
                key: 'YAZI',
                digId: ROLE_NPC_ID.YAZI,
                nameKey: 'role_yazi_name',
                desKey: 'role_yazi_des',
                unlocked: isRoleYaziUnlocked(),
            },
            {
                key: 'LOCKED',
                digId: 0,
                nameKey: 'roleComingSoon',
                desKey: 'roleComingSoonDes',
                unlocked: false,
            },
        ];
    }

    /**
     * Horizontal snap carousel (SlideView).
     * Original: size min(600, layoutWidth) × 320, center, y = 870 (Cocos).
     * 3 visible cells; center cell framed by frame_role_choose + side masks.
     */
    private buildRoleSlider(centerX: number, centerY: number, lan: LangCode): void {
        const viewWidth = Math.min(600, this.scale.width);
        // Slightly taller than Cocos 320 so name/title gutters exist outside the
        // 256px frame_role_choose bars.
        const viewHeight = 360;
        this.cellWidth = viewWidth / 3;

        const root = this.add.container(centerX, centerY);

        // Portrait track (clipped). Frame draws above this.
        const maskRect = this.add
            .rectangle(centerX, centerY, viewWidth, viewHeight, 0xffffff)
            .setVisible(false);

        const track = this.add.container(0, 0);
        track.enableFilters();
        if (track.filters) {
            track.filters.internal.addMask(maskRect, false, this.cameras.main, 'world');
        }
        root.add(track);
        this.slideTrack = track;

        // Labels track: same x as portrait track, drawn ABOVE the red frame so
        // name / title are never covered by frame_role_choose solid bars.
        const labelTrack = this.add.container(0, 0);
        this.slideLabelTrack = labelTrack;

        this.roleSlides.forEach((slide, index) => {
            const cellX = index * this.cellWidth;
            const portrait = this.buildRolePortrait(slide);
            portrait.x = cellX;
            track.add(portrait);

            const labels = this.buildRoleLabels(slide, lan);
            labels.x = cellX;
            labelTrack.add(labels);
        });

        // Side dim masks + center frame (above portraits, below labels)
        const frameW =
            this.textures.exists('ui') && this.textures.get('ui').has('frame_role_choose.png')
                ? this.textures.get('ui').get('frame_role_choose.png').width
                : 166;
        const sideMaskW = Math.max(0, (viewWidth - frameW) / 2);

        if (sideMaskW > 0) {
            root.add(
                this.add
                    .rectangle(
                        -viewWidth / 2 + sideMaskW / 2,
                        0,
                        sideMaskW,
                        viewHeight,
                        0x000000,
                        200 / 255,
                    )
                    .setOrigin(0.5),
            );
            root.add(
                this.add
                    .rectangle(
                        viewWidth / 2 - sideMaskW / 2,
                        0,
                        sideMaskW,
                        viewHeight,
                        0x000000,
                        200 / 255,
                    )
                    .setOrigin(0.5),
            );
        }

        if (this.textures.exists('ui') && this.textures.get('ui').has('frame_role_choose.png')) {
            root.add(this.add.image(0, 0, 'ui', 'frame_role_choose.png'));
        } else {
            root.add(this.add.rectangle(0, 0, 166, 256).setStrokeStyle(2, 0xf0e6d2));
        }

        // Labels after frame so they always win z-order
        root.add(labelTrack);

        // Page indicators under slider
        const indicatorY = viewHeight / 2 + 20;
        const roleCount = this.roleSlides.length;
        const indicatorSpacing = 20;
        const indicatorTotalW = roleCount * indicatorSpacing;
        for (let i = 0; i < roleCount; i++) {
            const dotX = -indicatorTotalW / 2 + indicatorSpacing / 2 + i * indicatorSpacing;
            if (
                this.textures.exists('ui') &&
                this.textures.get('ui').has('page_view_indicator_1.png')
            ) {
                const bg = this.add.image(dotX, indicatorY, 'ui', 'page_view_indicator_1.png');
                root.add(bg);
                let active: GameObjects.Image | null = null;
                if (this.textures.get('ui').has('page_view_indicator_2.png')) {
                    active = this.add.image(dotX, indicatorY, 'ui', 'page_view_indicator_2.png');
                    root.add(active);
                }
                this.indicatorDots.push(active ?? bg);
            } else {
                const fallback = this.add.circle(dotX, indicatorY, 5, 0x666666);
                root.add(fallback);
                this.indicatorDots.push(fallback as unknown as GameObjects.Image);
            }
        }

        // Drag / swipe hit area covering the viewport
        const hit = this.add
            .rectangle(0, 0, viewWidth, viewHeight, 0x000000, 0)
            .setInteractive({ useHandCursor: true });
        root.add(hit);

        const onPointerMove = (pointer: Phaser.Input.Pointer) => {
            if (!this.isDraggingSlide || !this.slideTrack) {
                return;
            }
            const deltaX = pointer.x - this.dragStartX;
            const nextX = this.trackStartX + deltaX;
            this.slideTrack.x = nextX;
            if (this.slideLabelTrack) {
                this.slideLabelTrack.x = nextX;
            }
        };

        const onPointerEnd = () => {
            if (!this.isDraggingSlide) {
                return;
            }
            this.isDraggingSlide = false;
            this.snapToNearestRole();
        };

        hit.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
            this.isDraggingSlide = true;
            this.dragStartX = pointer.x;
            this.trackStartX = this.slideTrack?.x ?? 0;
        });

        this.input.on('pointermove', onPointerMove);
        this.input.on('pointerup', onPointerEnd);
        this.input.on('pointerupoutside', onPointerEnd);

        this.events.once('shutdown', () => {
            this.input.off('pointermove', onPointerMove);
            this.input.off('pointerup', onPointerEnd);
            this.input.off('pointerupoutside', onPointerEnd);
        });
    }

    /** Portrait + lock only (under frame). */
    private buildRolePortrait(slide: RoleSlide): GameObjects.Container {
        const cell = this.add.container(0, 0);

        let headerBg: GameObjects.Image | GameObjects.Rectangle;
        if (this.textures.exists('ui') && this.textures.get('ui').has('role_bg.png')) {
            headerBg = this.add.image(0, 0, 'ui', 'role_bg.png');
            cell.add(headerBg);
        } else {
            headerBg = this.add.rectangle(0, 0, 134, 224, 0x2a2a2a);
            cell.add(headerBg);
        }

        const digFrame = `npc_dig_${slide.digId}.png`;
        if (this.textures.exists('npc') && this.textures.get('npc').has(digFrame)) {
            const portrait = this.add.image(0, 0, 'npc', digFrame).setScale(0.8);
            if (!slide.unlocked) {
                portrait.setAlpha(0.55);
            }
            cell.add(portrait);
        }

        if (
            !slide.unlocked &&
            this.textures.exists('icon') &&
            this.textures.get('icon').has('icon_iap_lock.png')
        ) {
            const lock = this.add
                .image(
                    headerBg.width * 0.5 - 12,
                    -headerBg.height * 0.5 + 12,
                    'icon',
                    'icon_iap_lock.png',
                )
                .setScale(0.45)
                .setOrigin(1, 0);
            cell.add(lock);
        }

        return cell;
    }

    /**
     * Name + title above frame_role_choose.
     * frame half-height 128; solid bars ~16–20px; place text just outside bars.
     */
    private buildRoleLabels(slide: RoleSlide, lan: LangCode): GameObjects.Container {
        const cell = this.add.container(0, 0);
        const name = t(slide.nameKey, lan);
        const des = slide.key === 'LOCKED' ? t('roleComingSoon', lan) : t(slide.desKey, lan);

        // frame_role_choose half-height 128 + solid bar ~18px → keep text
        // fully clear of the bars (Chinese glyphs need ~10–12px half-height).
        const nameY = -158;
        const desY = 158;

        cell.add(
            this.add
                .text(0, nameY, name, {
                    fontFamily: UI_FONT_FAMILY,
                    resolution: UI_TEXT_RESOLUTION,
                    fontSize: '18px',
                    color: '#ffffff',
                    align: 'center',
                    wordWrap: uiWordWrap(this.cellWidth - 12),
                    stroke: '#000000',
                    strokeThickness: 3,
                })
                .setOrigin(0.5),
        );

        cell.add(
            this.add
                .text(0, desY, des, {
                    fontFamily: UI_FONT_FAMILY,
                    resolution: UI_TEXT_RESOLUTION,
                    fontSize: '16px',
                    color: '#dddddd',
                    align: 'center',
                    wordWrap: uiWordWrap(this.cellWidth - 12),
                    stroke: '#000000',
                    strokeThickness: 3,
                })
                .setOrigin(0.5),
        );

        return cell;
    }

    private snapToNearestRole(): void {
        if (!this.slideTrack) {
            return;
        }

        const rawIndex = -this.slideTrack.x / this.cellWidth;
        const nearest = Math.max(0, Math.min(this.roleSlides.length - 1, Math.round(rawIndex)));
        this.applyRoleIndex(nearest, true);
    }

    private applyRoleIndex(index: number, animate: boolean): void {
        this.chosenRoleIndex = index;
        const targetX = -index * this.cellWidth;

        const tracks = [this.slideTrack, this.slideLabelTrack].filter(
            (track): track is GameObjects.Container => track !== null,
        );

        if (tracks.length > 0) {
            if (animate) {
                this.tweens.add({
                    targets: tracks,
                    x: targetX,
                    duration: 180,
                    ease: 'Cubic.easeOut',
                });
            } else {
                tracks.forEach((track) => {
                    track.x = targetX;
                });
            }
        }

        this.indicatorDots.forEach((dot, i) => {
            const imageDot = dot as GameObjects.Image;
            const isActiveLayer =
                this.textures.exists('ui') &&
                this.textures.get('ui').has('page_view_indicator_2.png') &&
                imageDot.frame?.name === 'page_view_indicator_2.png';

            if (isActiveLayer) {
                imageDot.setVisible(i === index);
            } else if (
                !this.textures.exists('ui') ||
                !this.textures.get('ui').has('page_view_indicator_2.png')
            ) {
                (dot as unknown as GameObjects.Arc).setFillStyle(i === index ? 0xf0e6d2 : 0x666666);
            }
        });

        const slide = this.roleSlides[index];
        this.setConfirmEnabled(Boolean(slide?.unlocked));
    }

    private setConfirmEnabled(enabled: boolean): void {
        if (!this.confirmBtn) {
            return;
        }

        const image = this.confirmBtn.list.find((child) => child instanceof GameObjects.Image) as
            | GameObjects.Image
            | undefined;
        if (!image) {
            return;
        }

        image.setAlpha(enabled ? 1 : 0.45);
        if (enabled) {
            image.setInteractive({ useHandCursor: true });
        } else {
            image.disableInteractive();
        }
    }

    /**
     * Talent grid: 3 on first row, 2 on second (ButtonAtChooseScene layout).
     * NODE 181×196; title at Cocos y=616.
     */
    private buildTalentGrid(
        layoutWidth: number,
        toPhaserY: (cocosY: number) => number,
        lan: LangCode,
    ): void {
        const nodeWidth = 181;
        const nodeHeight = 196;
        const widthPadding = (layoutWidth - 3 * nodeWidth) / 4;
        const widthPadding2 = (layoutWidth - 2 * nodeWidth) / 3;
        const heightPadding = 50;
        const titleCocosY = 616;

        TALENT_IDS.forEach((talentId, index) => {
            const unlocked = isTalentIapUnlocked(talentId);
            let cocosX: number;
            let cocosY: number;

            if (index < 3) {
                cocosX = widthPadding + (index % 3) * (widthPadding + nodeWidth) + nodeWidth / 2;
                cocosY = titleCocosY - 80 - 10 - nodeHeight / 2;
            } else {
                cocosX =
                    widthPadding2 + ((index - 3) % 2) * (widthPadding2 + nodeWidth) + nodeWidth / 2;
                cocosY = titleCocosY - 80 - (10 + (heightPadding + nodeHeight)) - nodeHeight / 2;
            }

            const node = this.buildTalentNode(cocosX, toPhaserY(cocosY), talentId, unlocked, lan);
            this.talentNodes.push(node);
        });

        this.setTalentChecked(0);
    }

    private buildTalentNode(
        x: number,
        y: number,
        talentId: TalentId,
        unlocked: boolean,
        lan: LangCode,
    ): TalentNode {
        const root = this.add.container(x, y);
        const iconFrame = `icon_iap_${talentId}.png`;
        const opacity = unlocked ? 1 : 0.5;

        root.add(
            this.add
                .text(0, -110, t(`talent_${talentId}`, lan), {
                    fontFamily: UI_FONT_FAMILY,
                    resolution: UI_TEXT_RESOLUTION,
                    fontSize: '18px',
                    color: unlocked ? '#eeeeee' : '#666666',
                })
                .setOrigin(0.5),
        );

        if (this.textures.exists('icon') && this.textures.get('icon').has('icon_iap_bg.png')) {
            root.add(
                this.add.image(0, 5, 'icon', 'icon_iap_bg.png').setScale(0.9).setAlpha(opacity),
            );
        } else if (
            this.textures.exists('ui') &&
            this.textures.get('ui').has('frame_iap_bg_talent.png')
        ) {
            root.add(
                this.add
                    .image(0, 5, 'ui', 'frame_iap_bg_talent.png')
                    .setScale(0.55)
                    .setAlpha(opacity),
            );
        }

        if (this.textures.exists('icon') && this.textures.get('icon').has(iconFrame)) {
            root.add(this.add.image(0, 5, 'icon', iconFrame).setScale(0.9).setAlpha(opacity));
        } else {
            root.add(this.add.circle(0, 5, 48, unlocked ? 0x555555 : 0x333333));
        }

        let mark: GameObjects.Image | null = null;
        if (this.textures.exists('icon') && this.textures.get('icon').has('icon_iap_mark.png')) {
            mark = this.add.image(0, 5, 'icon', 'icon_iap_mark.png').setVisible(false);
            root.add(mark);
        }

        if (
            !unlocked &&
            this.textures.exists('icon') &&
            this.textures.get('icon').has('icon_iap_lock.png')
        ) {
            root.add(this.add.image(0, 5, 'icon', 'icon_iap_lock.png'));
        }

        const hit = this.add
            .rectangle(0, 5, 160, 170, 0x000000, 0)
            .setInteractive({ useHandCursor: true });
        root.add(hit);

        hit.on('pointerdown', () => {
            if (!unlocked) {
                this.showLockedTalentDialog(lan);
                return;
            }
            this.chosenTalent = talentId;
            this.setTalentChecked(talentId);
        });

        return { id: talentId, unlocked, root, mark };
    }

    private setTalentChecked(talentId: TalentId): void {
        this.talentNodes.forEach((node) => {
            node.mark?.setVisible(node.id === talentId && node.unlocked);
        });
    }

    private showLockedTalentDialog(lan: LangCode): void {
        const { width, height } = this.scale;
        const overlay = this.add.container(0, 0);
        overlay.setDepth(100);

        const dim = this.add
            .rectangle(width / 2, height / 2, width, height, 0x000000, 0.55)
            .setInteractive();
        overlay.add(dim);

        if (this.textures.exists('ui') && this.textures.get('ui').has('dialog_tiny_bg.png')) {
            overlay.add(this.add.image(width / 2, height / 2, 'ui', 'dialog_tiny_bg.png'));
        } else if (
            this.textures.exists('ui') &&
            this.textures.get('ui').has('dialog_small_bg.png')
        ) {
            overlay.add(this.add.image(width / 2, height / 2, 'ui', 'dialog_small_bg.png'));
        } else {
            overlay.add(this.add.rectangle(width / 2, height / 2, 420, 220, 0xf2efe6));
        }

        overlay.add(
            this.add
                .text(width / 2, height / 2 - 36, t('talentLocked', lan), {
                    fontFamily: UI_FONT_FAMILY,
                    resolution: UI_TEXT_RESOLUTION,
                    fontSize: '18px',
                    color: '#222222',
                    wordWrap: uiWordWrap(340),
                    align: 'center',
                })
                .setOrigin(0.5),
        );

        const closeDialog = () => overlay.destroy(true);

        // Original DialogCommon always uses createCommonBtnBlack (black bg, white label).
        const makeDialogBtn = (btnX: number, label: string, onClick: () => void) => {
            if (
                this.textures.exists('ui') &&
                this.textures.get('ui').has('btn_common_black_normal.png')
            ) {
                const btn = addAtlasButton(this, btnX, height / 2 + 55, {
                    atlas: 'ui',
                    frame: 'btn_common_black_normal.png',
                    label,
                    labelColor: '#f5f0e6',
                    labelSizeTier: 'COMMON_2',
                    onClick,
                });
                overlay.add(btn);
                return;
            }

            const bg = this.add
                .rectangle(btnX, height / 2 + 55, 120, 40, 0x111111)
                .setInteractive({ useHandCursor: true });
            overlay.add(bg);
            overlay.add(
                this.add
                    .text(btnX, height / 2 + 55, label, {
                        fontFamily: UI_FONT_FAMILY,
                        resolution: UI_TEXT_RESOLUTION,
                        fontSize: '20px',
                        color: '#f5f0e6',
                    })
                    .setOrigin(0.5),
            );
            bg.on('pointerup', onClick);
        };

        makeDialogBtn(width / 2 - 90, t('cancel', lan), closeDialog);
        // Jump to shop for unlock (original unlockIt → ShopScene)
        makeDialogBtn(width / 2 + 90, t('unlockIt', lan), () => {
            closeDialog();
            this.scene.start('Shop');
        });
    }

    private confirm(): void {
        const slide = this.roleSlides[this.chosenRoleIndex];
        if (!slide?.unlocked) {
            return;
        }

        const roleKey = (slide.key === 'LOCKED' ? 'STRANGER' : slide.key) as SessionRole;
        this.registry.set('chosenTalent', this.chosenTalent);
        this.registry.set('chosenRole', roleKey);
        createNewSession(roleKey, this.chosenTalent as SessionTalent);
        this.scene.start('Story');
    }
}
