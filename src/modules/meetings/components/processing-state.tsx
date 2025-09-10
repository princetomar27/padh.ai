import { EmptyState } from "@/components/empty-state";

export const ProcessingState = () => {
  return (
    <div className="bg-white rounded-lg border px-4 py-5 flex flex-col gap-y-8 items-center justify-center">
      <EmptyState
        image="/processing.svg"
        title="Processing Meeting"
        description="Your meeting is being processed. This may take a few minutes."
      />
    </div>
  );
};
