import twilio from "twilio";
import { callStore } from "./store";
import { CallArgs, StatusArgs, CancelArgs, TranscriptArgs } from "../mcp/tools";

const getTwilioClient = () => {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  
  if (!accountSid || !authToken) {
    throw new Error("Twilio credentials not configured");
  }
  
  return twilio(accountSid, authToken);
};

export async function placeOutboundCall(args: CallArgs): Promise<{ callId: string }> {
  const { to, from, goal, context, instructions, timeoutSec } = args;
  
  // Create call record in store
  const callId = callStore.create({
    to,
    from,
    goal,
    context,
    instructions,
  });

  // Store as active call for session manager to pick up
  callStore.setActiveCall(callId);
  callStore.update(callId, { state: "dialing" });

  try {
    // Get TwiML URL from environment
    const publicUrl = process.env.PUBLIC_URL;
    if (!publicUrl) {
      throw new Error("PUBLIC_URL not configured");
    }
    
    const twimlUrl = `${publicUrl}/twiml`;
    
    // Place the call via Twilio
    const client = getTwilioClient();
    const call = await client.calls.create({
      to,
      from,
      url: twimlUrl,
      method: "POST",
      statusCallback: `${publicUrl}/status`,
      statusCallbackMethod: "POST",
      statusCallbackEvent: ["initiated", "ringing", "answered", "completed"],
      timeout: timeoutSec,
      machineDetection: "DetectMessageEnd",
      asyncAmd: "true",
    });

    // Link Twilio SID to our call ID
    callStore.linkTwilioSid(callId, call.sid);
    
    // Set timeout to cancel call if it runs too long
    setTimeout(() => {
      const currentCall = callStore.get(callId);
      if (currentCall && ["dialing", "connected"].includes(currentCall.state)) {
        cancelCall({ callId }).catch(console.error);
      }
    }, timeoutSec * 1000);

    return { callId };
  } catch (error: any) {
    callStore.update(callId, { 
      state: "failed", 
      error: error.message,
      endedAt: Date.now(),
    });
    throw error;
  }
}

export async function getCallStatus(args: StatusArgs): Promise<any> {
  const { callId } = args;
  const call = callStore.get(callId);
  
  if (!call) {
    return { 
      state: "unknown", 
      error: "Call not found" 
    };
  }

  // If call is completed, return full result
  if (["completed", "failed", "canceled"].includes(call.state)) {
    return {
      state: call.state,
      duration: call.endedAt && call.startedAt ? 
        Math.round((call.endedAt - call.startedAt) / 1000) : 0,
      result: call.result,
      error: call.error,
      transcript: call.transcript,
    };
  }

  // For ongoing calls, return current state
  return {
    state: call.state,
    duration: Math.round((Date.now() - call.startedAt) / 1000),
    to: call.to,
    from: call.from,
  };
}

export async function cancelCall(args: CancelArgs): Promise<{ success: boolean; message: string }> {
  const { callId } = args;
  const call = callStore.get(callId);
  
  if (!call) {
    return { 
      success: false, 
      message: "Call not found" 
    };
  }

  if (!call.twilioSid) {
    callStore.update(callId, { 
      state: "canceled",
      endedAt: Date.now(),
    });
    return { 
      success: true, 
      message: "Call canceled before connecting" 
    };
  }

  try {
    const client = getTwilioClient();
    await client.calls(call.twilioSid).update({ 
      status: "completed" 
    });
    
    callStore.update(callId, { 
      state: "canceled",
      endedAt: Date.now(),
    });
    
    return { 
      success: true, 
      message: "Call canceled successfully" 
    };
  } catch (error: any) {
    return { 
      success: false, 
      message: `Failed to cancel call: ${error.message}` 
    };
  }
}

export async function getCallTranscript(args: TranscriptArgs): Promise<any> {
  const { callId } = args;
  const call = callStore.get(callId);
  
  if (!call) {
    return { 
      error: "Call not found" 
    };
  }

  if (!call.transcript || call.transcript.length === 0) {
    return {
      error: "No transcript available yet",
      state: call.state,
    };
  }

  return {
    callId,
    state: call.state,
    duration: call.endedAt && call.startedAt ? 
      Math.round((call.endedAt - call.startedAt) / 1000) : 0,
    transcript: call.transcript,
    result: call.result,
  };
}

// Helper function to update call status from Twilio webhook
export function updateCallStatusFromWebhook(twilioSid: string, status: string): void {
  const callId = callStore.getCallIdByTwilioSid(twilioSid);
  if (!callId) return;

  const stateMap: Record<string, any> = {
    "initiated": "dialing",
    "ringing": "dialing",
    "in-progress": "connected",
    "completed": "completed",
    "failed": "failed",
    "busy": "no_answer",
    "no-answer": "no_answer",
  };

  const newState = stateMap[status];
  if (newState) {
    const updates: any = { state: newState };
    
    if (newState === "connected") {
      updates.connectedAt = Date.now();
    } else if (["completed", "failed", "no_answer"].includes(newState)) {
      updates.endedAt = Date.now();
    }
    
    callStore.update(callId, updates);
  }
}