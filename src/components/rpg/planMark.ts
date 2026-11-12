import type { PlanStatus } from "@/lib/game/train";

/** How a day's plan status is drawn: the Train week strip and the Quests calendar share it. */
export const MARK: Record<PlanStatus, { text: string; cls: string }> = {
  done: { text: "✓", cls: "border-rpg-good text-rpg-good" },
  "on-time": { text: "✓", cls: "border-rpg-good text-rpg-good" },
  late: { text: "~", cls: "border-rpg-warn text-rpg-warn" },
  early: { text: "~", cls: "border-rpg-warn text-rpg-warn" },
  today: { text: "•", cls: "border-rpg-accent bg-rpg-accent text-rpg-bg" },
  planned: { text: "", cls: "border-[#4a4d52] text-rpg-muted" },
  missed: { text: "–", cls: "border-transparent text-rpg-muted" },
  extra: { text: "+", cls: "border-rpg-line-strong text-rpg-text-2" },
  rest: { text: "", cls: "border-transparent" },
};
