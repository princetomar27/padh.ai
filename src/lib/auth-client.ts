/**
 * auth-client.ts — Client-side auth helpers (Clerk-based)
 *
 * Better Auth has been replaced by Clerk.
 * Use Clerk's React hooks directly in client components:
 *   import { useUser, useAuth, useClerk } from "@clerk/nextjs"
 *
 * This file is kept as a compatibility shim while old imports are updated.
 */
export { useUser as useSession, useAuth, useClerk } from "@clerk/nextjs";
