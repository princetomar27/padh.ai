import { AdminChapterDetailView } from "@/modules/chapters/ui/admin-chapter-detail-view";
import { getQueryClient, trpc } from "@/trpc/server";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";

type Props = { params: Promise<{ chapterId: string }> };

export default async function AdminChapterDetailPage({ params }: Props) {
  const { chapterId } = await params;
  const queryClient = getQueryClient();
  void queryClient.prefetchQuery(
    trpc.chapters.getByIdForAdmin.queryOptions({ id: chapterId }),
  );

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <AdminChapterDetailView chapterId={chapterId} />
    </HydrationBoundary>
  );
}
