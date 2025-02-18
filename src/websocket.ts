import { WebSocketServer, WebSocket } from "ws";
import { Pool } from "pg";
import { Server } from "http";
import dotenv from "dotenv";
import { MessageType } from "./types";

dotenv.config();

export interface Message {
    type: MessageType;
    roomId?: string;
    userId?: string;
    content?: string;
    message?: {
        id: string;
        room_id: string;
        user_id: string;
        username: string;
        content: string;
        timestamp: string;
    };
    room?: {
        id: string;
        name: string;
        latitude: number;
        longitude: number;
        creatorId: string;
        creatorUsername: string;
    };
    username?: string;
    timestamp?: string;
}

export const connections = new Map<string, Set<WebSocket>>();
export const userRooms = new Map<string, Set<string>>();

export const setupWebSocket = (server: Server, pool: Pool) => {
    const wss = new WebSocketServer({ server });

    wss.on("connection", (ws: WebSocket) => {
        console.log("Client connected");

        ws.on("message", async (data: string) => {
            try {
                const message = JSON.parse(data);
                if (message.type === 'CHAT') {
                    // Save message to database
                    const result = await pool.query(
                        `INSERT INTO messages (room_id, user_id, content) 
                         VALUES ($1, $2, $3) 
                         RETURNING id, created_at`,
                        [message.roomId, message.userId, message.text]
                    );

                    // Get user info
                    const userResult = await pool.query(
                        'SELECT username FROM users WHERE id = $1',
                        [message.userId]
                    );

                    const messageData = {
                        id: result.rows[0].id,
                        text: message.text,
                        userId: message.userId,
                        username: userResult.rows[0].username,
                        timestamp: result.rows[0].created_at
                    };

                    // Broadcast to all clients in room EXCEPT sender
                    const roomClients = connections.get(message.roomId) || new Set();
                    roomClients.forEach((client) => {
                        if (client !== ws && client.readyState === WebSocket.OPEN) {  // Don't send to self
                            client.send(JSON.stringify({
                                type: 'MESSAGE',
                                ...messageData
                            }));
                        }
                    });
                }
            } catch (error) {
                console.error('Error handling message:', error);
            }
        });

        ws.on("close", () => {
            console.log("Client disconnected");
            connections.forEach((clients, roomId) => {
                if (clients.has(ws)) {
                    clients.delete(ws);
                    if (clients.size === 0) {
                        connections.delete(roomId);
                    }
                }
            });
        });
    });

    console.log("WebSocket server running and attached to Express server.");
};