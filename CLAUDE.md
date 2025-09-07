# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### WebApp (NextJS Frontend)
```bash
cd webapp
npm install
npm run dev    # Start development server on default port 3000
npm run build  # Build for production
npm run lint   # Run linting
```

### WebSocket Server (Express Backend)
```bash
cd websocket-server
npm install
npm run dev    # Start development server on port 8081 with auto-reload
npm run build  # Compile TypeScript to dist/
npm start      # Run compiled production build
```

### Ngrok Setup
```bash
ngrok http 8081  # Required to make websocket-server reachable by Twilio
```

## Architecture Overview

This application implements a phone calling assistant using OpenAI's Realtime API and Twilio:

### Core Components

1. **webapp/** - NextJS frontend that provides:
   - Call configuration interface
   - Real-time transcript display
   - Function call management panel
   - Twilio phone number configuration

2. **websocket-server/** - Express backend handling:
   - Twilio webhook endpoints (`/twiml`)
   - WebSocket connections for Twilio calls (`/call`)
   - WebSocket connections for frontend logs (`/logs`)
   - OpenAI Realtime API integration
   - Message forwarding between Twilio ↔ OpenAI ↔ Frontend

### Key Flow

1. Frontend connects to backend via WebSocket (`ws://localhost:8081/logs`)
2. When call arrives at Twilio number, Twilio requests TwiML instructions from `/twiml`
3. Backend returns TwiML that opens bidirectional stream to `/call` WebSocket
4. Backend establishes connection to OpenAI Realtime API
5. Backend forwards messages between all three connections (Twilio, OpenAI, Frontend)

### Session Management

The backend maintains a single global session (`sessionManager.ts`) that tracks:
- Active Twilio connection
- Active frontend connection  
- OpenAI WebSocket connection
- Stream metadata and timing information

Only one active call is supported at a time - new connections close existing ones.

### Environment Configuration

**webapp/.env**
- `TWILIO_ACCOUNT_SID` - Twilio account identifier
- `TWILIO_AUTH_TOKEN` - Twilio authentication token

**websocket-server/.env**
- `OPENAI_API_KEY` - Required for Realtime API connection
- `PUBLIC_URL` - Public ngrok URL (e.g., `https://abc123.ngrok-free.app`)

## Key Implementation Details

- WebSocket server runs on port 8081 by default
- Frontend expects backend at `ws://localhost:8081`
- Twilio webhook must point to public ngrok URL + `/twiml`
- Function calls are mocked - responses can be configured in frontend UI
- Single active call limitation - new calls terminate existing ones