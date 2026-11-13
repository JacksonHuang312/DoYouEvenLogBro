<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Working on this project

- **Scope:** change only what was asked. Don't refactor or restyle neighbouring code. If you spot something else, mention it in one line instead of fixing it.
- **Ambiguity:** if a request has two reasonable readings, say which you picked, or ask. Design questions go to Jackson; don't invent names or art direction.
- **Phone first:** the app is used on a phone. Check UI at 390px width: no horizontal overflow, tap targets big enough. Use the preview browser and look at it before saying a change works.
- **Verify before "done":** run lint, `tsc`, vitest and the relevant e2e spec. If you couldn't check something, say so.
- **Game logic** (combat, cooldowns, damage, loot): write or update a test with the change. The server decides fights; the replay is presentation only.
- **Icons** (see GAME_DESIGN.md 13.19): AFK Arena-inspired filled, shaded vector on a rarity tile, thick dark outline, light from the top left, chunky shapes. Every band of a set has its own silhouette (not a recolour). Mythics must never read as a set. Follow Jackson's reference pictures, not text summaries, and take inspiration without copying. Check icons at the real tile ratio (icon = 78% of the tile) before reporting; weapons run corner to corner and clip easily. Art lives in `src/components/rpg/*Art.ts`; review page is `/dev/gear`.
- **Git:** `tsconfig.json` is rewritten by `next dev`; never commit it. `.claude/launch.json` stays untracked. Files use CRLF.
- **Docs:** when a feature is built, record it in GAME_DESIGN.md under the next 13.x heading.
