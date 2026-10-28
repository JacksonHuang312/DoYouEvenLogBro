import type { BattlePower } from "./battle";
import { CLASSES, COMBAT, POWER_MULTIPLIERS, SKILLS, STATS, type ClassId, type MythicEffect, type Stat } from "./config";
import type { GearEffects } from "./effects";
import { seeded } from "./random";
import type { StatLine } from "./score";

/*
 * The fight engine (GAME_DESIGN.md 4 and 10, Phase 5). Fights are timed, like AFK Arena: both sides
 * attack on their own timers, the hero has a skill on a cooldown and an ultimate charged by energy,
 * and the enemy telegraphs big hits, may bleed the hero, and enrages at a time limit. A fight is one
 * pure, deterministic calculation from a seed: the server runs it, and the same inputs always replay
 * the same way.
 */

// ---- The hero ----

export interface Attributes {
  hp: number;
  atk: number;
  def: number;
}

export interface Hero {
  classId: ClassId;
  /** Battle power: defense counts relative to it. */
  power: number;
  maxHp: number;
  atk: number;
  def: number;
  critChance: number;
  /** Share of incoming damage removed (belt), already capped. */
  damageReduction: number;
  /** Necklace healing as a share of max HP every COMBAT.necklaceEverySec, already halved for non-Clerics. */
  regenPct: number;
  /** What Mend heals as a share of max HP (Cleric only; 0 for others). */
  mendPct: number;
  mythic: MythicEffect[];
}

const statTotal = (stats: StatLine, s: Stat) => stats[s].value + stats[s].bonus;

/**
 * Combat attribute points before class weights: each stat's power points split by
 * COMBAT.statAttributes, plus the gear's counted power split by each piece's focus, all times
 * (1 + the bonus pool). Body and gear match battle power, so a hero's points add up to it.
 */
export function attributePoints(stats: StatLine, battle: BattlePower): Attributes {
  const points: Attributes = { hp: 0, atk: 0, def: 0 };
  const bodyRaw = STATS.reduce((sum, s) => sum + Math.max(0, statTotal(stats, s)) * POWER_MULTIPLIERS[s], 0);
  // Body power can differ slightly from the stats (rounding, a clamped negative); scale to match it.
  const scale = bodyRaw > 0 ? Math.max(0, battle.body) / bodyRaw : 0;
  for (const s of STATS) {
    const pts = Math.max(0, statTotal(stats, s)) * POWER_MULTIPLIERS[s] * scale;
    const split = COMBAT.statAttributes[s];
    points.hp += pts * split.hp;
    points.atk += pts * split.atk;
    points.def += pts * split.def;
  }
  const gear = battle.gear.attributes;
  const pool = 1 + battle.bonus.total;
  return { hp: (points.hp + gear.hp) * pool, atk: (points.atk + gear.atk) * pool, def: (points.def + gear.def) * pool };
}

/** The hero as they fight: attributes weighted by class, plus the gear effects that act in combat. */
export function buildHero({
  stats,
  battle,
  classId,
  effects,
}: {
  stats: StatLine;
  battle: BattlePower;
  classId: ClassId;
  effects: GearEffects;
}): Hero {
  const pts = attributePoints(stats, battle);
  const w = CLASSES[classId].weights;
  const core = Math.max(0, statTotal(stats, "core"));
  const average = STATS.reduce((sum, s) => sum + Math.max(0, statTotal(stats, s)), 0) / STATS.length;
  const mend = SKILLS.mend;
  return {
    classId,
    power: battle.total,
    maxHp: Math.max(1, Math.round(pts.hp * w.hp * COMBAT.hpPerPoint)),
    atk: pts.atk * w.atk,
    def: pts.def * w.def,
    critChance: COMBAT.baseCrit + effects.crit,
    damageReduction: effects.damageReduction,
    regenPct: effects.healing * (classId === "cleric" ? 1 : COMBAT.necklaceNonClericFactor),
    mendPct: classId === "cleric" ? Math.min(mend.maxPct, mend.basePct + mend.perCorePct * (average > 0 ? core / average : 0)) : 0,
    mythic: effects.mythic,
  };
}

// ---- The enemy ----

export interface FoeMechanics {
  /** Multipliers on HP, ATK and DEF from its power. */
  hp?: number;
  atk?: number;
  def?: number;
  attackEverySec?: number;
  /** A big hit every `everySec`, announced `telegraphSec` ahead, at `multiplier` × attack. DEF and Guard reduce it. */
  heavy?: { everySec: number; telegraphSec: number; multiplier: number };
  /** From `startSec`, `perSec` × attack every second. Ignores DEF and Guard; only healing offsets it. */
  bleed?: { startSec: number; perSec: number };
  /** When it enrages and the fight is lost. Defaults to COMBAT.enrageSec. */
  enrageSec?: number;
}

export interface Foe {
  name: string;
  /** Recommended battle power: its defense counts relative to it. */
  power: number;
  maxHp: number;
  atk: number;
  def: number;
  attackEverySec: number;
  heavy: FoeMechanics["heavy"] | null;
  bleed: FoeMechanics["bleed"] | null;
  enrageSec: number;
}

/** An enemy of recommended battle power `power`. */
export function buildFoe(name: string, power: number, m: FoeMechanics = {}): Foe {
  const f = COMBAT.foe;
  return {
    name,
    power,
    maxHp: Math.max(1, Math.round(power * f.hpPerPower * (m.hp ?? 1))),
    atk: power * f.atkPerPower * (m.atk ?? 1),
    def: power * f.defPerPower * (m.def ?? 1),
    attackEverySec: m.attackEverySec ?? f.attackEverySec,
    heavy: m.heavy ?? null,
    bleed: m.bleed ?? null,
    enrageSec: m.enrageSec ?? COMBAT.enrageSec,
  };
}

// ---- The fight ----

export type FightAction =
  | "attack"
  | "skill"
  | "ultimate"
  | "telegraph"
  | "heavy"
  | "bleed"
  | "heal"
  | "shield"
  | "last-stand"
  | "reflect"
  | "enrage"
  | "down";

export interface FightEvent {
  /** Seconds since the start, to one decimal. */
  t: number;
  actor: "hero" | "foe";
  action: FightAction;
  /** Damage, healing or shield amount. */
  amount?: number;
  crit?: boolean;
  /** The skill or ultimate's name. */
  name?: string;
}

export interface FightResult {
  won: boolean;
  /** Why it ended. */
  end: "foe-down" | "hero-down" | "enrage";
  /** Seconds the fight lasted. */
  seconds: number;
  heroHpLeft: number;
  foeHpLeft: number;
  /** For leaderboards later (Phase 6): damage dealt, damage absorbed (by DEF, Guard, the belt and shields), healing done. */
  stats: { dealt: number; taken: number; absorbed: number; healed: number; crits: number };
  log: FightEvent[];
}

const ticks = (sec: number) => Math.round((sec * 1000) / COMBAT.tickMs);
const secs = (tick: number) => Math.round((tick * COMBAT.tickMs) / 100) / 10;

/**
 * Fights `hero` against `foe`, deterministically from `seed`. Each tick: bleeding and regeneration,
 * then the hero (ultimate, skill, basic attack), then the enemy (telegraph, big hit, basic attack).
 * The hero's AI is simple and fixed per class: a Striker fires Power Strike when it's ready, a
 * Vanguard holds Guard for a telegraphed big hit, a Cleric mends once hurt.
 */
export function simulateFight(hero: Hero, foe: Foe, seed: string): FightResult {
  const rand = seeded(`fight:${seed}`);
  const cls = CLASSES[hero.classId];
  const has = (e: MythicEffect) => hero.mythic.includes(e);
  const M = COMBAT.mythic;
  /** Share of a hit that gets through `def`, whose owner has battle power `power`. */
  const through = (def: number, power: number) => {
    const k = COMBAT.defenseShare * Math.max(1, power);
    return k / (k + Math.max(0, def));
  };
  const spread = () => 1 + (rand() * 2 - 1) * COMBAT.damageSpread;
  // Each side's form on the day, rolled once per fight.
  const heroForm = 1 + (rand() * 2 - 1) * COMBAT.formSpread;
  const foeForm = 1 + (rand() * 2 - 1) * COMBAT.formSpread;

  const log: FightEvent[] = [];
  const stats = { dealt: 0, taken: 0, absorbed: 0, healed: 0, crits: 0 };
  let heroHp = hero.maxHp;
  let foeHp = foe.maxHp;
  let energy = 0;
  let shield = 0;
  let shieldUntil = -1;
  let guardUntil = -1;
  let bleedFreeUntil = -1;
  let lastStandUsed = false;
  let basicCount = 0;

  const heroEvery = ticks(cls.attackEverySec);
  const foeEvery = ticks(foe.attackEverySec);
  let nextHeroAttack = Math.max(1, Math.round(heroEvery / 2));
  let nextSkill = ticks(cls.skill.firstAtSec);
  let nextFoeAttack = foeEvery;
  const heavyEvery = foe.heavy ? ticks(foe.heavy.everySec) : 0;
  const heavyWarn = foe.heavy ? ticks(foe.heavy.telegraphSec) : 0;
  let nextHeavy = foe.heavy ? heavyEvery : Infinity;
  const bleedStart = foe.bleed ? ticks(foe.bleed.startSec) : Infinity;
  const second = ticks(1);
  const enrageAt = ticks(foe.enrageSec + (has("unbroken-path") ? M.pathEnrageSec : 0));

  const heal = (t: number, amount: number, name?: string) => {
    const gained = Math.min(Math.round(amount), hero.maxHp - heroHp);
    if (gained <= 0) return;
    heroHp += gained;
    stats.healed += gained;
    log.push({ t: secs(t), actor: "hero", action: "heal", amount: gained, ...(name ? { name } : {}) });
  };

  /** Damage to the hero. `physical` hits are reduced by DEF and Guard; bleeding isn't. */
  const hurtHero = (t: number, raw: number, physical: boolean): boolean => {
    let dmg = raw * foeForm;
    if (physical) dmg *= through(hero.def, hero.power);
    if (physical && t <= guardUntil) dmg *= SKILLS.guard.damageTakenFactor;
    dmg *= 1 - hero.damageReduction;
    dmg = Math.max(1, Math.round(dmg));
    if (t > shieldUntil) shield = 0;
    const soaked = Math.min(shield, dmg);
    shield -= soaked;
    const toHp = dmg - soaked;
    stats.absorbed += Math.round(raw) - toHp;
    stats.taken += toHp;
    if (heroHp - toHp <= 0 && has("unbroken-crown") && !lastStandUsed) {
      lastStandUsed = true;
      heroHp = M.lastStandHp;
      log.push({ t: secs(t), actor: "hero", action: "last-stand" });
    } else {
      heroHp -= toHp;
    }
    if (physical) {
      energy += COMBAT.energy.perHitTaken;
      if (has("unbroken-heart") && toHp + soaked > 0) {
        const back = Math.max(1, Math.round((toHp + soaked) * M.heartReflect));
        foeHp -= back;
        stats.dealt += back;
        log.push({ t: secs(t), actor: "hero", action: "reflect", amount: back });
      }
    }
    return heroHp <= 0;
  };

  /** A hero hit at `mult` × attack. Returns the damage. */
  const strike = (t: number, mult: number, action: FightAction, name?: string, forceCrit = false) => {
    const crit = forceCrit || rand() < hero.critChance;
    let dmg = hero.atk * heroForm * mult * spread() * through(foe.def, foe.power) * (crit ? COMBAT.critMultiplier : 1);
    dmg = Math.max(1, Math.round(dmg));
    foeHp -= dmg;
    stats.dealt += dmg;
    if (crit) stats.crits++;
    if (action !== "ultimate") energy += COMBAT.energy.perHitLanded;
    log.push({ t: secs(t), actor: "hero", action, amount: dmg, ...(crit ? { crit } : {}), ...(name ? { name } : {}) });
  };

  const end = (t: number, how: FightResult["end"]): FightResult => {
    if (how === "enrage") log.push({ t: secs(t), actor: "foe", action: "enrage" });
    else log.push({ t: secs(t), actor: how === "foe-down" ? "foe" : "hero", action: "down" });
    return {
      won: how === "foe-down",
      end: how,
      seconds: secs(t),
      heroHpLeft: Math.max(0, heroHp),
      foeHpLeft: Math.max(0, foeHp),
      stats,
      log,
    };
  };

  for (let t = 1; t <= enrageAt; t++) {
    // Over-time effects.
    if (t >= bleedStart && (t - bleedStart) % second === 0 && t > bleedFreeUntil) {
      const hp = heroHp;
      const dead = hurtHero(t, foe.atk * foe.bleed!.perSec, false);
      log.push({ t: secs(t), actor: "foe", action: "bleed", amount: Math.max(0, hp - heroHp) });
      if (dead) return end(t, "hero-down");
    }
    if (hero.regenPct > 0 && t % ticks(COMBAT.necklaceEverySec) === 0) heal(t, hero.maxHp * hero.regenPct);
    if (has("unbroken-pillars") && t % ticks(M.pillarsEverySec) === 0 && heroHp < hero.maxHp * M.pillarsBelowPct) {
      heal(t, hero.maxHp * M.pillarsPct);
    }

    // The hero: ultimate, skill, basic attack.
    if (energy >= COMBAT.energy.full) {
      energy = 0;
      const name = cls.ultimate.name;
      if (hero.classId === "striker") strike(t, SKILLS.execution.multiplier, "ultimate", name);
      else if (hero.classId === "vanguard") {
        strike(t, SKILLS.bastion.strikeMultiplier, "ultimate", name);
        shield = Math.round(hero.maxHp * SKILLS.bastion.shieldPct);
        shieldUntil = t + ticks(SKILLS.bastion.durationSec);
        log.push({ t: secs(t), actor: "hero", action: "shield", amount: shield });
      } else {
        log.push({ t: secs(t), actor: "hero", action: "ultimate", name });
        heal(t, hero.maxHp * SKILLS.radiance.healPct, name);
        bleedFreeUntil = t + ticks(SKILLS.radiance.bleedFreeSec);
      }
      if (foeHp <= 0) return end(t, "foe-down");
    }
    if (t >= nextSkill) {
      const name = cls.skill.name;
      if (hero.classId === "striker") {
        strike(t, SKILLS.powerStrike.multiplier, "skill", name);
        nextSkill = t + ticks(cls.skill.cooldownSec);
      } else if (hero.classId === "vanguard") {
        // Held for a telegraphed big hit; with none coming, used once hurt.
        const heavySoon = foe.heavy && nextHeavy - t <= ticks(SKILLS.guard.durationSec) / 2;
        if (foe.heavy ? heavySoon : heroHp < hero.maxHp * SKILLS.guard.useBelowPct) {
          guardUntil = t + ticks(SKILLS.guard.durationSec);
          log.push({ t: secs(t), actor: "hero", action: "skill", name });
          nextSkill = t + ticks(cls.skill.cooldownSec);
        }
      } else if (heroHp < hero.maxHp * SKILLS.mend.useBelowPct) {
        log.push({ t: secs(t), actor: "hero", action: "skill", name });
        heal(t, hero.maxHp * hero.mendPct, name);
        nextSkill = t + ticks(cls.skill.cooldownSec);
      }
      if (foeHp <= 0) return end(t, "foe-down");
    }
    if (t >= nextHeroAttack) {
      basicCount++;
      strike(t, 1, "attack", undefined, has("unbroken-hands") && basicCount % M.handsEvery === 0);
      nextHeroAttack += heroEvery;
      if (foeHp <= 0) return end(t, "foe-down");
    }

    // The enemy: telegraph, big hit, basic attack.
    if (foe.heavy && t === nextHeavy - heavyWarn) log.push({ t: secs(t), actor: "foe", action: "telegraph" });
    if (foe.heavy && t >= nextHeavy) {
      const raw = foe.atk * foe.heavy.multiplier * spread();
      const hp = heroHp;
      const dead = hurtHero(t, raw, true);
      log.push({ t: secs(t), actor: "foe", action: "heavy", amount: Math.max(0, hp - heroHp) });
      nextHeavy += heavyEvery;
      if (dead) return end(t, "hero-down");
      if (foeHp <= 0) return end(t, "foe-down");
    }
    if (t >= nextFoeAttack) {
      const hp = heroHp;
      const dead = hurtHero(t, foe.atk * spread(), true);
      log.push({ t: secs(t), actor: "foe", action: "attack", amount: Math.max(0, hp - heroHp) });
      nextFoeAttack += foeEvery;
      if (dead) return end(t, "hero-down");
      if (foeHp <= 0) return end(t, "foe-down");
    }
  }
  return end(enrageAt, "enrage");
}
