"use client";

import { X } from "lucide-react";
import { useEffect, useRef } from "react";

/**
 * A flat bottom sheet (section 7.1) on a native modal <dialog>: focus is trapped, the page behind
 * is inert and Escape closes it. Being in the top layer it sits under the RPG confirm dialog,
 * which opens after it. Render it only while it should be open.
 */
export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (el && !el.open) el.showModal();
  }, []);

  return (
    <dialog
      ref={ref}
      aria-labelledby="sheet-title"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      // A tap on the dimmed backdrop (the dialog element itself, outside the sheet) closes it.
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="m-0 mx-auto mt-auto max-h-[88dvh] w-full max-w-[28rem] overflow-y-auto border border-b-0 border-rpg-line bg-rpg-bg p-0 font-rpg-body text-rpg-text backdrop:bg-rpg-bg/85"
    >
      <div className="flex items-center justify-between gap-3 border-b border-rpg-line px-5 py-2">
        <h2 id="sheet-title" className="font-rpg-head text-2xl font-semibold uppercase">
          {title}
        </h2>
        <button onClick={onClose} aria-label="Close" className="flex h-11 w-11 items-center justify-center text-rpg-text-2">
          <X size={20} aria-hidden />
        </button>
      </div>
      <div className="pb-[max(1rem,env(safe-area-inset-bottom))]">{children}</div>
    </dialog>
  );
}
