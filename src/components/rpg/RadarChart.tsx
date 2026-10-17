import type { Stat } from "@/lib/game/config";
import { RADAR, RADAR_ORDER, radarAxis, radarPolygon, radarRing } from "@/lib/game/radar";
import { STAT_LABELS } from "@/lib/game/view";

/**
 * The six-stat radar: ring at 50 and 100, a spoke and label per stat, the current polygon filled
 * in the accent and, when given, the comparison polygon dashed. Values are 0–100 per stat.
 */
export function RadarChart({
  values,
  previous,
  previousLabel,
}: {
  values: Record<Stat, number>;
  /** The comparison period's values, or null for none. */
  previous: Record<Stat, number> | null;
  previousLabel?: string;
}) {
  const current = RADAR_ORDER.map((s) => values[s]);
  const description =
    `Radar chart of six stats: ${RADAR_ORDER.map((s) => `${STAT_LABELS[s]} ${Math.round(values[s])}`).join(", ")}.` +
    (previous && previousLabel ? ` Compared with ${previousLabel}.` : "");

  return (
    <svg viewBox={RADAR.viewBox} role="img" aria-label={description} className="h-auto w-full">
      <polygon points={radarRing(50)} className="fill-none stroke-rpg-line" strokeWidth={1} />
      <polygon points={radarRing(100)} className="fill-none stroke-rpg-line-strong" strokeWidth={1} />
      {RADAR_ORDER.map((stat, i) => {
        const a = radarAxis(i);
        return (
          <g key={stat}>
            <line x1={RADAR.cx} y1={RADAR.cy} x2={a.x} y2={a.y} className="stroke-rpg-line" strokeWidth={1} />
            <text x={a.lx} y={a.ly} textAnchor={a.anchor} fontSize={15} className="fill-rpg-text-2 font-rpg-body">
              {STAT_LABELS[stat]}
            </text>
          </g>
        );
      })}
      {previous && (
        <polygon
          points={radarPolygon(RADAR_ORDER.map((s) => previous[s]))}
          className="fill-none stroke-[#6f6c66]"
          strokeWidth={1.5}
          strokeDasharray="6 4"
        />
      )}
      <polygon points={radarPolygon(current)} className="fill-rpg-accent/20 stroke-rpg-accent" strokeWidth={2} />
    </svg>
  );
}
