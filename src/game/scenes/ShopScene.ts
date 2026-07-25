import { type GameObjects, Scene } from 'phaser';
import { getPurchaseConfig, type PermanentIapId, SHOP_PERMANENT_IDS } from '../data/purchaseList';
import { getLanguage, type LangCode, t } from '../settings/settingsStore';
import { isIapUnlocked } from '../systems/iapStore';
import { addAtlasButton } from '../ui/atlasButton';
import { openPayDialog } from '../ui/payDialog';
import { UI_FONT_FAMILY, UI_FONT_SIZE, UI_TEXT_RESOLUTION, uiWordWrap } from '../ui/uiFont';

/**
 * Port of Buried-City ShopScene / ShopLayer (main-menu permanent IAP list).
 *
 * Layout (design 640×1136):
 *   NODE 246×249, 2-col scroll of [108,109,101–107]
 *   bottom: Return (web hides Restore like Android)
 */

const NODE_WIDTH = 246;
const NODE_HEIGHT = 249;
const HEIGHT_PADDING = 10;
const SCROLL_TOP = 80;
const SCROLL_BOTTOM = 120;

type PayCard = {
    purchaseId: PermanentIapId;
    root: GameObjects.Container;
    unlockLabel: GameObjects.Text;
    priceLabel: GameObjects.Text;
};

export class ShopScene extends Scene {
    private cards: PayCard[] = [];
    private scrollRoot: GameObjects.Container | null = null;
    private scrollMask: GameObjects.Graphics | null = null;
    private scrollY = 0;
    private minScrollY = 0;
    private maxScrollY = 0;
    private dragging = false;
    private dragStartY = 0;
    private scrollStartY = 0;
    private dragMoved = false;
    private pointerDownY = 0;

    constructor() {
        super('Shop');
    }

    create() {
        this.cards = [];
        this.scrollRoot = null;
        this.scrollMask = null;
        this.scrollY = 0;
        this.dragging = false;
        this.dragMoved = false;
        this.pointerDownY = 0;

        const { width, height } = this.scale;
        const lan = getLanguage();

        this.add.rectangle(width / 2, height / 2, width, height, 0x1a1a1a);

        this.add
            .text(width / 2, 42, t('shop', lan), {
                fontFamily: UI_FONT_FAMILY,
                resolution: UI_TEXT_RESOLUTION,
                fontSize: `${UI_FONT_SIZE.COMMON_1}px`,
                color: '#f0e6d2',
            })
            .setOrigin(0.5);

        const layoutWidth = width;
        const widthPadding = (layoutWidth - 2 * NODE_WIDTH) / 3;
        const rowCount = Math.ceil(SHOP_PERMANENT_IDS.length / 2);
        const totalHeight = NODE_HEIGHT * rowCount + HEIGHT_PADDING * (rowCount - 1);
        const viewHeight = height - SCROLL_TOP - SCROLL_BOTTOM;
        const viewWidth = layoutWidth - 2 * widthPadding;
        const viewX = widthPadding;
        const viewY = SCROLL_TOP;

        this.scrollRoot = this.add.container(viewX, viewY);
        this.cards = SHOP_PERMANENT_IDS.map((purchaseId, index) => {
            const col = index % 2;
            const row = Math.floor(index / 2);
            const x = col * (widthPadding + NODE_WIDTH) + NODE_WIDTH / 2;
            const y = row * (HEIGHT_PADDING + NODE_HEIGHT) + NODE_HEIGHT / 2;
            return this.buildPayCard(purchaseId, x, y, lan);
        });

        this.scrollMask = this.make.graphics({ x: 0, y: 0 });
        this.scrollMask.fillStyle(0xffffff);
        this.scrollMask.fillRect(viewX, viewY, viewWidth, viewHeight);
        this.scrollRoot.setMask(this.scrollMask.createGeometryMask());

        this.maxScrollY = 0;
        this.minScrollY = Math.min(0, viewHeight - totalHeight);
        this.scrollY = this.maxScrollY;
        this.scrollRoot.y = viewY + this.scrollY;

        // Transparent drag plane under cards — cards keep click priority via depth.
        const dragPlane = this.add
            .rectangle(
                viewX + viewWidth / 2,
                viewY + viewHeight / 2,
                viewWidth,
                viewHeight,
                0x000000,
                0,
            )
            .setInteractive();
        dragPlane.setDepth(1);
        this.scrollRoot.setDepth(2);

        dragPlane.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
            this.dragging = true;
            this.dragMoved = false;
            this.dragStartY = pointer.y;
            this.pointerDownY = pointer.y;
            this.scrollStartY = this.scrollY;
        });

        const onMove = (pointer: Phaser.Input.Pointer) => {
            if (!this.dragging || !this.scrollRoot) {
                return;
            }
            if (Math.abs(pointer.y - this.pointerDownY) > 8) {
                this.dragMoved = true;
            }
            this.setScrollY(this.scrollStartY + (pointer.y - this.dragStartY));
        };
        const onUp = () => {
            this.dragging = false;
        };

        this.input.on('pointermove', onMove);
        this.input.on('pointerup', onUp);
        this.input.on('pointerupoutside', onUp);

        const onWheel = (
            _pointer: Phaser.Input.Pointer,
            _gos: unknown,
            _dx: number,
            dy: number,
        ) => {
            this.setScrollY(this.scrollY - dy * 0.5);
        };
        this.input.on('wheel', onWheel);

        this.events.once('shutdown', () => {
            this.input.off('pointermove', onMove);
            this.input.off('pointerup', onUp);
            this.input.off('pointerupoutside', onUp);
            this.input.off('wheel', onWheel);
            this.scrollMask?.destroy();
        });

        // Return — Android layout: single centered back button
        const backY = height - 60;
        if (
            this.textures.exists('ui') &&
            this.textures.get('ui').has('btn_common_white_normal.png')
        ) {
            addAtlasButton(this, width / 2, backY, {
                atlas: 'ui',
                frame: 'btn_common_white_normal.png',
                label: t('return', lan),
                labelSizeTier: 'COMMON_2',
                onClick: () => this.scene.start('MainMenu'),
            });
        } else {
            const btn = this.add
                .rectangle(width / 2, backY, 160, 48, 0xe8e0d0)
                .setInteractive({ useHandCursor: true });
            this.add
                .text(width / 2, backY, t('return', lan), {
                    fontFamily: UI_FONT_FAMILY,
                    resolution: UI_TEXT_RESOLUTION,
                    fontSize: '20px',
                    color: '#111',
                })
                .setOrigin(0.5);
            btn.on('pointerup', () => this.scene.start('MainMenu'));
        }
    }

    private setScrollY(y: number): void {
        if (!this.scrollRoot) {
            return;
        }
        this.scrollY = Math.max(this.minScrollY, Math.min(this.maxScrollY, y));
        this.scrollRoot.y = SCROLL_TOP + this.scrollY;
    }

    private buildPayCard(purchaseId: PermanentIapId, x: number, y: number, lan: LangCode): PayCard {
        const root = this.add.container(x, y);
        this.scrollRoot?.add(root);

        const bgFrame = purchaseId <= 104 ? 'frame_iap_bg_talent.png' : 'frame_iap_bg_formula.png';

        if (this.textures.exists('ui') && this.textures.get('ui').has(bgFrame)) {
            root.add(this.add.image(0, 0, 'ui', bgFrame));
        } else {
            root.add(
                this.add
                    .rectangle(0, 0, NODE_WIDTH, NODE_HEIGHT, 0xd8d0c0)
                    .setStrokeStyle(1, 0x333333),
            );
        }

        // Cocos node origin bottom-left; Phaser container origin center.
        // localY = NODE_HEIGHT/2 - cocosY
        const toLocalY = (cocosY: number) => NODE_HEIGHT / 2 - cocosY;

        root.add(
            this.add
                .text(0, toLocalY(218), t(`p_${purchaseId}_name`, lan), {
                    fontFamily: UI_FONT_FAMILY,
                    resolution: UI_TEXT_RESOLUTION,
                    fontSize: `${UI_FONT_SIZE.COMMON_2}px`,
                    color: '#111111',
                    align: 'center',
                    wordWrap: uiWordWrap(NODE_WIDTH - 16),
                    maxLines: 2,
                })
                .setOrigin(0.5, 0.5),
        );

        if (purchaseId === 108 || purchaseId === 109) {
            const dig = purchaseId === 108 ? 'npc_dig_1.png' : 'npc_dig_4.png';
            if (this.textures.exists('npc') && this.textures.get('npc').has(dig)) {
                root.add(this.add.image(0, toLocalY(118), 'npc', dig).setScale(0.45));
            }
        } else {
            const iconFrame = `icon_iap_${purchaseId}.png`;
            if (this.textures.exists('icon') && this.textures.get('icon').has(iconFrame)) {
                root.add(this.add.image(0, toLocalY(118), 'icon', iconFrame));
            }
        }

        if (
            purchaseId === 106 &&
            this.textures.exists('icon') &&
            this.textures.get('icon').has('icon_sale.png')
        ) {
            root.add(this.add.image(-NODE_WIDTH / 2 + 45, toLocalY(54), 'icon', 'icon_sale.png'));
        }

        const priceLabel = this.add
            .text(
                NODE_WIDTH / 2 - 10,
                toLocalY(26),
                getPurchaseConfig(purchaseId).productPriceStr,
                {
                    fontFamily: UI_FONT_FAMILY,
                    resolution: UI_TEXT_RESOLUTION,
                    fontSize: `${UI_FONT_SIZE.COMMON_2}px`,
                    color: '#111111',
                },
            )
            .setOrigin(1, 0.5);
        root.add(priceLabel);

        const unlockLabel = this.add
            .text(0, toLocalY(118), t('unlocked', lan), {
                fontFamily: UI_FONT_FAMILY,
                resolution: UI_TEXT_RESOLUTION,
                fontSize: '36px',
                color: '#f5f0e6',
                stroke: '#000000',
                strokeThickness: 6,
            })
            .setOrigin(0.5)
            .setVisible(false);
        root.add(unlockLabel);

        const cardHit = this.add
            .rectangle(0, 0, NODE_WIDTH - 12, NODE_HEIGHT - 12, 0x000000, 0)
            .setInteractive({ useHandCursor: true });
        root.add(cardHit);

        cardHit.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
            this.dragging = true;
            this.dragMoved = false;
            this.dragStartY = pointer.y;
            this.pointerDownY = pointer.y;
            this.scrollStartY = this.scrollY;
        });

        cardHit.on('pointerup', () => {
            if (this.dragMoved) {
                return;
            }
            openPayDialog(this, purchaseId, (result) => {
                if (result.unlocked) {
                    this.refreshCardStatuses();
                }
            });
        });

        const card: PayCard = { purchaseId, root, unlockLabel, priceLabel };
        this.applyCardStatus(card);
        return card;
    }

    private applyCardStatus(card: PayCard): void {
        card.unlockLabel.setVisible(isIapUnlocked(card.purchaseId));
        card.priceLabel.setText(getPurchaseConfig(card.purchaseId).productPriceStr);
    }

    private refreshCardStatuses(): void {
        this.cards.forEach((card) => this.applyCardStatus(card));
    }
}
