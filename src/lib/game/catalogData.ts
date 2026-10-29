import type { AccessoryEffect, Focus, Rarity, Slot } from "./config";

/*
 * THE ITEM LIST (GAME_DESIGN.md 5 and 10). This is the only file to edit to add items. Names and
 * focus only: an item's power comes from its rarity and upgrade level (config.ts).
 *
 * To add an item, add one line to ITEMS:
 *
 *   { id: "iron-ring", name: "Iron Ring", slot: "ring", rarity: "common", focus: { atk: 70, hp: 30 }, effect: "crit" },
 *
 *   id      Unique and never changed or reused: owned items point at it. Armor ids are "<family>-<slot>".
 *   name    What the player sees.
 *   slot    helmet, chestplate, gloves, leggings, boots, ring, necklace, belt or charm.
 *   rarity  The rarity a new copy starts at. Starting at Legendary or Mythic makes the item "named".
 *   focus   Optional. How its power splits over HP / ATK / DEF, in whole percents adding up to 100.
 *           Left out, it falls back to the slot's usual split (config.ts, GEAR.slotFocus).
 *           A Mythic is 100% one attribute. Pieces of a set take the set's focus: don't give them one.
 *   set     Optional. The id of a set in SETS. Only Rare, Epic and Legendary armor can be in a set.
 *   effect  Optional. An effect id. Every accessory needs one from ACCESSORY_EFFECTS in config.ts;
 *           every Mythic (accessories included) needs its own unique one from MYTHIC_EFFECTS.
 *
 * Rules (catalog.test.ts enforces them):
 *   - Common and Uncommon items have no sets: they are loose items, several per slot.
 *   - Sets exist only at Rare, Epic and Legendary, with 5 armor pieces each (one per slot). Rare and
 *     Epic sets are unnamed; Legendary sets are named.
 *   - Mythic has no sets: each Mythic is a standalone named item with its own unique effect.
 *   - Epic and Legendary sets may carry a 5-piece effect (SETS `effect`): an ACCESSORY_EFFECTS id and its
 *     value, added to that effect's total while all five pieces are worn.
 *   - Accessories are never in a set.
 *
 * To add a set, add a line to SETS, then five ITEMS lines with `set` and the same rarity.
 */

export interface SetEntry {
  id: string;
  name: string;
  rarity: Rarity;
  /** Shared by all five pieces. */
  focus: Focus;
  /** Epic and Legendary sets: an effect while all five pieces are worn. */
  effect?: { id: AccessoryEffect; value: number };
}

export interface ItemEntry {
  id: string;
  name: string;
  slot: Slot;
  rarity: Rarity;
  set?: string;
  effect?: string;
  focus?: Focus;
}

// One set per class at each rarity: Vanguard, Striker, Cleric.
export const SETS: SetEntry[] = [
  { id: "steelguard", name: "Steelguard", rarity: "rare", focus: { def: 60, hp: 40 } },
  { id: "thornweave", name: "Thornweave", rarity: "rare", focus: { atk: 70, hp: 30 } },
  { id: "lightwoven", name: "Lightwoven", rarity: "rare", focus: { hp: 60, def: 40 } },
  { id: "warden", name: "Warden", rarity: "epic", focus: { hp: 100 }, effect: { id: "guardDuration", value: 0.15 } },
  { id: "stormcaller", name: "Stormcaller", rarity: "epic", focus: { atk: 100 }, effect: { id: "finisher", value: 0.125 } },
  { id: "dawnkeeper", name: "Dawnkeeper", rarity: "epic", focus: { hp: 70, def: 30 }, effect: { id: "healPower", value: 0.125 } },
  { id: "titans-vow", name: "Titan's Vow", rarity: "legendary", focus: { hp: 100 }, effect: { id: "bastionShield", value: 0.2 } },
  { id: "ashen-covenant", name: "Ashen Covenant", rarity: "legendary", focus: { atk: 70, def: 30 }, effect: { id: "critDamage", value: 0.2 } },
  { id: "seraphs-grace", name: "Seraph's Grace", rarity: "legendary", focus: { hp: 60, def: 40 }, effect: { id: "healPower", value: 0.2 } },
];

export const ITEMS: ItemEntry[] = [
  // ---- Common: loose items ----
  // Ironbound has no focus on purpose: it uses the slot's usual split.
  { id: "ironbound-helmet", name: "Ironbound Helm", slot: "helmet", rarity: "common" },
  { id: "ironbound-chestplate", name: "Ironbound Plate", slot: "chestplate", rarity: "common" },
  { id: "ironbound-gloves", name: "Ironbound Gloves", slot: "gloves", rarity: "common" },
  { id: "ironbound-leggings", name: "Ironbound Legguards", slot: "leggings", rarity: "common" },
  { id: "ironbound-boots", name: "Ironbound Boots", slot: "boots", rarity: "common" },
  { id: "patchwork-helmet", name: "Patchwork Cap", slot: "helmet", rarity: "common", focus: { hp: 100 } },
  { id: "patchwork-chestplate", name: "Patchwork Vest", slot: "chestplate", rarity: "common", focus: { hp: 50, def: 50 } },
  { id: "patchwork-gloves", name: "Patchwork Mitts", slot: "gloves", rarity: "common", focus: { atk: 50, hp: 50 } },
  { id: "patchwork-leggings", name: "Patchwork Breeches", slot: "leggings", rarity: "common", focus: { hp: 60, def: 40 } },
  { id: "patchwork-boots", name: "Patchwork Wraps", slot: "boots", rarity: "common", focus: { def: 100 } },
  { id: "scrapper-helmet", name: "Scrapper Pot", slot: "helmet", rarity: "common", focus: { def: 80, atk: 20 } },
  { id: "scrapper-chestplate", name: "Scrapper Brigandine", slot: "chestplate", rarity: "common", focus: { def: 100 } },
  { id: "scrapper-gloves", name: "Scrapper Cuffs", slot: "gloves", rarity: "common", focus: { atk: 100 } },
  { id: "scrapper-leggings", name: "Scrapper Chaps", slot: "leggings", rarity: "common", focus: { atk: 60, def: 40 } },
  { id: "scrapper-boots", name: "Scrapper Clogs", slot: "boots", rarity: "common", focus: { atk: 40, hp: 60 } },

  // ---- Uncommon: loose items ----
  // Wayfarer has no focus on purpose: it uses the slot's usual split.
  { id: "wayfarer-helmet", name: "Wayfarer Hood", slot: "helmet", rarity: "uncommon" },
  { id: "wayfarer-chestplate", name: "Wayfarer Jerkin", slot: "chestplate", rarity: "uncommon" },
  { id: "wayfarer-gloves", name: "Wayfarer Grips", slot: "gloves", rarity: "uncommon" },
  { id: "wayfarer-leggings", name: "Wayfarer Trousers", slot: "leggings", rarity: "uncommon" },
  { id: "wayfarer-boots", name: "Wayfarer Treads", slot: "boots", rarity: "uncommon" },
  { id: "drifter-helmet", name: "Drifter Cowl", slot: "helmet", rarity: "uncommon", focus: { hp: 80, atk: 20 } },
  { id: "drifter-chestplate", name: "Drifter Coat", slot: "chestplate", rarity: "uncommon", focus: { hp: 100 } },
  { id: "drifter-gloves", name: "Drifter Wristlets", slot: "gloves", rarity: "uncommon", focus: { atk: 80, def: 20 } },
  { id: "drifter-leggings", name: "Drifter Leggings", slot: "leggings", rarity: "uncommon", focus: { def: 70, hp: 30 } },
  { id: "drifter-boots", name: "Drifter Soles", slot: "boots", rarity: "uncommon", focus: { atk: 50, def: 50 } },
  { id: "hunter-helmet", name: "Hunter Cap", slot: "helmet", rarity: "uncommon", focus: { atk: 60, hp: 40 } },
  { id: "hunter-chestplate", name: "Hunter Tunic", slot: "chestplate", rarity: "uncommon", focus: { atk: 40, def: 60 } },
  { id: "hunter-gloves", name: "Hunter Bracers", slot: "gloves", rarity: "uncommon", focus: { atk: 100 } },
  { id: "hunter-leggings", name: "Hunter Kilt", slot: "leggings", rarity: "uncommon", focus: { atk: 70, hp: 30 } },
  { id: "hunter-boots", name: "Hunter Moccasins", slot: "boots", rarity: "uncommon", focus: { hp: 50, atk: 50 } },

  // ---- Rare sets (unnamed) ----
  { id: "steelguard-helmet", name: "Steelguard Helm", slot: "helmet", rarity: "rare", set: "steelguard" },
  { id: "steelguard-chestplate", name: "Steelguard Cuirass", slot: "chestplate", rarity: "rare", set: "steelguard" },
  { id: "steelguard-gloves", name: "Steelguard Gauntlets", slot: "gloves", rarity: "rare", set: "steelguard" },
  { id: "steelguard-leggings", name: "Steelguard Tassets", slot: "leggings", rarity: "rare", set: "steelguard" },
  { id: "steelguard-boots", name: "Steelguard Sabatons", slot: "boots", rarity: "rare", set: "steelguard" },
  { id: "thornweave-helmet", name: "Thornweave Cowl", slot: "helmet", rarity: "rare", set: "thornweave" },
  { id: "thornweave-chestplate", name: "Thornweave Hauberk", slot: "chestplate", rarity: "rare", set: "thornweave" },
  { id: "thornweave-gloves", name: "Thornweave Wraps", slot: "gloves", rarity: "rare", set: "thornweave" },
  { id: "thornweave-leggings", name: "Thornweave Chausses", slot: "leggings", rarity: "rare", set: "thornweave" },
  { id: "thornweave-boots", name: "Thornweave Treads", slot: "boots", rarity: "rare", set: "thornweave" },
  { id: "lightwoven-helmet", name: "Lightwoven Hood", slot: "helmet", rarity: "rare", set: "lightwoven" },
  { id: "lightwoven-chestplate", name: "Lightwoven Robe", slot: "chestplate", rarity: "rare", set: "lightwoven" },
  { id: "lightwoven-gloves", name: "Lightwoven Mitts", slot: "gloves", rarity: "rare", set: "lightwoven" },
  { id: "lightwoven-leggings", name: "Lightwoven Leggings", slot: "leggings", rarity: "rare", set: "lightwoven" },
  { id: "lightwoven-boots", name: "Lightwoven Slippers", slot: "boots", rarity: "rare", set: "lightwoven" },

  // ---- Epic sets (unnamed) ----
  { id: "warden-helmet", name: "Warden Visor", slot: "helmet", rarity: "epic", set: "warden" },
  { id: "warden-chestplate", name: "Warden Hauberk", slot: "chestplate", rarity: "epic", set: "warden" },
  { id: "warden-gloves", name: "Warden Fists", slot: "gloves", rarity: "epic", set: "warden" },
  { id: "warden-leggings", name: "Warden Greaves", slot: "leggings", rarity: "epic", set: "warden" },
  { id: "warden-boots", name: "Warden Striders", slot: "boots", rarity: "epic", set: "warden" },
  { id: "stormcaller-helmet", name: "Stormcaller Circlet", slot: "helmet", rarity: "epic", set: "stormcaller" },
  { id: "stormcaller-chestplate", name: "Stormcaller Raiment", slot: "chestplate", rarity: "epic", set: "stormcaller" },
  { id: "stormcaller-gloves", name: "Stormcaller Talons", slot: "gloves", rarity: "epic", set: "stormcaller" },
  { id: "stormcaller-leggings", name: "Stormcaller Legwraps", slot: "leggings", rarity: "epic", set: "stormcaller" },
  { id: "stormcaller-boots", name: "Stormcaller Sandals", slot: "boots", rarity: "epic", set: "stormcaller" },
  { id: "dawnkeeper-helmet", name: "Dawnkeeper Veil", slot: "helmet", rarity: "epic", set: "dawnkeeper" },
  { id: "dawnkeeper-chestplate", name: "Dawnkeeper Vestment", slot: "chestplate", rarity: "epic", set: "dawnkeeper" },
  { id: "dawnkeeper-gloves", name: "Dawnkeeper Gloves", slot: "gloves", rarity: "epic", set: "dawnkeeper" },
  { id: "dawnkeeper-leggings", name: "Dawnkeeper Skirt", slot: "leggings", rarity: "epic", set: "dawnkeeper" },
  { id: "dawnkeeper-boots", name: "Dawnkeeper Steps", slot: "boots", rarity: "epic", set: "dawnkeeper" },

  // ---- Legendary sets (named) ----
  { id: "titans-vow-helmet", name: "Titan's Crest", slot: "helmet", rarity: "legendary", set: "titans-vow" },
  { id: "titans-vow-chestplate", name: "Titan's Mantle", slot: "chestplate", rarity: "legendary", set: "titans-vow" },
  { id: "titans-vow-gloves", name: "Titan's Grasp", slot: "gloves", rarity: "legendary", set: "titans-vow" },
  { id: "titans-vow-leggings", name: "Titan's Pillars", slot: "leggings", rarity: "legendary", set: "titans-vow" },
  { id: "titans-vow-boots", name: "Titan's March", slot: "boots", rarity: "legendary", set: "titans-vow" },
  { id: "ashen-covenant-helmet", name: "Ashen Crown", slot: "helmet", rarity: "legendary", set: "ashen-covenant" },
  { id: "ashen-covenant-chestplate", name: "Ashen Shroud", slot: "chestplate", rarity: "legendary", set: "ashen-covenant" },
  { id: "ashen-covenant-gloves", name: "Ashen Claws", slot: "gloves", rarity: "legendary", set: "ashen-covenant" },
  { id: "ashen-covenant-leggings", name: "Ashen Cinders", slot: "leggings", rarity: "legendary", set: "ashen-covenant" },
  { id: "ashen-covenant-boots", name: "Ashen Stride", slot: "boots", rarity: "legendary", set: "ashen-covenant" },
  { id: "seraphs-grace-helmet", name: "Seraph's Halo", slot: "helmet", rarity: "legendary", set: "seraphs-grace" },
  { id: "seraphs-grace-chestplate", name: "Seraph's Wings", slot: "chestplate", rarity: "legendary", set: "seraphs-grace" },
  { id: "seraphs-grace-gloves", name: "Seraph's Touch", slot: "gloves", rarity: "legendary", set: "seraphs-grace" },
  { id: "seraphs-grace-leggings", name: "Seraph's Vigil", slot: "leggings", rarity: "legendary", set: "seraphs-grace" },
  { id: "seraphs-grace-boots", name: "Seraph's Ascent", slot: "boots", rarity: "legendary", set: "seraphs-grace" },

  // ---- Mythic: standalone named items, each with its own unique effect (behavior comes in Phase 5) ----
  { id: "unbroken-helmet", name: "Crown of the Unbroken", slot: "helmet", rarity: "mythic", focus: { hp: 100 }, effect: "unbroken-crown" },
  { id: "unbroken-chestplate", name: "Heart of the Unbroken", slot: "chestplate", rarity: "mythic", focus: { def: 100 }, effect: "unbroken-heart" },
  { id: "unbroken-gloves", name: "Hands of the Unbroken", slot: "gloves", rarity: "mythic", focus: { atk: 100 }, effect: "unbroken-hands" },
  { id: "unbroken-leggings", name: "Pillars of the Unbroken", slot: "leggings", rarity: "mythic", focus: { hp: 100 }, effect: "unbroken-pillars" },
  { id: "unbroken-boots", name: "Path of the Unbroken", slot: "boots", rarity: "mythic", focus: { atk: 100 }, effect: "unbroken-path" },
  { id: "bloodletter-gauntlets", name: "Bloodletter Gauntlets", slot: "gloves", rarity: "mythic", focus: { atk: 100 }, effect: "bloodletter-gauntlets" },
  { id: "bulwark-plate", name: "Bulwark Plate", slot: "chestplate", rarity: "mythic", focus: { def: 100 }, effect: "bulwark-plate" },
  { id: "executioners-ring", name: "Executioner's Ring", slot: "ring", rarity: "mythic", focus: { atk: 100 }, effect: "executioners-ring" },
  { id: "oathkeeper-belt", name: "Oathkeeper Belt", slot: "belt", rarity: "mythic", focus: { def: 100 }, effect: "oathkeeper-belt" },
  { id: "saints-locket", name: "Saint's Locket", slot: "necklace", rarity: "mythic", focus: { hp: 100 }, effect: "saints-locket" },
  { id: "dawn-censer", name: "Dawn Censer", slot: "charm", rarity: "mythic", focus: { hp: 100 }, effect: "dawn-censer" },

  // ---- Accessories: never in a set ----
  // Rings lean ATK.
  { id: "copper-band", name: "Copper Band", slot: "ring", rarity: "common", focus: { atk: 70, hp: 30 }, effect: "crit" },
  { id: "bronze-signet", name: "Bronze Signet", slot: "ring", rarity: "uncommon", focus: { atk: 70, def: 30 }, effect: "crit" },
  { id: "silver-loop", name: "Silver Loop", slot: "ring", rarity: "rare", focus: { atk: 80, hp: 20 }, effect: "crit" },
  { id: "gold-seal", name: "Gold Seal", slot: "ring", rarity: "epic", focus: { atk: 70, hp: 30 }, effect: "crit" },
  { id: "sunforged-ring", name: "Sunforged Ring", slot: "ring", rarity: "legendary", focus: { atk: 80, def: 20 }, effect: "crit" },
  { id: "bone-ring", name: "Bone Ring", slot: "ring", rarity: "common", focus: { atk: 80, hp: 20 }, effect: "critDamage" },
  { id: "fang-band", name: "Fang Band", slot: "ring", rarity: "uncommon", focus: { atk: 70, hp: 30 }, effect: "lifesteal" },
  { id: "blood-garnet", name: "Blood Garnet", slot: "ring", rarity: "rare", focus: { atk: 80, hp: 20 }, effect: "finisher" },
  { id: "hunters-seal", name: "Hunter's Seal", slot: "ring", rarity: "epic", focus: { atk: 80, def: 20 }, effect: "critDamage" },
  { id: "reapers-coil", name: "Reaper's Coil", slot: "ring", rarity: "legendary", focus: { atk: 90, hp: 10 }, effect: "finisher" },
  // Necklaces lean HP / DEF.
  { id: "twine-pendant", name: "Twine Pendant", slot: "necklace", rarity: "common", focus: { hp: 60, def: 40 }, effect: "healing" },
  { id: "bead-strand", name: "Bead Strand", slot: "necklace", rarity: "uncommon", focus: { hp: 70, def: 30 }, effect: "healing" },
  { id: "silver-locket", name: "Silver Locket", slot: "necklace", rarity: "rare", focus: { hp: 50, def: 50 }, effect: "healing" },
  { id: "amber-torque", name: "Amber Torque", slot: "necklace", rarity: "epic", focus: { hp: 60, def: 40 }, effect: "healing" },
  { id: "heartstone-pendant", name: "Heartstone Pendant", slot: "necklace", rarity: "legendary", focus: { hp: 70, def: 30 }, effect: "healing" },
  { id: "prayer-beads", name: "Prayer Beads", slot: "necklace", rarity: "common", focus: { hp: 70, def: 30 }, effect: "healPower" },
  { id: "clearwater-vial", name: "Clearwater Vial", slot: "necklace", rarity: "uncommon", focus: { hp: 60, def: 40 }, effect: "bleedResist" },
  { id: "sun-medallion", name: "Sun Medallion", slot: "necklace", rarity: "rare", focus: { hp: 70, def: 30 }, effect: "healPower" },
  { id: "pilgrims-torque", name: "Pilgrim's Torque", slot: "necklace", rarity: "epic", focus: { hp: 60, def: 40 }, effect: "bleedResist" },
  { id: "halo-pendant", name: "Halo Pendant", slot: "necklace", rarity: "legendary", focus: { hp: 80, def: 20 }, effect: "healPower" },
  // Belts lean DEF.
  { id: "rope-belt", name: "Rope Belt", slot: "belt", rarity: "common", focus: { def: 80, hp: 20 }, effect: "damageReduction" },
  { id: "leather-belt", name: "Leather Belt", slot: "belt", rarity: "uncommon", focus: { def: 70, hp: 30 }, effect: "damageReduction" },
  { id: "studded-belt", name: "Studded Belt", slot: "belt", rarity: "rare", focus: { def: 100 }, effect: "damageReduction" },
  { id: "iron-girdle", name: "Iron Girdle", slot: "belt", rarity: "epic", focus: { def: 80, hp: 20 }, effect: "damageReduction" },
  { id: "mountainheart-girdle", name: "Mountainheart Girdle", slot: "belt", rarity: "legendary", focus: { def: 70, hp: 30 }, effect: "damageReduction" },
  { id: "cord-sash", name: "Cord Sash", slot: "belt", rarity: "common", focus: { def: 70, hp: 30 }, effect: "guardDuration" },
  { id: "buckler-belt", name: "Buckler Belt", slot: "belt", rarity: "uncommon", focus: { def: 80, hp: 20 }, effect: "thorns" },
  { id: "shield-strap", name: "Shield Strap", slot: "belt", rarity: "rare", focus: { def: 70, hp: 30 }, effect: "bastionShield" },
  { id: "bastion-girdle", name: "Bastion Girdle", slot: "belt", rarity: "epic", focus: { def: 80, hp: 20 }, effect: "guardDuration" },
  { id: "thornhide-belt", name: "Thornhide Belt", slot: "belt", rarity: "legendary", focus: { def: 70, hp: 30 }, effect: "thorns" },
  // Charms spread their power.
  { id: "lucky-pebble", name: "Lucky Pebble", slot: "charm", rarity: "common", focus: { hp: 34, atk: 33, def: 33 }, effect: "salvageYield" },
  { id: "fox-tooth", name: "Fox Tooth", slot: "charm", rarity: "uncommon", focus: { hp: 40, atk: 30, def: 30 }, effect: "rerollDiscount" },
  { id: "hourglass-charm", name: "Hourglass Charm", slot: "charm", rarity: "rare", focus: { hp: 30, atk: 40, def: 30 }, effect: "haste" },
  { id: "tinkers-cog", name: "Tinker's Cog", slot: "charm", rarity: "epic", focus: { hp: 34, atk: 33, def: 33 }, effect: "salvageYield" },
  { id: "chrono-charm", name: "Chrono Charm", slot: "charm", rarity: "legendary", focus: { hp: 30, atk: 30, def: 40 }, effect: "haste" },
  { id: "spark-charm", name: "Spark Charm", slot: "charm", rarity: "common", focus: { hp: 30, atk: 40, def: 30 }, effect: "ultCharge" },
  { id: "feather-charm", name: "Feather Charm", slot: "charm", rarity: "uncommon", focus: { hp: 30, atk: 40, def: 30 }, effect: "haste" },
  { id: "storm-bead", name: "Storm Bead", slot: "charm", rarity: "rare", focus: { hp: 30, atk: 40, def: 30 }, effect: "ultCharge" },
  { id: "thunder-charm", name: "Thunder Charm", slot: "charm", rarity: "epic", focus: { hp: 34, atk: 33, def: 33 }, effect: "ultCharge" },
  { id: "phoenix-charm", name: "Phoenix Charm", slot: "charm", rarity: "legendary", focus: { hp: 40, atk: 30, def: 30 }, effect: "ultCharge" },
];
