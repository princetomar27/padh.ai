import "server-only";
import { StreamClient } from "@stream-io/node-sdk";

const apiKey = process.env.NEXT_PUBLIC_STREAM_VIDEO_API_KEY;
const secret = process.env.STREAM_SECRET_KEY;

if (!apiKey || !secret) {
  throw new Error("Stream Video env vars are not set");
}

export const streamVideo = new StreamClient(apiKey, secret);
