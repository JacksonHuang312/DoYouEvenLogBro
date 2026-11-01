import type { AccessoryEffect, ClassId, Focus, Slot, WeaponType } from "./config";

/*
 * THE ITEM LIST (GAME_DESIGN.md 5 and 13.5). This is the only file to edit to add items. Names, focus and
 * where they fit only: an item's rarity and level are rolled when it drops, and its power comes from
 * those and its upgrade level (config.ts).
 *
 * To add an item, add one line to ITEMS:
 *
 *   { id: "iron-ring", name: "Iron Ring", slot: "ring", focus: { atk: 70, hp: 30 }, effect: "crit" },
 *
 *   id      Unique and never changed or reused: owned items point at it. Set armor ids are "<set>-<slot>".
 *   name    What the player sees.
 *   slot    weapon, helmet, chestplate, gloves, leggings, boots, ring, necklace, belt or charm.
 *   focus   Optional. How its power splits over HP / ATK / DEF, in whole percents adding up to 100.
 *           Left out, it falls back to the slot's usual split (config.ts, GEAR.slotFocus).
 *           Set pieces take the set's focus and weapons their type's: don't give them one.
 *   set     Optional. The id of a set in SETS. Only armor can be in a set.
 *   weapon  Weapons only: sword, staff or shield (config.ts, WEAPONS).
 *   band    Weapons only: the level band (config.ts, LEVEL_BANDS) it drops in. Set pieces take the set's.
 *   mythic  Optional. A unique item that is always Mythic, with its own effect from MYTHIC_EFFECTS.
 *   effect  Every accessory needs one from ACCESSORY_EFFECTS in config.ts; every Mythic its own from MYTHIC_EFFECTS.
 *
 * Rules (catalog.test.ts enforces them):
 *   - Every item but a Mythic can drop at any rarity, Common to Legendary, at any item level.
 *   - One set per class in each level band, with 5 armor pieces each (one per slot) and a 5-piece
 *     effect (SETS `effect`, at Legendary strength, scaled by the lowest rarity worn).
 *   - Loose armor and accessories fit any level. Accessories and weapons are never in a set.
 *
 * To add a set, add a line to SETS, then five ITEMS lines with `set`.
 */
export interface SetEntry {
  id: string;
  name: string;
  classId: ClassId;
  /** The first level of its band (LEVEL_BANDS): it drops from there to the next band. */
  band: number;
  /** Shared by all five pieces. */
  focus: Focus;
  /** An effect while all five pieces are worn, at Legendary strength. */
  effect: { id: AccessoryEffect; value: number };
}
export interface ItemEntry {
  id: string;
  name: string;
  slot: Slot;
  set?: string;
  weapon?: WeaponType;
  band?: number;
  mythic?: true;
  effect?: string;
  focus?: Focus;
}
// One set per class in each level band (GAME_DESIGN.md 13.5): Vanguard, Striker, Cleric.
export const SETS: SetEntry[] = [
  { id: "hearthguard", name: "Hearthguard", classId: "vanguard", band: 1, focus: { def: 60, hp: 40 }, effect: { id: "guardDuration", value: 0.1 } },
  { id: "swiftfang", name: "Swiftfang", classId: "striker", band: 1, focus: { atk: 70, hp: 30 }, effect: { id: "finisher", value: 0.1 } },
  { id: "acolyte", name: "Acolyte", classId: "cleric", band: 1, focus: { hp: 60, def: 40 }, effect: { id: "healPower", value: 0.1 } },
  { id: "steelguard", name: "Steelguard", classId: "vanguard", band: 20, focus: { def: 60, hp: 40 }, effect: { id: "bastionShield", value: 0.125 } },
  { id: "thornweave", name: "Thornweave", classId: "striker", band: 20, focus: { atk: 70, hp: 30 }, effect: { id: "critDamage", value: 0.125 } },
  { id: "lightwoven", name: "Lightwoven", classId: "cleric", band: 20, focus: { hp: 60, def: 40 }, effect: { id: "healPower", value: 0.125 } },
  { id: "warden", name: "Warden", classId: "vanguard", band: 40, focus: { hp: 100 }, effect: { id: "guardDuration", value: 0.15 } },
  { id: "stormcaller", name: "Stormcaller", classId: "striker", band: 40, focus: { atk: 100 }, effect: { id: "finisher", value: 0.15 } },
  { id: "dawnkeeper", name: "Dawnkeeper", classId: "cleric", band: 40, focus: { hp: 70, def: 30 }, effect: { id: "healPower", value: 0.15 } },
  { id: "ironwall", name: "Ironwall", classId: "vanguard", band: 60, focus: { def: 50, hp: 50 }, effect: { id: "bastionShield", value: 0.175 } },
  { id: "duskblade", name: "Duskblade", classId: "striker", band: 60, focus: { atk: 80, def: 20 }, effect: { id: "critDamage", value: 0.175 } },
  { id: "sunward", name: "Sunward", classId: "cleric", band: 60, focus: { hp: 70, def: 30 }, effect: { id: "healPower", value: 0.175 } },
  { id: "titans-vow", name: "Titan's Vow", classId: "vanguard", band: 80, focus: { hp: 100 }, effect: { id: "bastionShield", value: 0.2 } },
  { id: "ashen-covenant", name: "Ashen Covenant", classId: "striker", band: 80, focus: { atk: 70, def: 30 }, effect: { id: "critDamage", value: 0.2 } },
  { id: "seraphs-grace", name: "Seraph's Grace", classId: "cleric", band: 80, focus: { hp: 60, def: 40 }, effect: { id: "healPower", value: 0.2 } },
];
export const ITEMS: ItemEntry[] = [
  // ---- Sets, levels 1-19 ----
  { id: "hearthguard-helmet", name: "Hearthguard Helm", slot: "helmet", set: "hearthguard" },
  { id: "hearthguard-chestplate", name: "Hearthguard Breastplate", slot: "chestplate", set: "hearthguard" },
  { id: "hearthguard-gloves", name: "Hearthguard Gauntlets", slot: "gloves", set: "hearthguard" },
  { id: "hearthguard-leggings", name: "Hearthguard Greaves", slot: "leggings", set: "hearthguard" },
  { id: "hearthguard-boots", name: "Hearthguard Boots", slot: "boots", set: "hearthguard" },
  { id: "swiftfang-helmet", name: "Swiftfang Mask", slot: "helmet", set: "swiftfang" },
  { id: "swiftfang-chestplate", name: "Swiftfang Jerkin", slot: "chestplate", set: "swiftfang" },
  { id: "swiftfang-gloves", name: "Swiftfang Grips", slot: "gloves", set: "swiftfang" },
  { id: "swiftfang-leggings", name: "Swiftfang Leggings", slot: "leggings", set: "swiftfang" },
  { id: "swiftfang-boots", name: "Swiftfang Boots", slot: "boots", set: "swiftfang" },
  { id: "acolyte-helmet", name: "Acolyte's Hood", slot: "helmet", set: "acolyte" },
  { id: "acolyte-chestplate", name: "Acolyte's Robe", slot: "chestplate", set: "acolyte" },
  { id: "acolyte-gloves", name: "Acolyte's Gloves", slot: "gloves", set: "acolyte" },
  { id: "acolyte-leggings", name: "Acolyte's Leggings", slot: "leggings", set: "acolyte" },
  { id: "acolyte-boots", name: "Acolyte's Sandals", slot: "boots", set: "acolyte" },
  // ---- Sets, levels 20-39 ----
  { id: "steelguard-helmet", name: "Steelguard Helm", slot: "helmet", set: "steelguard" },
  { id: "steelguard-chestplate", name: "Steelguard Cuirass", slot: "chestplate", set: "steelguard" },
  { id: "steelguard-gloves", name: "Steelguard Gauntlets", slot: "gloves", set: "steelguard" },
  { id: "steelguard-leggings", name: "Steelguard Tassets", slot: "leggings", set: "steelguard" },
  { id: "steelguard-boots", name: "Steelguard Sabatons", slot: "boots", set: "steelguard" },
  { id: "thornweave-helmet", name: "Thornweave Cowl", slot: "helmet", set: "thornweave" },
  { id: "thornweave-chestplate", name: "Thornweave Hauberk", slot: "chestplate", set: "thornweave" },
  { id: "thornweave-gloves", name: "Thornweave Wraps", slot: "gloves", set: "thornweave" },
  { id: "thornweave-leggings", name: "Thornweave Chausses", slot: "leggings", set: "thornweave" },
  { id: "thornweave-boots", name: "Thornweave Treads", slot: "boots", set: "thornweave" },
  { id: "lightwoven-helmet", name: "Lightwoven Hood", slot: "helmet", set: "lightwoven" },
  { id: "lightwoven-chestplate", name: "Lightwoven Robe", slot: "chestplate", set: "lightwoven" },
  { id: "lightwoven-gloves", name: "Lightwoven Mitts", slot: "gloves", set: "lightwoven" },
  { id: "lightwoven-leggings", name: "Lightwoven Leggings", slot: "leggings", set: "lightwoven" },
  { id: "lightwoven-boots", name: "Lightwoven Slippers", slot: "boots", set: "lightwoven" },
  // ---- Sets, levels 40-59 ----
  { id: "warden-helmet", name: "Warden Visor", slot: "helmet", set: "warden" },
  { id: "warden-chestplate", name: "Warden Hauberk", slot: "chestplate", set: "warden" },
  { id: "warden-gloves", name: "Warden Fists", slot: "gloves", set: "warden" },
  { id: "warden-leggings", name: "Warden Greaves", slot: "leggings", set: "warden" },
  { id: "warden-boots", name: "Warden Striders", slot: "boots", set: "warden" },
  { id: "stormcaller-helmet", name: "Stormcaller Circlet", slot: "helmet", set: "stormcaller" },
  { id: "stormcaller-chestplate", name: "Stormcaller Raiment", slot: "chestplate", set: "stormcaller" },
  { id: "stormcaller-gloves", name: "Stormcaller Talons", slot: "gloves", set: "stormcaller" },
  { id: "stormcaller-leggings", name: "Stormcaller Legwraps", slot: "leggings", set: "stormcaller" },
  { id: "stormcaller-boots", name: "Stormcaller Sandals", slot: "boots", set: "stormcaller" },
  { id: "dawnkeeper-helmet", name: "Dawnkeeper Veil", slot: "helmet", set: "dawnkeeper" },
  { id: "dawnkeeper-chestplate", name: "Dawnkeeper Vestment", slot: "chestplate", set: "dawnkeeper" },
  { id: "dawnkeeper-gloves", name: "Dawnkeeper Gloves", slot: "gloves", set: "dawnkeeper" },
  { id: "dawnkeeper-leggings", name: "Dawnkeeper Skirt", slot: "leggings", set: "dawnkeeper" },
  { id: "dawnkeeper-boots", name: "Dawnkeeper Steps", slot: "boots", set: "dawnkeeper" },
  // ---- Sets, levels 60-79 ----
  { id: "ironwall-helmet", name: "Ironwall Helm", slot: "helmet", set: "ironwall" },
  { id: "ironwall-chestplate", name: "Ironwall Cuirass", slot: "chestplate", set: "ironwall" },
  { id: "ironwall-gloves", name: "Ironwall Gauntlets", slot: "gloves", set: "ironwall" },
  { id: "ironwall-leggings", name: "Ironwall Greaves", slot: "leggings", set: "ironwall" },
  { id: "ironwall-boots", name: "Ironwall Sabatons", slot: "boots", set: "ironwall" },
  { id: "duskblade-helmet", name: "Duskblade Hood", slot: "helmet", set: "duskblade" },
  { id: "duskblade-chestplate", name: "Duskblade Coat", slot: "chestplate", set: "duskblade" },
  { id: "duskblade-gloves", name: "Duskblade Claws", slot: "gloves", set: "duskblade" },
  { id: "duskblade-leggings", name: "Duskblade Breeches", slot: "leggings", set: "duskblade" },
  { id: "duskblade-boots", name: "Duskblade Striders", slot: "boots", set: "duskblade" },
  { id: "sunward-helmet", name: "Sunward Circlet", slot: "helmet", set: "sunward" },
  { id: "sunward-chestplate", name: "Sunward Vestment", slot: "chestplate", set: "sunward" },
  { id: "sunward-gloves", name: "Sunward Mitts", slot: "gloves", set: "sunward" },
  { id: "sunward-leggings", name: "Sunward Skirt", slot: "leggings", set: "sunward" },
  { id: "sunward-boots", name: "Sunward Slippers", slot: "boots", set: "sunward" },
  // ---- Sets, levels 80-100 ----
  { id: "titans-vow-helmet", name: "Titan's Crest", slot: "helmet", set: "titans-vow" },
  { id: "titans-vow-chestplate", name: "Titan's Mantle", slot: "chestplate", set: "titans-vow" },
  { id: "titans-vow-gloves", name: "Titan's Grasp", slot: "gloves", set: "titans-vow" },
  { id: "titans-vow-leggings", name: "Titan's Pillars", slot: "leggings", set: "titans-vow" },
  { id: "titans-vow-boots", name: "Titan's March", slot: "boots", set: "titans-vow" },
  { id: "ashen-covenant-helmet", name: "Ashen Crown", slot: "helmet", set: "ashen-covenant" },
  { id: "ashen-covenant-chestplate", name: "Ashen Shroud", slot: "chestplate", set: "ashen-covenant" },
  { id: "ashen-covenant-gloves", name: "Ashen Claws", slot: "gloves", set: "ashen-covenant" },
  { id: "ashen-covenant-leggings", name: "Ashen Cinders", slot: "leggings", set: "ashen-covenant" },
  { id: "ashen-covenant-boots", name: "Ashen Stride", slot: "boots", set: "ashen-covenant" },
  { id: "seraphs-grace-helmet", name: "Seraph's Halo", slot: "helmet", set: "seraphs-grace" },
  { id: "seraphs-grace-chestplate", name: "Seraph's Wings", slot: "chestplate", set: "seraphs-grace" },
  { id: "seraphs-grace-gloves", name: "Seraph's Touch", slot: "gloves", set: "seraphs-grace" },
  { id: "seraphs-grace-leggings", name: "Seraph's Vigil", slot: "leggings", set: "seraphs-grace" },
  { id: "seraphs-grace-boots", name: "Seraph's Ascent", slot: "boots", set: "seraphs-grace" },
  // ---- Weapons: one per type in each level band, never in a set ----
  { id: "recruits-blade", name: "Recruit's Blade", slot: "weapon", weapon: "sword", band: 1 },
  { id: "steel-longsword", name: "Steel Longsword", slot: "weapon", weapon: "sword", band: 20 },
  { id: "runed-broadsword", name: "Runed Broadsword", slot: "weapon", weapon: "sword", band: 40 },
  { id: "duskfang-saber", name: "Duskfang Saber", slot: "weapon", weapon: "sword", band: 60 },
  { id: "sunsteel-greatsword", name: "Sunsteel Greatsword", slot: "weapon", weapon: "sword", band: 80 },
  { id: "willow-staff", name: "Willow Staff", slot: "weapon", weapon: "staff", band: 1 },
  { id: "pilgrims-staff", name: "Pilgrim's Staff", slot: "weapon", weapon: "staff", band: 20 },
  { id: "moonwood-staff", name: "Moonwood Staff", slot: "weapon", weapon: "staff", band: 40 },
  { id: "lumen-rod", name: "Lumen Rod", slot: "weapon", weapon: "staff", band: 60 },
  { id: "seraph-scepter", name: "Seraph Scepter", slot: "weapon", weapon: "staff", band: 80 },
  { id: "wooden-buckler", name: "Wooden Buckler", slot: "weapon", weapon: "shield", band: 1 },
  { id: "iron-kite-shield", name: "Iron Kite Shield", slot: "weapon", weapon: "shield", band: 20 },
  { id: "tower-shield", name: "Tower Shield", slot: "weapon", weapon: "shield", band: 40 },
  { id: "ironwall-aegis", name: "Ironwall Aegis", slot: "weapon", weapon: "shield", band: 60 },
  { id: "titans-bulwark", name: "Titan's Bulwark", slot: "weapon", weapon: "shield", band: 80 },
  // ---- Loose armor: any level, any rarity ----
  // Ironbound and Wayfarer have no focus on purpose: it uses the slot's usual split.
  { id: "ironbound-helmet", name: "Ironbound Helm", slot: "helmet" },
  { id: "ironbound-chestplate", name: "Ironbound Plate", slot: "chestplate" },
  { id: "ironbound-gloves", name: "Ironbound Gloves", slot: "gloves" },
  { id: "ironbound-leggings", name: "Ironbound Legguards", slot: "leggings" },
  { id: "ironbound-boots", name: "Ironbound Boots", slot: "boots" },
  { id: "patchwork-helmet", name: "Patchwork Cap", slot: "helmet", focus: { hp: 100 } },
  { id: "patchwork-chestplate", name: "Patchwork Vest", slot: "chestplate", focus: { hp: 50, def: 50 } },
  { id: "patchwork-gloves", name: "Patchwork Mitts", slot: "gloves", focus: { atk: 50, hp: 50 } },
  { id: "patchwork-leggings", name: "Patchwork Breeches", slot: "leggings", focus: { hp: 60, def: 40 } },
  { id: "patchwork-boots", name: "Patchwork Wraps", slot: "boots", focus: { def: 100 } },
  { id: "scrapper-helmet", name: "Scrapper Pot", slot: "helmet", focus: { def: 80, atk: 20 } },
  { id: "scrapper-chestplate", name: "Scrapper Brigandine", slot: "chestplate", focus: { def: 100 } },
  { id: "scrapper-gloves", name: "Scrapper Cuffs", slot: "gloves", focus: { atk: 100 } },
  { id: "scrapper-leggings", name: "Scrapper Chaps", slot: "leggings", focus: { atk: 60, def: 40 } },
  { id: "scrapper-boots", name: "Scrapper Clogs", slot: "boots", focus: { atk: 40, hp: 60 } },

  { id: "wayfarer-helmet", name: "Wayfarer Hood", slot: "helmet" },
  { id: "wayfarer-chestplate", name: "Wayfarer Jerkin", slot: "chestplate" },
  { id: "wayfarer-gloves", name: "Wayfarer Grips", slot: "gloves" },
  { id: "wayfarer-leggings", name: "Wayfarer Trousers", slot: "leggings" },
  { id: "wayfarer-boots", name: "Wayfarer Treads", slot: "boots" },
  { id: "drifter-helmet", name: "Drifter Cowl", slot: "helmet", focus: { hp: 80, atk: 20 } },
  { id: "drifter-chestplate", name: "Drifter Coat", slot: "chestplate", focus: { hp: 100 } },
  { id: "drifter-gloves", name: "Drifter Wristlets", slot: "gloves", focus: { atk: 80, def: 20 } },
  { id: "drifter-leggings", name: "Drifter Leggings", slot: "leggings", focus: { def: 70, hp: 30 } },
  { id: "drifter-boots", name: "Drifter Soles", slot: "boots", focus: { atk: 50, def: 50 } },
  { id: "hunter-helmet", name: "Hunter Cap", slot: "helmet", focus: { atk: 60, hp: 40 } },
  { id: "hunter-chestplate", name: "Hunter Tunic", slot: "chestplate", focus: { atk: 40, def: 60 } },
  { id: "hunter-gloves", name: "Hunter Bracers", slot: "gloves", focus: { atk: 100 } },
  { id: "hunter-leggings", name: "Hunter Kilt", slot: "leggings", focus: { atk: 70, hp: 30 } },
  { id: "hunter-boots", name: "Hunter Moccasins", slot: "boots", focus: { hp: 50, atk: 50 } },

  // ---- Mythic: unique items, each with its own effect. Always Mythic, at the level they drop ----
  { id: "unbroken-helmet", name: "Revenant's Crown", slot: "helmet", mythic: true, focus: { hp: 100 }, effect: "unbroken-crown" },
  { id: "unbroken-chestplate", name: "Thornheart Cuirass", slot: "chestplate", mythic: true, focus: { def: 100 }, effect: "unbroken-heart" },
  { id: "unbroken-gloves", name: "Stormfist Gauntlets", slot: "gloves", mythic: true, focus: { atk: 100 }, effect: "unbroken-hands" },
  { id: "unbroken-leggings", name: "Verdant Greaves", slot: "leggings", mythic: true, focus: { hp: 100 }, effect: "unbroken-pillars" },
  { id: "unbroken-boots", name: "Timewarden's Treads", slot: "boots", mythic: true, focus: { atk: 100 }, effect: "unbroken-path" },
  { id: "bloodletter-gauntlets", name: "Bloodletter Gauntlets", slot: "gloves", mythic: true, focus: { atk: 100 }, effect: "bloodletter-gauntlets" },
  { id: "bulwark-plate", name: "Bulwark Plate", slot: "chestplate", mythic: true, focus: { def: 100 }, effect: "bulwark-plate" },
  { id: "executioners-ring", name: "Executioner's Ring", slot: "ring", mythic: true, focus: { atk: 100 }, effect: "executioners-ring" },
  { id: "oathkeeper-belt", name: "Oathkeeper Belt", slot: "belt", mythic: true, focus: { def: 100 }, effect: "oathkeeper-belt" },
  { id: "saints-locket", name: "Saint's Locket", slot: "necklace", mythic: true, focus: { hp: 100 }, effect: "saints-locket" },
  { id: "dawn-censer", name: "Dawn Censer", slot: "charm", mythic: true, focus: { hp: 100 }, effect: "dawn-censer" },
  { id: "kingsbane", name: "Kingsbane", slot: "weapon", weapon: "sword", mythic: true, effect: "kingsbane" },
  { id: "staff-of-first-light", name: "Staff of First Light", slot: "weapon", weapon: "staff", mythic: true, effect: "first-light" },
  { id: "unyielding-wall", name: "The Unyielding Wall", slot: "weapon", weapon: "shield", mythic: true, effect: "unyielding-wall" },

  // ---- Accessories: never in a set ----

  // Rings lean ATK.
  { id: "copper-band", name: "Copper Band", slot: "ring", focus: { atk: 70, hp: 30 }, effect: "crit" },
  { id: "bronze-signet", name: "Bronze Signet", slot: "ring", focus: { atk: 70, def: 30 }, effect: "crit" },
  { id: "silver-loop", name: "Silver Loop", slot: "ring", focus: { atk: 80, hp: 20 }, effect: "crit" },
  { id: "gold-seal", name: "Gold Seal", slot: "ring", focus: { atk: 70, hp: 30 }, effect: "crit" },
  { id: "sunforged-ring", name: "Sunforged Ring", slot: "ring", focus: { atk: 80, def: 20 }, effect: "crit" },
  { id: "bone-ring", name: "Bone Ring", slot: "ring", focus: { atk: 80, hp: 20 }, effect: "critDamage" },
  { id: "fang-band", name: "Fang Band", slot: "ring", focus: { atk: 70, hp: 30 }, effect: "lifesteal" },
  { id: "blood-garnet", name: "Blood Garnet", slot: "ring", focus: { atk: 80, hp: 20 }, effect: "finisher" },
  { id: "hunters-seal", name: "Hunter's Seal", slot: "ring", focus: { atk: 80, def: 20 }, effect: "critDamage" },
  { id: "reapers-coil", name: "Reaper's Coil", slot: "ring", focus: { atk: 90, hp: 10 }, effect: "finisher" },

  // Necklaces lean HP / DEF.
  { id: "twine-pendant", name: "Twine Pendant", slot: "necklace", focus: { hp: 60, def: 40 }, effect: "healing" },
  { id: "bead-strand", name: "Bead Strand", slot: "necklace", focus: { hp: 70, def: 30 }, effect: "healing" },
  { id: "silver-locket", name: "Silver Locket", slot: "necklace", focus: { hp: 50, def: 50 }, effect: "healing" },
  { id: "amber-torque", name: "Amber Torque", slot: "necklace", focus: { hp: 60, def: 40 }, effect: "healing" },
  { id: "heartstone-pendant", name: "Heartstone Pendant", slot: "necklace", focus: { hp: 70, def: 30 }, effect: "healing" },
  { id: "prayer-beads", name: "Prayer Beads", slot: "necklace", focus: { hp: 70, def: 30 }, effect: "healPower" },
  { id: "clearwater-vial", name: "Clearwater Vial", slot: "necklace", focus: { hp: 60, def: 40 }, effect: "bleedResist" },
  { id: "sun-medallion", name: "Sun Medallion", slot: "necklace", focus: { hp: 70, def: 30 }, effect: "healPower" },
  { id: "pilgrims-torque", name: "Pilgrim's Torque", slot: "necklace", focus: { hp: 60, def: 40 }, effect: "bleedResist" },
  { id: "halo-pendant", name: "Halo Pendant", slot: "necklace", focus: { hp: 80, def: 20 }, effect: "healPower" },

  // Belts lean DEF.
  { id: "rope-belt", name: "Rope Belt", slot: "belt", focus: { def: 80, hp: 20 }, effect: "damageReduction" },
  { id: "leather-belt", name: "Leather Belt", slot: "belt", focus: { def: 70, hp: 30 }, effect: "damageReduction" },
  { id: "studded-belt", name: "Studded Belt", slot: "belt", focus: { def: 100 }, effect: "damageReduction" },
  { id: "iron-girdle", name: "Iron Girdle", slot: "belt", focus: { def: 80, hp: 20 }, effect: "damageReduction" },
  { id: "mountainheart-girdle", name: "Mountainheart Girdle", slot: "belt", focus: { def: 70, hp: 30 }, effect: "damageReduction" },
  { id: "cord-sash", name: "Cord Sash", slot: "belt", focus: { def: 70, hp: 30 }, effect: "guardDuration" },
  { id: "buckler-belt", name: "Buckler Belt", slot: "belt", focus: { def: 80, hp: 20 }, effect: "thorns" },
  { id: "shield-strap", name: "Shield Strap", slot: "belt", focus: { def: 70, hp: 30 }, effect: "bastionShield" },
  { id: "bastion-girdle", name: "Bastion Girdle", slot: "belt", focus: { def: 80, hp: 20 }, effect: "guardDuration" },
  { id: "thornhide-belt", name: "Thornhide Belt", slot: "belt", focus: { def: 70, hp: 30 }, effect: "thorns" },

  // Charms spread their power.
  { id: "lucky-pebble", name: "Lucky Pebble", slot: "charm", focus: { hp: 34, atk: 33, def: 33 }, effect: "salvageYield" },
  { id: "fox-tooth", name: "Fox Tooth", slot: "charm", focus: { hp: 40, atk: 30, def: 30 }, effect: "rerollDiscount" },
  { id: "hourglass-charm", name: "Hourglass Charm", slot: "charm", focus: { hp: 30, atk: 40, def: 30 }, effect: "haste" },
  { id: "tinkers-cog", name: "Tinker's Cog", slot: "charm", focus: { hp: 34, atk: 33, def: 33 }, effect: "salvageYield" },
  { id: "chrono-charm", name: "Chrono Charm", slot: "charm", focus: { hp: 30, atk: 30, def: 40 }, effect: "haste" },
  { id: "spark-charm", name: "Spark Charm", slot: "charm", focus: { hp: 30, atk: 40, def: 30 }, effect: "ultCharge" },
  { id: "feather-charm", name: "Feather Charm", slot: "charm", focus: { hp: 30, atk: 40, def: 30 }, effect: "haste" },
  { id: "storm-bead", name: "Storm Bead", slot: "charm", focus: { hp: 30, atk: 40, def: 30 }, effect: "ultCharge" },
  { id: "thunder-charm", name: "Thunder Charm", slot: "charm", focus: { hp: 34, atk: 33, def: 33 }, effect: "ultCharge" },
  { id: "phoenix-charm", name: "Phoenix Charm", slot: "charm", focus: { hp: 40, atk: 30, def: 30 }, effect: "ultCharge" },
];
