/**
 * Auth layout — minimal wrapper for sign-in, sign-up, and onboarding pages.
 * Clerk middleware handles the redirect logic; this layout just renders children.
 */
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
