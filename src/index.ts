import express from 'express';
import http from 'http';
import { setupWebSocket } from './websocket';
import cookieParser from 'cookie-parser';
import { Request, Response } from 'express';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import { Pool } from 'pg';
import cors from 'cors';
import { MessageType } from './types';
import { connections, userRooms } from './websocket';

dotenv.config();

const app = express();
app.use(cookieParser());
app.use(
    cors({
        origin: 'http://localhost:3000', // Frontend URL
        credentials: true, // Allow cookies
    })
);
app.use(express.json());
const port = process.env.PORT;
const pool = new Pool({
    user: 'dara',
    host: 'localhost',
    database: 'yapper',
    password: '',
    port: 5432,
});
const server = http.createServer(app);

setupWebSocket(server, pool);
const getUserByEmail = async (email: string) => {
    const query = `SELECT * FROM users WHERE email = $1`;
    const result = await pool.query(query, [email]);
    return result.rows[0];
};
const encodedPassword = (password: string): string => {
    // Simple base64 encoding with a salt
    const salt = '4509809fgdjkn4454j5jkj62jk6'; // In production, use a proper random salt per user
    const encoded = Buffer.from(salt + password).toString('base64');
    return encoded;
};
const updateUserLocation = async (userId: number, latitude: number, longitude: number) => {
    const query = `
        UPDATE users
        SET latitude = $1, longitude = $2
        WHERE id = $3
    `;
    const values = [latitude, longitude, userId];
    await pool.query(query, values); // Replace `db.query` with your database query function
};

app.post('/login', async (req, res) => {
    const { email, password, latitude, longitude } = req.body;

    try {
        // Fetch user by email
        const user = await getUserByEmail(email);
        if (!user) {
            res.status(404).send('User not found');
            return;
        }

        // Verify the password
        const passedHash = encodedPassword(password);
        if (user.password_hash !== passedHash) {
            res.status(401).send('Invalid password');
            return;
        }

        // Generate a JWT token
        const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET as string, { expiresIn: '1h' });

        // Set the token as an HTTP-only cookie
        res.cookie('token', token, {
            httpOnly: true,
            secure: true,
            sameSite: 'none',
        });

        // Send response with user details
        res.status(200).send({
            id: user.id,
            username: user.username,
            email: user.email,
            latitude: user.latitude,
            longitude: user.longitude,
        });
    } catch (error) {
        console.error('Error during login:', error);
        res.status(500).send('Internal server error');
    }
});
app.post('/location', async (req, res) => {
    const { latitude, longitude, id } = req.body;
    const query = `
        UPDATE users
        SET latitude = $1, longitude = $2
        WHERE id = $3
    `;
    try {
        const result = await pool.query(query, [latitude, longitude, id]);
        res.status(200).json({ success: true, message: 'Location updated' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});
// Define the endpoint
app.post('/rooms', async (req, res) => {
    const { userLat, userLng, radius, searchT, userId } = req.body;

    if (!userLat || !userLng) {
        res.status(400).send({ error: 'Latitude and longitude are required.' });
    }

    try {
        let query = `
            SELECT 
                r.id, 
                r.name, 
                r.latitude, 
                r.longitude,
                r.creator_id,
                creator.username as creator_username,
                (SELECT json_agg(
                    json_build_object(
                        'id', m.id, 
                        'text', m.content, 
                        'userId', m.user_id,
                        'username', u.username,
                        'timestamp', m.created_at
                    )
                )
                FROM messages m 
                JOIN users u ON m.user_id = u.id 
                WHERE m.room_id = r.id) as messages,
                (6371 * ACOS(
                    COS(RADIANS($1)) * COS(RADIANS(r.latitude)) *
                    COS(RADIANS(r.longitude) - RADIANS($2)) +
                    SIN(RADIANS($1)) * SIN(RADIANS(r.latitude))
                )) AS distance,
                EXISTS(SELECT 1 FROM user_rooms ur WHERE ur.user_id = $4 AND ur.room_id = r.id) as "isJoined"
            FROM rooms r
            LEFT JOIN users creator ON r.creator_id = creator.id
            WHERE (6371 * ACOS(
                COS(RADIANS($1)) * COS(RADIANS(r.latitude)) *
                COS(RADIANS(r.longitude) - RADIANS($2)) +
                SIN(RADIANS($1)) * SIN(RADIANS(r.latitude))
            ) <= $3 OR EXISTS(SELECT 1 FROM user_rooms ur WHERE ur.user_id = $4 AND ur.room_id = r.id))
        `;

        const queryParams = [userLat, userLng, radius, userId];

        if (searchT?.length) {
            query += ` AND (${searchT.map((_: any, i: number) => `r.name ILIKE $${5 + i}`).join(' OR ')})`;
            queryParams.push(...searchT.map((term: any) => `%${term}%`));
        }

        query += ` ORDER BY distance ASC;`;

        const { rows } = await pool.query(query, queryParams);
        res.status(200).json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).send({ error: 'Failed to fetch rooms.' });
    }
});
app.post("/leave-room", async (req, res) => {
    const { userId, roomId } = req.body;

    if (!userId || !roomId) {
        res.status(400).json({ error: "User ID and Room ID are required" });
    }

    try {
        const result = await pool.query(
            `DELETE FROM user_rooms WHERE user_id = $1 AND room_id = $2 RETURNING *`,
            [userId, roomId]
        );

        if (result.rowCount === 0) {
            res.status(404).json({ error: "User is not in the specified room" });
        }

        res.status(200).json({ message: "User successfully left the room", roomId });
    } catch (error) {
        console.error("Error leaving room:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});
app.post("/joined-rooms", async (req, res) => {
    const { userId } = req.body;
    console.log("Received userId:", userId);

    if (!userId || userId === "null" || userId.trim() === "") {
        res.status(400).json({ error: "Valid user ID is required" });
    }

    try {
        const result = await pool.query(
            `SELECT r.id, r.name, r.latitude, r.longitude, ur.joined_at 
             FROM rooms r
             JOIN user_rooms ur ON r.id = ur.room_id
             WHERE ur.user_id = $1
             ORDER BY ur.joined_at DESC`,
            [userId]
        );
        console.log(result.rows);
        res.status(200).json(result.rows);
    } catch (error) {
        console.error("Error fetching joined rooms:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

app.post('/register', async (req, res) => {
    const { username, email, password, latitude, longitude } = req.body;
    const hashedPassword = encodedPassword(password);
    const query = `INSERT INTO users (username, email, password_hash, latitude, longitude) VALUES ($1, $2, $3, $4, $5)`;
    const result = await pool.query(query, [username, email, hashedPassword, latitude, longitude]);
    const user = await getUserByEmail(email);
    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET as string, { expiresIn: '1h' });
    res.cookie('token', token, {
        httpOnly: true,
        secure: true,
        sameSite: 'none',
    });
    res.status(200).send({ id: user.id, username: user.username, email: user.email, latitude: user.latitude, longitude: user.longitude, token: true });
});
app.post('/logout', (req, res) => {
    res.clearCookie('token', {
        httpOnly: true,
        secure: true,
        sameSite: 'none',
    });
    res.status(200).send('Token deleted successfully');
});
app.get('/verify-token', (req, res) => {
    const token = req.cookies.token;

    if (!token) {
        res.status(401).send('No active session');
        return;
    }
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET as string);
        res.status(200).send(decoded);
    } catch (err) {
        res.status(403).send('Invalid or expired session');
        return;
    }
});
app.post('/api/rooms/join', async (req, res) => {
    const { userId, roomId } = req.body;

    if (!roomId) {
        res.status(400).json({ error: "Room ID is required" });
    }

    try {
        // Check if room exists and get room data with creator info
        const roomResult = await pool.query(`
            SELECT r.*, creator.username as creator_username
            FROM rooms r
            LEFT JOIN users creator ON r.creator_id = creator.id
            WHERE r.id = $1
        `, [roomId]);
        
        const room = roomResult.rows[0];

        if (!room) {
            res.status(404).json({ error: "Room not found" });
        }

        // Add user to room
        await pool.query(
            `INSERT INTO user_rooms (user_id, room_id) VALUES ($1, $2)`,
            [userId, roomId]
        );

        // Get messages with user info
        const messagesResult = await pool.query(`
            SELECT 
                m.id,
                m.content as text,
                m.user_id as "userId",
                u.username,
                m.created_at as timestamp
            FROM messages m
            JOIN users u ON m.user_id = u.id
            WHERE m.room_id = $1
            ORDER BY m.created_at ASC
        `, [roomId]);

        // Update WebSocket state
        if (!userRooms.has(userId)) {
            userRooms.set(userId, new Set());
        }
        userRooms.get(userId)?.add(roomId);

        // Get joining user's username
        const userResult = await pool.query('SELECT username FROM users WHERE id = $1', [userId]);
        const username = userResult.rows[0]?.username;

        // Notify other users
        const roomConnections = connections.get(roomId);
        if (roomConnections) {
            roomConnections.forEach((ws) => {
                ws.send(JSON.stringify({
                    type: "USER_JOINED",
                    roomId: roomId,
                    userId: userId,
                    username: username
                }));
            });
        }

        // Return complete room data
        res.status(200).json({
            id: room.id,
            name: room.name,
            latitude: room.latitude,
            longitude: room.longitude,
            creator_id: room.creator_id,
            creator_username: room.creator_username,
            messages: messagesResult.rows,
            isJoined: true
        });

    } catch (error) {
        console.error('Error joining room:', error);
        res.status(500).json({ error: "Failed to join room" });
    }
});
server.listen(port, () => {
    console.log(`Yapper backend running on http://localhost:${port}`);
});