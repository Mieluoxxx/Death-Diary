/**
 * Port of Buried-City `src/util/audioManager.js`.
 *
 * Music / SFX toggles live in settingsStore (localStorage).
 * Playback goes through Phaser SoundManager bound once from Preloader.
 *
 * Nav BGM mapping mirrors BottomFrameNode.current():
 *   HOME / STORAGE / GATE / GATE_OUT / RADIO / BUILD → HOME
 *   MAP → MAP (+ re-roll site track pool)
 *   SITE* / BATTLE_AND_WORK → random SITE_1|2|3
 *   NPC → NPC
 *   Death scene → DEATH (+ re-roll site track pool)
 */

import type { Scene } from 'phaser';
import {
    getMusicOn,
    getSfxOn,
    setMusicOn as persistMusicOn,
    setSfxOn as persistSfxOn,
} from '../settings/settingsStore';

// Nav node names inlined (avoid import cycle with ui/navigation).
const N = {
    HOME: 'HomeNode',
    STORAGE: 'StorageNode',
    GATE: 'GateNode',
    GATE_OUT: 'GateOutNode',
    MAP: 'MapNode',
    SITE: 'SiteNode',
    SITE_STORAGE: 'SiteStorageNode',
    BATTLE_AND_WORK: 'BattleAndWorkNode',
    WORK_ROOM_STORAGE: 'WorkRoomStorageNode',
    RADIO: 'RadioNode',
    NPC: 'NpcNode',
    NPC_STORAGE: 'NpcStorageNode',
} as const;

const MUSIC_BASE = 'audio/music';
const SOUND_BASE = 'audio/sound';

/** Phaser cache keys + public paths for each BGM track. */
export const Music = {
    BATTLE: 'music_battle',
    DEATH: 'music_death',
    HOME: 'music_home',
    NPC: 'music_npc',
    HOME_REST: 'music_home_rest',
    MAIN_PAGE: 'music_mainpage',
    MAP: 'music_map',
    SITE_1: 'music_site_1',
    SITE_2: 'music_site_2',
    SITE_3: 'music_site_3',
    SITE_SECRET: 'music_secret_room',
} as const;

export type MusicKey = (typeof Music)[keyof typeof Music];

/** Phaser cache keys for one-shot SFX (original audioManager.sound). */
export const Sound = {
    ATTACK_1: 'sfx_attack_1',
    ATTACK_2: 'sfx_attack_2',
    ATTACK_3: 'sfx_attack_3',
    ATTACK_4: 'sfx_attack_4',
    ATTACK_5: 'sfx_attack_5',
    ATTACK_6: 'sfx_attack_6',
    ATTACK_7: 'sfx_attack_7',
    ATTACK_8: 'sfx_attack_8',
    BOMB: 'sfx_bomb',
    BUILD_UPGRADE: 'sfx_build_upgrade',
    CLICK: 'sfx_click',
    LOG_POP_UP: 'sfx_log_pop_up',
    LOOT: 'sfx_loot',
    MONSTER_ATTACK: 'sfx_monster_attack',
    MONSTER_DIE: 'sfx_monster_die',
    POPUP: 'sfx_popup',
    TRAP: 'sfx_trap',
    UNDER_ATTACK_MIDNIGHT: 'sfx_under_attack_midnight',
    BARK: 'sfx_bark',
    CLOSE_DOOR: 'sfx_close_door',
    FOOT_STEP: 'sfx_foot_step',
    RADIO: 'sfx_radio',
    BUBBLES: 'sfx_bubbles',
    PUNCH: 'sfx_punch',
    EXCHANGE: 'sfx_exchange',
    BAD_EFFECT: 'sfx_bad_effect',
    GOOD_EFFECT: 'sfx_good_effect',
    NPC_KNOCK: 'sfx_npc_knock',
} as const;

export type SoundKey = (typeof Sound)[keyof typeof Sound];

const SOUND_FILES: Record<SoundKey, string> = {
    [Sound.ATTACK_1]: `${SOUND_BASE}/attack_1.mp3`,
    [Sound.ATTACK_2]: `${SOUND_BASE}/attack_2.mp3`,
    [Sound.ATTACK_3]: `${SOUND_BASE}/attack_3.mp3`,
    [Sound.ATTACK_4]: `${SOUND_BASE}/attack_4.mp3`,
    [Sound.ATTACK_5]: `${SOUND_BASE}/attack_5.mp3`,
    [Sound.ATTACK_6]: `${SOUND_BASE}/attack_6.mp3`,
    [Sound.ATTACK_7]: `${SOUND_BASE}/attack_7.mp3`,
    [Sound.ATTACK_8]: `${SOUND_BASE}/attack_8.mp3`,
    [Sound.BOMB]: `${SOUND_BASE}/bomb.mp3`,
    [Sound.BUILD_UPGRADE]: `${SOUND_BASE}/build_upgrade.mp3`,
    [Sound.CLICK]: `${SOUND_BASE}/click.mp3`,
    [Sound.LOG_POP_UP]: `${SOUND_BASE}/log_pop_up.mp3`,
    [Sound.LOOT]: `${SOUND_BASE}/loot.mp3`,
    [Sound.MONSTER_ATTACK]: `${SOUND_BASE}/monster_attack.mp3`,
    [Sound.MONSTER_DIE]: `${SOUND_BASE}/monster_die.mp3`,
    [Sound.POPUP]: `${SOUND_BASE}/popup.mp3`,
    [Sound.TRAP]: `${SOUND_BASE}/trap.mp3`,
    [Sound.UNDER_ATTACK_MIDNIGHT]: `${SOUND_BASE}/under_attack_midnight.mp3`,
    [Sound.BARK]: `${SOUND_BASE}/bark.mp3`,
    [Sound.CLOSE_DOOR]: `${SOUND_BASE}/close_door.mp3`,
    [Sound.FOOT_STEP]: `${SOUND_BASE}/foot_step.mp3`,
    [Sound.RADIO]: `${SOUND_BASE}/radio.mp3`,
    [Sound.BUBBLES]: `${SOUND_BASE}/bubbles.mp3`,
    [Sound.PUNCH]: `${SOUND_BASE}/punch.mp3`,
    [Sound.EXCHANGE]: `${SOUND_BASE}/exchange.mp3`,
    [Sound.BAD_EFFECT]: `${SOUND_BASE}/bad_effect.mp3`,
    [Sound.GOOD_EFFECT]: `${SOUND_BASE}/good_effect.mp3`,
    [Sound.NPC_KNOCK]: `${SOUND_BASE}/npc_knock.mp3`,
};

/** Melee item id → attack SFX (original Battle weapon._action). */
const MELEE_ATTACK_SFX: Record<number, SoundKey> = {
    1302043: Sound.ATTACK_1,
    1302011: Sound.ATTACK_2,
};

/** Gun item id → attack SFX. */
const GUN_ATTACK_SFX: Record<number, SoundKey> = {
    1301022: Sound.ATTACK_3,
    1301052: Sound.ATTACK_3,
    1301011: Sound.ATTACK_4,
    1301041: Sound.ATTACK_4,
    1301033: Sound.ATTACK_5,
    1301063: Sound.ATTACK_5,
    1301071: Sound.ATTACK_7,
    1301082: Sound.ATTACK_8,
};

const MUSIC_FILES: Record<MusicKey, string> = {
    [Music.BATTLE]: `${MUSIC_BASE}/battle.mp3`,
    [Music.DEATH]: `${MUSIC_BASE}/death.mp3`,
    [Music.HOME]: `${MUSIC_BASE}/home.mp3`,
    [Music.NPC]: `${MUSIC_BASE}/npc.mp3`,
    [Music.HOME_REST]: `${MUSIC_BASE}/home_rest.mp3`,
    [Music.MAIN_PAGE]: `${MUSIC_BASE}/mainpage.mp3`,
    [Music.MAP]: `${MUSIC_BASE}/map.mp3`,
    [Music.SITE_1]: `${MUSIC_BASE}/site_1.mp3`,
    [Music.SITE_2]: `${MUSIC_BASE}/site_2.mp3`,
    [Music.SITE_3]: `${MUSIC_BASE}/site_3.mp3`,
    [Music.SITE_SECRET]: `${MUSIC_BASE}/secret_room.mp3`,
};

const SITE_POOL: readonly MusicKey[] = [Music.SITE_1, Music.SITE_2, Music.SITE_3];

const HOME_NODES: Record<string, true> = {
    [N.HOME]: true,
    [N.STORAGE]: true,
    [N.GATE]: true,
    [N.GATE_OUT]: true,
    [N.RADIO]: true,
};

const SITE_NODES: Record<string, true> = {
    [N.SITE]: true,
    [N.SITE_STORAGE]: true,
    [N.BATTLE_AND_WORK]: true,
    [N.WORK_ROOM_STORAGE]: true,
};
type SoundManager = Phaser.Sound.BaseSoundManager;

let soundMgr: SoundManager | null = null;
let lastMusic: MusicKey | null = null;
let playingMusic: MusicKey | null = null;
/** Active looped BGM instance (Phaser keeps playing across scenes when not stopped). */
let activeInstance: Phaser.Sound.BaseSound | null = null;
/** Ephemeral site-outing BGM pick (re-rolls on MAP / DEATH). */
let siteMusic: MusicKey | null = null;
/** Last nav-driven track (BottomFrame.currentMusic). */
let currentNavMusic: MusicKey | null = null;

function queueAudioFiles(
    scene: Scene,
    musicKeys: readonly MusicKey[],
    soundKeys: readonly SoundKey[],
): number {
    let queued = 0;
    for (const key of musicKeys) {
        if (!scene.cache.audio.exists(key)) {
            scene.load.audio(key, MUSIC_FILES[key]);
            queued += 1;
        }
    }
    for (const key of soundKeys) {
        if (!scene.cache.audio.exists(key)) {
            scene.load.audio(key, SOUND_FILES[key]);
            queued += 1;
        }
    }
    return queued;
}

/** Queue only the audio required by MainMenu. */
export function queueStartupAudio(scene: Scene): number {
    return queueAudioFiles(scene, [Music.MAIN_PAGE], [Sound.CLICK]);
}

/** Queue the remaining game audio before the interactive Home shell starts. */
export function queueGameAudio(scene: Scene): number {
    return queueAudioFiles(
        scene,
        Object.keys(MUSIC_FILES) as MusicKey[],
        Object.keys(SOUND_FILES) as SoundKey[],
    );
}

/** Bind Phaser sound manager once assets are ready. */
export function bindAudio(scene: Scene): void {
    soundMgr = scene.sound;
}

export function needMusic(): boolean {
    return getMusicOn();
}

export function needSfx(): boolean {
    return getSfxOn();
}

export function setMusicEnabled(on: boolean): void {
    persistMusicOn(on);
    if (on) {
        const key = playingMusic;
        if (key) {
            // Force replay of remembered track after toggle-on.
            const remembered = key;
            playingMusic = null;
            if (activeInstance) {
                activeInstance.stop();
                activeInstance.destroy();
                activeInstance = null;
            }
            playMusic(remembered, true);
        }
    } else {
        stopMusic();
    }
}

export function setSfxEnabled(on: boolean): void {
    persistSfxOn(on);
}

/**
 * One-shot SFX. Returns the Phaser sound instance (or null if muted/missing)
 * so callers can stop overlapping attack loops like original effectId.
 */
export function playEffect(key: SoundKey, loop = false): Phaser.Sound.BaseSound | null {
    if (!needSfx() || !soundMgr) {
        return null;
    }
    if (!soundMgr.game.cache.audio.exists(key)) {
        return null;
    }
    const inst = soundMgr.add(key, { loop, volume: 1 });
    inst.once('complete', () => {
        inst.destroy();
    });
    inst.play();
    return inst;
}

export function playClick(): void {
    playEffect(Sound.CLICK);
}

export function playPopup(): void {
    playEffect(Sound.POPUP);
}

/** Weapon attack SFX by equipment item id (melee / gun / hand). */
export function playWeaponAttack(itemId: number, kind: 'melee' | 'gun'): void {
    if (kind === 'melee') {
        if (itemId === 1) {
            // HAND_ITEM_ID — original Equipment.HAND → PUNCH
            playEffect(Sound.PUNCH);
            return;
        }
        playEffect(MELEE_ATTACK_SFX[itemId] ?? Sound.ATTACK_6);
        return;
    }
    playEffect(GUN_ATTACK_SFX[itemId] ?? Sound.ATTACK_4);
}

/** Currently playing BGM key, or null. Original audioManager.getPlayingMusic. */
export function getPlayingMusic(): MusicKey | null {
    return playingMusic;
}

/**
 * Original battleAndWorkNode.afterInit music swap: secret theme in the caves,
 * site theme outside. Shared by battleNode and siteNode.
 */
export function applySecretRoomMusic(active: boolean): void {
    if (active) {
        if (getPlayingMusic() !== Music.SITE_SECRET) {
            playMusic(Music.SITE_SECRET);
        }
    } else if (getPlayingMusic() === Music.SITE_SECRET) {
        playMusic(getSiteMusic());
    }
}

export function getSiteMusic(): MusicKey {
    if (!siteMusic) {
        siteMusic = SITE_POOL[Math.floor(Math.random() * SITE_POOL.length)] ?? Music.SITE_1;
    }
    return siteMusic;
}

/** Original Navigation.changeSiteMusic — re-roll on MAP / DEATH. */
export function changeSiteMusic(): void {
    siteMusic = null;
}

/**
 * Play BGM. Always updates lastMusic/playingMusic even if muted
 * (so toggle-on / resume can restore the right track).
 */
export function playMusic(key: MusicKey, loop = true): void {
    lastMusic = playingMusic;
    playingMusic = key;

    if (!needMusic() || !soundMgr) {
        return;
    }
    if (!soundMgr.game.cache.audio.exists(key)) {
        return;
    }

    // Same key already looping → leave it.
    if (activeInstance && activeInstance.key === key && activeInstance.isPlaying) {
        return;
    }

    if (activeInstance) {
        activeInstance.stop();
        activeInstance.destroy();
        activeInstance = null;
    }

    const inst = soundMgr.add(key, { loop, volume: 1 });
    activeInstance = inst;
    inst.play();
}

export function stopMusic(_releaseData?: unknown): void {
    if (activeInstance) {
        activeInstance.stop();
        activeInstance.destroy();
        activeInstance = null;
    }
    // Keep playingMusic so setMusicEnabled(true) / nav can resume intent.
    // Original stopMusic only stops engine; playingMusic stays until next playMusic.
}

/** Swap to a temporary track (battle / chair rest); previous becomes lastMusic. */
export function insertMusic(key: MusicKey): void {
    if (playingMusic) {
        stopMusic(playingMusic);
    }
    playMusic(key, true);
}

/** Stop insert and restore lastMusic (battle end / leave chair). */
export function resumeMusic(): void {
    stopMusic(playingMusic);
    if (lastMusic) {
        playMusic(lastMusic, true);
    }
}

/**
 * Apply BottomFrame-style BGM for a nav node.
 * No-op when the resolved track equals the current nav track.
 */
export function applyNavMusic(nodeName: string): void {
    let musicName: MusicKey | null = null;

    if (HOME_NODES[nodeName]) {
        musicName = Music.HOME;
    } else if (nodeName === N.MAP) {
        musicName = Music.MAP;
        changeSiteMusic();
    } else if (nodeName === N.NPC || nodeName === N.NPC_STORAGE) {
        musicName = Music.NPC;
    } else if (SITE_NODES[nodeName]) {
        musicName = getSiteMusic();
    }

    if (musicName && musicName !== currentNavMusic) {
        stopMusic(currentNavMusic);
        currentNavMusic = musicName;
        playMusic(musicName, true);
    }
}

/** Death scene BGM (not a NavNode in the web port). */
export function applyDeathMusic(): void {
    changeSiteMusic();
    if (currentNavMusic !== Music.DEATH) {
        stopMusic(currentNavMusic);
        currentNavMusic = Music.DEATH;
        playMusic(Music.DEATH, true);
    }
}

/** Main menu BGM. */
export function applyMainPageMusic(): void {
    currentNavMusic = null;
    playMusic(Music.MAIN_PAGE, true);
}
