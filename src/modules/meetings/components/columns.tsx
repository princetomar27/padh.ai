"use client";

import { ColumnDef } from "@tanstack/react-table";
import { GeneratedAvatar } from "@/components/generated-avatar";
import {
  CircleCheckIcon,
  CircleXIcon,
  ClockArrowUpIcon,
  ClockFadingIcon,
  CornerDownRightIcon,
  LoaderIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { MeetingGetMany } from "../types";
import { format } from "date-fns";
import { cn, formatDuration } from "@/lib/utils";

const statusIconMap = {
  upcoming: ClockArrowUpIcon,
  active: LoaderIcon,
  completed: CircleCheckIcon,
  processing: LoaderIcon,
  cancelled: CircleXIcon,
};

const statusColorMap = {
  upcoming: "bg-yellow-500/20 text-yellow-800 border-yellow-800/5",
  active: "bg-blue-500/20 text-blue-800 border-blue-800/5",
  completed: "bg-green-500/20 text-green-800 border-green-800/5",
  processing: "bg-gray-500/20 text-gray-800 border-gray-800/5",
  cancelled: "bg-rose-500/20 text-rose-800 border-rose-800/5",
};

export const columns: ColumnDef<MeetingGetMany[number]>[] = [
  {
    accessorKey: "name",
    header: "Meeting Name",
    cell: ({ row }) => (
      <div className="flex flex-col gap-y-1">
        <span className="font-semibold capitalize">{row.original.name}</span>

        <div className="flex items-center gap-x-2">
          <CornerDownRightIcon className="size-3 text-muted-foreground" />
          <span className="text-xs text-muted-foreground max-w-[200px] truncate capitalize">
            {row.original.agent.name}
          </span>
          <GeneratedAvatar
            variant="bottsNeutral"
            seed={row.original.agent.name}
            className="size-4"
          />
        </div>

        <span className="text-xs text-muted-foreground">
          {row.original.startedAt
            ? format(row.original.startedAt, "MMM d")
            : ""}
        </span>
      </div>
    ),
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => {
      const status = row.original.status.toLowerCase();
      const Icon = statusIconMap[status as keyof typeof statusIconMap];

      // Fallback to Clock icon if status not found
      const IconComponent = Icon;

      return (
        <Badge
          variant="outline"
          className={cn(
            "capitalize [&>svg]:size-4 text-muted-foreground",
            statusColorMap[status as keyof typeof statusColorMap]
          )}
        >
          <IconComponent
            className={cn(status === "processing" && "animate-spin")}
          />
          {row.original.status}
        </Badge>
      );
    },
  },
  {
    accessorKey: "duration",
    header: "Duration",
    cell: ({ row }) => (
      <Badge
        variant="outline"
        className="capitalize [&>svg]:size-4 flex items-center gap-x-2"
      >
        <ClockFadingIcon className="text-blue-700" />
        {row.original.duration ? formatDuration(row.original.duration) : "N/A"}
      </Badge>
    ),
  },
];
