import { TutorSessionView } from "@/modules/learning/ui/tutor-session-view";

type Props = { params: Promise<{ sessionId: string }> };

export default async function TutorSessionPage({ params }: Props) {
  const { sessionId } = await params;

  return (
    <div className="flex flex-1 flex-col min-h-0 min-w-0">
      <TutorSessionView sessionId={sessionId} />
    </div>
  );
}
