import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { ErrorBoundary } from "react-error-boundary";
import {
  OnboardingView,
  OnboardingViewError,
  OnboardingViewLoading,
} from "@/modules/auth/ui/views/onboarding-view";

/**
 * Onboarding page — collects class, school, and role from the student.
 * Only reachable when Clerk session exists but isOnboarded = false.
 * Middleware enforces this; this page adds a server-side safety check.
 */
const OnboardingPage = async () => {
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  return (
    <Suspense fallback={<OnboardingViewLoading />}>
      <ErrorBoundary fallback={<OnboardingViewError />}>
        <OnboardingView />
      </ErrorBoundary>
    </Suspense>
  );
};

export default OnboardingPage;
