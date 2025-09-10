import { db } from "@/db";
import { agents, meetings, user } from "@/db/schema";
import { ingest } from "@/inngest/client";
import { MeetingStatus, StreamTranscriptItem } from "@/modules/meetings/types";
import { eq, inArray } from "drizzle-orm";
import JSONL from "jsonl-parse-stringify";
import { createAgent, openai, TextMessage } from "@inngest/agent-kit";

const summarizer = createAgent({
  name: "Summarizer",
  system: `You are an expert summarizer. You write readable, concise, simple content. You are given a transcript of a meeting and you need to summarize it.

Use the following markdown structure for every output:

### Overview
Provide a detailed, engaging summary of the session's content. Focus on major features, user workflows, and any key takeaways. Write in a narrative style, using full sentences. Highlight unique or powerful aspects of the product, platform, or discussion.

### Notes
Break down key content into thematic sections with timestamp ranges. Each section should summarize key points, actions, or demos in bullet format.

Example:
#### Section Name
- Main point or demo shown here
- Another key insight or interaction
- Follow-up tool or explanation provided

#### Next Section
- Feature X automatically does Y
- Mention of integration with Z`,
  model: openai({
    model: "gpt-4o",
    apiKey: process.env.OPEN_AI_API_KEY,
  }),
});

export const meetingsProcessing = ingest.createFunction(
  {
    id: "meetings/processing",
  },
  {
    event: "meetings/processing",
  },

  async ({ event, step }) => {
    const response = await step.run("fetch-transcript", async () => {
      return fetch(event.data.transcriptUrl).then((res) => res.text());
    });

    const transcript = await step.run("parse-transcript", async () => {
      return JSONL.parse<StreamTranscriptItem>(response);
    });

    const transcriptWithSpeakers = await step.run("add-speakers", async () => {
      const speakerIds = [
        ...new Set(transcript.map((item) => item.speaker_id)),
      ];

      // Get all user speakers
      const userSpeakers = await db
        .select()
        .from(user)
        .where(inArray(user.id, speakerIds))
        .then((users) =>
          users.map((user) => ({
            ...user,
          }))
        );

      const agentSpeakers = await db
        .select()
        .from(agents)
        .where(inArray(agents.id, speakerIds))
        .then((agents) =>
          agents.map((agent) => ({
            ...agent,
          }))
        );

      const speakers = [...userSpeakers, ...agentSpeakers];

      return transcript.map((item) => {
        const speaker = speakers.find(
          (speaker) => speaker.id === item.speaker_id
        );

        if (!speaker) {
          return {
            ...item,
            user: {
              name: "Unknown",
            },
          };
        }

        return {
          ...item,
          user: {
            name: speaker.name,
          },
        };
      });
    });

    // Convert transcript to readable format for summarization
    const readableTranscript = transcriptWithSpeakers
      .map((item) => `${item.user.name}: ${item.text}`)
      .join("\n");

    const { output } = await step.run("summarize-transcript", async () => {
      const summary = await summarizer.run(
        `Summarize the following meeting transcript:\n\n${readableTranscript}`
      );

      return summary;
    });

    await step.run("save-summary", async () => {
      console.log(`Output 0: ${(output[0] as TextMessage).content as string}`);
      await db
        .update(meetings)
        .set({
          summary: (output[0] as TextMessage).content as string,
          status: MeetingStatus.COMPLETED,
        })
        .where(eq(meetings.id, event.data.meetingId));
    });
  }
);
