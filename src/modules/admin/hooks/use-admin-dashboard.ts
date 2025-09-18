"use client";

import { useTRPC } from "@/trpc/client";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { useAdminFilters } from "./use-admin-filters";

export const useAdminDashboard = () => {
  const [filters] = useAdminFilters();
  const trpc = useTRPC();

  // Use suspenseQuery to consume pre-fetched data from the server
  const { data } = useSuspenseQuery(
    trpc.admin.getAdminDashboardData.queryOptions({
      dateRange: filters.dateRange,
      includeAnalytics: filters.includeAnalytics === "true",
      includeRecentActivity: filters.includeRecentActivity === "true",
    })
  );

  const summary = useMemo(() => {
    if (!data?.summary) return null;
    return data.summary;
  }, [data?.summary]);

  const analytics = useMemo(() => {
    if (!data?.analytics) return null;
    return data.analytics;
  }, [data?.analytics]);

  const recentActivity = useMemo(() => {
    if (!data?.recentActivity) return [];
    return data.recentActivity.map((activity) => ({
      ...activity,
      timestamp: new Date(activity.timestamp),
    }));
  }, [data?.recentActivity]);

  return {
    summary,
    analytics,
    recentActivity,
  };
};
