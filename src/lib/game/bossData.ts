import type { FoeMechanics } from "./combat";
import type { Stat } from "./config";

/*
 * THE BOSS LIST (GAME_DESIGN.md 10, Phase 5). The only file to edit to add or change bosses. A first
 * draft for Jackson to review: names, one-line descriptions, boss types and minimums.
 *
 *   id         Unique and never reused: battle records point at it.
 *   name       What the player sees.
 *   epithet    One line under the name.
 *   type       Its mechanics (BOSS_TYPES below), which decide which class has the easiest time:
 *                brute    big telegraphed hits (Vanguard's Guard and high DEF shine)
 *                bleeder  bleeds you; DEF doesn't help, only healing (Cleric shines)
 *                timer    enrages early, so it has to die fast (Striker shines)
 *                mixed    a little of everything
 *                plain    no tricks
 *   tweak      Optional small changes to the type (more HP, a harder hit). Keep them small.
 *   minimums   Stats the boss checks, as a share of what a hero with every stat equal at the boss's
 *              power would have (1 = exactly that). Under one, you need 20% more power than the boss
 *              to fight it at all (section 4). An injury flag waives that stat's minimum.
 *
 * Power, HP and attack come from where the boss is used (weekly tier, tower floor, campaign stage),
 * not from here, so the same boss scales with you.
 */

export type BossType = "plain" | "brute" | "bleeder" | "timer" | "mixed";

/** Each type's mechanics, tuned with scripts/combat-table.ts. */
export const BOSS_TYPES: Record<BossType, FoeMechanics> = {
  plain: {},
  brute: { heavy: { everySec: 7, telegraphSec: 3, multiplier: 2 }, atk: 0.8 },
  bleeder: { bleed: { startSec: 8, perSec: 0.2 }, atk: 0.8 },
  timer: { enrageSec: 26, hp: 0.78, atk: 0.85 },
  mixed: { heavy: { everySec: 9, telegraphSec: 3, multiplier: 1.8 }, bleed: { startSec: 12, perSec: 0.1 }, enrageSec: 38, atk: 0.75 },
};

export interface BossEntry {
  id: string;
  name: string;
  epithet: string;
  type: BossType;
  tweak?: FoeMechanics;
  minimums?: Partial<Record<Stat, number>>;
}

/** The weekly pool: one boss a week, in this order, repeating every 12 weeks. */
export const WEEKLY_BOSSES: BossEntry[] = [
  { id: "ironmaw", name: "Ironmaw", epithet: "Its bite never quite closes.", type: "bleeder", minimums: { chest: 0.8 } },
  { id: "grond", name: "Grond the Crusher", epithet: "Swings like the ground owes him money.", type: "brute", minimums: { legs: 0.85, back: 0.7 } },
  { id: "vexa", name: "Vexa, Hourglass Witch", epithet: "When the sand runs out, so do you.", type: "timer", minimums: { arms: 0.8 } },
  { id: "stoneback", name: "Old Stoneback", epithet: "Older than the mountain it sleeps on.", type: "brute", tweak: { def: 1.2, hp: 0.9 }, minimums: { back: 0.85 } },
  { id: "marrow-queen", name: "The Marrow Queen", epithet: "Wears a crown of other people's bones.", type: "mixed", minimums: { core: 0.8, legs: 0.7 } },
  { id: "iron-choir", name: "The Iron Choir", epithet: "Seven helmets, one voice, no mercy.", type: "brute", minimums: { shoulders: 0.8 } },
  { id: "rattlefang", name: "Rattlefang", epithet: "Too fast to see, too angry to stop.", type: "timer", minimums: { legs: 0.75 } },
  { id: "gutterking", name: "Gutterking", epithet: "Rules the drains with a rusty knife.", type: "bleeder", minimums: { back: 0.8 } },
  { id: "halvard", name: "Halvard the Unmoving", epithet: "Has not taken a step back in a hundred years.", type: "brute", tweak: { heavy: { everySec: 8, telegraphSec: 3, multiplier: 2.4 } }, minimums: { chest: 0.85, core: 0.7 } },
  { id: "sister-ash", name: "Sister Ash", epithet: "Burns slow, then all at once.", type: "mixed", tweak: { enrageSec: 32 }, minimums: { arms: 0.75 } },
  { id: "quarry-titan", name: "Quarry Titan", epithet: "A cliff that learned to walk.", type: "brute", tweak: { hp: 1.1 }, minimums: { legs: 0.9 } },
  { id: "pale-coach", name: "The Pale Coach", epithet: "Arrives on time. Leaves with you.", type: "mixed", minimums: { arms: 0.75, shoulders: 0.75 } },
];

/** The Boss Tower: one boss per floor, floor 1 first. */
export const TOWER_BOSSES: BossEntry[] = [
  { id: "gatewatch-brann", name: "Gatewatch Brann", epithet: "Nobody gets past the first door.", type: "plain" },
  { id: "mossjaw", name: "Mossjaw", epithet: "Wet teeth, slow wounds.", type: "bleeder", minimums: { core: 0.7 } },
  { id: "tallow", name: "Tallow the Quick", epithet: "A candle that burns at both ends.", type: "timer", minimums: { arms: 0.7 } },
  { id: "anvil-sow", name: "The Anvil Sow", epithet: "Charges first, thinks never.", type: "brute", minimums: { legs: 0.75 } },
  { id: "kettle-hag", name: "Kettle Hag", epithet: "Her soup is mostly knives.", type: "bleeder", minimums: { back: 0.75 } },
  { id: "clockwork-duelist", name: "Clockwork Duelist", epithet: "Winds down in exactly twenty-six seconds.", type: "timer", minimums: { shoulders: 0.75 } },
  { id: "bonepile", name: "Bonepile", epithet: "Made of everyone who climbed before you.", type: "brute", minimums: { chest: 0.75 } },
  { id: "mire-saint", name: "The Mire Saint", epithet: "Blesses you with rot.", type: "mixed", minimums: { core: 0.75 } },
  { id: "lantern-thief", name: "Lantern Thief", epithet: "Steals the light, then the time.", type: "timer", minimums: { legs: 0.75 } },
  { id: "gravel-warden", name: "The Gravel Warden", epithet: "Guards the tenth floor and its Mythic Core.", type: "brute", tweak: { hp: 1.1 }, minimums: { back: 0.8, legs: 0.7 } },
  { id: "splinter-abbess", name: "Splinter Abbess", epithet: "Every prayer leaves a splinter.", type: "bleeder", minimums: { arms: 0.8 } },
  { id: "hookline", name: "Hookline", epithet: "Reels you in before you can blink.", type: "timer", minimums: { back: 0.8 } },
  { id: "copper-colossus", name: "Copper Colossus", epithet: "Green with age, red with rage.", type: "brute", minimums: { shoulders: 0.8 } },
  { id: "ninefold-viper", name: "Ninefold Viper", epithet: "Nine heads, nine bites, one bad day.", type: "bleeder", minimums: { legs: 0.8 } },
  { id: "dusk-courier", name: "Dusk Courier", epithet: "Delivers before sundown, every time.", type: "timer", minimums: { chest: 0.8 } },
  { id: "barrow-knight", name: "The Barrow Knight", epithet: "Swore an oath to a king long dead.", type: "mixed", minimums: { back: 0.8, core: 0.7 } },
  { id: "weeping-plate", name: "The Weeping Plate", epithet: "Empty armor that still hits hard.", type: "brute", tweak: { def: 1.15 }, minimums: { chest: 0.8 } },
  { id: "thornmother", name: "Thornmother", epithet: "Hugs you with a thousand thorns.", type: "bleeder", minimums: { shoulders: 0.8 } },
  { id: "quickstep-reaver", name: "Quickstep Reaver", epithet: "Dances you to exhaustion.", type: "timer", minimums: { legs: 0.85 } },
  { id: "iron-abbot", name: "The Iron Abbot", epithet: "Keeps the twentieth floor's Mythic Core in his cell.", type: "mixed", tweak: { hp: 1.1 }, minimums: { arms: 0.8, core: 0.75 } },
  { id: "saltmarrow", name: "Saltmarrow", epithet: "Rubs salt in every wound it makes.", type: "bleeder", minimums: { chest: 0.85 } },
  { id: "bell-tyrant", name: "The Bell Tyrant", epithet: "Each toll is a hammer blow.", type: "brute", tweak: { heavy: { everySec: 7, telegraphSec: 3, multiplier: 2.3 } }, minimums: { back: 0.85 } },
  { id: "glass-fencer", name: "Glass Fencer", epithet: "Shatters fast, so make it faster.", type: "timer", tweak: { hp: 0.7, atk: 0.95 }, minimums: { arms: 0.85 } },
  { id: "rot-shepherd", name: "The Rot Shepherd", epithet: "Herds plagues instead of sheep.", type: "bleeder", minimums: { core: 0.85 } },
  { id: "siege-ox", name: "Siege Ox", epithet: "Built to knock down walls. You are a wall.", type: "brute", tweak: { hp: 1.1 }, minimums: { legs: 0.85, shoulders: 0.75 } },
  { id: "ember-twins", name: "The Ember Twins", epithet: "Burn out together, burn you first.", type: "timer", minimums: { chest: 0.85, arms: 0.75 } },
  { id: "hollow-prior", name: "The Hollow Prior", epithet: "Preaches to an empty hall, loudly.", type: "mixed", minimums: { shoulders: 0.85, back: 0.75 } },
  { id: "blackwater-leech", name: "Blackwater Leech", epithet: "Drinks until you are dry.", type: "bleeder", tweak: { bleed: { startSec: 6, perSec: 0.22 } }, minimums: { legs: 0.85, core: 0.75 } },
  { id: "last-gate", name: "The Last Gate", epithet: "Opens for nobody. Hits like it.", type: "brute", tweak: { def: 1.2 }, minimums: { back: 0.9, chest: 0.8 } },
  { id: "unbroken-throne", name: "The Unbroken Throne", epithet: "Sits atop the tower. Has never been moved.", type: "mixed", tweak: { hp: 1.15 }, minimums: { chest: 0.85, back: 0.85, legs: 0.85 } },
];

export interface CampaignChapter {
  id: string;
  name: string;
  /** Names of the regular enemies, used in turn for the chapter's first eleven stages. */
  enemies: string[];
  /** Stage 12 of the chapter. */
  boss: BossEntry;
}

export const CAMPAIGN_CHAPTERS: CampaignChapter[] = [
  {
    id: "rusted-gate",
    name: "The Rusted Gate",
    enemies: ["Rust Rat", "Gate Guard", "Scrap Hound"],
    boss: { id: "warden-kell", name: "Warden Kell", epithet: "Keeps the gate rusted shut.", type: "brute", minimums: { legs: 0.6 } },
  },
  {
    id: "ashen-steps",
    name: "The Ashen Steps",
    enemies: ["Ash Imp", "Cinder Monk", "Ember Hound"],
    boss: { id: "cinder-abbot", name: "The Cinder Abbot", epithet: "His blessings leave burns.", type: "bleeder", minimums: { core: 0.65 } },
  },
  {
    id: "drowned-halls",
    name: "The Drowned Halls",
    enemies: ["Bog Lurker", "Drowned Squire", "Eel Swarm"],
    boss: { id: "mother-brine", name: "Mother Brine", epithet: "The tide comes in. You don't leave.", type: "timer", minimums: { arms: 0.7 } },
  },
  {
    id: "iron-wastes",
    name: "The Iron Wastes",
    enemies: ["Scrap Golem", "Waste Rider", "Rail Wraith"],
    boss: { id: "iron-prospector", name: "The Iron Prospector", epithet: "Mines the wastes for heroes.", type: "brute", tweak: { def: 1.1 }, minimums: { back: 0.75 } },
  },
  {
    id: "crown-of-teeth",
    name: "The Crown of Teeth",
    enemies: ["Tooth Knight", "Bone Herald", "Grave Hound"],
    boss: { id: "king-molar", name: "King Molar", epithet: "Every tooth in the crown was a challenger.", type: "mixed", minimums: { chest: 0.75, legs: 0.75 } },
  },
];
