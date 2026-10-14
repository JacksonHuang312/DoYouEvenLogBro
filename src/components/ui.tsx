"use client";

/* eslint-disable @next/next/no-img-element -- remote thumbnails/avatars; next/image would need per-host config */
import { ChevronLeft, Dumbbell, MoreHorizontal } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useCustomExercises } from "@/lib/customExercises";

const IMAGE_CDN = "https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@main/exercises";

/** Illustration for a library exercise (free-exercise-db). */
function libraryImageUrl(exerciseId: string) {
  return `${IMAGE_CDN}/${encodeURIComponent(exerciseId)}/0.jpg`;
}

/** The default image: a dumbbell on gray, used when an exercise has no photo. */
export function DefaultExerciseImage({ size }: { size: number }) {
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-full bg-surface-2 text-muted"
      style={{ width: size, height: size }}
    >
      <Dumbbell size={size * 0.5} />
    </span>
  );
}

/**
 * Circular exercise image: the library illustration, a custom exercise's own photo,
 * or the default dumbbell image. `src` overrides the lookup (e.g. a photo being previewed).
 */
export function ExerciseThumb({ exerciseId, src, size = 44 }: { exerciseId?: string; src?: string | null; size?: number }) {
  const custom = useCustomExercises();
  // Remember which URL failed, so a new photo gets a fresh attempt.
  const [failedUrl, setFailedUrl] = useState<string | null>(null);

  let url = src;
  if (url === undefined && exerciseId) {
    url = exerciseId.startsWith("c_")
      ? (custom.find((e) => e.id === exerciseId)?.imageData ?? null)
      : libraryImageUrl(exerciseId);
  }
  if (!url || url === failedUrl) return <DefaultExerciseImage size={size} />;

  return (
    <span className="shrink-0 overflow-hidden rounded-full bg-white" style={{ width: size, height: size }}>
      <img
        src={url}
        alt=""
        loading="lazy"
        onError={() => setFailedUrl(url)}
        // Catches images that already failed before React attached onError (server-rendered HTML).
        ref={(el) => {
          if (el?.complete && el.naturalWidth === 0) setFailedUrl(url);
        }}
        className="h-full w-full object-cover"
      />
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

export function PageHeader({ title, children }: { title: React.ReactNode; children?: React.ReactNode }) {
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

/**
 * Desktop two-column layout: content plus a sticky right rail (22rem). On phones it's one column:
 * the rail is hidden, or shown above the content with `railOnMobile`. The [data-rail] attribute
 * tells <SignedInChrome> to widen the page for it.
 */
export function WithRail({
  rail,
  railOnMobile = false,
  children,
}: {
  rail: React.ReactNode;
  railOnMobile?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div data-rail className="lg:grid lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start lg:gap-8">
      <aside className={`${railOnMobile ? "" : "hidden"} space-y-4 lg:sticky lg:top-8 lg:col-start-2 lg:row-start-1 lg:block`}>
        {rail}
      </aside>
      <div className="min-w-0 lg:col-start-1 lg:row-start-1">{children}</div>
    </div>
  );
}

/** A rail panel: plain on phones, a rounded surface card on desktop. */
export function RailCard({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <section className={`lg:rounded-xl lg:bg-surface lg:p-5 ${className}`}>{children}</section>;
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

/** "⋯" button with a dropdown that closes on selection or on any tap outside it. */
export function OverflowMenu({ label, children }: { label: string; children: (close: () => void) => React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  return (
    <div className="relative">
      <button aria-label={label} aria-expanded={open} onClick={() => setOpen((o) => !o)} className="p-2">
        <MoreHorizontal size={22} />
      </button>
      {open && (
        <>
          {/* Invisible full-screen layer: tapping anywhere else closes the menu. */}
          <div aria-hidden className="fixed inset-0 z-10" onClick={close} />
          <div className="absolute right-0 top-10 z-20 w-48 overflow-hidden rounded-xl bg-surface-2 shadow-lg">
            {children(close)}
          </div>
        </>
      )}
    </div>
  );
}

/** Google's "G", in its colors, so Google sign-in buttons and rows are recognizable at a glance. */
export function GoogleMark() {
  return (
    <svg viewBox="0 0 48 48" width="20" height="20" aria-hidden className="shrink-0">
      <path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.6-.4-3.9z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.6-.4-3.9z" />
    </svg>
  );
}
