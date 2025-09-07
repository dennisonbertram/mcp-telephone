import { randomUUID } from "crypto";

export interface CallRecord {
  id: string;
  twilioSid?: string;
  state: "queued" | "dialing" | "connected" | "completed" | "failed" | "canceled" | "no_answer" | "voicemail";
  to: string;
  from: string;
  goal: string;
  context?: Record<string, any>;
  instructions?: string;
  startedAt: number;
  connectedAt?: number;
  endedAt?: number;
  transcript?: Array<{
    role: "user" | "assistant";
    content: string;
    timestamp: number;
  }>;
  result?: {
    status: "confirmed" | "failed" | "human_escalation" | "no_answer" | "voicemail";
    summary: string;
    entities?: Record<string, any>;
  };
  error?: string;
}

class CallStore {
  private calls: Map<string, CallRecord> = new Map();
  private twilioToCallId: Map<string, string> = new Map();
  private activeCallId: string | null = null;

  create(params: {
    to: string;
    from: string;
    goal: string;
    context?: Record<string, any>;
    instructions?: string;
  }): string {
    const callId = randomUUID();
    const record: CallRecord = {
      id: callId,
      state: "queued",
      to: params.to,
      from: params.from,
      goal: params.goal,
      context: params.context,
      instructions: params.instructions,
      startedAt: Date.now(),
      transcript: [],
    };
    
    this.calls.set(callId, record);
    return callId;
  }

  get(callId: string): CallRecord | undefined {
    return this.calls.get(callId);
  }

  update(callId: string, updates: Partial<CallRecord>): void {
    const record = this.calls.get(callId);
    if (record) {
      Object.assign(record, updates);
      this.calls.set(callId, record);
    }
  }

  linkTwilioSid(callId: string, twilioSid: string): void {
    const record = this.calls.get(callId);
    if (record) {
      record.twilioSid = twilioSid;
      this.twilioToCallId.set(twilioSid, callId);
      this.calls.set(callId, record);
    }
  }

  getTwilioSid(callId: string): string | undefined {
    return this.calls.get(callId)?.twilioSid;
  }

  getCallIdByTwilioSid(twilioSid: string): string | undefined {
    return this.twilioToCallId.get(twilioSid);
  }

  setActiveCall(callId: string | null): void {
    this.activeCallId = callId;
  }

  getActiveCall(): CallRecord | undefined {
    if (!this.activeCallId) return undefined;
    return this.calls.get(this.activeCallId);
  }

  getActiveCallId(): string | null {
    return this.activeCallId;
  }

  addTranscript(callId: string, role: "user" | "assistant", content: string): void {
    const record = this.calls.get(callId);
    if (record) {
      record.transcript = record.transcript || [];
      record.transcript.push({
        role,
        content,
        timestamp: Date.now(),
      });
      this.calls.set(callId, record);
    }
  }

  getAllCalls(): CallRecord[] {
    return Array.from(this.calls.values());
  }

  getCallsByState(state: CallRecord["state"]): CallRecord[] {
    return Array.from(this.calls.values()).filter((call) => call.state === state);
  }
}

export const callStore = new CallStore();