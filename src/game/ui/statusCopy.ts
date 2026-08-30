import { findAttrBand } from '../data/playerAttrEffect';
import type { SessionState } from '../session/sessionStore';
import { formatClock } from '../session/sessionStore';
import { getLanguage, type LangCode, t } from '../settings/settingsStore';

/**
 * Port of Buried-City string ids used by topFrame showStatusDialog /
 * showAttrStatusDialog (string_zh.js "1"–"11" + attr_*_name).
 */

export type StatusInfoId = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11;

type StatusCopy = {
    title: string;
    des: string;
};

const STATUS_COPY: Record<StatusInfoId, Record<LangCode, StatusCopy>> = {
    1: {
        zh: {
            title: '日期',
            des: '你在游戏中存活的天数。如果你撑得够久，说不定完蛋后可以和你的僵尸伙伴们吹嘘一下。',
        },
        'zh-Hant': {
            title: '日期',
            des: '你在遊戲中存活的天數。如果你撐得夠久，說不定完蛋後可以和你的殭屍夥伴們吹噓一下。',
        },
        ja: {
            title: '日付',
            des: 'ゲーム内で生き残った日数です。長く生きれば、ゾンビ仲間に自慢できるかもしれません。',
        },
        en: {
            title: 'Date',
            des: 'Days you have survived. Live long enough and you might brag to your zombie pals.',
        },
    },
    2: {
        zh: {
            title: '季节',
            des: '秋季平均气温10℃，冬季平均气温0℃。低温状态影响很大，你会容易感冒，僵尸则由于缺乏食物更加疯狂。',
        },
        'zh-Hant': {
            title: '季節',
            des: '秋季平均氣溫10℃，冬季平均氣溫0℃。低溫狀態影響很大，你會容易感冒，殭屍則由於缺乏食物更加瘋狂。',
        },
        ja: {
            title: '季節',
            des: '秋の平均気温は10℃、冬は0℃。低温は体調を崩しやすく、ゾンビもより狂暴になります。',
        },
        en: {
            title: 'Season',
            des: 'Fall averages 10°C, winter 0°C. Cold makes you sick easily, and zombies grow fiercer.',
        },
    },
    3: {
        zh: {
            title: '室内温度',
            des: '在缺医少药的环境里，小感冒也会引发呼吸道感染，这将是致命的！如果气温过低，务必生火取暖，保持室内温暖。',
        },
        'zh-Hant': {
            title: '室內溫度',
            des: '在缺醫少藥的環境裡，小感冒也會引發呼吸道感染，這將是致命的！如果氣溫過低，務必生火取暖，保持室內溫暖。',
        },
        ja: {
            title: '室内温度',
            des: '医療が乏しい状況では軽い風邪でも致命的です。気温が低い時は必ず火を起こし、室内を暖かく保ちましょう。',
        },
        en: {
            title: 'Indoor Temperature',
            des: 'Without medicine, a cold can turn deadly. Keep a fire going when it is cold inside.',
        },
    },
    4: {
        zh: {
            title: '时间',
            des: '外出探索时请注意时间，死亡日记的太阳升于6:00，落于20:00。夜晚僵尸非常活跃，所造成的伤害是日间的数倍。',
        },
        'zh-Hant': {
            title: '時間',
            des: '外出探索時請注意時間，死亡日記的太陽升於6:00，落於20:00。夜晚殭屍非常活躍，所造成的傷害是日間的數倍。',
        },
        ja: {
            title: '時間',
            des: '探索時は時間に注意。日の出6:00、日没20:00。夜のゾンビは非常に活発で、ダメージが数倍になります。',
        },
        en: {
            title: 'Time',
            des: 'Watch the clock while exploring. Sun rises at 06:00 and sets at 20:00. Nights are far more dangerous.',
        },
    },
    5: {
        zh: {
            title: '生命值',
            des: '盯紧这个，如果生命值降为0，就意味着你完蛋了，变成了僵尸的同伙或食物。远离外伤和感染，确保食物和睡眠充足，注意调节心情。',
        },
        'zh-Hant': {
            title: '生命值',
            des: '盯緊這個，如果生命值降為0，就意味著你完蛋了，變成了殭屍的同夥或食物。遠離外傷和感染，確保食物和睡眠充足，注意調節心情。',
        },
        ja: {
            title: 'HP',
            des: 'HPが0になるとゲームオーバーです。外傷・感染を避け、食事と睡眠を確保し、気分も整えましょう。',
        },
        en: {
            title: 'HP',
            des: 'If HP hits 0, you are done. Avoid injury and infection, eat, sleep, and keep your spirit up.',
        },
    },
    6: {
        zh: {
            title: '饱食度',
            des: '请保持充足的饮食，长期处于食物匮乏状态会导致多种不良后果，比如肠道感染和生命值恢复变慢。',
        },
        'zh-Hant': {
            title: '飽食度',
            des: '請保持充足的飲食，長期處於食物匱乏狀態會導致多種不良後果，比如腸道感染和生命值恢復變慢。',
        },
        ja: {
            title: '満腹度',
            des: '十分な食事を。空腹が続くと腸の感染やHP回復低下など悪影響が出ます。',
        },
        en: {
            title: 'Satiety',
            des: 'Stay fed. Long hunger causes gut infection and slower HP recovery.',
        },
    },
    7: {
        zh: {
            title: '精力值',
            des: '规律地睡眠是恢复精力的唯一手段，否则你的工作效率和战斗能力将会大打折扣。',
        },
        'zh-Hant': {
            title: '精力值',
            des: '規律地睡眠是恢復精力的唯一手段，否則你的工作效率和戰鬥能力將會大打折扣。',
        },
        ja: {
            title: '精力',
            des: '睡眠が精力回復の唯一の手段。不足すると作業効率と戦闘力が下がります。',
        },
        en: {
            title: 'Vigor',
            des: 'Sleep is the only way to restore vigor. Without it, work and combat suffer.',
        },
    },
    8: {
        zh: {
            title: '心情值',
            des: '挫败、疲劳、饥饿和病痛都会导致心情欠佳，引发失眠，降低生命值和精力回复效果。适当静坐小憩是必要的，可能的话，来杯咖啡。',
        },
        'zh-Hant': {
            title: '心情值',
            des: '挫敗、疲勞、飢餓和病痛都會導致心情欠佳，引發失眠，降低生命值和精力回復效果。適當靜坐小憩是必要的，可能的話，來杯咖啡。',
        },
        ja: {
            title: '気分',
            des: '挫折・疲労・空腹・痛みは気分を下げ、不眠や回復低下を招きます。休憩やコーヒーが有効です。',
        },
        en: {
            title: 'Spirit',
            des: 'Failure, fatigue, hunger and pain hurt mood, cause insomnia, and slow recovery. Rest—or coffee—helps.',
        },
    },
    9: {
        zh: {
            title: '感染等级',
            des: '包括肠道感染，呼吸道感染和外伤感染。严重感染会造成生命值的迅速持续流失，威胁超过僵尸！务必及时使用药剂或青霉素治疗！',
        },
        'zh-Hant': {
            title: '感染等級',
            des: '包括腸道感染，呼吸道感染和外傷感染。嚴重感染會造成生命值的迅速持續流失，威脅超過殭屍！務必及時使用藥劑或青霉素治療！',
        },
        ja: {
            title: '感染レベル',
            des: '腸・呼吸器・外傷の感染を含みます。重症はHPを急速に削りゾンビ以上に危険です。薬やペニシリンで早めに治療を。',
        },
        en: {
            title: 'Infection',
            des: 'Gut, respiratory, and wound infections. Severe cases drain HP faster than zombies—treat with medicine or penicillin.',
        },
    },
    10: {
        zh: {
            title: '外伤等级',
            des: '外伤不仅可能导致感染，更会暂时扣减你的生命最大值，激烈的战斗后记得及时使用绷带包扎。',
        },
        'zh-Hant': {
            title: '外傷等級',
            des: '外傷不僅可能導致感染，更會暫時扣減你的生命最大值，激烈的戰鬥後記得及時使用繃帶包紮。',
        },
        ja: {
            title: '外傷レベル',
            des: '外傷は感染の原因になり、最大HPも一時低下します。戦闘後は包帯で手当を。',
        },
        en: {
            title: 'Injury',
            des: 'Wounds can infect and temporarily cut max HP. Bandage after hard fights.',
        },
    },
    11: {
        zh: {
            title: '天气',
            des: '尽管你已经有了避难所，但是天气变化的影响仍然不可忽视。最好能根据天气调整自己的行动计划。',
        },
        'zh-Hant': {
            title: '天氣',
            des: '儘管你已經有了避難所，但是天氣變化的影響仍然不可忽視。最好能根據天氣調整自己的行動計劃。',
        },
        ja: {
            title: '天気',
            des: 'シェルターがあっても天候の影響は無視できません。天気に合わせて行動計画を調整しましょう。',
        },
        en: {
            title: 'Weather',
            des: 'Even with a shelter, weather matters. Plan your actions around it.',
        },
    },
};

const SEASON_KEYS = ['season_fall', 'season_winter', 'season_spring', 'season_summer'] as const;

export function getStatusCopy(stringId: StatusInfoId, lan: LangCode = getLanguage()): StatusCopy {
    return STATUS_COPY[stringId][lan] ?? STATUS_COPY[stringId].zh;
}

/** statusDialog title template: 当前:%s */
export function formatCurrentValue(value: string, lan: LangCode = getLanguage()): string {
    if (lan === 'en') {
        return `Current: ${value}`;
    }
    if (lan === 'ja') {
        return `現在: ${value}`;
    }
    if (lan === 'zh-Hant') {
        return `當前:${value}`;
    }
    return `当前:${value}`;
}

export function formatStatusValue(
    stringId: StatusInfoId,
    session: SessionState,
    lan: LangCode = getLanguage(),
): string {
    switch (stringId) {
        case 1:
            return String(session.day);
        case 2:
            return t(SEASON_KEYS[session.season] ?? 'season_fall', lan);
        case 3:
            return String(session.temperature);
        case 4:
            return formatClock(session);
        case 11:
            return t(`weather_${session.weatherId}`, lan);
        default:
            return '';
    }
}

export type AttrKey = 'injury' | 'infect' | 'starve' | 'vigour' | 'spirit' | 'hp';

type BandLabelAttr = Exclude<AttrKey, 'hp'>;

/** Original string_{lang}.js attr_name arrays; index = original effect-band id − 1. */
const ATTR_BAND_COPY: Record<BandLabelAttr, Record<LangCode, readonly (string | null)[]>> = {
    starve: {
        zh: ['严重饥饿', '非常饿', '饥饿'],
        'zh-Hant': ['嚴重饑餓', '非常餓', '饑餓'],
        ja: ['非常に飢えている', '本当に飢えている', '飢えている'],
        en: ['Seriously starving', 'Starving', 'Hungry'],
    },
    vigour: {
        zh: ['困顿', '疲乏', '疲倦'],
        'zh-Hant': ['困頓', '疲乏', '疲倦'],
        ja: ['疲れ果てる', '本当に疲れている', '疲れている'],
        en: ['Exhausted', 'Fatigued', 'Tired'],
    },
    spirit: {
        zh: ['崩溃', '沮丧', '不安'],
        'zh-Hant': ['崩潰', '沮喪', '不安'],
        ja: ['崩壊する', '落ち込んでいる', '不安'],
        en: ['Breakdown', 'Depressed', 'Upset'],
    },
    injury: {
        zh: [null, '皮外伤', '轻伤', '重伤', '严重创伤'],
        'zh-Hant': [null, '皮肉傷', '輕傷', '重傷', '嚴重創傷'],
        ja: [null, '外傷', '軽傷', '重傷', '酷い外傷'],
        en: [null, 'Injured', 'Slightly injured', 'Severely injured', 'Fatally injured'],
    },
    infect: {
        zh: [null, '轻微感染', '中度感染', '重度感染', '免疫崩溃'],
        'zh-Hant': [null, '輕微感染', '中度感染', '重度感染', '免疫崩潰'],
        ja: [null, '軽微な感染', '感染', '酷い感染', '免疫システムが崩壊'],
        en: [
            null,
            'Light infection',
            'Medium infection',
            'Severe infection',
            'Immune system collapse',
        ],
    },
};

/** Original topFrame stringId for each attr button. */
export const ATTR_STATUS_ID: Record<AttrKey, StatusInfoId> = {
    hp: 5,
    starve: 6,
    vigour: 7,
    spirit: 8,
    infect: 9,
    injury: 10,
};

/**
 * Original Player.getAttrStr: HP remains numeric; other attributes display
 * their effect-band label and intentionally show no text in a healthy band.
 */
export function formatAttrValue(attr: AttrKey, session: SessionState): string {
    if (attr === 'hp') {
        return `${session.attrs.hp}/${session.attrs.hpMax}`;
    }
    const band = findAttrBand(attr, session.attrs[attr]);
    if (!band) {
        return '';
    }
    return ATTR_BAND_COPY[attr][getLanguage()][band.id - 1] ?? '';
}
