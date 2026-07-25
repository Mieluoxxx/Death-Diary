/**
 * Port of Buried-City blackList.js (subset used by night raid).
 */

/** Items that cannot be stolen during a home/site night raid. */
export const STORAGE_LOST_BLACKLIST: readonly number[] = [
    1104043, // penicillin
    1105011, // coffee beans
    1106013, // dog
    1106054, // first-aid kit
    1301011, // pistol
    1301022, // shotgun
    1301033, // AR
    1302011, // crowbar
    1302021, // axe
    1302032, // katana
    1302043, // chainsaw
    1303012, // bomb
    1303022, // bait
    1304012, // coat
    1304023, // riot suit
    1305023, // small bag
    1305024, // big bag
    1304024, // boots
    1301041, // magnum
    1301052, // M40
    1301063, // FAMAS
    1305053, // flashlight
    1305064, // detector
    1305034, // motorcycle
    1305044, // falcon
];

export const STORAGE_LOST_SET = new Set(STORAGE_LOST_BLACKLIST);

/** Items excluded when wildcard site loot expands (original blackList.randomLoop). */
export const RANDOM_LOOT_EXCLUDED_SET = new Set<number>([
    1305023, 1305024, 1106013, 1106054, 1304024, 1305034, 1305044, 1305053, 1305064, 1303033,
    1303044, 1102053, 1107012, 1107022, 1107032, 1107042,
]);
