/**
 * Radio cheat console catalog — item ids known to /list /get /getall.
 * Built from full ITEM_CONFIG (skip HAND placeholder).
 */

import { HAND_ITEM_ID, ITEM_CONFIG, getItemDef } from './itemConfig';

export type RadioItemEntry = {
    id: number;
    name: string;
};

export const RADIO_ITEM_CATALOG: Record<number, RadioItemEntry> = Object.fromEntries(
    Object.values(ITEM_CONFIG)
        .filter((item) => item.id !== HAND_ITEM_ID)
        .map((item) => [item.id, { id: item.id, name: item.name }]),
) as Record<number, RadioItemEntry>;

export function radioItemIds(): number[] {
    return Object.keys(RADIO_ITEM_CATALOG)
        .map(Number)
        .sort((a, b) => a - b);
}

export function radioItemName(itemId: number): string {
    return RADIO_ITEM_CATALOG[itemId]?.name ?? getItemDef(itemId).name;
}

/** Category label by original id band. */
function groupTitle(itemId: number): string {
    if (itemId >= 1101011 && itemId < 1102000) {
        return '材料';
    }
    if (itemId >= 1102011 && itemId < 1103000) {
        return '残骸/组件';
    }
    if (itemId >= 1103011 && itemId < 1104000) {
        return '食物';
    }
    if (itemId >= 1104011 && itemId < 1105000) {
        return '医疗';
    }
    if (itemId >= 1105011 && itemId < 1106000) {
        return '嗜好/原料';
    }
    if (itemId >= 1106013 && itemId < 1107000) {
        return '特殊';
    }
    if (itemId >= 1107012 && itemId < 1200000) {
        return '增益';
    }
    if (itemId >= 1301011 && itemId < 1302000) {
        return '枪械';
    }
    if (itemId >= 1302011 && itemId < 1303000) {
        return '近战';
    }
    if (itemId >= 1303012 && itemId < 1304000) {
        return '投掷/工具位';
    }
    if (itemId >= 1304012 && itemId < 1305000) {
        return '防具';
    }
    if (itemId >= 1305011) {
        return '弹药/出行/杂项';
    }
    return '其他';
}

/** Multi-line list for /list, grouped by id band. */
export function radioGroupedListText(): string {
    const ids = radioItemIds();
    if (ids.length === 0) {
        return '(empty catalog)';
    }

    const lines: string[] = [];
    let lastGroup = '';
    for (const id of ids) {
        const group = groupTitle(id);
        if (group !== lastGroup) {
            if (lines.length > 0) {
                lines.push('');
            }
            lines.push(`[${group}]`);
            lastGroup = group;
        }
        lines.push(`${id}  ${radioItemName(id)}`);
    }
    return lines.join('\n');
}
