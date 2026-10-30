import { baseItem } from "./catalog";
import { ATTRIBUTES, BONUS_BUCKET_CAP, GEAR, WEAPON_CLASS_BONUS, WEAPONS, type ClassId } from "./config";
import { activeSet, canEquip, pieceFocus, pieceSetId, piecePower, type Item, type PieceRef } from "./items";

/*
 * Battle power (GAME_DESIGN.md 2.5, 4, 12 and 13.6). Gear and titles count only here: the radar,
 * stats, stat XP and snapshots all use body power.
 *
 *   gear    = Σ piece power (a set's pieces × (1 + its set bonus), the class's own weapon type ×
 *             (1 + WEAPON_CLASS_BONUS)), capped at maxShare / (1 − maxShare) × body
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
    /** The counted gear power split into combat attributes by each piece's focus. */
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

export type GearPiece = Pick<Item, "slot" | "rarity" | "plus" | "baseId"> & Partial<Pick<Item, "itemLevel">> & PieceRef;

/** The class's own weapon type adds WEAPON_CLASS_BONUS to that weapon's power (13.6). */
export function weaponClassBonus(piece: Pick<Item, "baseId">, classId: ClassId | null | undefined): number {
  const weapon = baseItem(piece.baseId)?.weapon;
  return weapon && classId && WEAPONS[weapon].classId === classId ? WEAPON_CLASS_BONUS : 0;
}

/**
 * Battle power from body power, the equipped items, and the title and class bonuses (shares,
 * 0.05 = 5%). Pieces above the level are ignored. No body power means gear adds nothing.
 */
export function battlePower({
  body,
  equipped,
  level,
  classId = null,
  titlePct = 0,
  classPct = 0,
}: {
  body: number;
  equipped: GearPiece[];
  level: number;
  /** For the matching-weapon bonus. */
  classId?: ClassId | null;
  titlePct?: number;
  classPct?: number;
}): BattlePower {
  const pieces = equipped.filter((p) => canEquip(p, level));
  const set = activeSet(pieces);
  // The set bonus multiplies only the power of the active set's own pieces.
  const worth = (p: GearPiece) =>
    piecePower(p) * (set && pieceSetId(p) === set.setId ? 1 + set.pct : 1) * (1 + weaponClassBonus(p, classId));
  const raw = pieces.reduce((sum, p) => sum + piecePower(p), 0);
  const boosted = pieces.reduce((sum, p) => sum + worth(p), 0);
  const setPct = set?.pct ?? 0;
  const cap = (GEAR.maxShare / (1 - GEAR.maxShare)) * Math.max(0, body);
  const counted = Math.min(boosted, cap);
  const scale = boosted > 0 ? counted / boosted : 0;

  const attributes: Attributes = { hp: 0, atk: 0, def: 0 };
  for (const p of pieces) {
    const power = worth(p) * scale;
    const focus = pieceFocus(p);
    for (const attr of ATTRIBUTES) attributes[attr] += (power * (focus[attr] ?? 0)) / 100;
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
