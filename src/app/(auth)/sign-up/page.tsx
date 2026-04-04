import { SignUp } from "@clerk/nextjs";

/**
 * Sign-up page — Clerk handles the full UI and auth flow (email + Google SSO).
 *
 * forceRedirectUrl="/onboarding" ensures that after ANY sign-up method
 * (email/password or Google OAuth), Clerk always lands on /onboarding.
 * The middleware then routes onboarded users away from /onboarding automatically.
 */
export default function SignUpPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/50 p-4">
      <SignUp forceRedirectUrl="/onboarding" />
    </div>
  );
}
