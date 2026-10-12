"use client";

/* eslint-disable @next/next/no-img-element -- inline data-URL photo; next/image adds nothing here */
import { ImagePlus } from "lucide-react";
import { useRef, useState } from "react";
import { errorDialog } from "@/lib/dialog";
import { type DraftWorkout, MAX_DESCRIPTION_LENGTH } from "@/lib/draft";
import { formatShortDuration } from "@/lib/format";
import { photoToJpeg } from "@/lib/image";
import type { Unit, Workout } from "@/lib/types";
import { formatVolume } from "./WorkoutSummary";

/** "2026-10-12T18:05" in local time, the format <input type="datetime-local"> uses. */
function toLocalInput(ms: number) {
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export const MAX_DURATION_MIN = 24 * 60;

/**
 * The Hevy-style "Save Workout" fields, shared by finishing a workout and editing a saved one:
 * photo, title, description, start time and duration, plus a summary of what will be saved.
 */
export function WorkoutDetailsForm({
  draft,
  update,
  durationMin,
  setDurationMin,
  preview,
  unit,
}: {
  draft: DraftWorkout;
  update: (fn: (w: DraftWorkout) => DraftWorkout) => void;
  durationMin: number;
  setDurationMin: (min: number) => void;
  /** What will be saved, for the summary row. */
  preview: Workout;
  unit: Unit;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  // Latest allowed start time; read once so rendering stays pure.
  const [now] = useState(() => Date.now());

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // so picking the same file again still fires onChange
    if (!file) return;
    setBusy(true);
    try {
      const photo = await photoToJpeg(file);
      update((w) => ({ ...w, photo }));
    } catch (err) {
      await errorDialog("Couldn't use that photo", err);
    } finally {
      setBusy(false);
    }
  }

  const field = "w-full rounded-lg bg-surface-2 px-3 py-2.5 outline-none focus:ring-2 focus:ring-accent";

  return (
    <div className="space-y-5">
      <input
        aria-label="Workout title"
        value={draft.name}
        onChange={(e) => update((w) => ({ ...w, name: e.target.value }))}
        maxLength={100}
        placeholder="Workout title"
        className="w-full bg-transparent text-title-2 outline-none placeholder:text-muted"
      />

      <dl className="grid grid-cols-3 border-y border-line py-3">
        <div>
          <dt className="text-footnote text-muted">Duration</dt>
          <dd className="text-headline tabular-nums">{formatShortDuration(durationMin * 60_000)}</dd>
        </div>
        <div>
          <dt className="text-footnote text-muted">Volume</dt>
          <dd className="text-headline tabular-nums">{formatVolume(unit, preview.volumeKg)}</dd>
        </div>
        <div>
          <dt className="text-footnote text-muted">Sets</dt>
          <dd className="text-headline tabular-nums">{preview.setCount}</dd>
        </div>
      </dl>

      <div className="grid grid-cols-[minmax(0,1fr)_7rem] gap-3">
        <label className="block">
          <span className="mb-1 block text-footnote text-muted">Started</span>
          <input
            type="datetime-local"
            value={toLocalInput(draft.startedAt)}
            max={toLocalInput(now)}
            onChange={(e) => {
              const t = new Date(e.target.value).getTime();
              if (!Number.isNaN(t)) update((w) => ({ ...w, startedAt: t }));
            }}
            className={`${field} [color-scheme:dark]`}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-footnote text-muted">Minutes</span>
          <input
            type="number"
            inputMode="numeric"
            min={1}
            max={MAX_DURATION_MIN}
            value={durationMin || ""}
            onChange={(e) => setDurationMin(Math.min(MAX_DURATION_MIN, Math.max(0, Math.round(Number(e.target.value)))))}
            className={`${field} tabular-nums`}
          />
        </label>
      </div>

      {draft.photo ? (
        <figure className="relative overflow-hidden rounded-xl bg-surface">
          <img src={draft.photo} alt="Workout photo" className="max-h-96 w-full object-contain" />
          <div className="absolute bottom-2 right-2 flex gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => fileRef.current?.click()}
              className="rounded-lg bg-black/70 px-3 py-1.5 text-subhead backdrop-blur"
            >
              {busy ? "Processing..." : "Change"}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => update((w) => ({ ...w, photo: null }))}
              className="rounded-lg bg-black/70 px-3 py-1.5 text-subhead text-red-400 backdrop-blur"
            >
              Remove
            </button>
          </div>
        </figure>
      ) : (
        <button
          type="button"
          disabled={busy}
          onClick={() => fileRef.current?.click()}
          className="flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-line py-8 text-muted"
        >
          <ImagePlus size={28} />
          <span className="text-subhead">{busy ? "Processing..." : "Add a photo"}</span>
        </button>
      )}
      <input ref={fileRef} type="file" accept="image/*" hidden onChange={onFile} />

      <label className="block">
        <span className="mb-1 block text-footnote text-muted">Description</span>
        <textarea
          value={draft.description ?? ""}
          onChange={(e) => update((w) => ({ ...w, description: e.target.value }))}
          maxLength={MAX_DESCRIPTION_LENGTH}
          rows={3}
          placeholder="How did it go? Leave some notes here..."
          className={`${field} resize-none field-sizing-content min-h-24 placeholder:text-muted`}
        />
      </label>
    </div>
  );
}
