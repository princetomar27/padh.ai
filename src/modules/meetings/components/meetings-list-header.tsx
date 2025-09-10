"use client";

import { Button } from "@/components/ui/button";
import { PlusIcon, XCircleIcon } from "lucide-react";
import { useState } from "react";
import { NewMeetingDialog } from "./new-meeting-dialog";
import { MeetingSearchFilter } from "./meeting-search-filter";
import { StatusFilter } from "./status-filters";
import { AgentIdFilter } from "./agent-id-filter";
import { useMeetingFilters } from "../hooks/use-meeting-filters";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";

export const MeetingsListHeader = () => {
  const [isMeetingDialogOpen, setIsMeetingDialogOpen] = useState(false);
  const [filters, setFilters] = useMeetingFilters();

  const isFiltersActive =
    !!filters.status || !!filters.agentId || !!filters.search;

  const handleClearFilters = () => {
    setFilters({
      status: null,
      agentId: "",
      search: "",
    });
  };

  return (
    <>
      <NewMeetingDialog
        open={isMeetingDialogOpen}
        onOpenChange={setIsMeetingDialogOpen}
      />
      <div className="py-4 px-4 md:px-8 flex flex-col gap-y-4">
        <div className="flex items-center justify-between">
          <h5 className="font-medium text-lg">My Meetings</h5>
          <Button
            onClick={() => {
              setIsMeetingDialogOpen(true);
            }}
          >
            <PlusIcon />
            New Meeting
          </Button>
        </div>
      </div>
      <ScrollArea>
        <div className=" flex items-center gap-x-2 p-2 px-8 ">
          <MeetingSearchFilter />
          <StatusFilter />
          <AgentIdFilter />
          {isFiltersActive && (
            <Button variant="outline" size="sm" onClick={handleClearFilters}>
              <XCircleIcon /> Clear Filters
            </Button>
          )}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </>
  );
};
