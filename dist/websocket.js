"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.setupWebSocket = exports.userRooms = exports.connections = void 0;
const ws_1 = require("ws");
const dotenv_1 = __importDefault(require("dotenv"));
const types_1 = require("./types");
dotenv_1.default.config();
exports.connections = new Map();
exports.userRooms = new Map();
const setupWebSocket = (server, pool) => {
    const wss = new ws_1.WebSocketServer({ server });
    wss.on("connection", (ws) => {
        console.log("Client connected");
        ws.on("message", (message) => __awaiter(void 0, void 0, void 0, function* () {
            var _a, _b, _c, _d, _e, _f, _g, _h;
            try {
                const data = JSON.parse(message.toString());
                switch (data.type) {
                    case types_1.MessageType.CREATE_ROOM:
                        if (data.name && data.latitude && data.longitude && data.userId) {
                            try {
                                const client = yield pool.connect();
                                try {
                                    yield client.query('BEGIN');
                                    // Get creator's info
                                    const creatorResult = yield client.query('SELECT username FROM users WHERE id = $1', [data.userId]);
                                    const creatorUsername = (_a = creatorResult.rows[0]) === null || _a === void 0 ? void 0 : _a.username;
                                    // Create the room
                                    const roomResult = yield client.query(`INSERT INTO rooms (name, latitude, longitude, creator_id) 
                                         VALUES ($1, $2, $3, $4) 
                                         RETURNING id, name, latitude, longitude, creator_id, created_at`, [data.name, data.latitude, data.longitude, data.userId]);
                                    const newRoom = roomResult.rows[0];
                                    // Add creator to user_rooms
                                    yield client.query(`INSERT INTO user_rooms (user_id, room_id) 
                                         VALUES ($1, $2)`, [data.userId, newRoom.id]);
                                    // Find users within 100km radius
                                    const nearbyUsers = yield client.query(`SELECT id 
                                         FROM users 
                                         WHERE (6371 * acos(cos(radians($1)) * cos(radians(latitude)) * 
                                               cos(radians(longitude) - radians($2)) + 
                                               sin(radians($1)) * sin(radians(latitude)))) <= 100`, [data.latitude, data.longitude]);
                                    yield client.query('COMMIT');
                                    // Create room notification message
                                    const roomCreatedMessage = {
                                        type: types_1.MessageType.ROOM_CREATED,
                                        room: {
                                            id: newRoom.id,
                                            name: newRoom.name,
                                            latitude: newRoom.latitude,
                                            longitude: newRoom.longitude,
                                            creatorId: newRoom.creator_id,
                                            creatorUsername: creatorUsername,
                                            isJoined: true // Set to true for creator
                                        }
                                    };
                                    // Send to creator first
                                    ws.send(JSON.stringify(roomCreatedMessage));
                                    // Then send to all nearby users (except creator)
                                    nearbyUsers.rows.forEach(user => {
                                        if (user.id !== data.userId) { // Skip creator
                                            const userConnections = exports.connections.get(user.id);
                                            if (userConnections) {
                                                userConnections.forEach(conn => {
                                                    conn.send(JSON.stringify(Object.assign(Object.assign({}, roomCreatedMessage), { room: Object.assign(Object.assign({}, roomCreatedMessage.room), { isJoined: false }) })));
                                                });
                                            }
                                        }
                                    });
                                    // Update connection maps for the creator
                                    if (!exports.userRooms.has(data.userId)) {
                                        exports.userRooms.set(data.userId, new Set());
                                    }
                                    (_b = exports.userRooms.get(data.userId)) === null || _b === void 0 ? void 0 : _b.add(newRoom.id);
                                    if (!exports.connections.has(newRoom.id)) {
                                        exports.connections.set(newRoom.id, new Set());
                                    }
                                    (_c = exports.connections.get(newRoom.id)) === null || _c === void 0 ? void 0 : _c.add(ws);
                                }
                                catch (error) {
                                    yield client.query('ROLLBACK');
                                    throw error;
                                }
                                finally {
                                    client.release();
                                }
                            }
                            catch (error) {
                                console.error('Error creating room:', error);
                                ws.send(JSON.stringify({
                                    type: types_1.MessageType.ERROR,
                                    message: 'Failed to create room'
                                }));
                            }
                        }
                        else {
                            ws.send(JSON.stringify({
                                type: types_1.MessageType.ERROR,
                                message: 'Missing required fields for room creation'
                            }));
                        }
                        break;
                    case types_1.MessageType.SEND_MESSAGE:
                        if (data.roomId && data.content && data.userId) {
                            try {
                                const userResult = yield pool.query('SELECT username FROM users WHERE id = $1', [data.userId]);
                                const username = (_d = userResult.rows[0]) === null || _d === void 0 ? void 0 : _d.username;
                                const result = yield pool.query(`INSERT INTO messages (room_id, user_id, content, created_at) 
                                     VALUES ($1, $2, $3, NOW()) 
                                     RETURNING id, room_id, user_id, content, created_at`, [data.roomId, data.userId, data.content]);
                                const newMessage = result.rows[0];
                                // Create message payload
                                const messagePayload = {
                                    type: types_1.MessageType.NEW_MESSAGE,
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
                                const roomConnections = exports.connections.get(data.roomId);
                                if (roomConnections) {
                                    roomConnections.forEach(client => {
                                        client.send(JSON.stringify(messagePayload));
                                    });
                                }
                            }
                            catch (error) {
                                console.error('Error sending message:', error);
                                ws.send(JSON.stringify({
                                    type: types_1.MessageType.ERROR,
                                    message: 'Failed to send message'
                                }));
                            }
                        }
                        break;
                    case types_1.MessageType.LOAD_ROOM_MESSAGES:
                        if (data.roomId) {
                            try {
                                const messagesResult = yield pool.query(`SELECT m.id, m.user_id, m.content, m.created_at, u.username
                                     FROM messages m
                                     JOIN users u ON m.user_id = u.id
                                     WHERE m.room_id = $1 
                                     ORDER BY m.created_at ASC`, [data.roomId]);
                                const roomResult = yield pool.query("SELECT * FROM rooms WHERE id = $1", [data.roomId]);
                                ws.send(JSON.stringify({
                                    type: types_1.MessageType.LOAD_ROOM_MESSAGES,
                                    roomId: data.roomId,
                                    roomName: (_e = roomResult.rows[0]) === null || _e === void 0 ? void 0 : _e.name,
                                    messages: messagesResult.rows.map(msg => ({
                                        id: msg.id,
                                        content: msg.content,
                                        userId: msg.user_id,
                                        username: msg.username,
                                        timestamp: msg.created_at
                                    }))
                                }));
                            }
                            catch (error) {
                                console.error('Error loading messages:', error);
                            }
                        }
                        break;
                    case types_1.MessageType.ROOMS_UPDATE:
                        try {
                            const { rows } = yield pool.query(`
                                SELECT r.*, 
                                    EXISTS(
                                        SELECT 1 
                                        FROM user_rooms ur 
                                        WHERE ur.room_id = r.id 
                                        AND ur.user_id = $1
                                    ) as "isJoined"
                                FROM rooms r`, [data.userId]);
                            ws.send(JSON.stringify({
                                type: types_1.MessageType.ROOMS_UPDATE,
                                rooms: rows
                            }));
                        }
                        catch (error) {
                            console.error('Error fetching rooms:', error);
                        }
                        break;
                    case types_1.MessageType.NEARBY_ROOMS:
                        if (data.latitude && data.longitude) {
                            try {
                                const { rows } = yield pool.query(`SELECT r.*, 
                                        (6371 * acos(cos(radians($1)) * cos(radians(latitude)) * 
                                        cos(radians(longitude) - radians($2)) + 
                                        sin(radians($1)) * sin(radians(latitude)))) AS distance
                                     FROM rooms r
                                     WHERE (6371 * acos(cos(radians($1)) * cos(radians(latitude)) * 
                                           cos(radians(longitude) - radians($2)) + 
                                           sin(radians($1)) * sin(radians(latitude)))) <= $3`, [data.latitude, data.longitude, data.radius || 5]);
                                ws.send(JSON.stringify({
                                    type: types_1.MessageType.NEARBY_ROOMS,
                                    rooms: rows
                                }));
                            }
                            catch (error) {
                                console.error('Error fetching nearby rooms:', error);
                            }
                        }
                        break;
                    case types_1.MessageType.JOIN_ROOM:
                        if (data.roomId && data.userId) {
                            try {
                                const userResult = yield pool.query('SELECT username FROM users WHERE id = $1', [data.userId]);
                                const username = (_f = userResult.rows[0]) === null || _f === void 0 ? void 0 : _f.username;
                                yield pool.query(`INSERT INTO user_rooms (user_id, room_id) 
                                     VALUES ($1, $2) 
                                     ON CONFLICT (user_id, room_id) DO NOTHING`, [data.userId, data.roomId]);
                                // Update connection maps
                                if (!exports.userRooms.has(data.userId)) {
                                    exports.userRooms.set(data.userId, new Set());
                                }
                                (_g = exports.userRooms.get(data.userId)) === null || _g === void 0 ? void 0 : _g.add(data.roomId);
                                if (!exports.connections.has(data.roomId)) {
                                    exports.connections.set(data.roomId, new Set());
                                }
                                (_h = exports.connections.get(data.roomId)) === null || _h === void 0 ? void 0 : _h.add(ws);
                                // Notify room members
                                const roomConnections = exports.connections.get(data.roomId);
                                if (roomConnections) {
                                    roomConnections.forEach(client => {
                                        client.send(JSON.stringify({
                                            type: types_1.MessageType.USER_JOINED,
                                            roomId: data.roomId,
                                            userId: data.userId,
                                            username: username
                                        }));
                                    });
                                }
                            }
                            catch (error) {
                                console.error('Error joining room:', error);
                                ws.send(JSON.stringify({
                                    type: types_1.MessageType.ERROR,
                                    message: 'Failed to join room'
                                }));
                            }
                        }
                        break;
                    default:
                        console.warn("Unknown message type:", data.type);
                }
            }
            catch (error) {
                console.error("Error processing message:", error);
            }
        }));
        ws.on("close", () => {
            console.log("Client disconnected");
            exports.connections.forEach((clients, roomId) => {
                if (clients.has(ws)) {
                    clients.delete(ws);
                    if (clients.size === 0) {
                        exports.connections.delete(roomId);
                    }
                }
            });
        });
    });
    console.log("WebSocket server running and attached to Express server.");
};
exports.setupWebSocket = setupWebSocket;
