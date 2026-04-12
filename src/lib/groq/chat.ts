import "server-only";

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

export function groqConfigured(): boolean {
  return Boolean(process.env.GROQ_API_KEY?.trim());
}

export function getGroqChatModel(): string {
  return (
    process.env.GROQ_CHAT_MODEL?.trim() ||
    "meta-llama/llama-4-scout-17b-16e-instruct"
  );
}

export async function groqChatCompletion(opts: {
  messages: { role: "system" | "user" | "assistant"; content: string }[];
  responseFormatJson?: boolean;
  maxTokens?: number;
}): Promise<string> {
  const key = process.env.GROQ_API_KEY?.trim();
  if (!key) {
    throw new Error("GROQ_API_KEY is not set");
  }

  const body: Record<string, unknown> = {
    model: getGroqChatModel(),
    messages: opts.messages,
    max_tokens: opts.maxTokens ?? 2048,
  };

  if (opts.responseFormatJson) {
    body.response_format = { type: "json_object" };
  }

  const res = await fetch(GROQ_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Groq chat failed (${res.status}): ${t.slice(0, 500)}`);
  }

  const data = (await res.json()) as {
    choices?: { message?: { content?: string | null } }[];
  };
  const text = data.choices?.[0]?.message?.content;
  if (typeof text !== "string" || !text.trim()) {
    throw new Error("Groq returned empty content");
  }
  return text;
}
