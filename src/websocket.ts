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

        ws.on("message", async (message) => {
            try {
                const data = JSON.parse(message.toString());

                switch (data.type) {
                    case MessageType.CREATE_ROOM:
                        if (data.name && data.latitude && data.longitude && data.userId) {
                            try {
                                const client = await pool.connect();
                                try {
                                    await client.query('BEGIN');

                                    // Get creator's info
                                    const creatorResult = await client.query(
                                        'SELECT username FROM users WHERE id = $1',
                                        [data.userId]
                                    );
                                    const creatorUsername = creatorResult.rows[0]?.username;

                                    // Create the room
                                    const roomResult = await client.query(
                                        `INSERT INTO rooms (name, latitude, longitude, creator_id) 
                                         VALUES ($1, $2, $3, $4) 
                                         RETURNING id, name, latitude, longitude, creator_id, created_at`,
                                        [data.name, data.latitude, data.longitude, data.userId]
                                    );
                                    
                                    const newRoom = roomResult.rows[0];

                                    // Add creator to user_rooms
                                    await client.query(
                                        `INSERT INTO user_rooms (user_id, room_id) 
                                         VALUES ($1, $2)`,
                                        [data.userId, newRoom.id]
                                    );

                                    // Find users within 100km radius
                                    const nearbyUsers = await client.query(
                                        `SELECT id 
                                         FROM users 
                                         WHERE (6371 * acos(cos(radians($1)) * cos(radians(latitude)) * 
                    cos(radians(longitude) - radians($2)) + 
                                               sin(radians($1)) * sin(radians(latitude)))) <= 100`,
                                        [data.latitude, data.longitude]
                                    );

                                    await client.query('COMMIT');

                                    // Create room notification message
                                    const roomCreatedMessage = {
                                        type: MessageType.ROOM_CREATED,
                                        room: {
                                            id: newRoom.id,
                                            name: newRoom.name,
                                            latitude: newRoom.latitude,
                                            longitude: newRoom.longitude,
                                            creatorId: newRoom.creator_id,
                                            creatorUsername: creatorUsername,
                                            isJoined: true  // Set to true for creator
                                        }
                                    };

                                    // Send to creator first
                                    ws.send(JSON.stringify(roomCreatedMessage));

                                    // Then send to all nearby users (except creator)
                                    nearbyUsers.rows.forEach(user => {
                                        if (user.id !== data.userId) {  // Skip creator
                                            const userConnections = connections.get(user.id);
                                            if (userConnections) {
                                                userConnections.forEach(conn => {
                                                    conn.send(JSON.stringify({
                                                        ...roomCreatedMessage,
                                                        room: { ...roomCreatedMessage.room, isJoined: false }
                                                    }));
                                                });
                                            }
                                        }
                                    });

                                    // Update connection maps for the creator
                                    if (!userRooms.has(data.userId)) {
                                        userRooms.set(data.userId, new Set());
                                    }
                                    userRooms.get(data.userId)?.add(newRoom.id);

                                    if (!connections.has(newRoom.id)) {
                                        connections.set(newRoom.id, new Set());
                                    }
                                    connections.get(newRoom.id)?.add(ws);

    } catch (error) {
                                    await client.query('ROLLBACK');
        throw error;
                                } finally {
                                    client.release();
                                }
    } catch (error) {
                                console.error('Error creating room:', error);
                                ws.send(JSON.stringify({
                                    type: MessageType.ERROR,
                                    message: 'Failed to create room'
                                }));
                            }
                        } else {
                            ws.send(JSON.stringify({
                                type: MessageType.ERROR,
                                message: 'Missing required fields for room creation'
                            }));
                        }
                        break;

                    case MessageType.SEND_MESSAGE:
                        if (data.roomId && data.content && data.userId) {
                            try {
                                const userResult = await pool.query(
                                    'SELECT username FROM users WHERE id = $1',
                                    [data.userId]
                                );
                                const username = userResult.rows[0]?.username;

                            const result = await pool.query(
                                    `INSERT INTO messages (room_id, user_id, content, created_at) 
                                     VALUES ($1, $2, $3, NOW()) 
                                     RETURNING id, room_id, user_id, content, created_at`,
                                    [data.roomId, data.userId, data.content]
                                );
                                
                                const newMessage = result.rows[0];

                                // Create message payload
                                const messagePayload = {
                                    type: MessageType.NEW_MESSAGE,
                                    message: {
                                        id: newMessage.id,
                                        room_id: newMessage.room_id,
                                        user_id: newMessage.user_id,
                                        username: username,
                                        content: newMessage.content,
                                        timestamp: newMessage.created_at
                                    }
                                };

                                // Send to all users in the room, including sender
                                const roomConnections = connections.get(data.roomId);
                                if (roomConnections) {
                                    roomConnections.forEach(client => {
                                        client.send(JSON.stringify(messagePayload));
                                    });
                                }
                            } catch (error) {
                                console.error('Error sending message:', error);
                                ws.send(JSON.stringify({
                                    type: MessageType.ERROR,
                                    message: 'Failed to send message'
                                }));
                            }
                    }
                    break;

                    case MessageType.LOAD_ROOM_MESSAGES:
                        if (data.roomId) {
                            try {
                                const messagesResult = await pool.query(
                                    `SELECT m.id, m.user_id, m.content, m.created_at, u.username
                                     FROM messages m
                                     JOIN users u ON m.user_id = u.id
                                     WHERE m.room_id = $1 
                                     ORDER BY m.created_at ASC`,
                                    [data.roomId]
                                );

                                const roomResult = await pool.query(
                                    "SELECT * FROM rooms WHERE id = $1",
                                    [data.roomId]
                                );

                                ws.send(JSON.stringify({
                                    type: MessageType.LOAD_ROOM_MESSAGES,
                                    roomId: data.roomId,
                                    roomName: roomResult.rows[0]?.name,
                                    messages: messagesResult.rows.map(msg => ({
                                        id: msg.id,
                                        content: msg.content,
                                        userId: msg.user_id,
                                        username: msg.username,
                                        timestamp: msg.created_at
                                    }))
                                }));
                            } catch (error) {
                                console.error('Error loading messages:', error);
                            }
                        }
                        break;

                    case MessageType.ROOMS_UPDATE:
                        try {
                            const { rows } = await pool.query(`
                                SELECT r.*, 
                                    EXISTS(
                                        SELECT 1 
                                        FROM user_rooms ur 
                                        WHERE ur.room_id = r.id 
                                        AND ur.user_id = $1
                                    ) as "isJoined"
                                FROM rooms r`,
                                [data.userId]
                            );
                            ws.send(JSON.stringify({
                                type: MessageType.ROOMS_UPDATE,
                                rooms: rows
                            }));
                        } catch (error) {
                            console.error('Error fetching rooms:', error);
                        }
                        break;

                    case MessageType.NEARBY_ROOMS:
                        if (data.latitude && data.longitude) {
                            try {
                                const { rows } = await pool.query(
                                    `SELECT r.*, 
                                        (6371 * acos(cos(radians($1)) * cos(radians(r.latitude)) * 
                                        cos(radians(r.longitude) - radians($2)) + 
                                        sin(radians($1)) * sin(radians(r.latitude)))) AS distance
                                     FROM rooms r
                                     WHERE (6371 * acos(cos(radians($1)) * cos(radians(r.latitude)) * 
                                           cos(radians(r.longitude) - radians($2)) + 
                                           sin(radians($1)) * sin(radians(r.latitude)))) <= $3`,
                                    [data.latitude, data.longitude, data.radius || 5]
                                );

                                ws.send(JSON.stringify({
                                    type: MessageType.NEARBY_ROOMS,
                                    rooms: rows
                                }));
                            } catch (error) {
                                console.error('Error fetching nearby rooms:', error);
                            }
                        }
                        break;

                    case MessageType.JOIN_ROOM:
                        console.log(data);
                        if (data.roomId && data.userId) {
                            try {
                                // First check if user is already in the room
                                const existingMembership = await pool.query(
                                    `SELECT id FROM user_rooms WHERE user_id = $1 AND room_id = $2`,
                                    [data.userId, data.roomId]
                                );
                                console.log(existingMembership.rows);
                                if (existingMembership.rows.length === 0) {
                                    // Get user info
                                    const userResult = await pool.query(
                                        'SELECT username FROM users WHERE id = $1',
                                        [data.userId]
                                    );
                                    const username = userResult.rows[0]?.username;

                                    // Insert new membership
                                    await pool.query(
                                        `INSERT INTO user_rooms (user_id, room_id) 
                                         VALUES ($1, $2)`,
                                        [data.userId, data.roomId]
                                    );

                                    // Update WebSocket connections
                                    if (!userRooms.has(data.userId)) {
                                        userRooms.set(data.userId, new Set());
                                    }
                                    userRooms.get(data.userId)?.add(data.roomId);

                                    if (!connections.has(data.roomId)) {
                                        connections.set(data.roomId, new Set());
                                    }
                                    connections.get(data.roomId)?.add(ws);

                                    // Notify room members
                                    connections.get(data.roomId)?.forEach((client) => {
                                        client.send(JSON.stringify({
                                            type: MessageType.USER_JOINED,
                                            roomId: data.roomId,
                                            userId: data.userId,
                                            username: username
                                        }));
                                    });
                                }
                            } catch (error) {
                                console.error('Error joining room:', error);
                                ws.send(JSON.stringify({
                                    type: MessageType.ERROR,
                                    message: 'Failed to join room'
                                }));
                            }
                        }
                        break;

                    case MessageType.LEAVE_ROOM:
                        if (data.roomId && data.userId) {
                            try {
                                // Get user info for notification
                                const userResult = await pool.query(
                                    'SELECT username FROM users WHERE id = $1',
                                    [data.userId]
                                );
                                const username = userResult.rows[0]?.username;

                                // Remove from user_rooms table
                                await pool.query(
                                    `DELETE FROM user_rooms 
                                     WHERE user_id = $1 AND room_id = $2`,
                                    [data.userId, data.roomId]
                                );

                                // Update WebSocket connections
                                userRooms.get(data.userId)?.delete(data.roomId);
                                if (userRooms.get(data.userId)?.size === 0) {
                                    userRooms.delete(data.userId);
                                }

                                const roomConnections = connections.get(data.roomId);
                                if (roomConnections) {
                                    roomConnections.delete(ws);
                                    if (roomConnections.size === 0) {
                                        connections.delete(data.roomId);
                                    }

                                    // Notify remaining users in the room
                                    roomConnections.forEach((client) => {
                                        client.send(JSON.stringify({
                                            type: MessageType.USER_LEFT,
                                            roomId: data.roomId,
                                            userId: data.userId,
                                            username: username
                                        }));
                                    });
                                }

                                // Confirm to the leaving user
                                ws.send(JSON.stringify({
                                    type: MessageType.LEAVE_ROOM_CONFIRM,
                                    roomId: data.roomId,
                                    success: true
                                }));

                            } catch (error) {
                                console.error('Error leaving room:', error);
                                ws.send(JSON.stringify({
                                    type: MessageType.ERROR,
                                    message: 'Failed to leave room'
                                }));
                            }
                    }
                    break;

                    default:
                        console.warn("Unknown message type:", data.type);
                }
            } catch (error) {
                console.error("Error processing message:", error);
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