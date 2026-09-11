// Repair only classification metadata for one explicitly selected meeting.
// Original text, provider speaker, timestamps, memory and responses are untouched.
import nextEnv from "@next/env";
import mongoose from "mongoose";
import { classifyTranscriptSource } from "../src/lib/meeting-transcript-source.ts";

const id = process.argv[2];
if (!/^[0-9a-f]{24}$/iu.test(id || "")) throw new Error("Usage: node scripts/annotate-transcript-echoes.mjs MEETING_ID [--apply]");
nextEnv.loadEnvConfig(process.cwd());
if (!process.env.MONGODB_URI) throw new Error("Database is not configured");
try {
  await mongoose.connect(process.env.MONGODB_URI, {
    ...(process.env.MONGODB_DB_NAME ? { dbName: process.env.MONGODB_DB_NAME } : {}),
    serverSelectionTimeoutMS: 10_000,
  });
  const collection = mongoose.connection.collection("meetings");
  const meeting = await collection.findOne({ _id: new mongoose.Types.ObjectId(id) }, {
    projection: { transcript: 1, commandHistory: 1, "assistant.wakeWord": 1,
      "bot.outputSpeechCommandId": 1, "bot.outputSpeechState": 1, "bot.outputSpeechUpdatedAt": 1 },
  });
  if (!meeting) throw new Error("Selected meeting not found");
  const counts = { avatar: 0, suspected_echo: 0, applied: 0 };
  for (const segment of meeting.transcript) {
    if (segment.source) continue;
    const classification = classifyTranscriptSource(meeting, segment);
    if (classification.source === "participant") continue;
    counts[classification.source]++;
    if (process.argv.includes("--apply")) {
      const match = { sequence: segment.sequence, speakerName: segment.speakerName,
        text: segment.text, createdAt: segment.createdAt, source: { $exists: false } };
      const result = await collection.updateOne({ _id: meeting._id, transcript: { $elemMatch: match } }, { $set: {
        "transcript.$.source": classification.source,
        ...(classification.echoCommandId ? { "transcript.$.echoCommandId": classification.echoCommandId } : {}),
      } });
      counts.applied += result.modifiedCount;
    }
  }
  console.log(JSON.stringify({ mode: process.argv.includes("--apply") ? "apply" : "dry-run", ...counts }));
} finally {
  await mongoose.disconnect();
}
