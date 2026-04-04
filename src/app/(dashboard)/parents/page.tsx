/**
 * Parent dashboard — landing page for PARENT role users.
 * Phase 8 will add child progress monitoring, session history, etc.
 */
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

const ParentsDashboardPage = async () => {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  return (
    <div className="flex flex-col gap-6 p-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Parent Dashboard</h1>
        <p className="text-muted-foreground mt-1">
          Monitor your child&apos;s learning progress on padh.ai.
        </p>
      </div>
      <div className="rounded-xl border border-dashed p-12 text-center text-muted-foreground">
        <p className="text-lg font-medium">Progress monitoring coming soon</p>
        <p className="text-sm mt-1">
          View session history, test scores, and chapter completion.
        </p>
      </div>
    </div>
  );
};

export default ParentsDashboardPage;
