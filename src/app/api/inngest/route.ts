import { serve } from "inngest/next";
import { ingest } from "@/inngest/client";
import { meetingsProcessing } from "@/inngest/functions";

// Create an API that serves zero functions
export const { GET, POST, PUT } = serve({
  client: ingest,
  functions: [meetingsProcessing],
});
