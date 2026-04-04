/**
 * Student dashboard — the main landing page after onboarding.
 *
 * Phase 3 will replace this with the real subject/chapter selection UI.
 * For now this serves as a valid landing page so auth routing doesn't 404.
 */
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

const DashboardPage = async () => {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  return (
    <div className="flex flex-col gap-6 p-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-muted-foreground mt-1">
          Welcome to padh.ai — your AI-powered learning companion.
        </p>
      </div>
      <div className="rounded-xl border border-dashed p-12 text-center text-muted-foreground">
        <p className="text-lg font-medium">Subject selection coming soon</p>
        <p className="text-sm mt-1">
          Choose your class subjects and start an AI learning session.
        </p>
      </div>
    </div>
  );
};

export default DashboardPage;
