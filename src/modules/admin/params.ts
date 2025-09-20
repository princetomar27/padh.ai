import {
  parseAsStringEnum,
  createLoader,
  parseAsInteger,
  parseAsString,
} from "nuqs/server";

const adminSearchParams = {
  dateRange: parseAsStringEnum(["7d", "30d", "90d", "1y"]).withDefault("30d"),
  includeAnalytics: parseAsStringEnum(["true", "false"]).withDefault("true"),
  includeRecentActivity: parseAsStringEnum(["true", "false"]).withDefault(
    "true"
  ),
};

const adminClassesSearchParams = {
  ...adminSearchParams,
  search: parseAsString.withDefault("").withOptions({ clearOnDefault: true }),
  page: parseAsInteger.withDefault(1),
  limit: parseAsInteger.withDefault(10),
};

export const adminLoadSearchParams = createLoader(adminSearchParams);
export const adminClassesLoadSearchParams = createLoader(adminClassesSearchParams);