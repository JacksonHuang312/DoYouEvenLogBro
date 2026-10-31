import { notFound } from "next/navigation";
import { GearIcon } from "@/components/rpg/GearIcon";
import { BAND_ART, PIECE_TYPES, UNIQUE_ART } from "@/components/rpg/gearArt";
import { RARITY_TEXT } from "@/components/rpg/rarity";
import { LEVEL_BANDS, RARITIES, type Slot } from "@/lib/game/config";
import { ITEMS } from "@/lib/game/catalogData";

const SWORD_STAFF_SHIELD = ["sword", "staff", "shield"];

/** Dev-only contact sheet: every gear icon by piece type and level band (GAME_DESIGN.md 13.15). */
export default function GearContactSheet() {
  if (process.env.NODE_ENV === "production") notFound();
  const slotOf = (p: string): { slot: Slot; weapon?: "sword" | "staff" | "shield" } =>
    SWORD_STAFF_SHIELD.includes(p) ? { slot: "weapon", weapon: p as "sword" } : { slot: p as Slot };
  const mythics = ITEMS.filter((i) => i.mythic);
  const drawn = PIECE_TYPES.filter((p) => BAND_ART[p]);
  return (
    <main className="min-h-screen bg-rpg-bg px-5 py-6 font-rpg-body text-rpg-text">
      <h1 className="font-rpg-head text-3xl font-bold uppercase">Gear icons</h1>
      <p className="mt-1 text-xs text-rpg-muted">
        {drawn.length} of {PIECE_TYPES.length} piece types drawn, {Object.keys(UNIQUE_ART).length} of {mythics.length} Mythics.
        Missing art shows the plain slot icon (dimmed).
      </p>
      <h2 className="mt-6 font-rpg-head text-xl font-semibold uppercase">By piece type and band</h2>
      <table className="mt-3 border-separate border-spacing-x-3 border-spacing-y-2 text-xs">
        <thead>
          <tr className="text-left text-rpg-muted">
            <th className="font-normal">Piece</th>
            {LEVEL_BANDS.map((b) => (
              <th key={b} className="font-normal">Level {b}+</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {PIECE_TYPES.map((p) => (
            <tr key={p}>
              <td className="text-[13px]">{p}</td>
              {LEVEL_BANDS.map((b) => (
                <td key={b} className={BAND_ART[p] ? "" : "opacity-40"}>
                  <GearIcon {...slotOf(p)} itemLevel={b} size={72} className="text-rpg-text-2" />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <h2 className="mt-8 font-rpg-head text-xl font-semibold uppercase">Rarity colours (level 40 helmet)</h2>
      <ul className="mt-3 flex flex-wrap gap-4">
        {RARITIES.map((r) => (
          <li key={r} className="flex flex-col items-center gap-1 text-xs">
            <GearIcon slot="helmet" itemLevel={40} size={72} className={RARITY_TEXT[r]} />
            {r}
          </li>
        ))}
      </ul>
      <h2 className="mt-8 font-rpg-head text-xl font-semibold uppercase">Mythics</h2>
      <ul className="mt-3 grid grid-cols-2 gap-x-4 gap-y-4 sm:grid-cols-3 lg:grid-cols-4">
        {mythics.map((m) => (
          <li key={m.id} className="flex items-center gap-3">
            <GearIcon slot={m.slot} weapon={m.weapon} baseId={m.id} itemLevel={80} size={72} className={RARITY_TEXT.mythic} />
            <span className="min-w-0 text-[13px] leading-tight">
              {m.name}
              <span className="block text-xs text-rpg-muted">{m.id}</span>
            </span>
          </li>
        ))}
      </ul>
    </main>
  );
}
