const IMAGE_BUCKET = "link-in-bio";

function parseImageDataUrl(dataUrl: string): { mime: string; ext: string; bytes: Uint8Array } | null {
  const match = dataUrl.trim().match(/^data:(image\/(?:jpeg|jpg|png|webp));base64,([A-Za-z0-9+/]+=*)$/i);
  const mimePart = match?.[1];
  const payload = match?.[2];
  if (!mimePart || !payload) return null;
  const rawMime = mimePart.toLowerCase();
  const mime = rawMime === "image/jpg" ? "image/jpeg" : rawMime;
  const binary = Uint8Array.from(atob(payload), (char) => char.charCodeAt(0));
  if (binary.byteLength < 24 || binary.byteLength > 220_000) return null;
  const ext = mime === "image/png" ? "png" : mime === "image/webp" ? "webp" : "jpg";
  return { mime, ext, bytes: new Uint8Array(binary) };
}

function objectPath(userId: string, url: string): string | null {
  const marker = `/storage/v1/object/public/${IMAGE_BUCKET}/`;
  const idx = url.indexOf(marker);
  if (idx === -1) return null;
  const path = decodeURIComponent(url.slice(idx + marker.length));
  if (!path.startsWith(`${userId}/`) || path.includes("..")) return null;
  return path;
}

export async function storeLinkInBioImage(userId: string, dataUrl: string): Promise<string | null> {
  const parsed = parseImageDataUrl(dataUrl);
  if (!parsed) return null;
  const { supabaseAdmin } = await import("@/lib/supabase/client.server");
  try {
    const path = `${userId}/${crypto.randomUUID()}.${parsed.ext}`;
    const { error } = await supabaseAdmin.storage.from(IMAGE_BUCKET).upload(path, parsed.bytes, {
      contentType: parsed.mime,
      upsert: true,
    });
    if (error) return null;
    const { data } = supabaseAdmin.storage.from(IMAGE_BUCKET).getPublicUrl(path);
    return data.publicUrl || null;
  } catch {
    return null;
  }
}

export async function deleteLinkInBioImage(userId: string, url: string): Promise<void> {
  const path = objectPath(userId, url);
  if (!path) return;
  const { supabaseAdmin } = await import("@/lib/supabase/client.server");
  try {
    await supabaseAdmin.storage.from(IMAGE_BUCKET).remove([path]);
  } catch {
    /* ignore missing bucket/object */
  }
}

export async function persistLinkInBioImageUrl(userId: string, url: string): Promise<string> {
  if (!url) return "";
  if (url.startsWith("data:image/")) {
    return (await storeLinkInBioImage(userId, url)) ?? "";
  }
  if (/^https:\/\//i.test(url) && url.length <= 2048) return url;
  return "";
}
