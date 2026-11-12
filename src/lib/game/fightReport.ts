import type { FightMode } from "./fights";
import type { FightRecord } from "../server/fights";

/*
 * What real fights say (GAME_DESIGN.md 13.11 and 13.24): win rates per enemy, how long players take
 * to first beat each weekly tier, and what fights pay. Pure: `scripts/fight-report.ts` reads the
 * stored fight records and prints this, so tuning can use data and not only the pacing model.
 */

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;
/** An average month, for "months since the account's game began". */
export const MONTH_MS = 30.44 * DAY_MS;

export interface ReportPlayer {
  uid: string;
  /** When the player's game began (game/state.createdAt), the zero for "months to a tier". Null if unknown. */
  startedAt: number | null;
  fights: FightRecord[];
}

export interface FoeRow {
  mode: FightMode;
  /** The enemy's name; endless tower enemies lose their "(floor N)", so a type is one row. */
  foe: string;
  /** Rounds fought against it (a climb is several rounds). */
  rounds: number;
  wins: number;
  winRate: number;
  /** Average fight length in the simulation's seconds. */
  seconds: number;
  /** Average hero power over the enemy's recommended power: under 1 means players go in underpowered. */
  powerRatio: number;
  /** Losses where the hero fell, and losses to the enrage timer. */
  fell: number;
  enraged: number;
  /** Lowest and highest tier, floor or stage it was met at. */
  keys: [number, number];
}

export interface ModeRow {
  mode: FightMode;
  /** Fight requests (a climb counts once). */
  fights: number;
  wins: number;
  winRate: number;
  coins: number;
  scrap: number;
  mythicCores: number;
  /** Items kept, and drops that auto-salvage turned into scrap. */
  items: number;
  autoSalvaged: number;
}

export interface TierRow {
  tier: number;
  /** Players who have beaten this weekly tier at least once. */
  players: number;
  /** Months from the start of their game to that first win: fastest, median, slowest. Null without a known start. */
  months: { min: number; median: number; max: number } | null;
}

export interface IncomeRow {
  uid: string;
  fights: number;
  coins: number;
  /** Weeks from the first fight to the last, at least one. */
  weeks: number;
  coinsPerWeek: number;
  /** Days with at least one fight (UTC days). */
  fightDays: number;
}

export interface FightReport {
  players: number;
  fights: number;
  from: number | null;
  to: number | null;
  byMode: ModeRow[];
  byFoe: FoeRow[];
  weeklyTiers: TierRow[];
  income: IncomeRow[];
}

const MODES: FightMode[] = ["campaign", "endless", "weekly", "bossTower"];
const foeName = (name: string) => name.replace(/\s*\(floor \d+\)$/, "");
const rate = (wins: number, of: number) => (of ? wins / of : 0);

function median(sorted: number[]): number {
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/** The report over every player's stored fights. Players without fights count for nothing. */
export function fightReport(players: ReportPlayer[]): FightReport {
  const active = players.filter((p) => p.fights.length > 0);
  const all = active.flatMap((p) => p.fights);

  const byMode = MODES.map((mode): ModeRow => {
    const fights = all.filter((f) => f.mode === mode);
    const wins = fights.filter((f) => f.won).length;
    const sum = (pick: (f: FightRecord) => number) => fights.reduce((n, f) => n + pick(f), 0);
    return {
      mode,
      fights: fights.length,
      wins,
      winRate: rate(wins, fights.length),
      coins: sum((f) => f.coins),
      scrap: sum((f) => f.scrap),
      mythicCores: sum((f) => f.mythicCores),
      items: sum((f) => f.items.length),
      autoSalvaged: sum((f) => (f.salvaged ?? []).filter((s) => s.itemLevel != null).length),
    };
  }).filter((row) => row.fights > 0);

  const foes = new Map<string, FoeRow & { secondsSum: number; ratioSum: number }>();
  for (const fight of all) {
    for (const round of fight.rounds) {
      const foe = foeName(round.foe);
      const id = `${fight.mode}|${foe}`;
      const row = foes.get(id) ?? {
        mode: fight.mode,
        foe,
        rounds: 0,
        wins: 0,
        winRate: 0,
        seconds: 0,
        powerRatio: 0,
        fell: 0,
        enraged: 0,
        keys: [round.key, round.key] as [number, number],
        secondsSum: 0,
        ratioSum: 0,
      };
      row.rounds++;
      if (round.result.won) row.wins++;
      else if (round.result.end === "enrage") row.enraged++;
      else row.fell++;
      row.secondsSum += round.result.seconds;
      row.ratioSum += round.power > 0 ? fight.heroPower / round.power : 0;
      row.keys = [Math.min(row.keys[0], round.key), Math.max(row.keys[1], round.key)];
      foes.set(id, row);
    }
  }
  const byFoe = [...foes.values()]
    .map(({ secondsSum, ratioSum, ...row }): FoeRow => ({
      ...row,
      winRate: rate(row.wins, row.rounds),
      seconds: secondsSum / row.rounds,
      powerRatio: ratioSum / row.rounds,
    }))
    // By mode, then where it is met, so the table reads in the order a player meets them.
    .sort((a, b) => MODES.indexOf(a.mode) - MODES.indexOf(b.mode) || a.keys[0] - b.keys[0] || a.foe.localeCompare(b.foe));

  const tiers = new Map<number, { players: number; months: number[] }>();
  for (const player of active) {
    const first = new Map<number, number>();
    for (const fight of player.fights) {
      if (fight.mode !== "weekly") continue;
      for (const round of fight.rounds) {
        if (round.result.won) first.set(round.key, Math.min(first.get(round.key) ?? Infinity, fight.at));
      }
    }
    for (const [tier, at] of first) {
      const row = tiers.get(tier) ?? { players: 0, months: [] };
      row.players++;
      if (player.startedAt != null) row.months.push(Math.max(0, at - player.startedAt) / MONTH_MS);
      tiers.set(tier, row);
    }
  }
  const weeklyTiers = [...tiers.entries()]
    .sort(([a], [b]) => a - b)
    .map(([tier, row]): TierRow => {
      const sorted = [...row.months].sort((a, b) => a - b);
      return {
        tier,
        players: row.players,
        months: sorted.length ? { min: sorted[0], median: median(sorted), max: sorted[sorted.length - 1] } : null,
      };
    });

  const income = active
    .map((player): IncomeRow => {
      const times = player.fights.map((f) => f.at);
      const weeks = Math.max(1, (Math.max(...times) - Math.min(...times)) / WEEK_MS);
      const coins = player.fights.reduce((n, f) => n + f.coins, 0);
      return {
        uid: player.uid,
        fights: player.fights.length,
        coins,
        weeks,
        coinsPerWeek: coins / weeks,
        fightDays: new Set(times.map((t) => Math.floor(t / DAY_MS))).size,
      };
    })
    .sort((a, b) => b.coinsPerWeek - a.coinsPerWeek || a.uid.localeCompare(b.uid));

  const times = all.map((f) => f.at);
  return {
    players: active.length,
    fights: all.length,
    from: times.length ? Math.min(...times) : null,
    to: times.length ? Math.max(...times) : null,
    byMode,
    byFoe,
    weeklyTiers,
    income,
  };
}

const MODE_NAME: Record<FightMode, string> = {
  campaign: "Campaign",
  endless: "Endless tower",
  weekly: "Weekly boss",
  bossTower: "Boss Tower",
};
const KEY_NAME: Record<FightMode, string> = { campaign: "stage", endless: "floor", weekly: "tier", bossTower: "floor" };
const pct = (x: number) => `${Math.round(x * 100)}%`;
const num = (x: number) => Math.round(x).toLocaleString("en-US");
const day = (ms: number) => new Date(ms).toISOString().slice(0, 10);

function table(head: string[], rows: string[][]): string[] {
  const widths = head.map((h, i) => Math.max(h.length, ...rows.map((r) => r[i].length)));
  const line = (cells: string[]) => cells.map((c, i) => (i === 0 ? c.padEnd(widths[i]) : c.padStart(widths[i]))).join("  ").trimEnd();
  return [line(head), ...rows.map(line)];
}

/** The report as plain text lines, for the script to print. */
export function reportLines(report: FightReport): string[] {
  if (!report.fights) return ["No stored fights."];
  const out = [
    `${num(report.fights)} fights by ${report.players} ${report.players === 1 ? "player" : "players"}, ${day(report.from!)} to ${day(report.to!)}.`,
    "",
    "By mode (a climb is one fight)",
    ...table(
      ["Mode", "Fights", "Won", "Coins", "Scrap", "Cores", "Items", "Auto-salvaged"],
      report.byMode.map((r) => [MODE_NAME[r.mode], num(r.fights), pct(r.winRate), num(r.coins), num(r.scrap), num(r.mythicCores), num(r.items), num(r.autoSalvaged)]),
    ),
    "",
    "By enemy (each round; power is the hero's over the enemy's recommended)",
    ...table(
      ["Enemy", "Mode", "Met at", "Rounds", "Won", "Fell", "Enraged", "Avg s", "Power"],
      report.byFoe.map((r) => [
        r.foe,
        MODE_NAME[r.mode],
        `${KEY_NAME[r.mode]} ${r.keys[0] === r.keys[1] ? r.keys[0] : `${r.keys[0]}-${r.keys[1]}`}`,
        num(r.rounds),
        pct(r.winRate),
        num(r.fell),
        num(r.enraged),
        r.seconds.toFixed(1),
        `${Math.round(r.powerRatio * 100)}%`,
      ]),
    ),
    "",
    "Months to the first win at each weekly tier (from the start of the player's game)",
    ...(report.weeklyTiers.length
      ? table(
          ["Tier", "Players", "Fastest", "Median", "Slowest"],
          report.weeklyTiers.map((r) => [
            String(r.tier),
            num(r.players),
            ...(r.months ? [r.months.min, r.months.median, r.months.max].map((m) => m.toFixed(1)) : ["?", "?", "?"]),
          ]),
        )
      : ["No weekly wins yet."]),
    "",
    "Coins from fights, per player (workout and quest coins are not counted here)",
    ...table(
      ["Player", "Fights", "Fight days", "Coins", "Weeks", "Coins / week"],
      report.income.map((r) => [r.uid, num(r.fights), num(r.fightDays), num(r.coins), r.weeks.toFixed(1), num(r.coinsPerWeek)]),
    ),
  ];
  return out;
}
