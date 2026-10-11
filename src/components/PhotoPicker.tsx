"use client";

import { Camera, ImageUp, Trash2 } from "lucide-react";
import { useRef, useState } from "react";
import { photoToThumbnail } from "@/lib/image";
import { ExerciseThumb } from "./ui";

/**
 * Exercise photo preview with Take Photo / Upload / Remove.
 * On phones, "Take Photo" opens the camera; on desktop both buttons open a file picker.
 */
export function PhotoPicker({
  value,
  onChange,
  size = 88,
}: {
  value: string | null;
  onChange: (imageData: string | null) => void;
  size?: number;
}) {
  const cameraRef = useRef<HTMLInputElement>(null);
  const uploadRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // so picking the same file again still fires onChange
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      onChange(await photoToThumbnail(file));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const btn = "flex items-center gap-1.5 rounded-lg bg-surface-2 px-3 py-2 text-sm disabled:opacity-40";

  return (
    <div className="flex items-center gap-4">
      <ExerciseThumb src={value} size={size} />
      <div className="space-y-2">
        <div className="flex flex-wrap gap-2">
          <button type="button" disabled={busy} onClick={() => cameraRef.current?.click()} className={btn}>
            <Camera size={16} /> Take Photo
          </button>
          <button type="button" disabled={busy} onClick={() => uploadRef.current?.click()} className={btn}>
            <ImageUp size={16} /> Upload
          </button>
          {value && (
            <button type="button" disabled={busy} onClick={() => onChange(null)} className={`${btn} text-red-400`}>
              <Trash2 size={16} /> Remove
            </button>
          )}
        </div>
        <p className="text-xs text-muted">
          {busy ? "Processing..." : value ? "Looking good." : "Optional. Without a photo it gets the default image."}
        </p>
        {error && <p className="text-xs text-red-400">{error}</p>}
      </div>
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" hidden onChange={onFile} />
      <input ref={uploadRef} type="file" accept="image/*" hidden onChange={onFile} />
    </div>
  );
}
