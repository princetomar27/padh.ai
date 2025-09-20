"use client";

import { ErrorState } from "@/components/error-state";
import { LoadingState } from "@/components/loading-state";
import { AdminRootDashboardSummaryHeader } from "../../components/admin-root-dashboard-summary-header";
import { RecentActivity } from "../../components/recent-activity";
import { QuickActions } from "../../components/quick-actions";
import { useAdminDashboard } from "../../hooks/use-admin-dashboard";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

export const AdminRootDashboardView = () => {
  const { summary, recentActivity } = useAdminDashboard();

  return (
    <div className="flex-1 space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">
            Welcome back! Here’s the latest on your learning platform.
          </p>
        </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Quick Add
        </Button>
      </div>

      {/* Summary Cards */}
      <AdminRootDashboardSummaryHeader summary={summary} />

      {/* Main Content Grid */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Recent Activity */}
        <RecentActivity activities={recentActivity} />

        {/* Quick Actions */}
        <QuickActions />
      </div>
    </div>
  );
};

export const AdminRootDashboardLoading = () => {
  return (
    <LoadingState
      title="Loading Admin Dashboard"
      description="Please wait while we load the admin dashboard"
    />
  );
};

export const AdminRootDashboardError = () => {
  return (
    <ErrorState
      title="Error loading admin dashboard"
      description="Please try again later"
    />
  );
};
