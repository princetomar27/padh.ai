import { serve } from "inngest/next";
import { ingest } from "@/inngest/client";
import { inngestFunctions } from "@/inngest/functions";

export const runtime = "nodejs";

export const { GET, POST, PUT } = serve({
  client: ingest,
  functions: inngestFunctions,
});
