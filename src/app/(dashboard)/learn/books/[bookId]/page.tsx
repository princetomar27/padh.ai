import { StudentBookChaptersView } from "@/modules/student-dashboard/ui/student-book-chapters-view";

type Props = { params: Promise<{ bookId: string }> };

export default async function LearnBookDetailPage({ params }: Props) {
  const { bookId } = await params;
  return <StudentBookChaptersView bookId={bookId} />;
}
