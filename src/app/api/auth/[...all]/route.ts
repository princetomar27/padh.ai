/**
 * Better Auth catch-all route — replaced by Clerk.
 * Clerk handles all authentication; this stub returns 410 Gone so any old
 * bookmarks or cached requests don't silently break.
 */
import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json(
    { error: "Better Auth has been replaced by Clerk authentication." },
    { status: 410 }
  );
}

export async function POST() {
  return NextResponse.json(
    { error: "Better Auth has been replaced by Clerk authentication." },
    { status: 410 }
  );
}
