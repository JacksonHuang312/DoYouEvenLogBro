import { BONUS_BUCKET_CAP, GEAR } from "./config";
import { canEquip, piecePower, setBonusPct, type Item } from "./items";

/*
 * Battle power (GAME_DESIGN.md 2.5, 4 and 12). Gear and titles count only here: the radar,
 * stats, stat XP and snapshots all use body power.
 *
 *   gear    = Σ piece power × (1 + set bonus), capped at maxShare / (1 − maxShare) × body
 *   bucket  = min(BONUS_BUCKET_CAP, titles + class)
 *   battle  = (body + gear) × (1 + bucket)
 */

export interface Attributes {
  hp: number;
  atk: number;
  def: number;
}

export interface BattlePower {
  /** Σ(stat × multiplier): the power the Stats tab shows. */
  body: number;
  gear: {
    /** Before the set bonus and the cap. */
    raw: number;
    setPct: number;
    /** With the set bonus. */
    boosted: number;
    /** The most gear can add for this body power. */
    cap: number;
    /** What counts: min(boosted, cap). */
    counted: number;
    capped: boolean;
    /** The counted gear power split into combat attributes by slot. */
    attributes: Attributes;
  };
  bonus: {
    titles: number;
    class: number;
    /** The bucket after its cap. */
    total: number;
    capped: boolean;
  };
  total: number;
}

type GearPiece = Pick<Item, "slot" | "rarity" | "plus" | "originRarity" | "baseId">;

/**
 * Battle power from body power, the equipped items, and the title and class bonuses (shares,
 * 0.05 = 5%). Pieces the level can't equip are ignored. No body power means gear adds nothing.
 */
export function battlePower({
  body,
  equipped,
  level,
  titlePct = 0,
  classPct = 0,
}: {
  body: number;
  equipped: GearPiece[];
  level: number;
  titlePct?: number;
  classPct?: number;
}): BattlePower {
  const pieces = equipped.filter((p) => canEquip(p, level));
  const raw = pieces.reduce((sum, p) => sum + piecePower(p), 0);
  const setPct = setBonusPct(pieces);
  const boosted = raw * (1 + setPct);
  const cap = (GEAR.maxShare / (1 - GEAR.maxShare)) * Math.max(0, body);
  const counted = Math.min(boosted, cap);
  const scale = boosted > 0 ? counted / boosted : 0;

  const attributes: Attributes = { hp: 0, atk: 0, def: 0 };
  for (const p of pieces) {
    const power = piecePower(p) * (1 + setPct) * scale;
    for (const [attr, share] of Object.entries(GEAR.slotAttributes[p.slot]) as [keyof Attributes, number][]) {
      attributes[attr] += power * share;
    }
  }

  const bucket = titlePct + classPct;
  const total = Math.min(BONUS_BUCKET_CAP, bucket);
  return {
    body,
    gear: { raw, setPct, boosted, cap, counted, capped: boosted > cap, attributes },
    bonus: { titles: titlePct, class: classPct, total, capped: bucket > BONUS_BUCKET_CAP },
    total: (Math.max(0, body) + counted) * (1 + total),
  };
}
