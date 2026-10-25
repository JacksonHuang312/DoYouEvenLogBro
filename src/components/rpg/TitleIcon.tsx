import { CalendarCheck, Crown, Flame, Hexagon, Link2, ScrollText, Target, Trophy, type LucideIcon } from "lucide-react";
import type { TitleId } from "@/lib/game/titles";

/** One line-art icon per title, so no two look alike. */
const ICONS: Record<TitleId, LucideIcon> = {
  calibrated: Target,
  regular: CalendarCheck,
  unbroken: Link2,
  recordBreaker: Trophy,
  questmaster: ScrollText,
  wellRounded: Hexagon,
  ironHabit: Flame,
  centurion: Crown,
};

/** Lit in the accent color once earned, muted until then. Decorative: the title's name is beside it. */
export function TitleIcon({ id, earned }: { id: TitleId; earned: boolean }) {
  const Icon = ICONS[id];
  return <Icon size={26} strokeWidth={1.5} aria-hidden className={`mt-0.5 shrink-0 ${earned ? "text-rpg-accent" : "text-rpg-muted"}`} />;
}
