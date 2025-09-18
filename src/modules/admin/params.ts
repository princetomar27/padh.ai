import { parseAsStringEnum, createLoader } from "nuqs/server";

const adminSearchParams = {
  dateRange: parseAsStringEnum(["7d", "30d", "90d", "1y"]).withDefault("30d"),
  includeAnalytics: parseAsStringEnum(["true", "false"]).withDefault("true"),
  includeRecentActivity: parseAsStringEnum(["true", "false"]).withDefault(
    "true"
  ),
};

export const adminLoadSearchParams = createLoader(adminSearchParams);
