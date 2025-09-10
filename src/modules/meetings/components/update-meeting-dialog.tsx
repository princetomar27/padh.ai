import { ResponsiveDialog } from "@/components/responsive-dialog";
import { MeetingForm } from "./meeting-form";
import { useRouter } from "next/navigation";
import { MeetingGetOne } from "../types";

interface UpdateMeetingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  intialMeetingValue: MeetingGetOne;
}

export const UpdateMeetingDialog = ({
  open,
  onOpenChange,
  intialMeetingValue,
}: UpdateMeetingDialogProps) => {
  const router = useRouter();
  return (
    <ResponsiveDialog
      title="Update Meeting"
      description="Update the meeting"
      open={open}
      onOpenChange={onOpenChange}
    >
      <MeetingForm
        onSuccess={(id) => {
          onOpenChange(false);
          router.push(`/meetings/${id}`);
        }}
        onCancel={() => onOpenChange(false)}
        initialValues={intialMeetingValue}
      />
    </ResponsiveDialog>
  );
};
