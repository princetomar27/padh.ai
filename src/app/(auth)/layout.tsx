import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { db } from "@/db";
import { user } from "@/db/schema";
import { eq } from "drizzle-orm";

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  // If user is authenticated, check onboarding status
  if (session?.user) {
    try {
      const userData = await db
        .select({ isOnboarded: user.isOnboarded })
        .from(user)
        .where(eq(user.id, session.user.id))
        .limit(1);

      const isOnboarded = userData[0]?.isOnboarded ?? false;

      // If user is authenticated and onboarded, redirect to dashboard
      if (isOnboarded) {
        redirect("/");
      }
    } catch (error) {
      console.error("Error fetching user data in auth layout:", error);
      // Continue to show auth pages if there's an error
    }
  }

  // If user is authenticated but not onboarded, allow access to onboarding
  // If user is not authenticated, allow access to sign-in/sign-up

  return <>{children}</>;
}
