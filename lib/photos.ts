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
