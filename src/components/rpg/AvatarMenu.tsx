"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth, useProfile } from "@/components/AuthProvider";
import { Avatar } from "@/components/ui";
import { useFollowRequests } from "@/lib/follows";

const ROW = "flex min-h-11 w-full items-center justify-between gap-3 px-4 text-left text-sm hover:bg-rpg-line-soft";

/**
 * The avatar in every tab header. Opens the places that aren't tabs: profile, friends feed, find
 * friends, calendar, follow requests, settings and sign out. A dot on the avatar means follow
 * requests are waiting.
 */
export function AvatarMenu() {
  const profile = useProfile();
  const { signOut } = useAuth();
  const pathname = usePathname();
  const requests = useFollowRequests(profile.uid);
  const pending = requests?.length ?? 0;
  const [openAt, setOpenAt] = useState<string | null>(null);
  // Closes by itself when the page changes.
  const open = openAt === pathname;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpenAt(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const close = () => setOpenAt(null);

  return (
    <div className="relative">
      <button
        onClick={() => setOpenAt(open ? null : pathname)}
        aria-label={pending > 0 ? `Menu, ${pending} follow ${pending === 1 ? "request" : "requests"}` : "Menu"}
        aria-expanded={open}
        aria-haspopup="menu"
        className="relative flex h-11 w-11 items-center justify-center border border-rpg-line-strong"
      >
        <Avatar photoURL={profile.photoURL} name={profile.username} size={30} />
        {pending > 0 && (
          <span aria-hidden className="absolute -right-1 -top-1 h-3 w-3 rounded-full border-2 border-rpg-bg bg-rpg-accent" />
        )}
      </button>
      {open && (
        <>
          {/* Invisible full-screen layer: tapping anywhere else closes the menu. */}
          <div aria-hidden className="fixed inset-0 z-30" onClick={close} />
          <div role="menu" className="absolute right-0 top-12 z-40 w-60 border border-rpg-line-strong bg-rpg-surface py-1">
            <div className="truncate px-4 py-2 text-xs text-rpg-muted">@{profile.username}</div>
            <MenuLink href="/profile" onNavigate={close}>
              Profile
            </MenuLink>
            <MenuLink href="/home" onNavigate={close}>
              Friends feed
            </MenuLink>
            <MenuLink href="/search" onNavigate={close}>
              Find friends
            </MenuLink>
            {pending > 0 && (
              <MenuLink href="/profile/requests" onNavigate={close}>
                Follow requests
                <span className="bg-rpg-accent px-1.5 text-xs font-semibold text-rpg-bg">{pending}</span>
              </MenuLink>
            )}
            <MenuLink href="/profile/calendar" onNavigate={close}>
              Calendar
            </MenuLink>
            <MenuLink href="/settings" onNavigate={close}>
              Settings
            </MenuLink>
            <button
              role="menuitem"
              onClick={() => {
                close();
                void signOut();
              }}
              className={`${ROW} border-t border-rpg-line text-rpg-muted`}
            >
              Sign out
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function MenuLink({ href, onNavigate, children }: { href: string; onNavigate: () => void; children: React.ReactNode }) {
  return (
    <Link href={href} role="menuitem" onClick={onNavigate} className={ROW}>
      {children}
    </Link>
  );
}
