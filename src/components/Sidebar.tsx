"use client";

import { BookOpen, Dumbbell, House, LogOut, Settings, User } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth, useProfile } from "./AuthProvider";
import { isActive } from "./BottomNav";
import { Avatar } from "./ui";
import { useWorkout } from "./WorkoutProvider";

const ITEMS = [
  { href: "/home", label: "Home", Icon: House, match: ["/home"] },
  { href: "/workout", label: "Workout", Icon: Dumbbell, match: ["/workout", "/routines"] },
  { href: "/exercises", label: "Exercises", Icon: BookOpen, match: ["/exercises"] },
  { href: "/profile", label: "Profile", Icon: User, match: ["/profile"] },
  { href: "/settings", label: "Settings", Icon: Settings, match: ["/settings"] },
];

/** Desktop navigation (lg and up); phones use <BottomNav> instead. */
export function Sidebar() {
  const pathname = usePathname();
  const profile = useProfile();
  const { signOut } = useAuth();
  const { draft } = useWorkout();

  return (
    <nav className="fixed inset-y-0 left-0 z-20 hidden w-64 flex-col border-r border-line bg-surface lg:flex">
      <Link href="/home" className="px-6 pb-6 pt-7 text-title-3 tracking-tight">
        Do You Even Log <span className="text-accent">Bro?</span>
      </Link>

      <ul className="flex-1 space-y-1 px-3">
        {ITEMS.map(({ href, label, Icon, match }) => {
          const active = isActive(pathname, match);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-body ${
                  active ? "bg-accent/12 font-semibold text-accent" : "text-white hover:bg-surface-2"
                }`}
              >
                <Icon size={22} strokeWidth={active ? 2.2 : 1.8} />
                <span className="flex-1">{label}</span>
                {href === "/workout" && draft && (
                  <span className="rounded-full bg-accent px-2 py-0.5 text-caption font-semibold text-on-accent">
                    In progress
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>

      <div className="flex items-center gap-3 border-t border-line px-4 py-4">
        <Avatar photoURL={profile.photoURL} name={profile.username} size={36} />
        <span className="min-w-0 flex-1 truncate text-headline">{profile.username}</span>
        <button onClick={signOut} aria-label="Sign out" title="Sign out" className="rounded-md p-2 text-muted hover:text-white">
          <LogOut size={20} />
        </button>
      </div>
    </nav>
  );
}
