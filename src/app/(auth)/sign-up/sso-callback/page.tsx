/**
 * Clerk SSO callback page for sign-up (Google, GitHub, etc.)
 *
 * After the OAuth provider redirects back to Clerk, Clerk redirects here
 * to complete the authentication handshake. AuthenticateWithRedirectCallback
 * handles the token exchange and then redirects to the redirect_url param
 * (which our middleware then routes to /onboarding or /dashboard).
 */
import { AuthenticateWithRedirectCallback } from "@clerk/nextjs";

export default function SignUpSSOCallback() {
  return <AuthenticateWithRedirectCallback />;
}
