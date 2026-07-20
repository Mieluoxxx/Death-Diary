/**
 * Port of Buried-City playerAttrEffect.js — band secondary effects per hour.
 */

export type AttrEffectKey =
    | 'hp'
    | 'spirit'
    | 'starve'
    | 'vigour'
    | 'injury'
    | 'infect'
    | 'temperature';

export type AttrBand = {
    id: number;
    /** Half-open range string: "[-,25]", "(25,50]", "(75,-]" */
    range: string;
    effect: Partial<Record<AttrEffectKey, number>>;
};

export type AttrEffectTable = Record<string, Record<string, AttrBand>>;

export const PLAYER_ATTR_EFFECT: AttrEffectTable = {
    starve: {
        '1': { id: 1, range: '[-,25]', effect: { spirit: -5, infect: 1.5 } },
        '2': { id: 2, range: '(25,50]', effect: { spirit: -2 } },
        '3': { id: 3, range: '(50,75]', effect: {} },
        '4': { id: 4, range: '(75,-]', effect: {} },
    },
    infect: {
        '1': { id: 1, range: '[-,0]', effect: {} },
        '2': { id: 2, range: '(0,25]', effect: {} },
        '3': { id: 3, range: '(25,50]', effect: { hp: -6 } },
        '4': { id: 4, range: '(50,75]', effect: { spirit: -1, infect: 1, hp: -12 } },
        '5': { id: 5, range: '(75,-]', effect: { spirit: -1, infect: 1, hp: -16 } },
    },
    vigour: {
        '1': { id: 1, range: '[-,25]', effect: { spirit: -2 } },
        '2': { id: 2, range: '(25,50]', effect: { spirit: -1 } },
        '3': { id: 3, range: '(50,75]', effect: {} },
        '4': { id: 4, range: '(75,-]', effect: {} },
    },
    injury: {
        '1': { id: 1, range: '[-,0]', effect: {} },
        '2': { id: 2, range: '(0,25]', effect: {} },
        '3': { id: 3, range: '(25,50]', effect: {} },
        '4': { id: 4, range: '(50,75]', effect: { spirit: -1, infect: 1 } },
        '5': { id: 5, range: '(75,-]', effect: { spirit: -1, infect: 2 } },
    },
    spirit: {
        '1': { id: 1, range: '[-,25]', effect: {} },
        '2': { id: 2, range: '(25,50]', effect: {} },
        '3': { id: 3, range: '(50,75]', effect: {} },
        '4': { id: 4, range: '(75,-]', effect: {} },
    },
    temperature: {
        '1': { id: 1, range: '[-,-10)', effect: {} },
        '2': { id: 2, range: '[-10,10]', effect: { infect: 1 } },
        '3': { id: 3, range: '(10,-]', effect: {} },
    },
};

/**
 * Parse original Range strings.
 * "-" means open infinity on that side.
 */
export function isValueInRange (value: number, rangeText: string): boolean
{
    const trimmed = rangeText.trim();
    const match = trimmed.match(/^([\[(])\s*([^,]+)\s*,\s*([^)\]]+)\s*([)\]])$/);
    if (!match)
    {
        return false;
    }
    const leftInclusive = match[1] === '[';
    const rightInclusive = match[4] === ']';
    const leftRaw = match[2].trim();
    const rightRaw = match[3].trim();

    const leftBound = leftRaw === '-' ? Number.NEGATIVE_INFINITY : Number(leftRaw);
    const rightBound = rightRaw === '-' ? Number.POSITIVE_INFINITY : Number(rightRaw);

    if (Number.isNaN(leftBound) || Number.isNaN(rightBound))
    {
        return false;
    }

    const leftOk = leftInclusive ? value >= leftBound : value > leftBound;
    const rightOk = rightInclusive ? value <= rightBound : value < rightBound;
    return leftOk && rightOk;
}

export function findAttrBand (
    attrKey: string,
    value: number,
): AttrBand | null
{
    const bands = PLAYER_ATTR_EFFECT[attrKey];
    if (!bands)
    {
        return null;
    }
    for (const band of Object.values(bands))
    {
        if (isValueInRange(value, band.range))
        {
            return band;
        }
    }
    return null;
}
