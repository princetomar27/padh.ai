import { db } from "@/db";
import { userProfiles } from "@/db/schema";
import { auth } from "@clerk/nextjs/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { NextResponse } from "next/server";

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
      message: `Create bucket "${bucketId}" failed: ${createErr.message}`,
    };
  }

  return { ok: true };
}

/**
 * Returns a short-lived signed upload URL so the browser can PUT the PDF
 * directly to Supabase Storage (avoids proxying large bodies through Vercel).
 */
export async function POST() {
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

  const supabase = createClient(url, key);
  const ensured = await ensurePdfBucket(supabase, bucket);
  if (!ensured.ok) {
    return NextResponse.json({ error: ensured.message }, { status: 500 });
  }

  const storagePath = `books/${nanoid()}.pdf`;
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUploadUrl(storagePath);

  if (error || !data) {
    return NextResponse.json(
      { error: error?.message ?? "Could not create signed upload URL" },
      { status: 500 },
    );
  }

  return NextResponse.json({
    bucket,
    path: data.path,
    token: data.token,
    signedUrl: data.signedUrl,
  });
}
