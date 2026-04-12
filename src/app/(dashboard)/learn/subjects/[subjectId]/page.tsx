import { StudentSubjectBooksView } from "@/modules/student-dashboard/ui/student-subject-books-view";

type Props = { params: Promise<{ subjectId: string }> };

export default async function LearnSubjectDetailPage({ params }: Props) {
  const { subjectId } = await params;
  return <StudentSubjectBooksView subjectId={subjectId} />;
}
