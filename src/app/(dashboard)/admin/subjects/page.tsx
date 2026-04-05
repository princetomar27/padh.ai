import AdminSubjectsView from "@/modules/subjects/ui/admin-subjects-view";
import { getQueryClient, trpc } from "@/trpc/server";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";

export default async function AdminSubjectsPage() {
  const queryClient = getQueryClient();

  void queryClient.prefetchQuery(trpc.subjects.adminList.queryOptions({}));
  void queryClient.prefetchQuery(trpc.books.list.queryOptions());
  void queryClient.prefetchQuery(
    trpc.classes.getMany.queryOptions({
      page: 1,
      pageSize: 50,
      search: "",
      classNumber: null,
      isActive: null,
    })
  );

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <AdminSubjectsView />
    </HydrationBoundary>
  );
}
