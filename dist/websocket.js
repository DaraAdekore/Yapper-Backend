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
dotenv_1.default.config();
exports.connections = new Map();
exports.userRooms = new Map();
const setupWebSocket = (server, pool) => {
    const wss = new ws_1.WebSocketServer({ server });
    wss.on("connection", (ws) => {
        console.log("Client connected");
        ws.on("message", (data) => __awaiter(void 0, void 0, void 0, function* () {
            try {
                const message = JSON.parse(data);
                if (message.type === 'CHAT') {
                    // Save message to database
                    const result = yield pool.query(`INSERT INTO messages (room_id, user_id, content) 
                         VALUES ($1, $2, $3) 
                         RETURNING id, created_at`, [message.roomId, message.userId, message.text]);
                    // Get user info
                    const userResult = yield pool.query('SELECT username FROM users WHERE id = $1', [message.userId]);
                    const messageData = {
                        id: result.rows[0].id,
                        text: message.text,
                        userId: message.userId,
                        username: userResult.rows[0].username,
                        timestamp: result.rows[0].created_at
                    };
                    // Broadcast to all clients in room EXCEPT sender
                    const roomClients = exports.connections.get(message.roomId) || new Set();
                    roomClients.forEach((client) => {
                        if (client !== ws && client.readyState === ws_1.WebSocket.OPEN) { // Don't send to self
                            client.send(JSON.stringify(Object.assign({ type: 'MESSAGE' }, messageData)));
                        }
                    });
                }
            }
            catch (error) {
                console.error('Error handling message:', error);
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
