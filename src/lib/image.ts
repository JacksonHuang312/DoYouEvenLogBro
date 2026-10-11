/** Side length of stored exercise photos: sharp at the largest 88px thumbnail on 2x screens. */
const THUMB_SIZE = 192;

/** Must stay under the limit in firestore.rules. A 192px JPEG is typically 10-25 KB. */
export const MAX_IMAGE_DATA_CHARS = 150_000;

/**
 * Center-crops a photo to a square, scales it to 192px and returns a JPEG data URL,
 * small enough to store inline on the Firestore doc (no Cloud Storage needed).
 */
export async function photoToThumbnail(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("That file isn't an image.");

  let bitmap: ImageBitmap;
  try {
    // Applies the photo's EXIF orientation, so phone pictures aren't sideways.
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new Error("Couldn't read that image. Try a JPEG or PNG.");
  }

  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = THUMB_SIZE;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#fff"; // transparent PNGs get the same white background as library images
  ctx.fillRect(0, 0, THUMB_SIZE, THUMB_SIZE);
  ctx.drawImage(
    bitmap,
    (bitmap.width - side) / 2,
    (bitmap.height - side) / 2,
    side,
    side,
    0,
    0,
    THUMB_SIZE,
    THUMB_SIZE,
  );
  bitmap.close();

  const dataUrl = canvas.toDataURL("image/jpeg", 0.8);
  if (dataUrl.length > MAX_IMAGE_DATA_CHARS) throw new Error("That image is too detailed. Try another one.");
  return dataUrl;
}
