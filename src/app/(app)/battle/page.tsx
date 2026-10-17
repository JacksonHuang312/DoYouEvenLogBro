"use client";

import { ComingSoon, RpgScreen } from "@/components/rpg/RpgScreen";
import { TabHeader } from "@/components/rpg/TabHeader";

export default function BattlePage() {
  return (
    <RpgScreen>
      <TabHeader title="Battle" />
      <ComingSoon title="Weekly boss, tower and raids">
        Your stats become power in auto-resolved fights: a new boss every week, an endless tower, and party raids with
        friends. Bosses check minimums on each body part, so every muscle counts. Coming in Phase 5.
      </ComingSoon>
    </RpgScreen>
  );
}
