import { EmptyState } from "@/components/empty-state";

export const CancelledState = () => {
  return (
    <div className="bg-white rounded-lg border px-4 py-5 flex flex-col gap-y-8 items-center justify-center">
      <EmptyState
        image="/cancelled.svg"
        title="Meeting Cancelled"
        description="This meeting has been cancelled. You can create a new meeting to continue."
      />
    </div>
  );
};
