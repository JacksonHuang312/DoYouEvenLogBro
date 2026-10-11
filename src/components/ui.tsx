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
