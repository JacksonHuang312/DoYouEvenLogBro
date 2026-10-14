"use client";

import { Dumbbell, House, User } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useWorkout } from "./WorkoutProvider";

const TABS = [
  { href: "/home", label: "Home", Icon: House, match: ["/home", "/search", "/u"] },
  { href: "/workout", label: "Workout", Icon: Dumbbell, match: ["/workout", "/routines"] },
  { href: "/profile", label: "Profile", Icon: User, match: ["/profile", "/exercises", "/settings"] },
];

/** True when `pathname` is one of `match` or below it (e.g. /routines/abc for /routines). */
export function isActive(pathname: string, match: string[]) {
  return match.some((m) => pathname === m || pathname.startsWith(`${m}/`));
}

/** Phone tab bar; hidden from lg up, where <Sidebar> takes over. */
export function BottomNav() {
  const pathname = usePathname();
  const { draft } = useWorkout();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] lg:hidden">
      {/* h-16 (4rem): the rest timer and page padding in AppShell/RestTimer assume this height. */}
      <div className="mx-auto flex h-16 max-w-xl">
        {TABS.map(({ href, label, Icon, match }) => {
          const active = isActive(pathname, match);
          return (
            <Link
              key={href}
              href={href}
              className={`relative flex flex-1 flex-col items-center justify-center gap-0.5 text-xs ${
                active ? "text-accent" : "text-muted"
              }`}
            >
              <Icon size={24} strokeWidth={active ? 2.2 : 1.8} />
              {label}
              {href === "/workout" && draft && (
                <span className="absolute right-[calc(50%-18px)] top-2 h-2.5 w-2.5 rounded-full border-2 border-surface bg-accent" />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
