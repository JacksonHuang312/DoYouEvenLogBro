import {
  CAMPAIGN_CHAPTERS,
  TOWER_BOSSES,
  WEEKLY_BOSSES,
  type BossType,
} from "./bossData";

/*
 * Which icon an enemy gets (GAME_DESIGN.md 13.15). Fights name their enemy by display name, so the
 * lookup starts from the name: the enemy's id if it has its own art, else its kind, else a default.
 */

export type EnemyKind =
  BossType | "sentinel" | "stalker" | "warden" | "regular";

export interface EnemyRef {
  /** Stable id, also the key for its own artwork. */
  id: string;
  name: string;
  kind: EnemyKind;
  group:
    | "Chapter bosses"
    | "Weekly bosses"
    | "Boss Tower"
    | "Campaign enemies"
    | "Endless tower";
}

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

/** Every enemy there is, in the order the contact sheet shows them. */
export const ENEMIES: EnemyRef[] = [
  ...CAMPAIGN_CHAPTERS.map((c): EnemyRef => ({
    id: c.boss.id,
    name: c.boss.name,
    kind: c.boss.type,
    group: "Chapter bosses",
  })),
  ...WEEKLY_BOSSES.map((b): EnemyRef => ({
    id: b.id,
    name: b.name,
    kind: b.type,
    group: "Weekly bosses",
  })),
  ...TOWER_BOSSES.map((b): EnemyRef => ({
    id: b.id,
    name: b.name,
    kind: b.type,
    group: "Boss Tower",
  })),
  ...CAMPAIGN_CHAPTERS.flatMap((c) =>
    c.enemies.map((name): EnemyRef => ({
      id: slug(name),
      name,
      kind: "regular",
      group: "Campaign enemies",
    })),
  ),
  {
    id: "tower-sentinel",
    name: "Tower Sentinel",
    kind: "sentinel",
    group: "Endless tower",
  },
  {
    id: "tower-stalker",
    name: "Tower Stalker",
    kind: "stalker",
    group: "Endless tower",
  },
  {
    id: "tower-warden",
    name: "Tower Warden",
    kind: "warden",
    group: "Endless tower",
  },
];

const BY_NAME = new Map(ENEMIES.map((e) => [e.name, e]));

/** The enemy behind a display name; endless tower names carry their floor ("Tower Sentinel (floor 3)"). Null if unknown. */
export function enemyByName(name: string): EnemyRef | null {
  return BY_NAME.get(name.replace(/\s*\(floor \d+\)$/, "")) ?? null;
}
