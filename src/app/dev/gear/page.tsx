import { notFound } from "next/navigation";
import { ItemTile } from "@/components/rpg/ItemTile";
import { PIECE_TYPES } from "@/components/rpg/gearArt";
import { ARMOR_SLOTS, CLASS_IDS, LEVEL_BANDS, RARITIES, type Slot } from "@/lib/game/config";
import { ITEMS, SETS } from "@/lib/game/catalogData";

const SWORD_STAFF_SHIELD = ["sword", "staff", "shield"];

/** Dev-only contact sheet: every gear icon by piece type and level band (GAME_DESIGN.md 13.15). */
export default function GearContactSheet() {
  if (process.env.NODE_ENV === "production") notFound();
  const slotOf = (p: string): { slot: Slot; weapon?: "sword" | "staff" | "shield" } =>
    SWORD_STAFF_SHIELD.includes(p) ? { slot: "weapon", weapon: p as "sword" } : { slot: p as Slot };
  const mythics = ITEMS.filter((i) => i.mythic);
  return (
    <main className="min-h-screen bg-rpg-bg px-5 py-6 font-rpg-body text-rpg-text">
      <h1 className="font-rpg-head text-3xl font-bold uppercase">Gear icons</h1>
      <p className="mt-1 text-xs text-rpg-muted">
        Placeholder art: every item draws the same gem until the Figma icons are dropped in (GAME_DESIGN.md 13.20).
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
                <td key={b}>
                  <ItemTile {...slotOf(p)} itemLevel={b} rarity="rare" size={72} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <h2 className="mt-8 font-rpg-head text-xl font-semibold uppercase">Class sets (armor)</h2>
      {CLASS_IDS.map((c) => (
        <section key={c} className="mt-4" aria-label={`${c} sets`}>
          <h3 className="text-sm uppercase text-rpg-muted">{c}</h3>
          <table className="mt-2 border-separate border-spacing-x-3 border-spacing-y-2 text-xs">
            <tbody>
              {ARMOR_SLOTS.map((slot) => (
                <tr key={slot}>
                  <td className="text-[13px]">{slot}</td>
                  {LEVEL_BANDS.map((b) => {
                    const set = SETS.find((x) => x.classId === c && x.band === b);
                    return (
                      <td key={b}>
                        <ItemTile slot={slot} baseId={set ? `${set.id}-${slot}` : undefined} itemLevel={b} rarity="rare" size={72} />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ))}
      <h2 className="mt-8 font-rpg-head text-xl font-semibold uppercase">Rarity tiles (level 40 Warden helm)</h2>
      <ul className="mt-3 flex flex-wrap gap-4">
        {RARITIES.map((r) => (
          <li key={r} className="flex flex-col items-center gap-1 text-xs">
            <ItemTile slot="helmet" baseId="warden-helmet" itemLevel={40} rarity={r} size={72} />
            {r}
          </li>
        ))}
      </ul>
      <h2 className="mt-8 font-rpg-head text-xl font-semibold uppercase">Mythics</h2>
      <ul className="mt-3 grid grid-cols-2 gap-x-4 gap-y-4 sm:grid-cols-3 lg:grid-cols-4">
        {mythics.map((m) => (
          <li key={m.id} className="flex items-center gap-3">
            <ItemTile slot={m.slot} weapon={m.weapon} baseId={m.id} itemLevel={80} rarity="mythic" size={72} />
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
