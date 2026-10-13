// Generates the app icons (favicon, home-screen icons, PWA manifest icons) from one dumbbell drawing.
// Usage: `node scripts/build-icons.mjs`. Uses sharp, which Next.js installs for image optimization.
import { mkdirSync, writeFileSync } from "node:fs";
import sharp from "sharp";

const MINT = "#30d5a0"; // --color-accent in globals.css
const BLACK = "#000000";

/**
 * A dumbbell drawn horizontally on a 512 grid, tilted 45°: bar, two big inner plates,
 * two smaller outer plates and end caps. `scale` shrinks it toward the center for padding.
 */
function dumbbell(scale) {
  return `
  <g transform="translate(256 256) scale(${scale}) rotate(-45) translate(-256 -256)" fill="${MINT}">
    <rect x="136" y="238" width="240" height="36" rx="10"/>
    <rect x="108" y="148" width="44" height="216" rx="16"/>
    <rect x="360" y="148" width="44" height="216" rx="16"/>
    <rect x="66" y="184" width="40" height="144" rx="14"/>
    <rect x="406" y="184" width="40" height="144" rx="14"/>
    <rect x="44" y="234" width="24" height="44" rx="8"/>
    <rect x="444" y="234" width="24" height="44" rx="8"/>
  </g>`;
}

/**
 * `rounded`: a rounded-square tile with transparent corners (browser tabs, Android "any").
 * Otherwise a full-bleed square, for iOS and maskable icons, which apply their own mask.
 */
function svg({ scale, rounded }) {
  const bg = rounded
    ? `<rect width="512" height="512" rx="112" fill="${BLACK}"/>`
    : `<rect width="512" height="512" fill="${BLACK}"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">${bg}${dumbbell(scale)}</svg>`;
}

const png = (source, size) => sharp(Buffer.from(source)).resize(size, size).png().toBuffer();

/** An .ico holding PNG images (supported by every current browser). */
function ico(pngs) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(pngs.length, 4);
  let offset = 6 + 16 * pngs.length;
  const entries = pngs.map(({ size, data }) => {
    const e = Buffer.alloc(16);
    e.writeUInt8(size >= 256 ? 0 : size, 0);
    e.writeUInt8(size >= 256 ? 0 : size, 1);
    e.writeUInt16LE(1, 4); // color planes
    e.writeUInt16LE(32, 6); // bits per pixel
    e.writeUInt32LE(data.length, 8);
    e.writeUInt32LE(offset, 12);
    offset += data.length;
    return e;
  });
  return Buffer.concat([header, ...entries, ...pngs.map((p) => p.data)]);
}

const tab = svg({ scale: 0.82, rounded: true });
const full = svg({ scale: 0.72, rounded: false });
// Maskable icons can be cropped to a circle 80% wide, so the drawing stays well inside it.
const maskable = svg({ scale: 0.6, rounded: false });

mkdirSync("public/icons", { recursive: true });

// Browser tab: SVG for modern browsers, .ico for the rest (Next.js links both from src/app).
writeFileSync("src/app/icon.svg", tab);
writeFileSync(
  "src/app/favicon.ico",
  ico(await Promise.all([16, 32, 48].map(async (size) => ({ size, data: await png(tab, size) })))),
);
// iPhone home screen: iOS rounds the corners itself and shows transparency as black.
writeFileSync("src/app/apple-icon.png", await png(full, 180));
// PWA manifest (src/app/manifest.ts).
writeFileSync("public/icons/icon-192.png", await png(tab, 192));
writeFileSync("public/icons/icon-512.png", await png(tab, 512));
writeFileSync("public/icons/maskable-512.png", await png(maskable, 512));

console.log("Icons written to src/app and public/icons.");
