import {
  CircleCheckIcon,
  CircleXIcon,
  ClockArrowUpIcon,
  LoaderIcon,
  VideoIcon,
} from "lucide-react";
import { MeetingStatus } from "../types";
import { useMeetingFilters } from "../hooks/use-meeting-filters";
import { CommandSelect } from "@/components/command-select";

const options = [
  {
    id: MeetingStatus.UPCOMING,
    value: MeetingStatus.UPCOMING,
    children: (
      <div className="flex items-center gap-x-2 capitalize">
        <ClockArrowUpIcon />
        {MeetingStatus.UPCOMING}
      </div>
    ),
  },
  {
    id: MeetingStatus.COMPLETED,
    value: MeetingStatus.COMPLETED,
    children: (
      <div className="flex items-center gap-x-2 capitalize">
        <CircleCheckIcon />
        {MeetingStatus.COMPLETED}
      </div>
    ),
  },
  {
    id: MeetingStatus.ACTIVE,
    value: MeetingStatus.ACTIVE,
    children: (
      <div className="flex items-center gap-x-2 capitalize">
        <VideoIcon />
        {MeetingStatus.ACTIVE}
      </div>
    ),
  },
  {
    id: MeetingStatus.PROCESSING,
    value: MeetingStatus.PROCESSING,
    children: (
      <div className="flex items-center gap-x-2 capitalize">
        <LoaderIcon />
        {MeetingStatus.PROCESSING}
      </div>
    ),
  },
  {
    id: MeetingStatus.CANCELLED,
    value: MeetingStatus.CANCELLED,
    children: (
      <div className="flex items-center gap-x-2 capitalize">
        <CircleXIcon />
        {MeetingStatus.CANCELLED}
      </div>
    ),
  },
];

export const StatusFilter = () => {
  const [filters, setFilters] = useMeetingFilters();

  return (
    <CommandSelect
      placeholder="Status"
      className="h-9"
      options={options}
      onSelect={(value) => setFilters({ status: value as MeetingStatus })}
      value={filters.status ?? ""}
    />
  );
};
