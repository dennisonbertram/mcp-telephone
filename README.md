# MCP Telephone - AI Phone Calling Service

A Model Context Protocol (MCP) server that enables LLMs to make phone calls using OpenAI's Realtime API and Twilio. This project transforms the OpenAI Realtime + Twilio demo into a production-ready MCP telephony service that can be used by any MCP-compatible client like Claude Desktop or Cursor IDE.

<img width="1728" alt="Screenshot 2024-12-18 at 4 59 30 PM" src="https://github.com/user-attachments/assets/d3c8dcce-b339-410c-85ca-864a8e0fc326" />

## What is MCP?

The Model Context Protocol (MCP) is an open standard that enables seamless integration between LLMs and external data sources or tools. This project implements an MCP server that exposes telephony capabilities, allowing any MCP-compatible LLM to make and manage phone calls programmatically.

## Features

- **🤖 MCP Telephony Tools**: Four powerful tools for phone operations
  - `telephony.call` - Place outbound calls with AI agents
  - `telephony.status` - Check call progress in real-time
  - `telephony.cancel` - Terminate ongoing calls
  - `telephony.transcript` - Retrieve call transcripts
- **🔌 Multiple Transports**: HTTP and WebSocket support for MCP communication
- **📞 Twilio Integration**: Production-ready phone calling via Twilio
- **🎙️ OpenAI Realtime API**: Natural voice conversations with AI
- **📝 Call Management**: Track call states, goals, and results
- **🔒 Secure**: All credentials stored in environment variables

## Quick Setup

Open three terminal windows:

| Terminal | Purpose                       | Quick Reference (see below for more) |
| -------- | ----------------------------- | ------------------------------------ |
| 1        | To run the `webapp`           | `npm run dev`                        |
| 2        | To run the `websocket-server` | `npm run dev`                        |
| 3        | To run `ngrok`                | `ngrok http 8081`                    |

Make sure all vars in `webapp/.env` and `websocket-server/.env` are set correctly. See [full setup](#full-setup) section for more.

## Overview

This repo implements a phone calling assistant with the Realtime API and Twilio, and had two main parts: the `webapp`, and the `websocket-server`.

1. `webapp`: NextJS app to serve as a frontend for call configuration and transcripts
2. `websocket-server`: Express backend that handles connection from Twilio, connects it to the Realtime API, and forwards messages to the frontend
<img width="1514" alt="Screenshot 2024-12-20 at 10 32 40 AM" src="https://github.com/user-attachments/assets/61d39b88-4861-4b6f-bfe2-796957ab5476" />

Twilio uses TwiML (a form of XML) to specify how to handle a phone call. When a call comes in we tell Twilio to start a bi-directional stream to our backend, where we forward messages between the call and the Realtime API. (`{{WS_URL}}` is replaced with our websocket endpoint.)

```xml
<!-- TwiML to start a bi-directional stream-->

<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>Connected</Say>
  <Connect>
    <Stream url="{{WS_URL}}" />
  </Connect>
  <Say>Disconnected</Say>
</Response>
```

We use `ngrok` to make our server reachable by Twilio.

### Life of a phone call

Setup

1. We run ngrok to make our server reachable by Twilio
1. We set the Twilio webhook to our ngrok address
1. Frontend connects to the backend (`wss://[your_backend]/logs`), ready for a call

Call

1. Call is placed to Twilio-managed number
1. Twilio queries the webhook (`http://[your_backend]/twiml`) for TwiML instructions
1. Twilio opens a bi-directional stream to the backend (`wss://[your_backend]/call`)
1. The backend connects to the Realtime API, and starts forwarding messages:
   - between Twilio and the Realtime API
   - between the frontend and the Realtime API

### Function Calling

This demo mocks out function calls so you can provide sample responses. In reality you could handle the function call, execute some code, and then supply the response back to the model.

## Full Setup

1. Make sure your [auth & env](#detailed-auth--env) is configured correctly.

2. Run webapp.

```shell
cd webapp
npm install
npm run dev
```

3. Run websocket server.

```shell
cd websocket-server
npm install
npm run dev
```

## Detailed Auth & Env

### OpenAI & Twilio

Set your credentials in `webapp/.env` and `websocket-server` - see `webapp/.env.example` and `websocket-server.env.example` for reference.

### Ngrok

Twilio needs to be able to reach your websocket server. If you're running it locally, your ports are inaccessible by default. [ngrok](https://ngrok.com/) can make them temporarily accessible.

We have set the `websocket-server` to run on port `8081` by default, so that is the port we will be forwarding.

```shell
ngrok http 8081
```

Make note of the `Forwarding` URL. (e.g. `https://54c5-35-170-32-42.ngrok-free.app`)

### Websocket URL

Your server should now be accessible at the `Forwarding` URL when run, so set the `PUBLIC_URL` in `websocket-server/.env`. See `websocket-server/.env.example` for reference.

## Using MCP with Cursor IDE

### 1. Configure Cursor

Add the MCP server to your Cursor configuration file at `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "mcp-telephone": {
      "transport": {
        "type": "http",
        "url": "http://localhost:8081/mcp"
      }
    }
  }
}
```

For WebSocket transport instead:
```json
{
  "mcpServers": {
    "mcp-telephone": {
      "transport": {
        "type": "websocket",
        "url": "ws://localhost:8081/mcp/ws"
      }
    }
  }
}
```

### 2. Use MCP Tools in Cursor

Once configured, you can ask Cursor to make phone calls:

```
"Use the telephony.call tool to call +1234567890 and book a table for 2 at 7:30pm tonight at Restaurant Name. Be polite and professional."
```

The AI will use the MCP tools to:
1. Place the call
2. Have a natural conversation
3. Complete the requested task
4. Return the result

## MCP Tool Documentation

### telephony.call

Places an outbound phone call with an AI agent.

**Parameters:**
- `to` (string, required): Phone number to call (E.164 format, e.g., "+1234567890")
- `from` (string, required): Your Twilio phone number (E.164 format)
- `goal` (string, required): What the AI should accomplish on the call
- `context` (object, optional): Additional context for the AI
- `instructions` (string, optional): Specific behavioral instructions
- `timeoutSec` (number, optional): Maximum call duration in seconds (default: 180)

**Returns:**
- `callId`: Unique identifier for tracking the call

**Example:**
```json
{
  "to": "+14155551234",
  "from": "+13156303570",
  "goal": "Book a dinner reservation for 2 people",
  "context": {
    "restaurant": "Via Carota",
    "date": "Friday",
    "time": "7:30pm",
    "party_size": 2
  },
  "instructions": "Be polite and professional. If they ask for a name, say 'Smith'.",
  "timeoutSec": 120
}
```

### telephony.status

Checks the current status of a call.

**Parameters:**
- `callId` (string, required): The ID returned from telephony.call

**Returns:**
- `state`: Current call state ("dialing", "connected", "completed", "failed", "canceled")
- `duration`: Call duration in seconds
- `result`: Call outcome (if completed)
- `error`: Error message (if failed)

### telephony.cancel

Cancels an ongoing call.

**Parameters:**
- `callId` (string, required): The ID of the call to cancel

**Returns:**
- `success`: Boolean indicating if cancellation was successful
- `message`: Status message

### telephony.transcript

Retrieves the full transcript of a call.

**Parameters:**
- `callId` (string, required): The ID of the call

**Returns:**
- `transcript`: Array of conversation turns with timestamps
- `state`: Current call state
- `duration`: Total call duration
- `result`: Call outcome

## Testing MCP Endpoints

### List Available Tools
```bash
curl -X POST http://localhost:8081/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'
```

### Place a Test Call
```bash
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
        "goal":"Test the phone system",
        "context":{"test":true}
      }
    }
  }'
```

## Architecture

The MCP Telephone service consists of three main components:

1. **MCP Server** (`websocket-server/src/mcp/`)
   - Handles JSON-RPC 2.0 requests
   - Provides HTTP and WebSocket transports
   - Routes tool calls to appropriate services

2. **Call Management** (`websocket-server/src/svc/`)
   - Manages call state and lifecycle
   - Integrates with Twilio API
   - Tracks transcripts and results

3. **Session Bridge** (`websocket-server/src/sessionManager.ts`)
   - Connects Twilio ↔ OpenAI Realtime API
   - Injects call goals into AI prompts
   - Captures real-time transcripts

## Important Notes

### Twilio Trial Account Limitations
If using a Twilio trial account:
- Calls to unverified numbers will play a trial message first
- Recipients must press a key to continue
- For production use, upgrade to a paid Twilio account

### Security Considerations
- Never commit `.env` files or expose API keys
- Use environment variables for all credentials
- Implement authentication for production deployments
- Consider rate limiting for public endpoints

### Production Deployment
For production use:
1. Upgrade Twilio account from trial to paid
2. Implement proper authentication on MCP endpoints
3. Use persistent storage instead of in-memory store
4. Add monitoring and logging
5. Implement rate limiting
6. Use HTTPS/WSS for all connections

## Contributing

Contributions are welcome! Please ensure:
- No hardcoded credentials
- Tests for new features
- Documentation updates
- Follow existing code style

## License

MIT

## Acknowledgments

Built on top of the OpenAI Realtime API + Twilio demo. Enhanced with Model Context Protocol support for LLM integration.
