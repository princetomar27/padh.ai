import AdminChaptersView from "@/modules/admin/ui/views/admin-chapters-view";
import { getQueryClient, trpc } from "@/trpc/server";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";

export default async function AdminChaptersPage() {
  const queryClient = getQueryClient();
  void queryClient.prefetchQuery(trpc.chapters.listForAdmin.queryOptions());

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <AdminChaptersView />
    </HydrationBoundary>
  );
}
