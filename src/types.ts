import { UUID } from "crypto"

export interface User {
    id: UUID; // Unique identifier for the user
    roomIds: string[]; // Array of room IDs the user is part of
    username?: string; // Optional username
    latitude: number; // User's latitude coordinate
    longitude: number; // User's longitude coordinate
    email?: string; // Optional email
    password?: string; // Optional password
}

export interface Message {
    type: MessageType;
    userId?: string;    // For user-related operations
    roomId?: string;    // For room-related operations
    messageId?: string; // For message-related operations
    content?: string;
    username?: string;
    email?: string;
    password?: string;
    name?: string;
    latitude?: number;
    longitude?: number;
    distance?: number;
    token?: string;
}

export enum MessageType {
    SEND_MESSAGE = 'SEND_MESSAGE',
    NEW_MESSAGE = 'NEW_MESSAGE',
    JOIN_ROOM = 'JOIN_ROOM',
    USER_JOINED = 'USER_JOINED',
    ROOM_CREATED = 'ROOM_CREATED',
    CREATE_ROOM = 'CREATE_ROOM',
    MEMBERSHIP_STATUS = 'MEMBERSHIP_STATUS',
    ERROR = 'ERROR',
    LOAD_ROOM_MESSAGES = "LOAD_ROOM_MESSAGES",
    ROOMS_UPDATE = "ROOMS_UPDATE",
    NEARBY_ROOMS = "NEARBY_ROOMS",
    LEAVE_ROOM = 'LEAVE_ROOM',
    LEAVE_ROOM_CONFIRM = 'LEAVE_ROOM_CONFIRM',
    USER_LEFT = 'USER_LEFT'
}
