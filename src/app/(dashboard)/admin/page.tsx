import {
  AdminRootDashboardView,
  AdminRootDashboardLoading,
  AdminRootDashboardError,
} from "@/modules/admin/ui/views/admin-root-dashboard-view";
import { getQueryClient, trpc } from "@/trpc/server";
import { adminLoadSearchParams } from "@/modules/admin/params";
import { SearchParams } from "nuqs/server";
import { HydrationBoundary, dehydrate } from "@tanstack/react-query";
import React, { Suspense } from "react";
import { ErrorBoundary } from "react-error-boundary";

interface AdminPageProps {
  searchParams: Promise<SearchParams>;
}

const AdminRootPage = async ({ searchParams }: AdminPageProps) => {
  const filterParams = await adminLoadSearchParams(searchParams);

  const queryClient = getQueryClient();

  void queryClient.prefetchQuery(
    trpc.admin.getAdminDashboardData.queryOptions({
      dateRange: filterParams.dateRange,
      includeAnalytics: filterParams.includeAnalytics === "true",
      includeRecentActivity: filterParams.includeRecentActivity === "true",
    })
  );

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <Suspense fallback={<AdminRootDashboardLoading />}>
        <ErrorBoundary fallback={<AdminRootDashboardError />}>
          <AdminRootDashboardView />
        </ErrorBoundary>
      </Suspense>
    </HydrationBoundary>
  );
};

export default AdminRootPage;
