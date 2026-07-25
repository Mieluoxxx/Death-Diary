import { isFoodItem, isUsableItem } from '../data/itemEffects';
import { getSession, type ItemCounts } from '../session/sessionStore';
import { useItem, type ItemUseSource } from '../systems/itemUse';

/** A concrete session inventory which can supply an item-detail dialog. */
export type ItemDetailContainer =
    | { kind: 'storage' }
    | { kind: 'bag' }
    | { kind: 'site'; siteId: number }
    | { kind: 'temp' };

export type ItemDetailActionResult = {
    ok: boolean;
    msg?: string;
};

/** A context-specific command rendered as the dialog's primary action. */
export type ItemDetailAction = {
    label: string;
    run: () => ItemDetailActionResult;
};

/** Presentation data only. ItemDialog never reads session state itself. */
export type ItemDetailModel = {
    itemId: number;
    quantity: number;
    primaryAction?: ItemDetailAction;
    onToast?: (message: string) => void;
    onClose?: () => void;
    /** 使用成功且详情框关闭后调用，用于刷新仍在底层的物品列表。 */
    onUseSuccess?: () => void;
};

export type ItemDetailOptions = {
    allowUse?: boolean;
    onToast?: (message: string) => void;
    onClose?: () => void;
    /** 使用成功且详情框关闭后调用，用于刷新仍在底层的物品列表。 */
    onUseSuccess?: () => void;
};

function countsFor(container: ItemDetailContainer): ItemCounts | null {
    const session = getSession();
    if (!session) {
        return null;
    }
    if (container.kind === 'storage') {
        return session.storage;
    }
    if (container.kind === 'bag') {
        return session.bag;
    }
    if (container.kind === 'temp') {
        return session.tempLoot;
    }
    return session.map.sites[container.siteId]?.storage ?? null;
}

function useSourceFor(container: ItemDetailContainer): ItemUseSource | null {
    if (container.kind === 'storage' || container.kind === 'bag') {
        return container.kind;
    }
    return null;
}

/**
 * Compose a detail model from a concrete holder and its allowed capabilities.
 * UI entry points resolve aliases such as the top status strip before this call.
 */
export function createItemDetailModel(
    itemId: number,
    container: ItemDetailContainer,
    options: ItemDetailOptions = {},
): ItemDetailModel {
    const quantity = countsFor(container)?.[itemId] ?? 0;
    const useSource = useSourceFor(container);
    const canUse =
        options.allowUse !== false && useSource !== null && quantity > 0 && isUsableItem(itemId);

    return {
        itemId,
        quantity,
        ...(canUse && useSource !== null
            ? {
                  primaryAction: {
                      label: isFoodItem(itemId) ? '吃' : '使用',
                      run: () => useItem(itemId, useSource),
                  },
              }
            : {}),
        onToast: options.onToast,
        onClose: options.onClose,
        onUseSuccess: options.onUseSuccess,
    };
}

/** Compose a read-only model for items owned by a non-player inventory. */
export function createReadOnlyItemDetailModel(
    itemId: number,
    quantity: number,
    options: Pick<ItemDetailOptions, 'onToast' | 'onClose'> = {},
): ItemDetailModel {
    return {
        itemId,
        quantity,
        onToast: options.onToast,
        onClose: options.onClose,
    };
}

/** Resolve the status strip's displayed item to its real session holder. */
export function topStatusItemContainer(): Extract<
    ItemDetailContainer,
    { kind: 'storage' | 'bag' }
> {
    return getSession()?.isAtHome ? { kind: 'storage' } : { kind: 'bag' };
}
