import { parseAsStringEnum, useQueryStates } from "nuqs";

export const useAdminFilters = () => {
  return useQueryStates({
    dateRange: parseAsStringEnum(["7d", "30d", "90d", "1y"])
      .withDefault("30d")
      .withOptions({ clearOnDefault: true }),
    includeAnalytics: parseAsStringEnum(["true", "false"])
      .withDefault("true")
      .withOptions({ clearOnDefault: true }),
    includeRecentActivity: parseAsStringEnum(["true", "false"])
      .withDefault("true")
      .withOptions({ clearOnDefault: true }),
  });
};
