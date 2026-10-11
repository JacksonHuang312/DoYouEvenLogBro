"use client";

/* eslint-disable @next/next/no-img-element -- remote thumbnails/avatars; next/image would need per-host config */
import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

const IMAGE_CDN = "https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@main/exercises";

/** Illustration for a library exercise (free-exercise-db); custom exercises have none. */
function exerciseImageUrl(exerciseId: string): string | null {
  return exerciseId.startsWith("c_") ? null : `${IMAGE_CDN}/${encodeURIComponent(exerciseId)}/0.jpg`;
}

/** Circular exercise illustration (white background like Hevy's), or the initial for custom exercises. */
export function ExerciseThumb({ exerciseId, name, size = 44 }: { exerciseId: string; name: string; size?: number }) {
  const [failed, setFailed] = useState(false);
  const src = failed ? null : exerciseImageUrl(exerciseId);
  return (
    <span
      className="flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-white text-lg font-semibold text-black"
      style={{ width: size, height: size }}
    >
      {src ? <img
          src={src}
          alt=""
          loading="lazy"
          onError={() => setFailed(true)}
          // Catches images that already failed before React attached onError (server-rendered HTML).
          ref={(el) => {
            if (el?.complete && el.naturalWidth === 0) setFailed(true);
          }}
          className="h-full w-full object-cover"
        /> : name.charAt(0).toUpperCase()}
    </span>
  );
}

export function Avatar({ photoURL, name, size = 40 }: { photoURL: string | null; name: string; size?: number }) {
  return (
    <span
      className="flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-surface-2 font-semibold"
      style={{ width: size, height: size, fontSize: size * 0.4 }}
    >
      {photoURL ? (
        <img src={photoURL} alt="" referrerPolicy="no-referrer" className="h-full w-full object-cover" />
      ) : (
        name.charAt(0).toUpperCase()
      )}
    </span>
  );
}

export function PageHeader({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <header className="flex items-center justify-between gap-3 pb-4 pt-2">
      <h1 className="truncate text-3xl font-bold">{title}</h1>
      {children && <div className="flex items-center gap-4">{children}</div>}
    </header>
  );
}

export function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-sm text-muted">{label}</div>
      <div className="text-lg">{value}</div>
    </div>
  );
}

/** Sub-page header: back chevron, centered title, optional right slot. */
export function BackHeader({ title, href, right }: { title: string; href: string; right?: React.ReactNode }) {
  return (
    <div className="-mx-4 mb-4 flex items-center px-2 py-2">
      <Link href={href} aria-label="Back" className="w-16 p-1 text-accent">
        <ChevronLeft size={28} />
      </Link>
      <h1 className="flex-1 truncate text-center font-semibold">{title}</h1>
      <div className="flex w-16 justify-end pr-2">{right}</div>
    </div>
  );
}
