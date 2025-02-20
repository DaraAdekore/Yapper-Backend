-- Users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    latitude DECIMAL(10, 6),
    longitude DECIMAL(10, 6),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Rooms table
CREATE TABLE rooms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    latitude DECIMAL(10, 6) NOT NULL,
    longitude DECIMAL(10, 6) NOT NULL,
    creator_id UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP + interval '24 hours'
);

-- User-Room relationships
CREATE TABLE user_rooms (
    user_id UUID REFERENCES users(id),
    room_id UUID REFERENCES rooms(id),
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, room_id)
);

-- Messages table
CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID REFERENCES rooms(id),
    user_id UUID REFERENCES users(id),
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Update messages table
ALTER TABLE messages 
ALTER COLUMN created_at TYPE timestamp with time zone,
ALTER COLUMN created_at SET DEFAULT CURRENT_TIMESTAMP;

-- Update user_rooms table
ALTER TABLE user_rooms 
ALTER COLUMN joined_at TYPE timestamp with time zone,
ALTER COLUMN joined_at SET DEFAULT CURRENT_TIMESTAMP;

-- Update rooms table
ALTER TABLE rooms 
ALTER COLUMN created_at TYPE timestamp with time zone,
ALTER COLUMN created_at SET DEFAULT CURRENT_TIMESTAMP,
ALTER COLUMN expires_at TYPE timestamp with time zone,
ALTER COLUMN expires_at SET DEFAULT CURRENT_TIMESTAMP + interval '24 hours'; 