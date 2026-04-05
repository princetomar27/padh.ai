import { ChapterReaderView } from "@/modules/chapters/ui/chapter-reader-view";

type Props = { params: Promise<{ chapterId: string }> };

export default async function StudentChapterReadPage({ params }: Props) {
  const { chapterId } = await params;

  return (
    <ChapterReaderView
      chapterId={chapterId}
      backHref="/study-materials"
      backLabel="Study materials"
    />
  );
}
