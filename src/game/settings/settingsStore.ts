export type LangCode = 'zh' | 'zh-Hant' | 'ja' | 'en';

export const LAN_SUPPORTS: LangCode[] = ['zh', 'zh-Hant', 'ja', 'en'];

export const LANG_NAMES: Record<LangCode, string> = {
    zh: '简体中文',
    'zh-Hant': '繁體中文',
    ja: '日本語',
    en: 'English',
};

const KEYS = {
    music: 'buried_city_music',
    sfx: 'buried_city_sfx',
    language: 'language',
} as const;

function readBool(key: string, fallback: boolean): boolean {
    try {
        const v = localStorage.getItem(key);
        if (v === null) {
            return fallback;
        }
        return v === '1' || v === 'true';
    } catch {
        return fallback;
    }
}

function writeBool(key: string, value: boolean): void {
    try {
        localStorage.setItem(key, value ? '1' : '0');
    } catch {
        // ignore quota / private mode
    }
}

export function normalizeLanguage(lan: string | null | undefined): LangCode {
    if (!lan) {
        return 'zh';
    }
    if ((LAN_SUPPORTS as string[]).includes(lan)) {
        return lan as LangCode;
    }
    if (lan === 'zh-TW' || lan === 'zh-HK' || lan === 'zh-Hant-TW' || lan === 'zh-Hant-HK') {
        return 'zh-Hant';
    }
    if (lan.indexOf('zh') === 0) {
        return 'zh';
    }
    if (lan.indexOf('ja') === 0) {
        return 'ja';
    }
    if (lan.indexOf('en') === 0) {
        return 'en';
    }
    return 'en';
}

export function getMusicOn(): boolean {
    return readBool(KEYS.music, true);
}

export function setMusicOn(on: boolean): void {
    writeBool(KEYS.music, on);
}

export function getSfxOn(): boolean {
    return readBool(KEYS.sfx, true);
}

export function setSfxOn(on: boolean): void {
    writeBool(KEYS.sfx, on);
}

export function getLanguage(): LangCode {
    try {
        return normalizeLanguage(localStorage.getItem(KEYS.language));
    } catch {
        return 'zh';
    }
}

export function setLanguage(lan: LangCode): void {
    try {
        localStorage.setItem(KEYS.language, lan);
    } catch {
        // ignore
    }
}

/** Minimal UI copy for menu/settings (web slice). */
export function t(key: string, lan: LangCode = getLanguage()): string {
    const table: Record<string, Record<LangCode, string>> = {
        music: { zh: '音乐', 'zh-Hant': '音樂', ja: 'BGM', en: 'Music' },
        sfx: { zh: '音效', 'zh-Hant': '音效', ja: '効果音', en: 'SFX' },
        language: { zh: '语言', 'zh-Hant': '語言', ja: '言語', en: 'Language' },
        on: { zh: '打开', 'zh-Hant': '打開', ja: 'オン', en: 'On' },
        off: { zh: '关闭', 'zh-Hant': '關閉', ja: 'オフ', en: 'Off' },
        confirm: { zh: '确定', 'zh-Hant': '確定', ja: 'OK', en: 'OK' },
        gotIt: {
            zh: '知道了',
            'zh-Hant': '知道了',
            ja: 'わかった',
            en: 'Got it',
        },
        newGame: {
            zh: '新的开始',
            'zh-Hant': '新的開始',
            ja: '初めから遊ぶ',
            en: 'New Game',
        },
        continue: {
            zh: '继续',
            'zh-Hant': '繼續',
            ja: '続きから',
            en: 'Continue',
        },
        ranking: {
            zh: '排行榜',
            'zh-Hant': '排行榜',
            ja: 'ランキング',
            en: 'Ranking list',
        },
        version: {
            zh: '当前版本:',
            'zh-Hant': '當前版本:',
            ja: '現在のバージョン：',
            en: 'Version:',
        },
        back: { zh: '返回', 'zh-Hant': '返回', ja: '戻る', en: 'Back' },
        chooseRole: {
            zh: '选择角色',
            'zh-Hant': '選擇角色',
            ja: 'キャラ選択',
            en: 'Choose character',
        },
        chooseTalent: {
            zh: '选择天赋',
            'zh-Hant': '選擇天賦',
            ja: 'ギフトを選びなさい',
            en: 'Choose a talent',
        },
        tapContinue: {
            zh: '点击继续',
            'zh-Hant': '點擊繼續',
            ja: 'タップして続行',
            en: 'Tap to continue',
        },
        medalWall: {
            zh: '勋章墙',
            'zh-Hant': '勳章牆',
            ja: '勲章の壁',
            en: 'Wall of Medals',
        },
        cancel: {
            zh: '取消',
            'zh-Hant': '取消',
            ja: 'キャンセル',
            en: 'Cancel',
        },
        unlockIt: {
            zh: '去解锁',
            'zh-Hant': '去解鎖',
            ja: 'アンロック',
            en: 'Unlock it',
        },
        talentLocked: {
            zh: '该人物天赋尚未解锁，无法选择',
            'zh-Hant': '該人物天賦尚未解鎖，無法選擇',
            ja: '当該キャラのギフトはまだアンロックされず、選べない',
            en: 'This talent has not been unlocked yet.',
        },
        roleLocked: {
            zh: '该人物尚未解锁，无法选择',
            'zh-Hant': '該人物尚未解鎖，無法選擇',
            ja: '当該キャラはまだ解放していないので選択できません',
            en: 'You need to unlock this character before you can select him/her.',
        },
        roleComingSoon: {
            zh: '即将开放',
            'zh-Hant': '即將開放',
            ja: 'じきに解放',
            en: 'Coming soon',
        },
        roleComingSoonDes: {
            zh: '新的人物角色即将开放，敬请期待',
            'zh-Hant': '新的人物角色即將開放，敬請期待',
            ja: '新しいキャラがじきに解放されますので、楽しみにして下さい',
            en: 'New characters will be available soon, stay tuned.',
        },

        // Roles (ChooseScene SlideView)
        role_stranger_name: {
            zh: '陌生人',
            'zh-Hant': '陌生人',
            ja: '見知らぬ人',
            en: 'Stranger',
        },
        role_stranger_des: {
            zh: '外来游客',
            'zh-Hant': '外來遊客',
            ja: '外来の観光客',
            en: 'Stranger visitor',
        },
        role_luo_name: {
            zh: '老罗',
            'zh-Hant': '老羅',
            ja: '羅じいさん',
            en: 'Mr. Luo',
        },
        role_luo_des: {
            zh: '退役军人',
            'zh-Hant': '退役軍人',
            ja: '退役軍人',
            en: 'Veteran',
        },
        role_yazi_name: {
            zh: '雅子',
            'zh-Hant': '雅子',
            ja: '雅子',
            en: 'Yazi',
        },
        role_yazi_des: {
            zh: '电气工程师',
            'zh-Hant': '電氣工程師',
            ja: '電気エンジニア',
            en: 'Electrical engineer',
        },

        // Talents (ChooseScene IAP 0/101–104)
        talent_0: {
            zh: '幸存者',
            'zh-Hant': '倖存者',
            ja: '生存者',
            en: 'Survivor',
        },
        talent_101: {
            zh: '神枪手',
            'zh-Hant': '神槍手',
            ja: 'スナイパー',
            en: 'Marksman',
        },
        talent_102: {
            zh: '大块头',
            'zh-Hant': '大塊頭',
            ja: 'マッチョ',
            en: 'Athlete',
        },
        talent_103: {
            zh: '拾荒者',
            'zh-Hant': '拾荒者',
            ja: 'くず拾い',
            en: 'Scavenger',
        },
        talent_104: {
            zh: '社交达人',
            'zh-Hant': '社交達人',
            ja: '社交の達人',
            en: 'Communicator',
        },

        backToMenu: {
            zh: '返回菜单',
            'zh-Hant': '返回選單',
            ja: 'メニューに戻る',
            en: 'Back to Menu',
        },
        buildSoon: {
            zh: '详情稍后开放',
            'zh-Hant': '詳情稍後開放',
            ja: '詳細は後ほど',
            en: 'Details soon',
        },
        season_fall: { zh: '秋', 'zh-Hant': '秋', ja: '秋', en: 'Fall' },
        season_winter: { zh: '冬', 'zh-Hant': '冬', ja: '冬', en: 'Winter' },
        season_spring: { zh: '春', 'zh-Hant': '春', ja: '春', en: 'Spring' },
        season_summer: { zh: '夏', 'zh-Hant': '夏', ja: '夏', en: 'Summer' },
        weather_0: { zh: '多云', 'zh-Hant': '多雲', ja: '曇り', en: 'Cloudy' },
        weather_1: { zh: '晴朗', 'zh-Hant': '晴朗', ja: '晴れ', en: 'Sunny' },
        weather_2: { zh: '下雨', 'zh-Hant': '下雨', ja: '雨', en: 'Rainy' },
        weather_3: { zh: '下雪', 'zh-Hant': '下雪', ja: '雪', en: 'Snowy' },
        weather_4: { zh: '大雾', 'zh-Hant': '大霧', ja: '霧', en: 'Foggy' },
        build_tool: {
            zh: '工具台',
            'zh-Hant': '工具台',
            ja: '作業台',
            en: 'Workbench',
        },
        build_fence: { zh: '围墙', 'zh-Hant': '圍牆', ja: '塀', en: 'Fence' },
        build_well: { zh: '水井', 'zh-Hant': '水井', ja: '井戸', en: 'Well' },
        build_farm: { zh: '农田', 'zh-Hant': '農田', ja: '畑', en: 'Farm' },
        build_kitchen: {
            zh: '厨房',
            'zh-Hant': '廚房',
            ja: 'キッチン',
            en: 'Kitchen',
        },
        build_workshop: {
            zh: '工坊',
            'zh-Hant': '工坊',
            ja: '工房',
            en: 'Workshop',
        },
        build_cellar: {
            zh: '酒窖',
            'zh-Hant': '酒窖',
            ja: '酒蔵',
            en: 'Cellar',
        },
        build_bathroom: {
            zh: '浴室',
            'zh-Hant': '浴室',
            ja: '浴室',
            en: 'Bathroom',
        },
        build_bed: { zh: '床铺', 'zh-Hant': '床鋪', ja: 'ベッド', en: 'Bed' },
        build_fireplace: {
            zh: '火炉',
            'zh-Hant': '火爐',
            ja: '暖炉',
            en: 'Fireplace',
        },
        build_booth: { zh: '摊位', 'zh-Hant': '攤位', ja: '露店', en: 'Booth' },
        build_doghouse: {
            zh: '狗舍',
            'zh-Hant': '狗舍',
            ja: '犬小屋',
            en: 'Kennel',
        },
        build_storage: {
            zh: '仓库',
            'zh-Hant': '倉庫',
            ja: '倉庫',
            en: 'Storage',
        },
        build_gate: { zh: '大门', 'zh-Hant': '大門', ja: '門', en: 'Gate' },
        build_radio: { zh: '电台', 'zh-Hant': '電台', ja: '無線', en: 'Radio' },
        build_minefield: {
            zh: '雷区',
            'zh-Hant': '雷區',
            ja: '地雷原',
            en: 'Minefield',
        },
        build_lathe: { zh: '机床', 'zh-Hant': '機床', ja: '旋盤', en: 'Lathe' },
        build_power: { zh: '发电', 'zh-Hant': '發電', ja: '発電', en: 'Power' },
        build_electric: {
            zh: '电气',
            'zh-Hant': '電氣',
            ja: '電気',
            en: 'Electric',
        },

        // Ironman (days) 103/102/101
        m_103_name: {
            zh: '铁人勋章（三等）',
            'zh-Hant': '鐵人勳章(三等)',
            ja: 'アイアンマン勲章（三等）',
            en: 'Ironman Medal (Grade 3)',
        },
        m_103_condition: {
            zh: '单局生存超过5天',
            'zh-Hant': '單局生存超過5天',
            ja: '一回のゲームで5日以上のサバイバルに成功',
            en: 'Survive 5+ days in a single game',
        },
        m_103_des: {
            zh: '开局自带6个罐头',
            'zh-Hant': '開局時自動攜帶6個罐頭',
            ja: 'ゲームの最初で自動的に6個の缶詰を所持',
            en: 'Start with 6 × canned food at the beginning of a new game.',
        },
        m_102_name: {
            zh: '铁人勋章（二等）',
            'zh-Hant': '鐵人勳章(二等)',
            ja: 'アイアンマン勲章（二等）',
            en: 'Ironman Medal (Grade 2)',
        },
        m_102_condition: {
            zh: '单局生存超过60天',
            'zh-Hant': '單局生存超過60天',
            ja: '一回のゲームで60日以上のサバイバルに成功',
            en: 'Survive 60+ days in a single game',
        },
        m_102_des: {
            zh: '开局自带2个绷带',
            'zh-Hant': '開局時自動攜帶2個繃帶',
            ja: 'ゲームの最初で自動的に2個の包帯を所持',
            en: 'Start with 2 × bandages at the beginning of a new game.',
        },
        m_101_name: {
            zh: '铁人勋章（一等）',
            'zh-Hant': '鐵人勳章(一等)',
            ja: 'アイアンマン勲章（一等）',
            en: 'Ironman Medal (Grade 1)',
        },
        m_101_condition: {
            zh: '单局生存超过120天',
            'zh-Hant': '單局生存超過120天',
            ja: '一回のゲームで120日以上のサバイバルに成功',
            en: 'Survive 120+ days in a single game',
        },
        m_101_des: {
            zh: '开局自带1个青霉素',
            'zh-Hant': '開局時自動攜帶1個青霉素',
            ja: 'ゲームの最初で自動的に1本のペニシリンを所持',
            en: 'Start with 1 × Penicillin at the beginning of a new game.',
        },

        // Valor (kills) 203/202/201
        m_203_name: {
            zh: '英勇勋章（三等）',
            'zh-Hant': '英勇勳章(三等)',
            ja: 'ブレーブ勲章（三等）',
            en: 'Medal of Valor (Grade 3)',
        },
        m_203_condition: {
            zh: '野外累计消灭20个僵尸',
            'zh-Hant': '野外累計消滅20隻殭屍',
            ja: '野外で合計20匹以上のゾンビを殺す',
            en: 'Kill 20+ zombies in the wild',
        },
        m_203_des: {
            zh: '生命值上限额外增加10',
            'zh-Hant': '生命值上限額外增加10點',
            ja: '最大ＨＰが10ポイントＵＰ',
            en: 'Increase maximum HP by 10',
        },
        m_202_name: {
            zh: '英勇勋章（二等）',
            'zh-Hant': '英勇勳章(二等)',
            ja: 'ブレーブ勲章（二等）',
            en: 'Medal of Valor (Grade 2)',
        },
        m_202_condition: {
            zh: '野外累计消灭400个僵尸',
            'zh-Hant': '野外累計消滅400隻殭屍',
            ja: '野外で合計400匹以上のゾンビを殺す',
            en: 'Kill 400+ zombies in the wild',
        },
        m_202_des: {
            zh: '生命值上限额外增加20',
            'zh-Hant': '生命值上限額外增加20點',
            ja: '最大ＨＰが20ポイントＵＰ',
            en: 'Increase maximum HP by 20',
        },
        m_201_name: {
            zh: '英勇勋章（一等）',
            'zh-Hant': '英勇勳章(一等)',
            ja: 'ブレーブ勲章（一等）',
            en: 'Medal of Valor (Grade 1)',
        },
        m_201_condition: {
            zh: '野外累计消灭8000个僵尸',
            'zh-Hant': '野外累計消滅8000隻殭屍',
            ja: '野外で合計8000匹以上のゾンビを殺す',
            en: 'Kill 8000+ zombies in the wild',
        },
        m_201_des: {
            zh: '生命值上限额外增加50',
            'zh-Hant': '生命值上限額外增加50點',
            ja: '最大ＨＰが50ポイントＵＰ',
            en: 'Increase maximum HP by 50',
        },

        // Freedom (secret rooms) 303/302/301
        m_303_name: {
            zh: '自由勋章（三等）',
            'zh-Hant': '自由勳章(三等)',
            ja: 'フリーダム勲章（三等）',
            en: 'Medal of Freedom (Grade 3)',
        },
        m_303_condition: {
            zh: '单局清空5个密室',
            'zh-Hant': '單局清空5間密室',
            ja: '一回のゲームで5ヶ所の密室をクリア',
            en: 'Clear 5 secret chambers in a single game',
        },
        m_303_des: {
            zh: '开局自带子弹30发',
            'zh-Hant': '開局時自動攜帶子彈30發',
            ja: 'ゲームの最初で自動的に30発の弾丸を所持',
            en: 'Start with 30 × bullets at the beginning of a new game.',
        },
        m_302_name: {
            zh: '自由勋章（二等）',
            'zh-Hant': '自由勳章(二等)',
            ja: 'フリーダム勲章（二等）',
            en: 'Medal of Freedom (Grade 2)',
        },
        m_302_condition: {
            zh: '单局清空10个密室',
            'zh-Hant': '單局清空10間密室',
            ja: '一回のゲームで10ヶ所の密室をクリア',
            en: 'Clear 10 secret chambers in a single game',
        },
        m_302_des: {
            zh: '开局自带1把手枪',
            'zh-Hant': '開局時自動攜帶1把手槍',
            ja: 'ゲームの最初で自動的に1丁の拳銃を所持',
            en: 'Start with 1 × pistol at the beginning of a new game.',
        },
        m_301_name: {
            zh: '自由勋章（一等）',
            'zh-Hant': '自由勳章(一等)',
            ja: 'フリーダム勲章（一等）',
            en: 'Medal of Freedom (Grade 1)',
        },
        m_301_condition: {
            zh: '单局清空30个密室',
            'zh-Hant': '單局清空30間密室',
            ja: '一回のゲームで30ヶ所の密室をクリア',
            en: 'Clear 30 secret chambers in a single game',
        },
        m_301_des: {
            zh: '开局自带1支M40',
            'zh-Hant': '開局時自動攜帶1把M40',
            ja: 'ゲームの最初で自動的に1丁のＭ40を所持',
            en: 'Start with 1 × M40 at the beginning of a new game.',
        },

        // Shop / IAP permanent packages
        shop: { zh: '商店', 'zh-Hant': '商店', ja: 'ショップ', en: 'Shop' },
        return: { zh: '返回', 'zh-Hant': '返回', ja: '戻す', en: 'Return' },
        unlock: {
            zh: '解锁',
            'zh-Hant': '解鎖',
            ja: 'アンロック',
            en: 'Unlock',
        },
        unlocked: {
            zh: '已解锁',
            'zh-Hant': '已解鎖',
            ja: 'アンロック',
            en: 'Unlocked',
        },
        buy: { zh: '购买', 'zh-Hant': '購買', ja: '購入する', en: 'Buy' },
        purchased: {
            zh: '已购买',
            'zh-Hant': '已購買',
            ja: '購入済み',
            en: 'Purchased',
        },
        p_101_name: {
            zh: '神枪手',
            'zh-Hant': '神槍手',
            ja: 'スナイパー',
            en: 'Marksman',
        },
        p_101_des: {
            zh: '你曾接受过专业训练，对枪弹非常熟悉。\n（解锁后永久有效，可选择该角色进入游戏。)',
            'zh-Hant':
                '你曾接受過專業訓練，對槍彈非常熟悉。\n（解鎖後永久有效，可選擇該角色進入遊戲。)',
            ja: 'プロの訓練を経験したあなたは銃と弾丸に詳しい。\n（アンロック後永遠に有効で、当該キャラを選んでゲームを始めることができる。）',
            en: 'Well trained in shooting, and familiar with firearms. \n (Once unlocked it never expires, and is available for all future games.)',
        },
        p_101_effect: {
            zh: '命中提高到125%',
            'zh-Hant': '命中提高到125%',
            ja: '命中率を125%までアップ',
            en: 'Hit increases to 125%',
        },
        p_102_name: {
            zh: '大块头',
            'zh-Hant': '大塊頭',
            ja: 'マッチョ',
            en: 'Athlete',
        },
        p_102_des: {
            zh: '坚持不懈地锻炼，你的体格优于常人。\n（解锁后永久有效，可选择该角色进入游戏。)',
            'zh-Hant':
                '堅持不懈地鍛煉，你的體格優於常人。\n（解鎖後永久有效，可選擇該角色進入遊戲。)',
            ja: '絶えがたい身体鍛錬をしてきたあなたは一般人よりもかなりがっちりしている。\n（アンロック後永遠に有効で、当該キャラを選んでゲームを始めることができる。）',
            en: 'Has exercised for a long time, and therefore has a stronger physique and faster recovery times. \n (Once unlocked it never expires, and is available for all future games.)',
        },
        p_102_effect: {
            zh: '生命值提高到125%',
            'zh-Hant': '生命值提高到125%',
            ja: 'HPを125%までアップ',
            en: 'HP increases to 125%',
        },
        p_103_name: {
            zh: '拾荒者',
            'zh-Hant': '拾荒者',
            ja: 'くず拾い',
            en: 'Scavenger',
        },
        p_103_des: {
            zh: '你善于在垃圾堆里寻找价值。\n（解锁后永久有效，可选择该角色进入游戏。)',
            'zh-Hant': '你擅於在垃圾堆裡尋找價值。\n（解鎖後永久有效，可選擇該角色進入遊戲。)',
            ja: 'あなたはゴミの山の中から価値のあるものを探し出すことに長けている。\n（アンロック後永遠に有効で、当該キャラを選んでゲームを始めることができる。）',
            en: 'Good at scavenging useful items from rubble. \n (Once unlocked it never expires, and is available for all future games.)',
        },
        p_103_effect: {
            zh: '副本获得资源提高到110%',
            'zh-Hant': '副本獲得資源110%',
            ja: 'ドロップ量を110%までアップ',
            en: 'Item drops increased by 10%.',
        },
        p_104_name: {
            zh: '社交达人',
            'zh-Hant': '社交達人',
            ja: '社交の達人',
            en: 'Communicator',
        },
        p_104_des: {
            zh: '你善于跟人相处，并获得别人的青睐和帮助。\n（解锁后永久有效，可选择该角色进入游戏。)',
            'zh-Hant':
                '你善於跟人相處，並獲得他人的青睞和幫助。\n（解鎖後永久有效，可選擇該角色進入遊戲。)',
            ja: '人との付き合いが上手で、他人から好かれて助けられます。\n（アンロック後、永久に有効です。このキャラを選んでゲームを始めることが可能です。）ｴ',
            en: "You are good with interacting with people. You're able to quickly earn their trust and aid. \n (Unlocking this permanently allows you to choose this character).",
        },
        p_104_effect: {
            zh: '额外获得NPC大量礼物。拒绝NPC求助，亲密度不会下降。',
            'zh-Hant': '額外獲得NPC大量禮物。拒絕NPC求助，親密度不會下降。',
            ja: 'NPCから大量のギフトがもらえる。NPCの援助要請を断っても親密度が下がらない。',
            en: "Gain a large bonus to NPC interactions. Refusing an NPC's request will not cause relationship points to drop.",
        },
        p_105_name: {
            zh: '军用背包',
            'zh-Hant': '軍用背包',
            ja: '軍用リュック',
            en: 'Military Grade Backpack',
        },
        p_105_des: {
            zh: '立即制作一个军用背包，负重增加到60。',
            'zh-Hant': '立即製作一個軍用背包，負重增加到60。',
            ja: '直ちに軍用リュック一つを作成して、最大負荷を60まで上昇。ﾌk',
            en: 'Instantly create a military backpack increasing your storage space to 60.',
        },
        p_105_effect: {
            zh: '获得后永久有效。',
            'zh-Hant': '獲得後永久有效。',
            ja: '入手後永久に有効。',
            en: 'Buff stays permanently after purchase.',
        },
        p_106_name: {
            zh: '靴子',
            'zh-Hant': '靴子',
            ja: 'ブーツ',
            en: 'Boots',
        },
        p_106_des: {
            zh: '立即制作一双靴子，玩家移动速度提高到125%',
            'zh-Hant': '立即製作一雙靴子，玩家移動速度提高到125%',
            ja: '直ちにブーツ一足を作成して、移動スピードを125%まで上昇。',
            en: 'Instantly create a pair of boots. Your movement speed will be increased to 125%.',
        },
        p_106_effect: {
            zh: '获得后永久有效。',
            'zh-Hant': '獲得後永久有效。',
            ja: '入手後永久に有効。',
            en: 'Buff stays permantly after purchase.',
        },
        p_107_name: {
            zh: '狗舍',
            'zh-Hant': '狗屋',
            ja: '犬小屋',
            en: 'Kennel',
        },
        p_107_des: {
            zh: '立即建造一间狗舍，增强抵御僵尸夜袭的能力。',
            'zh-Hant': '立即建造一間狗屋，增強抵禦僵屍夜襲的能力。',
            ja: '直ちに犬小屋一つを作成して、ゾンビによる夜間襲撃への防御確率を上昇。ﾎﾞ',
            en: 'Instantly build a kennel. Dogs help you fight off zombie attacks at night.',
        },
        p_107_effect: {
            zh: '获得后永久有效。',
            'zh-Hant': '獲得後永久有效。',
            ja: '入手後永久に有効。',
            en: 'Buff stays permantly after purchase.',
        },
        p_108_name: {
            zh: '人物:老罗',
            'zh-Hant': '人物：老羅',
            ja: 'キャラ：羅じいさん',
            en: 'Character: Mr. Luo',
        },
        p_108_des: {
            zh: '作为前陆战队军官，老罗的优势在于枪械，甚至能自己制作无壳子弹。但是长期酗酒，导致他的战斗力非常不稳定。',
            'zh-Hant':
                '身為前陸戰隊軍官，老羅的優勢在於槍械使用能力，他甚至還能自己製作無殼子彈，但因為長期酗酒，導致戰鬥力相當不穩定。',
            ja: '元陸戦隊幹部として、羅じいさんは銃使いが上手で、さらに薬きょうがない弾丸も作れます。しかし、彼は呑兵衛だから戦闘力が安定しないようです。',
            en: 'As a former marine officer, Mr. Luo knows how to use guns and make bullets, but his long-term alcohol abuse makes him an unstable force in combat.',
        },
        p_108_effect: {
            zh: '可以建造雷区，使用自制炸药抵御僵尸夜袭\n可以建造机床，生产子弹、炸药和僵尸诱饵\n可以喝酒提升心情值，但如果心情值过低导致枪械命中率下降',
            'zh-Hant':
                '可以建造地雷區，利用自製炸藥抵抗殭屍夜襲\n可以建造機床，生產子彈、炸藥和殭屍誘餌\n可以喝酒提升心情值，但若心情值過低會造成槍械命中率下降',
            ja: '爆発ゾーンを仕掛けて、手作り爆薬でゾンビの夜襲を凌げる\n旋盤を作り、弾丸、爆薬とゾンビ餌の生産が可能になる\n酒を飲んで気分ゲージを溜めることが出来るが、気分ゲージが低くなると銃類の命中率が悪くなる',
            en: 'Can build mine fields and use homemade explosives to defend against night raids from zombies.\nCan make machine tools, bullets, explosives, and zombie bait.\nCan increase your Mood by drinking with you (a low Mood will reduce your shooting accuracy).',
        },
        p_109_name: {
            zh: '人物:雅子',
            'zh-Hant': '人物：雅子',
            ja: 'キャラ：雅子',
            en: 'Character: Yazi',
        },
        p_109_des: {
            zh: '雅子是一个来自二次元的电气工程师，喜欢把各种奇思妙想变成现实。',
            'zh-Hant': '雅子是一個來自二次元的電氣工程師，喜歡把各種奇思妙想變成現實。',
            ja: '雅子は二次元から来た電気エンジニアで、様々な奇想を現実に変えるのが好きです。',
            en: 'Yazi is an electrical engineer from another dimension who loves turning wild ideas into reality.',
        },
        p_109_effect: {
            zh: '可以维修发电厂获得电力，可以制造电网、电锯和电极武器',
            'zh-Hant': '可以維修發電廠獲得電力，可以製造電網、電鋸和電極武器',
            ja: '発電所を修理して電力を得られ、電網・チェーンソー・電極武器を製造できる',
            en: 'Can repair the power plant for electricity, and craft electric fences, chainsaws, and electrode weapons',
        },
    };

    return table[key]?.[lan] ?? key;
}
