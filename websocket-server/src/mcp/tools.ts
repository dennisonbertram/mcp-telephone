import { z } from "zod";

export const CallArgsSchema = z.object({
  to: z.string().describe("Phone number to call (E.164 format)"),
  from: z.string().describe("Phone number to call from (E.164 format)"),
  goal: z.string().describe("The objective of the call"),
  context: z.record(z.string(), z.any()).describe("Additional context for the call").optional(),
  instructions: z.string().describe("Specific instructions for the AI agent").optional(),
  timeoutSec: z.number().describe("Maximum call duration in seconds").default(180),
});

export const StatusArgsSchema = z.object({
  callId: z.string().describe("Call ID to check status for"),
});

export const CancelArgsSchema = z.object({
  callId: z.string().describe("Call ID to cancel"),
});

export const TranscriptArgsSchema = z.object({
  callId: z.string().describe("Call ID to get transcript for"),
});

export type CallArgs = z.infer<typeof CallArgsSchema>;
export type StatusArgs = z.infer<typeof StatusArgsSchema>;
export type CancelArgs = z.infer<typeof CancelArgsSchema>;
export type TranscriptArgs = z.infer<typeof TranscriptArgsSchema>;

export const tools = [
  {
    name: "telephony.call",
    description: "Place an outbound phone call using OpenAI Realtime and Twilio",
    inputSchema: {
      type: "object",
      properties: {
        to: { type: "string", description: "Phone number to call (E.164 format)" },
        from: { type: "string", description: "Phone number to call from (E.164 format)" },
        goal: { type: "string", description: "The objective of the call" },
        context: { type: "object", description: "Additional context for the call" },
        instructions: { type: "string", description: "Specific instructions for the AI agent" },
        timeoutSec: { type: "number", description: "Maximum call duration in seconds", default: 180 },
      },
      required: ["to", "from", "goal"],
    },
  },
  {
    name: "telephony.status",
    description: "Check the status of an ongoing or completed call",
    inputSchema: {
      type: "object",
      properties: {
        callId: { type: "string", description: "Call ID to check status for" },
      },
      required: ["callId"],
    },
  },
  {
    name: "telephony.cancel",
    description: "Cancel an ongoing call",
    inputSchema: {
      type: "object",
      properties: {
        callId: { type: "string", description: "Call ID to cancel" },
      },
      required: ["callId"],
    },
  },
  {
    name: "telephony.transcript",
    description: "Get the transcript of a completed call",
    inputSchema: {
      type: "object",
      properties: {
        callId: { type: "string", description: "Call ID to get transcript for" },
      },
      required: ["callId"],
    },
  },
];