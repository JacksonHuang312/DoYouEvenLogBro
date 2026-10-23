"use client";

import { useMemo, useState } from "react";
import type { GameState } from "@/lib/game/claim";
import { isAccessory } from "@/lib/game/config";
import { RARITY_LABEL, shopView, SLOT_LABEL, type OfferView } from "@/lib/game/itemsView";
import { buyOffer, rerollShop, ApiError } from "@/lib/gameApi";
import { confirmRpgDialog, alertRpgDialog } from "@/lib/rpgDialog";
import { addDays, dayStartMs } from "@/lib/game/time";
import { useShop } from "@/lib/useGame";
import { useRunner } from "@/lib/useRunner";
import { OfflineNote } from "./Disclosure";
import { RARITY_BORDER, RARITY_TEXT } from "./rarity";
import { Skeleton } from "./RpgScreen";
import { SlotIcon } from "./SlotIcon";

const number = (n: number) => n.toLocaleString("en-US");
const HEADING = "font-rpg-head text-xl font-semibold uppercase tracking-[0.02em]";

/**
 * Hero · Shop: this week's six offers (Common to Epic), a reroll, and the restock countdown. The
 * stock is computed from the week and the reroll count, so only those are stored. Every buy and
 * reroll names the week and reroll count on screen; if the week has rolled over meanwhile the
 * server refuses and the screen moves on to the new week.
 */
export function ShopPanel({
  uid,
  state,
  now,
  timeZone,
  online,
}: {
  uid: string;
  state: GameState | null;
  now: number;
  timeZone: string;
  online: boolean;
}) {
  // After a "just restocked" answer, trust the server's clock over this device's.
  const [skew, setSkew] = useState(0);
  const clock = now + skew;
  const { weekId } = useMemo(() => shopView(uid, null, state, clock, timeZone), [uid, state, clock, timeZone]);
  const shop = useShop(uid, weekId);
  const view = useMemo(() => shopView(uid, shop.data, state, clock, timeZone), [uid, shop.data, state, clock, timeZone]);
  const { busy, run } = useRunner();

  if (shop.status === "unavailable") {
    return (
      <p className="px-5 py-8 text-sm text-rpg-text-2">
        Can&apos;t load the shop right now. It&apos;ll show here once you&apos;re back online.
      </p>
    );
  }
  if (shop.status === "loading") {
    return (
      <div aria-busy="true" aria-label="Loading shop" className="flex flex-col gap-4 px-5 pt-4">
        <Skeleton className="h-6 w-40" />
        <div className="grid grid-cols-2 gap-3">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-44 w-full" />
          ))}
        </div>
      </div>
    );
  }

  const off = busy || !online;

  /** A buy or reroll: confirmed first, and a rollover answer moves the screen to the new week. */
  async function act(title: string, action: () => Promise<unknown>) {
    await run(title, async () => {
      try {
        await action();
      } catch (err) {
        if (err instanceof ApiError && err.status === 409 && /restocked/i.test(err.message)) {
          // The server says the week turned. If this device's clock lags, jump this screen to the new week.
          setSkew(Math.max(0, dayStartMs(addDays(view.weekId, 7), timeZone) - now) + 1000);
          void alertRpgDialog({ title: "The shop restocked", message: "This week's stock is gone. Here is the new stock." });
          return;
        }
        throw err;
      }
    });
  }

  async function buy(offer: OfferView) {
    const ok = await confirmRpgDialog({
      title: `Buy ${offer.name}?`,
      message: `${RARITY_LABEL(offer.rarity)} ${SLOT_LABEL[offer.slot].toLowerCase()} for ${number(offer.price)} coins. You have ${number(state?.coins ?? 0)}.${offer.locked ? ` You need level ${offer.locked.level} to equip it.` : ""}`,
      confirmLabel: `Buy for ${number(offer.price)}`,
    });
    if (ok) await act("Couldn't buy", () => buyOffer(view.weekId, offer.index, view.rerolls));
  }

  async function reroll() {
    const ok = await confirmRpgDialog({
      title: "Reroll the shop?",
      message: `${view.reroll.label}. You get a whole new stock. Offers you have not bought are replaced; what you bought stays yours. You have ${number(state?.coins ?? 0)} coins.`,
      confirmLabel: view.reroll.cost != null ? `Reroll for ${number(view.reroll.cost)}` : "Reroll",
    });
    if (ok) await act("Couldn't reroll", () => rerollShop(view.weekId, view.rerolls));
  }

  return (
    <>
      <div className="flex items-end justify-between gap-3 px-5 pt-3">
        <div className="flex flex-col gap-0.5">
          <h2 className={HEADING}>This week</h2>
          <span className="text-[11px] text-rpg-muted">Restocks in {view.restocks} (Sunday 00:00)</span>
        </div>
        <span className="pb-0.5 text-xs text-rpg-text-2">{number(state?.coins ?? 0)} coins</span>
      </div>
      {!online && (
        <div className="px-5 pt-2">
          <OfflineNote what="Buying and rerolling" />
        </div>
      )}

      <ul className="grid grid-cols-2 gap-3 px-5 pt-3">
        {view.offers.map((o) => (
          <li key={o.key} className={`flex flex-col gap-2 border bg-rpg-surface p-3 ${RARITY_BORDER[o.rarity]} ${o.bought ? "opacity-60" : ""}`}>
            <div className="flex items-start justify-between gap-2 text-[11px]">
              <span className={`font-semibold ${RARITY_TEXT[o.rarity]}`}>{RARITY_LABEL(o.rarity)}</span>
              <span className="text-rpg-muted">{SLOT_LABEL[o.slot]}</span>
            </div>
            <div className="flex h-14 items-center justify-center">
              <SlotIcon slot={o.slot} size={44} className={RARITY_TEXT[o.rarity]} />
            </div>
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className="break-words font-rpg-head text-lg font-semibold leading-tight">{o.name}</span>
              <span className="text-[11px] text-rpg-muted">{o.focus}</span>
              <span className="text-[11px] text-rpg-muted">{o.setName ? `${o.setName} set` : isAccessory(o.slot) ? "Accessory" : "Loose item"} · unnamed</span>
              {o.locked && <span className="text-[11px] text-rpg-warn">Equip at level {o.locked.level}</span>}
            </div>
            {o.bought ? (
              <div className="flex min-h-11 items-center justify-center border border-rpg-line-soft text-xs text-rpg-muted">
                Bought · in your Gear
              </div>
            ) : (
              <>
                <button
                  onClick={() => void buy(o)}
                  disabled={off || !!o.reason}
                  className="min-h-11 border border-rpg-text bg-rpg-text px-2 text-[13px] font-semibold text-rpg-bg disabled:opacity-40"
                >
                  Buy · {number(o.price)}
                </button>
                {o.reason && <span className="text-[11px] text-rpg-muted">{o.reason}</span>}
              </>
            )}
          </li>
        ))}
      </ul>

      <section className="flex flex-col gap-2 px-5 pt-4">
        <button
          onClick={() => void reroll()}
          disabled={off || !view.reroll.enabled}
          className="min-h-11 border border-rpg-line-strong px-3 text-[13px] text-rpg-text-2 disabled:opacity-40"
        >
          {view.reroll.label}
        </button>
        {view.reroll.reason && view.reroll.cost != null && <p className="text-[11px] text-rpg-muted">{view.reroll.reason}</p>}
        <p className="text-xs leading-relaxed text-rpg-muted">
          The shop sells Common to Epic gear at a markup. Legendary and Mythic gear only drops from bosses. Selling pays a quarter of an item&apos;s
          original value.
        </p>
      </section>
    </>
  );
}
