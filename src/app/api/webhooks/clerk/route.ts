import { db } from "@/db";
import { userProfiles } from "@/db/schema";
import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { Webhook } from "svix";

/**
 * Clerk Webhook Handler
 *
 * Syncs Clerk user lifecycle events to our user_profiles table.
 * Register this endpoint in Clerk Dashboard → Webhooks:
 *   URL: https://your-domain.com/api/webhooks/clerk
 *   Events: user.created, user.updated, user.deleted
 *
 * Set CLERK_WEBHOOK_SECRET in .env.local from the Clerk Webhook page.
 */

type ClerkEmailAddress = {
  email_address: string;
  id: string;
};

type ClerkUserData = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email_addresses: ClerkEmailAddress[];
  primary_email_address_id: string | null;
  image_url: string;
};

type ClerkWebhookEvent =
  | { type: "user.created"; data: ClerkUserData }
  | { type: "user.updated"; data: ClerkUserData }
  | { type: "user.deleted"; data: { id: string } };

function getPrimaryEmail(data: ClerkUserData): string {
  const primary = data.email_addresses.find(
    (e) => e.id === data.primary_email_address_id
  );
  return primary?.email_address ?? data.email_addresses[0]?.email_address ?? "";
}

function getFullName(data: ClerkUserData): string {
  const parts = [data.first_name, data.last_name].filter(Boolean);
  return parts.join(" ") || "User";
}

export async function POST(req: Request) {
  const webhookSecret = process.env.CLERK_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.error("CLERK_WEBHOOK_SECRET is not set");
    return NextResponse.json(
      { error: "Webhook secret not configured" },
      { status: 500 }
    );
  }

  // Verify the webhook signature using svix
  const headerPayload = await headers();
  const svixId = headerPayload.get("svix-id");
  const svixTimestamp = headerPayload.get("svix-timestamp");
  const svixSignature = headerPayload.get("svix-signature");

  if (!svixId || !svixTimestamp || !svixSignature) {
    return NextResponse.json(
      { error: "Missing svix headers" },
      { status: 400 }
    );
  }

  const payload = await req.text();

  let event: ClerkWebhookEvent;
  try {
    const wh = new Webhook(webhookSecret);
    event = wh.verify(payload, {
      "svix-id": svixId,
      "svix-timestamp": svixTimestamp,
      "svix-signature": svixSignature,
    }) as ClerkWebhookEvent;
  } catch (err) {
    console.error("Clerk webhook verification failed:", err);
    return NextResponse.json(
      { error: "Webhook verification failed" },
      { status: 400 }
    );
  }

  // Handle each event type
  try {
    if (event.type === "user.created") {
      const { data } = event;
      const email = getPrimaryEmail(data);
      const name = getFullName(data);

      await db
        .insert(userProfiles)
        .values({
          clerkId: data.id,
          name,
          email,
          image: data.image_url || null,
          role: "STUDENT",
          isOnboarded: false,
        })
        .onConflictDoNothing({ target: userProfiles.clerkId });

      console.log(`[Clerk Webhook] Created user profile for ${email}`);
    }

    if (event.type === "user.updated") {
      const { data } = event;
      const email = getPrimaryEmail(data);
      const name = getFullName(data);

      await db
        .update(userProfiles)
        .set({
          name,
          email,
          image: data.image_url || null,
          updatedAt: new Date(),
        })
        .where(eq(userProfiles.clerkId, data.id));

      console.log(`[Clerk Webhook] Updated user profile for ${email}`);
    }

    if (event.type === "user.deleted") {
      const { data } = event;
      // Soft approach: we keep the profile but could mark it deleted
      // For now, delete the profile (cascades to all child records)
      await db
        .delete(userProfiles)
        .where(eq(userProfiles.clerkId, data.id));

      console.log(`[Clerk Webhook] Deleted user profile for clerkId ${data.id}`);
    }
  } catch (err) {
    console.error(`[Clerk Webhook] DB error for event ${event.type}:`, err);
    return NextResponse.json(
      { error: "Database error processing webhook" },
      { status: 500 }
    );
  }

  return NextResponse.json({ received: true });
}
