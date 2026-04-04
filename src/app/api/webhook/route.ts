/**
 * Legacy Stream.io webhook route — replaced by Clerk webhook at /api/webhooks/clerk
 *
 * Stream.io has been removed from padh.ai in favour of OpenAI Realtime API
 * directly over WebRTC. This stub keeps the route file present so any cached
 * references don't cause 404 noise, but it immediately returns 410 Gone.
 */
import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    { error: "This webhook endpoint has been decommissioned." },
    { status: 410 }
  );
}
