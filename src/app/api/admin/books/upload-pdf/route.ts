import { db } from "@/db";
import { userProfiles } from "@/db/schema";
import { auth } from "@clerk/nextjs/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { NextResponse } from "next/server";

const MAX_BYTES = 55 * 1024 * 1024;

/**
 * Ensures the PDF bucket exists (Supabase projects ship with no buckets by default).
 */
async function ensurePdfBucket(
  supabase: SupabaseClient,
  bucketId: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { data: buckets, error: listErr } =
    await supabase.storage.listBuckets();
  if (listErr) {
    return {
      ok: false,
      message: `Could not list storage buckets: ${listErr.message}`,
    };
  }

  if (buckets?.some((b) => b.id === bucketId)) {
    return { ok: true };
  }

  // Do not set fileSizeLimit here: Supabase rejects values above the project's
  // global max (often 50 MiB), which surfaces as "object exceeded the maximum allowed size".
  // Upload size is still enforced below via MAX_BYTES before .upload().
  const { error: createErr } = await supabase.storage.createBucket(bucketId, {
    public: false,
    allowedMimeTypes: ["application/pdf"],
  });

  if (createErr) {
    const msg = createErr.message.toLowerCase();
    if (
      msg.includes("already exists") ||
      msg.includes("resource already exists")
    ) {
      return { ok: true };
    }
    return {
      ok: false,
      message: `Create bucket "${bucketId}" failed: ${createErr.message}. In Supabase → Storage → New bucket, create it manually or fix service role permissions.`,
    };
  }

  return { ok: true };
}

export async function POST(req: Request) {
  const { userId: clerkId } = await auth();
  if (!clerkId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [profile] = await db
    .select({ role: userProfiles.role })
    .from(userProfiles)
    .where(eq(userProfiles.clerkId, clerkId))
    .limit(1);

  if (profile?.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const bucket = process.env.SUPABASE_PDF_BUCKET ?? "ncert-pdfs";
  if (!url || !key) {
    return NextResponse.json(
      { error: "Supabase storage is not configured" },
      { status: 500 },
    );
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing file field" }, { status: 400 });
  }

  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: `File too large (max ${MAX_BYTES / 1024 / 1024} MB)` },
      { status: 400 },
    );
  }

  const ct = file.type || "application/octet-stream";
  if (ct !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
    return NextResponse.json(
      { error: "Only PDF uploads are allowed" },
      { status: 400 },
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const storagePath = `books/${nanoid()}.pdf`;

  const supabase = createClient(url, key);

  const ensured = await ensurePdfBucket(supabase, bucket);
  if (!ensured.ok) {
    return NextResponse.json({ error: ensured.message }, { status: 500 });
  }

  const { error } = await supabase.storage
    .from(bucket)
    .upload(storagePath, buffer, {
      contentType: "application/pdf",
      upsert: false,
    });

  if (error) {
    const isBucketMissing = /bucket not found/i.test(error.message);
    if (isBucketMissing) {
      const retryEnsure = await ensurePdfBucket(supabase, bucket);
      if (!retryEnsure.ok) {
        return NextResponse.json(
          { error: retryEnsure.message },
          { status: 500 },
        );
      }
      const second = await supabase.storage
        .from(bucket)
        .upload(storagePath, buffer, {
          contentType: "application/pdf",
          upsert: false,
        });
      if (second.error) {
        return NextResponse.json(
          { error: `Upload failed: ${second.error.message}` },
          { status: 500 },
        );
      }
    } else {
      return NextResponse.json(
        { error: `Upload failed: ${error.message}` },
        { status: 500 },
      );
    }
  }

  return NextResponse.json({
    path: storagePath,
    size: buffer.byteLength,
  });
}
