/** Side length of stored exercise photos: sharp at the largest 88px thumbnail on 2x screens. */
const THUMB_SIZE = 192;

/** Must stay under the limit in firestore.rules. A 192px JPEG is typically 10-25 KB. */
export const MAX_IMAGE_DATA_CHARS = 150_000;

/** Profile pictures: sharp at the largest 76px avatar on 2x screens, ~10-20 KB. */
export const AVATAR_SIZE = 160;

/**
 * Must match the data-URL limit in validPhotoURL() in firestore.rules. Kept small because the
 * picture is stored on the profile and copied onto each comment you post.
 */
export const MAX_AVATAR_CHARS = 40_000;

/** Workout photos: longest side, enough for a full-width feed photo on a phone. */
export const WORKOUT_PHOTO_SIDE = 1080;

/**
 * Must match the photos/{id} limit in firestore.rules. Stays well under Firestore's 1 MiB
 * document limit; a 1080px JPEG is typically 150-350 KB (200-470K chars as base64).
 */
export const MAX_WORKOUT_PHOTO_CHARS = 800_000;

async function loadBitmap(file: File) {
  if (!file.type.startsWith("image/")) throw new Error("That file isn't an image.");
  try {
    // Applies the photo's EXIF orientation, so phone pictures aren't sideways.
    return await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new Error("Couldn't read that image. Try a JPEG or PNG.");
  }
}

/** Encodes the canvas as JPEG, stepping quality down for very detailed photos before giving up. */
function toJpeg(canvas: HTMLCanvasElement, maxChars: number) {
  for (const quality of [0.8, 0.65, 0.5]) {
    const dataUrl = canvas.toDataURL("image/jpeg", quality);
    if (dataUrl.length <= maxChars) return dataUrl;
  }
  throw new Error("That image is too detailed. Try another one.");
}

/**
 * Center-crops a photo to a square, scales it to `size` px and returns a JPEG data URL,
 * small enough to store inline on the Firestore doc (no Cloud Storage needed).
 */
export async function photoToThumbnail(
  file: File,
  { size = THUMB_SIZE, maxChars = MAX_IMAGE_DATA_CHARS } = {},
): Promise<string> {
  const bitmap = await loadBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#fff"; // transparent PNGs get the same white background as library images
  ctx.fillRect(0, 0, size, size);
  ctx.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, size, size);
  bitmap.close();
  return toJpeg(canvas, maxChars);
}

/** Scales a photo down (never up) so its longest side is `maxSide`, keeping its shape. */
export async function photoToJpeg(
  file: File,
  { maxSide = WORKOUT_PHOTO_SIDE, maxChars = MAX_WORKOUT_PHOTO_CHARS } = {},
): Promise<string> {
  const bitmap = await loadBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return toJpeg(canvas, maxChars);
}
