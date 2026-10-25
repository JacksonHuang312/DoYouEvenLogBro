"use client";

import { Info } from "lucide-react";
import { useId, useState } from "react";

/*
 * A small ⓘ beside a heading that shows or hides its explanation right under the heading, so
 * descriptions stay out of the way until asked for. Use useInfo() once per heading, put
 * <InfoButton> in the heading row and <InfoText> where the text should open.
 */

export function useInfo() {
  const [open, setOpen] = useState(false);
  const id = useId();
  return { open, id, toggle: () => setOpen((o) => !o) };
}

type InfoState = ReturnType<typeof useInfo>;

/** `label` completes "About ...": the pause, the shop. The tap area is 44px; the icon is small. */
export function InfoButton({ info, label }: { info: InfoState; label: string }) {
  return (
    <button
      type="button"
      onClick={info.toggle}
      aria-label={`About ${label}`}
      aria-expanded={info.open}
      aria-controls={info.id}
      className={`-my-3 flex h-11 w-11 shrink-0 items-center justify-center ${info.open ? "text-rpg-accent" : "text-rpg-muted"}`}
    >
      <Info size={16} aria-hidden />
    </button>
  );
}

export function InfoText({ info, children, className = "" }: { info: InfoState; children: React.ReactNode; className?: string }) {
  return (
    <p id={info.id} hidden={!info.open} className={`text-xs leading-relaxed text-rpg-text-2 ${className}`}>
      {children}
    </p>
  );
}
