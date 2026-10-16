import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    // Only the unit tests: tests/firestore.rules.test.mjs runs under node:test against the emulator.
    include: ["src/**/*.test.ts"],
    environment: "node",
  },
});
