import type { Unit } from "./types";

const LB_PER_KG = 2.20462262185;

export function kgTo(unit: Unit, kg: number): number {
  return unit === "kg" ? kg : kg * LB_PER_KG;
}

export function toKg(unit: Unit, value: number): number {
  return unit === "kg" ? value : value / LB_PER_KG;
}

/** Rounds to 2 decimals and drops trailing zeros, e.g. 225.0000001 -> "225". */
export function formatNumber(n: number): string {
  return String(Math.round(n * 100) / 100);
}

export function formatWeight(unit: Unit, kg: number | null): string {
  if (kg == null) return "BW";
  return `${formatNumber(kgTo(unit, kg))} ${unit}`;
}
