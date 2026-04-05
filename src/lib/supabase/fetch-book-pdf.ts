import "server-only";

import { createClient } from "@supabase/supabase-js";

/**
 * Download raw PDF bytes for a book.
 * `storagePathOrUrl` may be a public HTTPS URL or a bucket-relative path.
 */
export async function fetchBookPdfBuffer(
  storagePathOrUrl: string,
): Promise<Buffer> {
  if (
    storagePathOrUrl.startsWith("http://") ||
    storagePathOrUrl.startsWith("https://")
  ) {
    const res = await fetch(storagePathOrUrl);
    if (!res.ok) {
      throw new Error(
        `Failed to fetch PDF URL (${res.status}): ${storagePathOrUrl.slice(0, 80)}`,
      );
    }
    return Buffer.from(await res.arrayBuffer());
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const bucket = process.env.SUPABASE_PDF_BUCKET ?? "ncert-pdfs";
  if (!url || !key) {
    throw new Error(
      "Storage and service role key are required for storage paths.",
    );
  }

  const supabase = createClient(url, key);
  const { data, error } = await supabase.storage
    .from(bucket)
    .download(storagePathOrUrl);
  if (error || !data) {
    throw new Error(
      `Supabase download failed: ${error?.message ?? "no data"} (${bucket}/${storagePathOrUrl})`,
    );
  }
  return Buffer.from(await data.arrayBuffer());
}
