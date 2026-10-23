"use client";

import { ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";
import type { GameState } from "@/lib/game/claim";
import type { Slot } from "@/lib/game/config";
import { equippedItems, type OwnedItem } from "@/lib/game/items";
import {
  mythicCoresOf,
  powerView,
  scrapOf,
  setProgress,
  slotViews,
  type ItemView,
  type SlotView,
} from "@/lib/game/itemsView";
import type { LoadStatus } from "@/lib/game/view";
import { equipItem, salvageItem, sellItem, unequipSlot, upgradeItem } from "@/lib/gameApi";
import { confirmRpgDialog } from "@/lib/rpgDialog";
import { useRunner } from "@/lib/useRunner";
import { OfflineNote } from "./Disclosure";
import { RARITY_BORDER, RARITY_TEXT } from "./rarity";
import { Skeleton } from "./RpgScreen";
import { Sheet } from "./Sheet";
import { SlotIcon } from "./SlotIcon";

const number = (n: number) => n.toLocaleString("en-US");
const SECONDARY = "min-h-11 border border-rpg-line-strong px-3 text-[13px] text-rpg-text-2 disabled:opacity-40";
const PRIMARY = "min-h-11 border border-rpg-text bg-rpg-text px-3 text-[13px] font-semibold text-rpg-bg disabled:opacity-40";
const HEADING = "font-rpg-head text-xl font-semibold uppercase tracking-[0.02em]";

/**
 * Hero · Gear: the power block, scrap and set progress, and one row per slot. Tapping a slot opens
 * a sheet with everything owned for it. Every action is a server call, so the controls turn off
 * offline and while a request is in flight.
 */
export function GearPanel({
  state,
  items,
  itemsStatus,
  bodyPower,
  now,
  online,
}: {
  state: GameState | null;
  items: OwnedItem[];
  itemsStatus: LoadStatus;
  /** Body power from the Stats tab; null while calibrating. */
  bodyPower: number | null;
  now: number;
  online: boolean;
}) {
  const [openSlot, setOpenSlot] = useState<Slot | null>(null);
  const { busy, run } = useRunner();
  const slots = useMemo(() => slotViews(state, items, now), [state, items, now]);
  const power = useMemo(() => powerView(bodyPower, state, items), [bodyPower, state, items]);
  const sets = useMemo(() => setProgress(equippedItems(state ?? { equipped: {} }, items)), [state, items]);

  if (itemsStatus === "unavailable") {
    return (
      <p className="px-5 py-8 text-sm text-rpg-text-2">
        Can&apos;t load your gear right now. It&apos;ll show here once you&apos;re back online.
      </p>
    );
  }
  if (itemsStatus === "loading") {
    return (
      <div aria-busy="true" aria-label="Loading gear" className="flex flex-col gap-4 px-5 pt-4">
        <Skeleton className="h-24 w-full" />
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} className="h-14 w-full" />
        ))}
      </div>
    );
  }

  const owned = slots.reduce((n, s) => n + s.items.length, 0);
  const open = slots.find((s) => s.slot === openSlot) ?? null;

  return (
    <>
      <section className="px-5 pt-3">
        <h2 className={HEADING}>Power</h2>
        <PowerBlock power={power} />
        <div className="flex items-baseline justify-between border-t border-rpg-line-soft py-2.5 text-[13px]">
          <span className="text-rpg-text-2">Scrap</span>
          <span>
            <span className="font-semibold">{number(scrapOf(state))}</span>
            {mythicCoresOf(state) > 0 && <span className="text-rpg-mythic"> · {mythicCoresOf(state)} Mythic Core</span>}
          </span>
        </div>
      </section>

      {sets.length > 0 && (
        <section className="px-5 pt-3">
          <h2 className={HEADING}>Sets</h2>
          {sets.map((s) => (
            <div key={s.name} className="border-t border-rpg-line-soft py-2.5 text-[13px]">
              <div className="flex items-baseline justify-between">
                <span className="text-rpg-text-2">{s.name}</span>
                <span>{s.count} / 5 equipped</span>
              </div>
              {s.tiers.map((t) => (
                <div key={t.pieces} className={`pt-1 text-xs ${t.reached && s.active ? "text-rpg-good" : "text-rpg-muted"}`}>
                  {t.label}
                  {t.reached && s.active ? " · active" : t.reached ? " · only your best set counts" : ""}
                </div>
              ))}
            </div>
          ))}
        </section>
      )}

      <section className="px-5 pt-3">
        <h2 className={HEADING}>Equipment</h2>
        {!online && <OfflineNote what="Equipping, upgrading, selling and salvaging" />}
        <ul className="mt-1 border-t border-rpg-line">
          {slots.map((s) => (
            <li key={s.slot} className="border-b border-rpg-line-soft">
              <button
                onClick={() => setOpenSlot(s.slot)}
                aria-haspopup="dialog"
                className="flex min-h-[60px] w-full items-center gap-3 py-2 text-left"
              >
                <SlotIcon slot={s.slot} className={s.equipped ? RARITY_TEXT[s.equipped.rarity] : "text-rpg-muted"} />
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="text-[11px] text-rpg-muted">{s.label}</span>
                  {s.equipped ? (
                    <>
                      <span className={`truncate font-rpg-head text-lg font-semibold leading-tight ${RARITY_TEXT[s.equipped.rarity]}`}>
                        {s.equipped.name}
                      </span>
                      <span className="truncate text-[11px] text-rpg-text-2">
                        {s.equipped.title} · {s.equipped.power} power
                      </span>
                    </>
                  ) : (
                    <span className="text-[13px] text-rpg-muted">{s.items.length > 0 ? "Nothing equipped" : "Empty"}</span>
                  )}
                </span>
                <span className="shrink-0 text-[11px] text-rpg-muted">{s.items.length} owned</span>
                <ChevronRight size={14} aria-hidden className="shrink-0 text-rpg-muted" />
              </button>
            </li>
          ))}
        </ul>
        {owned === 0 && (
          <p className="pt-3 text-xs leading-relaxed text-rpg-text-2">
            You don&apos;t own any gear yet. Buy some in the Shop tab. Legendary and Mythic gear drops from bosses.
          </p>
        )}
      </section>

      {open && (
        <Sheet title={open.label} onClose={() => setOpenSlot(null)}>
          <SlotSheet slot={open} state={state} online={online} busy={busy} run={run} />
        </Sheet>
      )}
    </>
  );
}

function PowerBlock({ power }: { power: ReturnType<typeof powerView> }) {
  if (power.body == null) {
    return (
      <p className="border-t border-rpg-line-soft py-2.5 text-xs leading-relaxed text-rpg-text-2">
        Calibrating. Gear and titles count toward battle power once your real stats are in. You can still collect and equip gear.
      </p>
    );
  }
  const { gear, bonus } = power;
  return (
    <div className="mt-1">
      <Row label="Body" value={number(Math.round(power.body))} note="Your stats, without gear" />
      <Row
        label="Gear"
        value={`+${number(Math.round(gear!.counted))}`}
        note={
          gear!.capped
            ? `Capped at ${number(Math.round(gear!.cap))} (30% of battle power). ${number(Math.round(gear!.raw))} equipped`
            : `Counted of ${number(Math.round(gear!.cap))} allowed${gear!.setPct > 0 ? ` · set bonus +${Math.round(gear!.setPct * 100)}%` : ""}`
        }
      />
      <Row
        label="Bonuses"
        value={`+${Math.round(bonus!.total * 100)}%`}
        note={`Titles and class, of ${Math.round(bonus!.cap * 100)}% allowed`}
      />
      <div className="flex items-baseline justify-between border-t border-rpg-line py-2.5 text-[13px]">
        <span className="text-rpg-text-2">Battle</span>
        <span className="font-rpg-head text-3xl font-bold leading-none text-rpg-accent">{number(Math.round(power.battle!))}</span>
      </div>
    </div>
  );
}

function Row({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="border-t border-rpg-line-soft py-2.5 text-[13px]">
      <div className="flex items-baseline justify-between">
        <span className="text-rpg-text-2">{label}</span>
        <span className="font-semibold">{value}</span>
      </div>
      <div className="pt-0.5 text-[11px] text-rpg-muted">{note}</div>
    </div>
  );
}

type Run = ReturnType<typeof useRunner>["run"];

function SlotSheet({ slot, state, online, busy, run }: { slot: SlotView; state: GameState | null; online: boolean; busy: boolean; run: Run }) {
  const off = busy || !online;
  const level = state?.level ?? 1;

  async function upgrade(item: ItemView) {
    const up = item.upgrade;
    if (!up) return;
    const ok = await confirmRpgDialog({
      title: `Upgrade ${item.name}?`,
      message: `${up.label}. Costs ${up.costLabel}. Power ${item.power} → ${up.powerAfter}. Upgrades never fail, and what you spend isn't refunded if you sell or salvage it later.`,
      confirmLabel: "Upgrade",
    });
    if (ok) await run("Couldn't upgrade", () => upgradeItem(item.id, item.rarity, item.plus));
  }

  async function sell(item: ItemView) {
    const ok = await confirmRpgDialog({
      title: `Sell ${item.name}?`,
      message: `You get ${number(item.sell.price ?? 0)} coins: a quarter of its original value, whatever you have upgraded it to. It can't be bought back.`,
      confirmLabel: `Sell for ${number(item.sell.price ?? 0)}`,
      destructive: true,
    });
    if (ok) await run("Couldn't sell", () => sellItem(item.id));
  }

  async function salvage(item: ItemView) {
    const ok = await confirmRpgDialog({
      title: `Salvage ${item.name}?`,
      message: `You get ${number(item.salvage.scrap)} scrap. The item is gone for good.`,
      confirmLabel: `Salvage for ${number(item.salvage.scrap)} scrap`,
      destructive: true,
    });
    if (ok) await run("Couldn't salvage", () => salvageItem(item.id));
  }

  return (
    <div className="flex flex-col">
      <div className="flex items-baseline justify-between gap-3 px-5 pt-3 text-xs text-rpg-muted">
        <span>
          Level {level} · {number(state?.coins ?? 0)} coins · {number(scrapOf(state))} scrap
        </span>
      </div>
      {!online && (
        <div className="px-5 pt-2">
          <OfflineNote what="Gear changes" />
        </div>
      )}
      {slot.items.length === 0 ? (
        <p className="px-5 py-8 text-sm leading-relaxed text-rpg-text-2">
          You don&apos;t own any {slot.label.toLowerCase()} yet. Buy one in the Shop tab, or win one from a boss.
        </p>
      ) : (
        <ul className="flex flex-col gap-3 px-5 pt-3">
          {slot.items.map((item) => (
            <li key={item.id} className={`flex flex-col gap-2.5 border bg-rpg-surface p-3.5 ${RARITY_BORDER[item.rarity]}`}>
              <div className="flex items-start gap-3">
                <SlotIcon slot={item.slot} size={36} className={RARITY_TEXT[item.rarity]} />
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className={`break-words font-rpg-head text-xl font-semibold leading-tight ${RARITY_TEXT[item.rarity]}`}>
                    {item.name}
                  </span>
                  <span className="text-xs text-rpg-text-2">
                    {item.title} · {item.power} power{item.setName ? ` · ${item.setName}` : ""}
                  </span>
                  {item.tags.length > 0 && <span className="text-[11px] text-rpg-muted">{item.tags.join(" · ")}</span>}
                  {item.locked && <span className="text-[11px] text-rpg-warn">Needs level {item.locked.level} to equip</span>}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {item.equipped ? (
                  <button onClick={() => void run("Couldn't unequip", () => unequipSlot(item.slot))} disabled={off} className={SECONDARY}>
                    Unequip
                  </button>
                ) : (
                  <button onClick={() => void run("Couldn't equip", () => equipItem(item.id))} disabled={off || !item.equip.enabled} className={PRIMARY}>
                    Equip
                  </button>
                )}
                {item.upgrade ? (
                  <button onClick={() => void upgrade(item)} disabled={off || !item.upgrade.enabled} className={SECONDARY}>
                    Upgrade
                  </button>
                ) : (
                  <span className="flex min-h-11 items-center justify-center border border-rpg-line-soft px-3 text-center text-[11px] text-rpg-muted">
                    {item.maxedNote}
                  </span>
                )}
                <button onClick={() => void sell(item)} disabled={off || !item.sell.enabled} className={SECONDARY}>
                  {item.sell.price == null ? "Can't sell" : `Sell · ${number(item.sell.price)}`}
                </button>
                <button onClick={() => void salvage(item)} disabled={off || !item.salvage.enabled} className={SECONDARY}>
                  Salvage · +{number(item.salvage.scrap)}
                </button>
              </div>

              <div className="flex flex-col gap-0.5 text-[11px] text-rpg-muted">
                {item.upgrade && (
                  <span className={item.upgrade.enabled ? "" : "text-rpg-text-2"}>
                    {item.upgrade.label}: {item.upgrade.costLabel}
                    {item.upgrade.reason ? ` (${item.upgrade.reason.toLowerCase()})` : ""}
                  </span>
                )}
                {!item.equipped && !item.equip.enabled && item.equip.reason && <span>{item.equip.reason}</span>}
                {item.equipped && <span>Unequip it to sell or salvage it.</span>}
                {!item.equipped && item.named && <span>Named gear can&apos;t be sold, only salvaged.</span>}
              </div>
            </li>
          ))}
        </ul>
      )}
      {slot.equipped == null && slot.items.length > 0 && (
        <p className="px-5 pt-3 text-xs text-rpg-muted">Nothing is equipped in this slot.</p>
      )}
    </div>
  );
}
