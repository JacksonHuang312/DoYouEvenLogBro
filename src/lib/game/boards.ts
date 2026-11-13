import type { ClassId } from "./config";

/*
 * Friend leaderboards (GAME_DESIGN.md 6 and 13.27). The server keeps each player's board numbers in
 * publicStats/{uid}.board (readable under the same privacy rule as their workouts); the Leaderboards
 * page ranks you and everyone you follow. Pure.
 */

export const BOARDS = ["power", "dealt", "absorbed", "healed"] as const;
export type BoardId = (typeof BOARDS)[number];

export const BOARD_TEXT: Record<BoardId, { label: string; note: string; weekly: boolean }> = {
  power: { label: "Power", note: "Body power from training, as of each player's last workout.", weekly: false },
  dealt: { label: "Damage", note: "Damage dealt in fights this week.", weekly: true },
  absorbed: { label: "Absorbed", note: "Damage absorbed in fights this week.", weekly: true },
  healed: { label: "Healing", note: "Healing done in fights this week.", weekly: true },
};

/** A fight week's totals: every round of every fight in it. */
export interface BoardWeek {
  /** The player's fight week (`fightWeek`): it turns on Sunday at 04:00 in their own time zone. */
  id: string;
  dealt: number;
  absorbed: number;
  healed: number;
  fights: number;
}

/** publicStats/{uid}.board. Written only by the server. */
export interface BoardStats {
  /** Body power at the last counted workout. Missing until the first one after boards shipped. */
  power?: number;
  level?: number;
  classId?: ClassId;
  week?: BoardWeek;
  updatedAt?: number;
}

/** What a counted workout writes: power and level. The week's fight totals are left alone (merged). */
export const boardAfterClaim = (power: number, level: number, now: number): BoardStats => ({
  power: Math.round(power * 10) / 10,
  level,
  updatedAt: now,
});

/** The week's totals after a fight: added to the same week's, or a new week's started. */
export function boardAfterFight(
  prev: BoardStats | null | undefined,
  fight: { week: string; level: number; classId: ClassId; rounds: { dealt: number; absorbed: number; healed: number }[] },
  now: number,
): BoardStats {
  const before = prev?.week?.id === fight.week ? prev.week : { id: fight.week, dealt: 0, absorbed: 0, healed: 0, fights: 0 };
  const sum = (pick: (r: { dealt: number; absorbed: number; healed: number }) => number) =>
    Math.round(fight.rounds.reduce((n, r) => n + pick(r), 0));
  return {
    level: fight.level,
    classId: fight.classId,
    week: {
      id: fight.week,
      dealt: before.dealt + sum((r) => r.dealt),
      absorbed: before.absorbed + sum((r) => r.absorbed),
      healed: before.healed + sum((r) => r.healed),
      fights: before.fights + 1,
    },
    updatedAt: now,
  };
}

export interface BoardEntry {
  uid: string;
  name: string;
  photoURL: string | null;
  /** Null when the player has no board numbers yet, or they can't be read. */
  board: BoardStats | null;
}

export interface BoardRow {
  uid: string;
  name: string;
  photoURL: string | null;
  /** 1 for the top; players level on the number share a rank. Null with no number. */
  rank: number | null;
  value: number | null;
  /** "1,234", or "–" with no number. */
  text: string;
  /** "Level 40 · Striker", as far as it is known. */
  detail: string;
  isYou: boolean;
}

const CLASS_NAME: Record<ClassId, string> = { vanguard: "Vanguard", striker: "Striker", cleric: "Cleric" };

/** A player's number on a board. Weekly boards count only the fight week `week`; an older week's totals are gone. */
export function boardValue(board: BoardStats | null, id: BoardId, week: string): number | null {
  if (!board) return null;
  if (id === "power") return board.power ?? null;
  return board.week?.id === week ? board.week[id] : null;
}

/**
 * The board, best first. Players with no number come last, by name. `week` is the viewer's current
 * fight week: a friend in another time zone is on the same week except for a few hours around the reset.
 */
export function boardRows(entries: BoardEntry[], id: BoardId, viewerUid: string, week: string): BoardRow[] {
  const rows = entries.map((e) => {
    const value = boardValue(e.board, id, week);
    const detail = [e.board?.level != null ? `Level ${e.board.level}` : "", e.board?.classId ? CLASS_NAME[e.board.classId] : ""]
      .filter(Boolean)
      .join(" · ");
    return {
      uid: e.uid,
      name: e.name,
      photoURL: e.photoURL,
      rank: null as number | null,
      value,
      text: value == null ? "–" : Math.round(value).toLocaleString("en-US"),
      detail,
      isYou: e.uid === viewerUid,
    };
  });
  rows.sort(
    (a, b) =>
      Number(b.value != null) - Number(a.value != null) ||
      (b.value ?? 0) - (a.value ?? 0) ||
      a.name.localeCompare(b.name) ||
      a.uid.localeCompare(b.uid),
  );
  let rank = 0;
  rows.forEach((row, i) => {
    if (row.value == null) return;
    if (i === 0 || rows[i - 1].value !== row.value) rank = i + 1;
    row.rank = rank;
  });
  return rows;
}
