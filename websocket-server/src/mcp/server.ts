import express from "express";
import bodyParser from "body-parser";
import { WebSocketServer, WebSocket } from "ws";
import { randomUUID } from "crypto";
import { Server } from "http";
import { 
  CallArgsSchema, 
  StatusArgsSchema, 
  CancelArgsSchema, 
  TranscriptArgsSchema,
  tools 
} from "./tools";
import { 
  placeOutboundCall, 
  getCallStatus, 
  cancelCall, 
  getCallTranscript 
} from "../svc/calls";

interface JsonRpcRequest {
  jsonrpc: "2.0";
  id: string | number;
  method: string;
  params?: any;
}

interface JsonRpcResponse {
  jsonrpc: "2.0";
  id: string | number;
  result?: any;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
}

export function mountMcp(app: express.Express, server: Server) {
  // Add body parser for JSON-RPC
  app.use("/mcp", bodyParser.json());

  // HTTP JSON-RPC endpoint
  app.post("/mcp", async (req, res) => {
    const request = req.body as JsonRpcRequest;
    const response: JsonRpcResponse = {
      jsonrpc: "2.0",
      id: request.id,
    };

    try {
      switch (request.method) {
        case "initialize":
          response.result = {
            protocolVersion: "2024-11-05",
            capabilities: {
              tools: {},
            },
            serverInfo: {
              name: "twilio-realtime-mcp",
              version: "1.0.0",
            },
          };
          break;

        case "tools/list":
          response.result = { tools };
          break;

        case "tools/call":
          const toolName = request.params?.name;
          const toolArgs = request.params?.arguments || {};

          if (toolName === "telephony.call") {
            const args = CallArgsSchema.parse(toolArgs);
            const result = await placeOutboundCall(args);
            response.result = {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(result),
                },
              ],
            };
          } else if (toolName === "telephony.status") {
            const args = StatusArgsSchema.parse(toolArgs);
            const result = await getCallStatus(args);
            response.result = {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(result),
                },
              ],
            };
          } else if (toolName === "telephony.cancel") {
            const args = CancelArgsSchema.parse(toolArgs);
            const result = await cancelCall(args);
            response.result = {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(result),
                },
              ],
            };
          } else if (toolName === "telephony.transcript") {
            const args = TranscriptArgsSchema.parse(toolArgs);
            const result = await getCallTranscript(args);
            response.result = {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(result),
                },
              ],
            };
          } else {
            throw new Error(`Unknown tool: ${toolName}`);
          }
          break;

        default:
          response.error = {
            code: -32601,
            message: "Method not found",
          };
      }
    } catch (error: any) {
      console.error("MCP error:", error);
      response.error = {
        code: -32000,
        message: error.message || "Internal error",
        data: error.stack,
      };
    }

    res.json(response);
  });

  // WebSocket JSON-RPC endpoint
  const wss = new WebSocketServer({ server, path: "/mcp/ws" });

  wss.on("connection", (ws: WebSocket) => {
    console.log("MCP WebSocket connection established");

    // Send welcome message
    ws.send(JSON.stringify({
      jsonrpc: "2.0",
      method: "notification/initialized",
      params: {
        serverInfo: {
          name: "twilio-realtime-mcp",
          version: "1.0.0",
        },
      },
    }));

    ws.on("message", async (data) => {
      try {
        const request = JSON.parse(data.toString()) as JsonRpcRequest;
        const response: JsonRpcResponse = {
          jsonrpc: "2.0",
          id: request.id,
        };

        switch (request.method) {
          case "initialize":
            response.result = {
              protocolVersion: "2024-11-05",
              capabilities: {
                tools: {},
              },
              serverInfo: {
                name: "twilio-realtime-mcp",
                version: "1.0.0",
              },
            };
            break;

          case "tools/list":
            response.result = { tools };
            break;

          case "tools/call":
            const toolName = request.params?.name;
            const toolArgs = request.params?.arguments || {};

            if (toolName === "telephony.call") {
              const args = CallArgsSchema.parse(toolArgs);
              const result = await placeOutboundCall(args);
              response.result = {
                content: [
                  {
                    type: "text",
                    text: JSON.stringify(result),
                  },
                ],
              };
            } else if (toolName === "telephony.status") {
              const args = StatusArgsSchema.parse(toolArgs);
              const result = await getCallStatus(args);
              response.result = {
                content: [
                  {
                    type: "text",
                    text: JSON.stringify(result),
                  },
                ],
              };
            } else if (toolName === "telephony.cancel") {
              const args = CancelArgsSchema.parse(toolArgs);
              const result = await cancelCall(args);
              response.result = {
                content: [
                  {
                    type: "text",
                    text: JSON.stringify(result),
                  },
                ],
              };
            } else if (toolName === "telephony.transcript") {
              const args = TranscriptArgsSchema.parse(toolArgs);
              const result = await getCallTranscript(args);
              response.result = {
                content: [
                  {
                    type: "text",
                    text: JSON.stringify(result),
                  },
                ],
              };
            } else {
              throw new Error(`Unknown tool: ${toolName}`);
            }
            break;

          default:
            response.error = {
              code: -32601,
              message: "Method not found",
            };
        }

        ws.send(JSON.stringify(response));
      } catch (error: any) {
        console.error("MCP WebSocket error:", error);
        const errorResponse: JsonRpcResponse = {
          jsonrpc: "2.0",
          id: 0,
          error: {
            code: -32000,
            message: error.message || "Internal error",
          },
        };
        ws.send(JSON.stringify(errorResponse));
      }
    });

    ws.on("close", () => {
      console.log("MCP WebSocket connection closed");
    });

    ws.on("error", (error) => {
      console.error("MCP WebSocket error:", error);
    });
  });

  console.log("MCP server mounted at /mcp (HTTP) and /mcp/ws (WebSocket)");
}