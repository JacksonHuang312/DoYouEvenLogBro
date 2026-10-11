"use client";

import { useState } from "react";
import { formatNumber } from "@/lib/units";

const fmt = (n: number | null) => (n == null ? "" : formatNumber(n));
const differs = (a: number | null, b: number | null) =>
  a == null || b == null ? a !== b : Math.abs(a - b) > 1e-6;

/**
 * Numeric text input that keeps the user's raw text ("102.") while typing,
 * but resyncs when the value changes from outside (e.g. filled from "Previous").
 */
export function NumberCell({
  value,
  onChange,
  placeholder,
  decimal = false,
  className = "",
  label,
}: {
  value: number | null;
  onChange: (value: number | null) => void;
  placeholder?: string;
  decimal?: boolean;
  className?: string;
  label: string;
}) {
  const [text, setText] = useState(() => fmt(value));
  const [synced, setSynced] = useState(value);

  if (differs(value, synced)) {
    setSynced(value);
    setText(fmt(value));
  }

  return (
    <input
      type="text"
      inputMode={decimal ? "decimal" : "numeric"}
      aria-label={label}
      value={text}
      placeholder={placeholder}
      onFocus={(e) => e.target.select()}
      onChange={(e) => {
        const raw = e.target.value.replace(",", ".");
        const pattern = decimal ? /^\d{0,4}(\.\d{0,2})?$/ : /^\d{0,4}$/;
        if (!pattern.test(raw)) return;
        setText(raw);
        const n = raw === "" || raw === "." ? null : Number(raw);
        setSynced(n);
        onChange(n);
      }}
      className={`w-full rounded-md bg-surface-2 px-2 py-1.5 text-center tabular-nums outline-none placeholder:text-muted/60 focus:ring-2 focus:ring-accent ${className}`}
    />
  );
}
