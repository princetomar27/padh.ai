/**
 * auth.ts — Server-side auth helpers (Clerk-based)
 *
 * Better Auth has been replaced by Clerk. This file re-exports
 * Clerk's server utilities so existing imports don't all break at once.
 * Over time, callers should import directly from @clerk/nextjs/server.
 */
export { auth, currentUser } from "@clerk/nextjs/server";
