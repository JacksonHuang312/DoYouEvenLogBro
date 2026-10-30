import { notFound } from "next/navigation";
import { EnemyIcon } from "@/components/rpg/EnemyIcon";
import { ENEMIES } from "@/lib/game/enemyIcons";

/** Dev-only contact sheet: every enemy's icon with its name (GAME_DESIGN.md 13.15). */
export default function EnemyContactSheet() {
  if (process.env.NODE_ENV === "production") notFound();
  const groups = [...new Set(ENEMIES.map((e) => e.group))];
  return (
    <main className="min-h-screen bg-rpg-bg px-5 py-6 font-rpg-body text-rpg-text">
      <h1 className="font-rpg-head text-3xl font-bold uppercase">
        Enemy icons
      </h1>
      <p className="mt-1 text-xs text-rpg-muted">
        {ENEMIES.length} enemies. Enemies without their own art show their
        kind’s icon.
      </p>
      {groups.map((group) => (
        <section key={group} className="mt-6" aria-label={group}>
          <h2 className="font-rpg-head text-xl font-semibold uppercase">
            {group}
          </h2>
          <ul className="mt-3 grid grid-cols-2 gap-x-4 gap-y-4 sm:grid-cols-3 lg:grid-cols-4">
            {ENEMIES.filter((e) => e.group === group).map((e) => (
              <li key={e.id} className="flex items-center gap-3">
                <EnemyIcon name={e.name} size={72} />
                <span className="min-w-0 text-[13px] leading-tight">
                  {e.name}
                  <span className="block text-xs text-rpg-muted">
                    {e.id} · {e.kind}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </main>
  );
}
