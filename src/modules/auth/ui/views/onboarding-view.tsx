"use client";

import { OnboardingForm } from "../../components/onboarding-form";
import { LoadingState } from "@/components/loading-state";
import { ErrorState } from "@/components/error-state";

export const OnboardingView = () => {
  const handleSuccess = (userRole: string) => {
    // Use a full-page navigation instead of router.push so the browser sends
    // the fresh Clerk session cookie (updated by clerkUser.reload()) on the
    // very next request. router.push() is a client-side transition that reuses
    // the old request context and can hit the middleware before the new JWT
    // cookie is fully committed, causing a spurious redirect to sign-in.
    const destination =
      userRole === "ADMIN"
        ? "/admin"
        : userRole === "PARENT"
          ? "/parents"
          : "/dashboard";

    // Set a short-lived fallback cookie to instantly tell our Next.js middleware
    // that the user has been onboarded, bypassing any Clerk JWT refresh lags.
    document.cookie = `padh_ai_onboarded=true; path=/; max-age=120`;
    window.location.href = destination;
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/50 p-4">
      <OnboardingForm onSuccess={handleSuccess} />
    </div>
  );
};

export const OnboardingViewLoading = () => (
  <LoadingState
    title="Setting up your profile"
    description="Please wait a moment…"
  />
);

export const OnboardingViewError = () => (
  <ErrorState
    title="Something went wrong"
    description="Could not load the onboarding form. Please refresh the page."
  />
);
