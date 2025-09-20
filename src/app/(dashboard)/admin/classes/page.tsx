import { classesLoadSearchParams } from "@/modules/classes/params";
import AdminClassesView, {
  AdminClassViewError,
  AdminClassViewLoading,
} from "@/modules/classes/ui/admin-classes-view";
import { getQueryClient, trpc } from "@/trpc/server";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { SearchParams } from "nuqs";
import { Suspense } from "react";
import { ErrorBoundary } from "react-error-boundary";

interface AdminClassPageProps {
  searchParams: Promise<SearchParams>;
}

const AdminClassesPage = async ({ searchParams }: AdminClassPageProps) => {
  const filterParams = await classesLoadSearchParams(searchParams);

  const queryClient = getQueryClient();

  void queryClient.prefetchQuery(
    trpc.classes.getMany.queryOptions({
      search: filterParams.search,
      page: filterParams.page,
      pageSize: 10,

      isActive:
        filterParams.isActive === "true"
          ? true
          : filterParams.isActive === "false"
          ? false
          : undefined,
    })
  );

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <Suspense fallback={<AdminClassViewLoading />}>
        <ErrorBoundary fallback={<AdminClassViewError />}>
          <AdminClassesView />
        </ErrorBoundary>
      </Suspense>
    </HydrationBoundary>
  );
};

export default AdminClassesPage;
