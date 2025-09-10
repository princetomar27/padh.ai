import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { VideoIcon } from "lucide-react";
import Link from "next/link";

interface ActiveStateProps {
  meetingId: string;
}

export const ActiveState = ({ meetingId }: ActiveStateProps) => {
  return (
    <div className="bg-white rounded-lg border px-4 py-5 flex flex-col gap-y-8 items-center justify-center">
      <EmptyState
        image="/upcoming.svg"
        title="Meeting Active"
        description="This meeting is currently active. You can join it by clicking the button below. Meeting will end automatically once all participants have left."
      />
      <div className="flex flex-col-reverse lg:flex-row lg:justify-center items-center gap-2 w-full">
        <Button asChild className="w-full lg:w-auto">
          <Link href={`/call/${meetingId}`}>
            <VideoIcon />
            Join Meeting
          </Link>
        </Button>
      </div>
    </div>
  );
};
