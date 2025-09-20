import {
  parseAsInteger,
  parseAsString,
  parseAsStringEnum,
  createLoader,
} from "nuqs/server";
import { DEFAULT_PAGE } from "@/constants";

const classesSearchParams = {
  search: parseAsString.withDefault("").withOptions({ clearOnDefault: true }),
  page: parseAsInteger
    .withDefault(DEFAULT_PAGE)
    .withOptions({ clearOnDefault: true }),
  classNumber: parseAsInteger.withOptions({ clearOnDefault: true }),
  isActive: parseAsStringEnum(["true", "false"]).withOptions({
    clearOnDefault: true,
  }),
};

export const classesLoadSearchParams = createLoader(classesSearchParams);
