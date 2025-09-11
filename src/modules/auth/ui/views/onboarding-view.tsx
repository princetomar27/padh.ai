"use client";

import { ErrorState } from "@/components/error-state";
import { LoadingState } from "@/components/loading-state";
import { OnboardingForm } from "../../components/onboarding-form";
import React from "react";
import { useRouter } from "next/navigation";

export const OnboardingView = () => {
  const router = useRouter();

  const handleSuccess = (userRole: string) => {
    if (userRole === "STUDENT") {
      router.push("/subjects");
    } else if (userRole === "TEACHER") {
      router.push("/subjects");
    } else if (userRole === "PARENT") {
      router.push("/students");
    } else if (userRole === "ADMIN") {
      router.push("/admin");
    } else {
      router.push("/");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/50 p-4">
      <OnboardingForm onSuccess={handleSuccess} />
    </div>
  );
};

export const OnboardingViewLoading = () => {
  return (
    <LoadingState
      title="Loading Onboarding"
      description="Please wait while we load the onboarding"
    />
  );
};

export const OnboardingViewError = () => {
  return (
    <ErrorState
      title="Error Loading Onboarding"
      description="Please try again later"
    />
  );
};
