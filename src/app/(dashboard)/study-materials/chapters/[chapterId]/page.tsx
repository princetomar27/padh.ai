import { ChapterReaderView } from "@/modules/chapters/ui/chapter-reader-view";

type Props = { params: Promise<{ chapterId: string }> };

export default async function StudentChapterReadPage({ params }: Props) {
  const { chapterId } = await params;

  return (
    <div className="flex flex-1 flex-col min-h-0 min-w-0">
      <ChapterReaderView
        chapterId={chapterId}
        backHref="/study-materials"
        backLabel="Study materials"
      />
    </div>
  );
}
