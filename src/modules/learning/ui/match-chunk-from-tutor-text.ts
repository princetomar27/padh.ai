/** Used to infer which textbook segment the tutor is discussing from recent spoken text. */

export type ChunkForMatch = {
  id: string;
  orderInChapter: number;
  speakText: string | null;
  text: string | null;
};

function normalize(s: string): string {
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}

function chunkBody(c: ChunkForMatch): string {
  return (c.speakText ?? c.text ?? "").trim();
}

/**
 * Score how well `recentTutorText` matches this chunk (word overlap on chunk tokens).
 */
export function scoreChunkAgainstTutorWindow(
  recentTutorText: string,
  chunk: ChunkForMatch,
): number {
  const window = normalize(recentTutorText);
  if (window.length < 12) return 0;
  const body = normalize(chunkBody(chunk));
  if (body.length < 8) return 0;

  const tokens = body
    .split(" ")
    .filter((t) => t.length >= 4)
    .slice(0, 50);
  if (tokens.length === 0) return 0;

  let score = 0;
  for (const t of tokens) {
    if (window.includes(t)) score += Math.min(t.length, 12);
  }
  return score;
}

export function findBestChunkIndexForTutorSpeech(
  chunks: ChunkForMatch[],
  recentTutorText: string,
  opts?: { minScore?: number },
): number {
  const minScore = opts?.minScore ?? 18;
  if (!chunks.length || recentTutorText.length < 24) return -1;

  const window = recentTutorText.slice(-2000);
  let bestIdx = -1;
  let bestScore = 0;
  let second = 0;

  for (let i = 0; i < chunks.length; i++) {
    const s = scoreChunkAgainstTutorWindow(window, chunks[i]!);
    if (s > bestScore) {
      second = bestScore;
      bestScore = s;
      bestIdx = i;
    } else if (s > second) {
      second = s;
    }
  }

  if (bestIdx < 0 || bestScore < minScore) return -1;
  if (bestScore < second * 1.15 && second > 0) return -1;
  return bestIdx;
}
