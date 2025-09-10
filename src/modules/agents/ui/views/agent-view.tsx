"use client";

import { ErrorState } from "@/components/error-state";
import { LoadingState } from "@/components/loading-state";
import { useTRPC } from "@/trpc/client";
import { useSuspenseQuery } from "@tanstack/react-query";
import { DataTable } from "@/components/data-table";
import { columns } from "../../components/columns";
import { EmptyState } from "@/components/empty-state";
import { useAgentFilters } from "../../hooks/use-agent-filters";
import { DataPagination } from "../../../../components/data-pagination";
import { useRouter } from "next/navigation";

export const AgentView = () => {
  const trpc = useTRPC();
  const router = useRouter();

  const [filters, setFilters] = useAgentFilters();
  const { data, isLoading, isError } = useSuspenseQuery(
    trpc.agents.getMany.queryOptions({
      ...filters,
    })
  );

  return (
    <div className=" flex-1 pb-4 px-4 md:px-8 flex-col gap-y-4">
      <DataTable
        columns={columns}
        data={data.items}
        onRowClick={(row) => router.push(`/agents/${row.id}`)}
      />
      <DataPagination
        page={filters.page}
        totalPages={data.totalPages}
        onPageChange={(page) => setFilters({ page })}
      />
      {data.items.length === 0 && (
        <EmptyState
          title="Create your first agent"
          description="Create an agent to connect to your meetings.\nEach agent will follow your instructions and can interact with participants during the call."
        />
      )}
      {isLoading && <AgentViewLoading />}
      {isError && <AgentViewError />}
    </div>
  );
};

export const AgentViewLoading = () => {
  return (
    <LoadingState
      title="Loading Agents"
      description="Please wait while we load the agents"
    />
  );
};

export const AgentViewError = () => {
  return (
    <ErrorState
      title="Error Loading Agents"
      description="Please try again later"
    />
  );
};
