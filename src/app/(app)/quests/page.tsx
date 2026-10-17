"use client";

import { ComingSoon, RpgScreen } from "@/components/rpg/RpgScreen";
import { TabHeader } from "@/components/rpg/TabHeader";

export default function QuestsPage() {
  return (
    <RpgScreen>
      <TabHeader title="Quests" />
      <ComingSoon title="Weekly quests">
        Each Sunday you get quests aimed at your weakest muscles, like &ldquo;log 12 working sets of arms&rdquo;. This tab
        will also hold your workout schedule calendar. Coming in Phase 3.
      </ComingSoon>
    </RpgScreen>
  );
}
