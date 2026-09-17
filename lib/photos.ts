import { supabaseAdmin, PHOTOS_BUCKET } from "@/lib/supabase";

/**
 * Uploads a photo to Supabase Storage and returns its public URL. The bucket
 * ("order-photos") must exist and be set to public — created once by hand in
 * the Supabase dashboard, not by this code.
 */
export async function savePhoto(
  orderId: string,
  type: "BOUQUET" | "DELIVERY" | "REFERENCE",
  file: File
) {
  const ext = extensionFor(file.type);
  const path = `${orderId}/${type.toLowerCase()}-${Date.now()}${ext}`;

  const supabase = supabaseAdmin();
  const { error } = await supabase.storage.from(PHOTOS_BUCKET).upload(path, file, {
    contentType: file.type,
    cacheControl: "31536000",
  });
  if (error) throw new Error(`Photo upload failed: ${error.message}`);

  const { data } = supabase.storage.from(PHOTOS_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

function extensionFor(mime: string) {
  if (mime === "image/png") return ".png";
  if (mime === "image/webp") return ".webp";
  return ".jpg";
}

/**
 * Copies a photo that lives on someone else's server into our own storage.
 *
 * Used for Slider's proof-of-delivery photos: their URL is public and would
 * render fine in an <img>, but hotlinking it would put a permanent hole in
 * every past order's record the day Slider expires or moves that bucket — and
 * the delivery photo is the one piece of evidence a customer dispute turns on.
 * So we keep our own copy, and the rest of the app can't tell the difference
 * between a photo a driver took here and one taken in Slider's app.
 */
export async function savePhotoFromUrl(
  orderId: string,
  type: "BOUQUET" | "DELIVERY" | "REFERENCE",
  sourceUrl: string
) {
  const response = await fetch(sourceUrl, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Couldn't download photo (HTTP ${response.status}).`);
  }

  const contentType = response.headers.get("content-type") ?? "image/jpeg";
  if (!contentType.startsWith("image/")) {
    throw new Error(`Expected an image, got ${contentType}.`);
  }

  const blob = await response.blob();
  const file = new File([blob], "proof", { type: contentType });
  return savePhoto(orderId, type, file);
}
