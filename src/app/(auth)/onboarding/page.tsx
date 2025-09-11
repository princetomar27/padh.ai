import { auth } from "@/lib/auth";
import {
  OnboardingView,
  OnboardingViewError,
  OnboardingViewLoading,
} from "@/modules/auth/ui/views/onboarding-view";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { ErrorBoundary } from "react-error-boundary";

const OnboardingPage = async () => {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect("/sign-in");
  }

  return (
    <>
      <Suspense fallback={<OnboardingViewLoading />}>
        <ErrorBoundary fallback={<OnboardingViewError />}>
          <OnboardingView />
        </ErrorBoundary>
      </Suspense>
    </>
  );
};

export default OnboardingPage;
