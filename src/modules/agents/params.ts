import { DEFAULT_PAGE } from "@/constants";
import { createLoader, parseAsInteger, parseAsString } from "nuqs/server";

// Define the search params for the agents page
export const agentsFilterSearchParams = {
  search: parseAsString.withDefault("").withOptions({ clearOnDefault: true }),
  page: parseAsInteger
    .withDefault(DEFAULT_PAGE)
    .withOptions({ clearOnDefault: true }),
};

// Create a loader for the search params
export const agentsLoadSearchParams = createLoader(agentsFilterSearchParams);
