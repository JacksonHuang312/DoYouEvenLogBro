"use client";

import { Plus } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useWorkout } from "./WorkoutProvider";

const LEFT = [
  { href: "/train", label: "Train", match: ["/train", "/routines", "/exercises"] },
  { href: "/quests", label: "Quests", match: ["/quests"] },
];
const RIGHT = [
  { href: "/battle", label: "Battle", match: ["/battle"] },
  { href: "/hero", label: "Hero", match: ["/hero"] },
];

/** True when `pathname` is one of `match` or below it (e.g. /routines/abc for /routines). */
export function isActive(pathname: string, match: string[]) {
  return match.some((m) => pathname === m || pathname.startsWith(`${m}/`));
}

/** Phone tab bar: Train · Quests · [+] · Battle · Hero. Hidden from lg up, where <Sidebar> takes over. */
export function BottomNav() {
  const pathname = usePathname();
  const { draft } = useWorkout();

  const tab = ({ href, label, match }: (typeof LEFT)[number]) => {
    const active = isActive(pathname, match);
    return (
      <Link
        key={href}
        href={href}
        aria-current={active ? "page" : undefined}
        className={`flex h-full items-center justify-center border-t-2 text-xs ${
          active ? "border-rpg-accent text-rpg-text" : "border-transparent text-rpg-muted"
        }`}
      >
        {label}
      </Link>
    );
  };

  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-rpg-line bg-rpg-bg pb-[env(safe-area-inset-bottom)] font-rpg-body lg:hidden">
      {/* h-16 (4rem) above the home bar: the rest timer and page padding in AppShell/RestTimer assume this height. */}
      <div className="mx-auto grid h-16 max-w-xl grid-cols-5">
        {LEFT.map(tab)}
        {/* The whole cell is the tap target; the button itself is drawn smaller inside it. */}
        <Link
          href="/workout"
          aria-label={draft ? "Resume workout" : "Start workout"}
          className="flex h-full items-center justify-center"
        >
          <span className="relative flex h-10 w-[46px] items-center justify-center bg-rpg-accent text-rpg-bg">
            <Plus size={20} strokeWidth={2.4} aria-hidden />
            {draft && (
              <span
                aria-hidden
                className="absolute -right-1.5 -top-1.5 h-3 w-3 rounded-full border-2 border-rpg-bg bg-rpg-text"
              />
            )}
          </span>
        </Link>
        {RIGHT.map(tab)}
      </div>
    </nav>
  );
}
