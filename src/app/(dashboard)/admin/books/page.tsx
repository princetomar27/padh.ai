import AdminBooksView from "@/modules/admin/ui/views/admin-books-view";
import { getQueryClient, trpc } from "@/trpc/server";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";

export default async function AdminBooksPage() {
  const queryClient = getQueryClient();

  void queryClient.prefetchQuery(trpc.books.list.queryOptions());
  void queryClient.prefetchQuery(trpc.subjects.listActive.queryOptions());
  void queryClient.prefetchQuery(
    trpc.classes.getMany.queryOptions({
      page: 1,
      pageSize: 50,
      search: "",
      classNumber: null,
      isActive: null,
    }),
  );

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <AdminBooksView />
    </HydrationBoundary>
  );
}
