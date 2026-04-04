/**
 * Clerk SSO callback page for sign-in (Google, GitHub, etc.)
 *
 * Mirrors the sign-up SSO callback. Clerk redirects here after OAuth,
 * completes the token exchange, then redirects to the final destination.
 */
import { AuthenticateWithRedirectCallback } from "@clerk/nextjs";

export default function SignInSSOCallback() {
  return <AuthenticateWithRedirectCallback />;
}
