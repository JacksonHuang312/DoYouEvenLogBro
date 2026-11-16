import { buildFoe, type FightAction, type Foe, type FoeMechanics, type Hero } from "./combat";
import { CLASSES, COMBAT, RAID, SKILLS, type MythicEffect } from "./config";
import { seeded } from "./random";

/*
 * The party fight engine (GAME_DESIGN.md 13.10 and 13.29): several heroes against one raid boss.
 * It is the solo engine (`simulateFight` in combat.ts) with every piece of hero state kept per
 * member, plus what a party needs: the boss picks a target, a Vanguard draws its hits, a Cleric
 * heals whoever is hurt worst, and the boss grows with the party. Pure and deterministic from a
 * seed, like solo fights. A party of one fights exactly as the solo engine does (tested), so the
 * two can't drift apart. Solo fights never run through this file.
 */

export interface RaidFoe extends Foe {
  /** The big hit lands on everyone: the target in full, the rest at RAID.cleaveShare. */
  cleave: boolean;
}

export type RaidMechanics = FoeMechanics & { cleave?: boolean };

/**
 * A raid boss for a party of `size`. `power` is the recommended battle power of each member. Its
 * health grows with the party; it attacks faster with more members, because only one of them is
 * hit at a time. With `size` 1 it is the same enemy `buildFoe` makes.
 */
export function buildRaidFoe(name: string, power: number, size: number, m: RaidMechanics = {}): RaidFoe {
  const base = buildFoe(name, power, m);
  const extra = Math.max(0, size - 1);
  return {
    ...base,
    maxHp: Math.max(1, Math.round(base.maxHp * (1 + extra * RAID.hpPerExtraMember))),
    attackEverySec: base.attackEverySec / (1 + extra * RAID.attackRatePerExtraMember),
    cleave: m.cleave ?? false,
  };
}

export interface PartyEvent {
  /** Seconds since the start, to one decimal. */
  t: number;
  /** Who acted: a member (their place in the party, from 0) or the boss. */
  actor: number | "foe";
  action: FightAction;
  /** The member hit or healed, when that isn't the actor. */
  target?: number;
  amount?: number;
  crit?: boolean;
  name?: string;
  /** The boss's health right after this event. */
  fh: number;
}

export interface MemberResult {
  maxHp: number;
  hpLeft: number;
  /** When the member went down, in seconds, or null if they were standing at the end. */
  downAt: number | null;
  /** Damage dealt, damage taken, damage absorbed (DEF, Guard, the belt, shields), healing done (to anyone), crits. */
  stats: { dealt: number; taken: number; absorbed: number; healed: number; crits: number };
}

export interface PartyResult {
  won: boolean;
  end: "foe-down" | "party-down" | "enrage";
  seconds: number;
  foeHpLeft: number;
  foeMaxHp: number;
  members: MemberResult[];
  log: PartyEvent[];
}

const ticks = (sec: number) => Math.round((sec * 1000) / COMBAT.tickMs);
const secs = (tick: number) => Math.round((tick * COMBAT.tickMs) / 100) / 10;

/** One member's state during the fight: what the solo engine keeps in local variables. */
interface Member {
  i: number;
  hero: Hero;
  form: number;
  hp: number;
  energy: number;
  shield: number;
  shieldUntil: number;
  guardUntil: number;
  bleedFreeUntil: number;
  lastStandUsed: boolean;
  basicCount: number;
  ward: number;
  wardMax: number;
  every: number;
  skillEvery: number;
  nextAttack: number;
  nextSkill: number;
  downAt: number | null;
  stats: MemberResult["stats"];
}

/**
 * Fights `heroes` against `foe`, deterministically from `seed`. Each tick: bleeding and
 * regeneration for everyone standing, then each member in party order (ultimate, skill, basic
 * attack), then the boss (telegraph, big hit, basic attack). A member at zero health is down for
 * the rest of the fight. The party wins when the boss falls, and loses when everyone is down or
 * the boss enrages.
 */
export function simulateParty(heroes: Hero[], foe: RaidFoe, seed: string): PartyResult {
  const rand = seeded(`fight:${seed}`);
  const M = COMBAT.mythic;
  const through = (def: number, power: number) => {
    const k = COMBAT.defenseShare * Math.max(1, power);
    return k / (k + Math.max(0, def));
  };
  const spread = () => 1 + (rand() * 2 - 1) * COMBAT.damageSpread;
  const form = () => 1 + (rand() * 2 - 1) * COMBAT.formSpread;
  const has = (m: Member, e: MythicEffect) => m.hero.mythic.includes(e);

  // Each side's form on the day, rolled once per fight: the members in party order, then the boss.
  const forms = heroes.map(form);
  const foeForm = form();

  const party: Member[] = heroes.map((hero, i) => {
    const cls = CLASSES[hero.classId];
    const every = Math.max(1, ticks(cls.attackEverySec * (1 - hero.fx.haste)));
    return {
      i,
      hero,
      form: forms[i],
      hp: hero.maxHp,
      energy: 0,
      shield: 0,
      shieldUntil: -1,
      guardUntil: -1,
      bleedFreeUntil: -1,
      lastStandUsed: false,
      basicCount: 0,
      ward: 0,
      wardMax: hero.mythic.includes("dawn-censer") ? Math.round(hero.maxHp * M.censerShieldMaxPct) : 0,
      every,
      skillEvery: ticks(cls.skill.cooldownSec * (1 - hero.fx.haste)),
      nextAttack: Math.max(1, Math.round(every / 2)),
      nextSkill: ticks(cls.skill.firstAtSec),
      downAt: null,
      stats: { dealt: 0, taken: 0, absorbed: 0, healed: 0, crits: 0 },
    };
  });

  const log: PartyEvent[] = [];
  let foeHp = foe.maxHp;
  const fh = () => Math.max(0, Math.round(foeHp));
  const standing = () => party.filter((m) => m.downAt == null);

  const foeEvery = Math.max(1, ticks(foe.attackEverySec));
  let nextFoeAttack = foeEvery;
  const heavyEvery = foe.heavy ? ticks(foe.heavy.everySec) : 0;
  const heavyWarn = foe.heavy ? ticks(foe.heavy.telegraphSec) : 0;
  let nextHeavy = foe.heavy ? heavyEvery : Infinity;
  const bleedStart = foe.bleed ? ticks(foe.bleed.startSec) : Infinity;
  const second = ticks(1);
  const enrageAt = ticks(foe.enrageSec + (party.some((m) => has(m, "unbroken-path")) ? M.pathEnrageSec : 0));

  /** `by` heals `to`. The healing done counts for the healer. `quiet` (lifesteal) leaves no log line. */
  const heal = (t: number, by: Member, to: Member, amount: number, name?: string, quiet = false) => {
    if (to.downAt != null) return;
    // Staff of First Light: the healer's heals land stronger on someone who is low.
    const low = has(by, "first-light") && to.hp < to.hero.maxHp * M.firstLightBelowPct;
    const wanted = Math.round(amount * (low ? M.firstLightHeal : 1));
    const gained = Math.min(wanted, to.hero.maxHp - to.hp);
    // Dawn Censer: its wearer's healing past full health stays as a shield on whoever was healed.
    if (by.wardMax > 0 && wanted > gained) to.ward = Math.min(by.wardMax, to.ward + wanted - Math.max(0, gained));
    if (gained <= 0) return;
    to.hp += gained;
    by.stats.healed += gained;
    if (!quiet)
      log.push({
        t: secs(t),
        fh: fh(),
        actor: by.i,
        action: "heal",
        amount: gained,
        ...(to !== by ? { target: to.i } : {}),
        ...(name ? { name } : {}),
      });
  };

  /** Damage `m` sends back at the boss (Thorns, the Heart, Bulwark Plate). */
  const reflect = (t: number, m: Member, amount: number) => {
    const back = Math.max(1, Math.round(amount));
    foeHp -= back;
    m.stats.dealt += back;
    log.push({ t: secs(t), fh: fh(), actor: m.i, action: "reflect", amount: back });
  };

  /** Damage to a member. `physical` hits are reduced by DEF and Guard; bleeding isn't. Returns what reached their health. */
  const hurt = (t: number, m: Member, raw: number, physical: boolean): number => {
    const fx = m.hero.fx;
    const before = m.hp;
    let dmg = raw * foeForm;
    if (!physical) dmg *= 1 - fx.bleedResist;
    if (physical) dmg *= through(m.hero.def, m.hero.power);
    if (physical && t <= m.guardUntil) dmg *= SKILLS.guard.damageTakenFactor;
    dmg *= 1 - m.hero.damageReduction;
    dmg = Math.max(1, Math.round(dmg));
    if (t > m.shieldUntil) m.shield = 0;
    const fromShield = Math.min(m.shield, dmg);
    m.shield -= fromShield;
    const fromWard = Math.min(m.ward, dmg - fromShield);
    m.ward -= fromWard;
    const soaked = fromShield + fromWard;
    const toHp = dmg - soaked;
    m.stats.absorbed += Math.round(raw) - toHp;
    m.stats.taken += toHp;
    if (m.hp - toHp <= 0 && has(m, "unbroken-crown") && !m.lastStandUsed) {
      m.lastStandUsed = true;
      m.hp = M.lastStandHp;
      log.push({ t: secs(t), fh: fh(), actor: m.i, action: "last-stand" });
    } else {
      m.hp -= toHp;
    }
    if (physical) {
      m.energy += COMBAT.energy.perHitTaken * (1 + fx.ultCharge) * (has(m, "unyielding-wall") ? M.wallTakenCharge : 1);
      const hit = toHp + soaked;
      if (hit > 0) {
        let back = 0;
        if (has(m, "unbroken-heart")) back += M.heartReflect;
        if (has(m, "bulwark-plate") && t <= m.guardUntil) back += M.bulwarkReflect;
        back += fx.thorns;
        if (back > 0) reflect(t, m, hit * back);
      }
    }
    return Math.max(0, before - m.hp);
  };

  /** A member's hit on the boss at `mult` × attack. */
  const strike = (t: number, m: Member, mult: number, action: FightAction, name?: string, forceCrit = false) => {
    const fx = m.hero.fx;
    const low = foeHp < foe.maxHp * COMBAT.finisherBelowPct;
    const roll = rand();
    const crit = forceCrit || (has(m, "executioners-ring") && foeHp < foe.maxHp * M.executionerBelowPct) || roll < m.hero.critChance;
    let dmg = m.hero.atk * m.form * mult * spread() * through(foe.def, foe.power);
    if (crit) dmg *= COMBAT.critMultiplier * (1 + fx.critDamage);
    if (low) dmg *= 1 + fx.finisher;
    dmg = Math.max(1, Math.round(dmg));
    foeHp -= dmg;
    m.stats.dealt += dmg;
    if (crit) m.stats.crits++;
    if (action !== "ultimate")
      m.energy += COMBAT.energy.perHitLanded * (1 + fx.ultCharge) * (crit && has(m, "kingsbane") ? M.kingsbaneCritCharge : 1);
    log.push({ t: secs(t), fh: fh(), actor: m.i, action, amount: dmg, ...(crit ? { crit } : {}), ...(name ? { name } : {}) });
    const drain = fx.lifesteal + (crit && has(m, "bloodletter-gauntlets") ? M.bloodletterHealPct : 0);
    if (drain > 0) heal(t, m, m, dmg * drain, undefined, true);
  };

  /** Marks members whose health ran out as down. */
  const fall = (t: number) => {
    for (const m of party) {
      if (m.downAt == null && m.hp <= 0) {
        m.hp = 0;
        m.downAt = secs(t);
        log.push({ t: secs(t), fh: fh(), actor: m.i, action: "down" });
      }
    }
  };

  const end = (t: number, how: PartyResult["end"]): PartyResult => {
    if (how === "enrage") log.push({ t: secs(t), fh: fh(), actor: "foe", action: "enrage" });
    else if (how === "foe-down") log.push({ t: secs(t), fh: fh(), actor: "foe", action: "down" });
    return {
      won: how === "foe-down",
      end: how,
      seconds: secs(t),
      foeHpLeft: Math.max(0, foeHp),
      foeMaxHp: foe.maxHp,
      members: party.map((m) => ({ maxHp: m.hero.maxHp, hpLeft: Math.max(0, m.hp), downAt: m.downAt, stats: m.stats })),
      log,
    };
  };

  /**
   * Who the boss hits: a standing Vanguard draws it (the one with the most health left); with none,
   * anyone standing, picked by the seed. Alone, no roll is spent.
   */
  const pickTarget = (): Member => {
    const up = standing();
    const tanks = up.filter((m) => m.hero.classId === "vanguard");
    if (tanks.length) return tanks.reduce((a, b) => (b.hp > a.hp ? b : a));
    return up.length === 1 ? up[0] : up[Math.floor(rand() * up.length)];
  };

  /** The standing member with the least health left as a share of their own, the Cleric's patient. */
  const mostHurt = (): Member => standing().reduce((a, b) => (b.hp / b.hero.maxHp < a.hp / a.hero.maxHp ? b : a));

  for (let t = 1; t <= enrageAt; t++) {
    // Over-time effects, for everyone standing.
    for (const m of party) {
      if (m.downAt != null) continue;
      if (t >= bleedStart && (t - bleedStart) % second === 0 && t > m.bleedFreeUntil) {
        const lost = hurt(t, m, foe.atk * foe.bleed!.perSec, false);
        log.push({ t: secs(t), fh: fh(), actor: "foe", action: "bleed", amount: lost, target: m.i });
        fall(t);
        if (m.downAt != null) continue;
      }
      if (m.hero.regenPct > 0 && t % ticks(COMBAT.necklaceEverySec) === 0) heal(t, m, m, m.hero.maxHp * m.hero.regenPct);
      if (has(m, "unbroken-pillars") && t % ticks(M.pillarsEverySec) === 0 && m.hp < m.hero.maxHp * M.pillarsBelowPct) {
        heal(t, m, m, m.hero.maxHp * M.pillarsPct);
      }
    }
    if (!standing().length) return end(t, "party-down");
    if (foeHp <= 0) return end(t, "foe-down");

    // Each member: ultimate, skill, basic attack.
    for (const m of party) {
      if (m.downAt != null) continue;
      const cls = CLASSES[m.hero.classId];
      const fx = m.hero.fx;
      if (m.energy >= COMBAT.energy.full) {
        m.energy = 0;
        const name = cls.ultimate.name;
        if (m.hero.classId === "striker") strike(t, m, SKILLS.execution.multiplier, "ultimate", name);
        else if (m.hero.classId === "vanguard") {
          strike(t, m, SKILLS.bastion.strikeMultiplier, "ultimate", name);
          const shieldFactor = (1 + fx.bastionShield) * (has(m, "oathkeeper-belt") ? M.oathkeeperShieldFactor : 1);
          m.shield = Math.round(m.hero.maxHp * SKILLS.bastion.shieldPct * shieldFactor);
          m.shieldUntil = t + ticks(SKILLS.bastion.durationSec);
          log.push({ t: secs(t), fh: fh(), actor: m.i, action: "shield", amount: m.shield });
        } else {
          // Radiance: the Cleric in full, everyone else standing at a share, and nobody bleeds for a while.
          log.push({ t: secs(t), fh: fh(), actor: m.i, action: "ultimate", name });
          const full = m.hero.maxHp * SKILLS.radiance.healPct * (1 + fx.healPower);
          heal(t, m, m, full, name);
          for (const ally of standing()) {
            if (ally !== m) heal(t, m, ally, full * RAID.groupHealShare, name);
            ally.bleedFreeUntil = t + ticks(SKILLS.radiance.bleedFreeSec);
          }
        }
        if (foeHp <= 0) return end(t, "foe-down");
      }
      if (t >= m.nextSkill) {
        const name = cls.skill.name;
        if (m.hero.classId === "striker") {
          strike(t, m, SKILLS.powerStrike.multiplier, "skill", name);
          m.nextSkill = t + m.skillEvery;
        } else if (m.hero.classId === "vanguard") {
          // Held for a telegraphed big hit; with none coming, used once hurt.
          const heavySoon = foe.heavy && nextHeavy - t <= ticks(SKILLS.guard.durationSec) / 2;
          if (foe.heavy ? heavySoon : m.hp < m.hero.maxHp * SKILLS.guard.useBelowPct) {
            m.guardUntil = t + ticks(SKILLS.guard.durationSec * (1 + fx.guardDuration));
            log.push({ t: secs(t), fh: fh(), actor: m.i, action: "skill", name });
            m.nextSkill = t + m.skillEvery;
          }
        } else {
          // Mend goes to whoever is hurt worst, the Cleric included, once they are hurt enough.
          const patient = mostHurt();
          if (patient.hp < patient.hero.maxHp * SKILLS.mend.useBelowPct) {
            log.push({ t: secs(t), fh: fh(), actor: m.i, action: "skill", name, ...(patient !== m ? { target: patient.i } : {}) });
            heal(t, m, patient, m.hero.maxHp * m.hero.mendPct * (1 + fx.healPower), name);
            if (has(m, "saints-locket")) patient.bleedFreeUntil = Math.max(patient.bleedFreeUntil, t + ticks(M.saintsBleedFreeSec));
            m.nextSkill = t + m.skillEvery;
          }
        }
        if (foeHp <= 0) return end(t, "foe-down");
      }
      if (t >= m.nextAttack) {
        m.basicCount++;
        strike(t, m, 1, "attack", undefined, has(m, "unbroken-hands") && m.basicCount % M.handsEvery === 0);
        m.nextAttack += m.every;
        if (foeHp <= 0) return end(t, "foe-down");
      }
    }

    // The boss: telegraph, big hit, basic attack.
    if (foe.heavy && t === nextHeavy - heavyWarn) log.push({ t: secs(t), fh: fh(), actor: "foe", action: "telegraph" });
    if (foe.heavy && t >= nextHeavy) {
      const raw = foe.atk * foe.heavy.multiplier * spread();
      const target = pickTarget();
      const hit = foe.cleave ? [target, ...standing().filter((m) => m !== target)] : [target];
      for (const m of hit) {
        const lost = hurt(t, m, m === target ? raw : raw * RAID.cleaveShare, true);
        log.push({ t: secs(t), fh: fh(), actor: "foe", action: "heavy", amount: lost, target: m.i });
      }
      nextHeavy += heavyEvery;
      fall(t);
      if (!standing().length) return end(t, "party-down");
      if (foeHp <= 0) return end(t, "foe-down");
    }
    if (t >= nextFoeAttack) {
      const target = pickTarget();
      const lost = hurt(t, target, foe.atk * spread(), true);
      log.push({ t: secs(t), fh: fh(), actor: "foe", action: "attack", amount: lost, target: target.i });
      nextFoeAttack += foeEvery;
      fall(t);
      if (!standing().length) return end(t, "party-down");
      if (foeHp <= 0) return end(t, "foe-down");
    }
  }
  return end(enrageAt, "enrage");
}
