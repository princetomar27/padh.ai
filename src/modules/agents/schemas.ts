import { z } from "zod";

export const agentIdSchema = z.object({
  agentId: z.string().min(1),
});

export const updateTutorAgentSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(200).optional(),
  instructions: z.string().min(10).max(50_000).optional(),
  voiceId: z
    .enum([
      "alloy",
      "ash",
      "ballad",
      "cedar",
      "coral",
      "echo",
      "marin",
      "sage",
      "shimmer",
      "verse",
      "fable",
      "onyx",
      "nova",
    ])
    .optional(),
  isActive: z.boolean().optional(),
});
