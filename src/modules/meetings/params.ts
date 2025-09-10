import { DEFAULT_PAGE } from "@/constants";
import {
  createLoader,
  parseAsInteger,
  parseAsString,
  parseAsStringEnum,
} from "nuqs/server";
import { MeetingStatus } from "./types";

// Define the search params for the agents page
export const meetingsFilterSearchParams = {
  search: parseAsString.withDefault("").withOptions({ clearOnDefault: true }),
  page: parseAsInteger
    .withDefault(DEFAULT_PAGE)
    .withOptions({ clearOnDefault: true }),
  status: parseAsStringEnum(Object.values(MeetingStatus)),
  agentId: parseAsString.withDefault("").withOptions({ clearOnDefault: true }),
};

// Create a loader for the search params
export const meetingsLoadSearchParams = createLoader(
  meetingsFilterSearchParams
);
