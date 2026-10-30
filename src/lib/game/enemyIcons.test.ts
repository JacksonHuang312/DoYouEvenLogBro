import { describe, expect, it } from "vitest";
import { OWN_ART } from "@/components/rpg/EnemyIcon";
import { ENEMIES, enemyByName } from "./enemyIcons";

describe("enemy icons", () => {
  it("lists the 62 bosses and Campaign enemies plus the 3 endless tower types (65), with unique ids and names", () => {
    expect(ENEMIES).toHaveLength(65);
    expect(new Set(ENEMIES.map((e) => e.id)).size).toBe(65);
    expect(new Set(ENEMIES.map((e) => e.name)).size).toBe(65);
  });

  it("finds an enemy by its display name, endless floor suffix included", () => {
    expect(enemyByName("Ironmaw")?.id).toBe("ironmaw");
    expect(enemyByName("Tower Warden (floor 20)")?.kind).toBe("warden");
    expect(enemyByName("Rust Rat")?.kind).toBe("regular");
    expect(enemyByName("Nobody")).toBeNull();
  });

  it("only has artwork for enemies that exist", () => {
    const ids = new Set(ENEMIES.map((e) => e.id));
    for (const id of Object.keys(OWN_ART)) expect(ids.has(id), id).toBe(true);
  });
});
