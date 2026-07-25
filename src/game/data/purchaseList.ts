/**
 * Port of Buried-City PurchaseList permanent packages (101–109).
 * Main-menu ShopScene only lists permanent unlocks; consume packs (201+) stay in-game.
 */

export type PermanentIapId = 101 | 102 | 103 | 104 | 105 | 106 | 107 | 108 | 109;

export type PurchasePriceInfo = {
    productId: string;
    price: number;
    currencyCode: string;
    productPriceStr: string;
};

export type PurchaseInfo = {
    priceList: PurchasePriceInfo[];
    multiPrice: boolean;
};

/** ShopLayer display order (original shopScene.js). */
export const SHOP_PERMANENT_IDS: readonly PermanentIapId[] = [
    108, 109, 101, 102, 103, 104, 105, 106, 107,
];

export const PURCHASE_LIST: Record<PermanentIapId, PurchaseInfo> = {
    101: {
        priceList: [
            {
                productId: 'cnan_huozhe_nc1',
                price: 12,
                currencyCode: 'CNY',
                productPriceStr: '￥ 12.00',
            },
        ],
        multiPrice: false,
    },
    102: {
        priceList: [
            {
                productId: 'cnan_huozhe_nc2',
                price: 12,
                currencyCode: 'CNY',
                productPriceStr: '￥ 12.00',
            },
        ],
        multiPrice: false,
    },
    103: {
        priceList: [
            {
                productId: 'cnan_huozhe_nc3',
                price: 12,
                currencyCode: 'CNY',
                productPriceStr: '￥ 12.00',
            },
        ],
        multiPrice: false,
    },
    104: {
        priceList: [
            {
                productId: 'cnan_huozhe_nc4',
                price: 12,
                currencyCode: 'CNY',
                productPriceStr: '￥ 12.00',
            },
        ],
        multiPrice: false,
    },
    105: {
        priceList: [
            {
                productId: 'cnan_huozhe_nc5',
                price: 6,
                currencyCode: 'CNY',
                productPriceStr: '￥ 6.00',
            },
        ],
        multiPrice: false,
    },
    106: {
        priceList: [
            {
                productId: 'cnan_huozhe_nc8',
                price: 1,
                currencyCode: 'CNY',
                productPriceStr: '￥ 1.00',
            },
        ],
        multiPrice: false,
    },
    107: {
        priceList: [
            {
                productId: 'cnan_huozhe_nc7',
                price: 6,
                currencyCode: 'CNY',
                productPriceStr: '￥ 6.00',
            },
        ],
        multiPrice: false,
    },
    108: {
        priceList: [
            {
                productId: 'ipa_huozhe_nc9',
                price: 12,
                currencyCode: 'CNY',
                productPriceStr: '￥ 12.00',
            },
        ],
        multiPrice: false,
    },
    109: {
        priceList: [
            {
                productId: 'cnan_huozhe_nc10',
                price: 12,
                currencyCode: 'CNY',
                productPriceStr: '￥ 12.00',
            },
        ],
        multiPrice: false,
    },
};

export function getPurchaseConfig(purchaseId: PermanentIapId): PurchasePriceInfo & {
    multiPrice: boolean;
    priceIndex: number;
} {
    const info = PURCHASE_LIST[purchaseId];
    const price = info.priceList[0];
    return {
        ...price,
        multiPrice: info.multiPrice,
        priceIndex: 0,
    };
}

export function isPermanentIapId(id: number): id is PermanentIapId {
    return id in PURCHASE_LIST;
}
