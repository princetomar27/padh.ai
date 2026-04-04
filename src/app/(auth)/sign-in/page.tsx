import { SignIn } from "@clerk/nextjs";

/**
 * Sign-in page — Clerk handles the full UI and auth flow (email + Google SSO).
 *
 * forceRedirectUrl="/" lets the middleware decide where to send the user:
 *   - Not yet onboarded → /onboarding
 *   - Already onboarded → role-specific dashboard (/dashboard, /admin, /parents)
 */
export default function SignInPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/50 p-4">
      <SignIn forceRedirectUrl="/" />
    </div>
  );
}
