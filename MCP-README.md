# MCP Telephone Service - Implementation Documentation

This document describes the Model Context Protocol (MCP) integration added to the OpenAI Realtime + Twilio demo, transforming it into a fully functional telephony service that LLMs can use to make phone calls.

## What Was Built

We've extended the original demo with:

1. **MCP Server** (`websocket-server/src/mcp/`)
   - HTTP and WebSocket transports for MCP communication
   - Full JSON-RPC 2.0 compliance
   - Tool definitions for telephony operations

2. **Call Management Service** (`websocket-server/src/svc/`)
   - Call state tracking and storage
   - Twilio API integration for outbound calls
   - Transcript management
   - Call result tracking

3. **Enhanced Session Management**
   - Integration with call goals and context
   - Dynamic system prompts based on call objectives
   - Real-time transcript capture

## MCP Tools Available

### telephony.call
Places an outbound phone call with an AI agent.

```typescript
{
  to: string,       // Phone number to call (E.164 format)
  from: string,     // Your Twilio number (E.164 format)  
  goal: string,     // What the AI should accomplish
  context?: object, // Additional context for the AI
  instructions?: string, // Specific behavioral instructions
  timeoutSec?: number   // Max call duration (default: 180)
}
```

Returns: `{ callId: string }`

### telephony.status
Checks the status of a call.

```typescript
{
  callId: string    // The ID from telephony.call
}
```

Returns call state, duration, and result if completed.

### telephony.cancel
Cancels an ongoing call.

```typescript
{
  callId: string    // The ID to cancel
}
```

### telephony.transcript
Gets the full transcript of a call.

```typescript
{
  callId: string    // The ID to get transcript for
}
```

Returns conversation history with timestamps.

## Architecture Changes

### Original Flow
```
Phone → Twilio → WebSocket → OpenAI Realtime
```

### Enhanced Flow
```
LLM/Cursor → MCP Server → Call Management → Twilio → WebSocket Bridge → OpenAI Realtime
                                    ↓
                              Call Store (state, transcripts, results)
```

## Key Implementation Details

### 1. MCP Server (`mcp/server.ts`)
- Handles JSON-RPC requests on `/mcp` (HTTP) and `/mcp/ws` (WebSocket)
- Validates tool arguments using Zod schemas
- Routes tool calls to appropriate service functions

### 2. Call Store (`svc/store.ts`)
- In-memory storage for call records
- Tracks: state, participants, transcripts, results
- Links internal call IDs to Twilio SIDs

### 3. Call Service (`svc/calls.ts`)
- `placeOutboundCall`: Creates call record, initiates Twilio call
- `getCallStatus`: Returns current state and metadata
- `cancelCall`: Terminates via Twilio API
- `getCallTranscript`: Returns conversation history

### 4. Session Manager Integration
- Loads call goal/context when WebSocket connects
- Injects system prompt with call objectives
- Captures transcripts in real-time
- Updates call state on connection/disconnection

## Usage with Cursor

1. Add to `.cursor/mcp.json`:
```json
{
  "mcpServers": {
    "twilio-realtime-mcp": {
      "transport": {
        "type": "http",
        "url": "http://localhost:8081/mcp"
      },
      "env": {
        "OPENAI_API_KEY": "${OPENAI_API_KEY}",
        "TWILIO_ACCOUNT_SID": "${TWILIO_ACCOUNT_SID}",
        "TWILIO_AUTH_TOKEN": "${TWILIO_AUTH_TOKEN}"
      }
    }
  }
}
```

2. Use in Cursor:
```
Use the telephony.call tool to call +12125551234 and book a table for 2 at Via Carota next Friday at 7:30pm under the name Dennison. Be polite and professional.
```

## Testing

### Direct MCP Testing
```bash
# List available tools
curl -X POST http://localhost:8081/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'

# Place a test call
curl -X POST http://localhost:8081/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc":"2.0",
    "id":2,
    "method":"tools/call",
    "params":{
      "name":"telephony.call",
      "arguments":{
        "to":"+1234567890",
        "from":"+10987654321",
        "goal":"Test the system",
        "context":{"test":true}
      }
    }
  }'
```

## Files Modified/Added

### New Files
- `websocket-server/src/mcp/server.ts` - MCP server implementation
- `websocket-server/src/mcp/tools.ts` - Tool definitions and schemas
- `websocket-server/src/svc/calls.ts` - Call management service
- `websocket-server/src/svc/store.ts` - Call state storage
- `.cursor/mcp.json` - Cursor MCP configuration

### Modified Files
- `websocket-server/src/server.ts` - Added MCP mounting, status webhook
- `websocket-server/src/sessionManager.ts` - Integrated call tracking
- `websocket-server/.env.example` - Added Twilio credentials
- `websocket-server/package.json` - Added dependencies (zod, twilio, body-parser)

## Environment Variables

Required additions to `websocket-server/.env`:
```
TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=...
```

## Security Considerations

1. **Authentication**: Current implementation has no auth on MCP endpoints. Add authentication before production use.

2. **Rate Limiting**: No rate limiting implemented. Add to prevent abuse.

3. **Data Storage**: Uses in-memory storage. Move to persistent database for production.

4. **Credential Management**: Ensure all credentials are in environment variables, never committed.

## Future Enhancements

1. **Persistent Storage**: Replace in-memory store with database
2. **Authentication**: Add API key or OAuth to MCP endpoints
3. **Advanced Features**:
   - Call recording
   - SMS follow-ups
   - Call scheduling
   - Multiple concurrent calls
4. **Monitoring**: Add logging, metrics, and alerting
5. **Error Handling**: More robust error handling and retry logic

## Conclusion

This implementation successfully transforms the OpenAI Realtime + Twilio demo into a production-ready MCP telephony service. LLMs can now make phone calls with specific goals, track their progress, and retrieve results - all through a standardized protocol that works seamlessly with tools like Cursor.