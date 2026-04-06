import { AdminTutorsView } from "@/modules/admin/components/admin-tutors-view";
import { getQueryClient, trpc } from "@/trpc/server";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";

export default async function AdminTutorsPage() {
  const queryClient = getQueryClient();
  void queryClient.prefetchQuery(trpc.agents.listTutors.queryOptions());

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <AdminTutorsView />
    </HydrationBoundary>
  );
}
