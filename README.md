# Yapper - Real-time Local Chat Application

Yapper is a location-based chat application that allows users to create and join chat rooms within their geographical vicinity. It features real-time messaging, room discovery based on location, and instant notifications for nearby room creation.

## Features

- **Location-Based Room Discovery**: Find and join chat rooms within a 100km radius
- **Real-time Messaging**: Instant message delivery using WebSocket technology
- **Room Creation**: Create new chat rooms tied to specific locations
- **User Notifications**: Get notified when new rooms are created in your area
- **Message History**: Access previous messages when joining a room
- **Optimistic Updates**: Immediate UI feedback for better user experience
- **Unread Message Tracking**: Keep track of unread messages per room

## Technical Stack

### Backend
- Node.js
- Express
- WebSocket (ws)
- PostgreSQL
- TypeScript

### Frontend
- React
- Redux Toolkit
- TypeScript
- WebSocket Client

## Database Schema

### Users Table

## WebSocket Message Types

- `SEND_MESSAGE`: Send a new message to a room
- `NEW_MESSAGE`: Receive a new message in a room
- `JOIN_ROOM`: Join an existing room
- `USER_JOINED`: Notification when a user joins a room
- `CREATE_ROOM`: Create a new room
- `ROOM_CREATED`: Notification of a new room creation
- `MEMBERSHIP_STATUS`: Room membership confirmation
- `ERROR`: Error message notification

## API Endpoints

### Rooms
- `POST /rooms`: Get rooms based on location and search criteria
- `POST /api/rooms/join`: Join a specific room

## Setup and Installation

1. Clone the repository:

```bash
git clone https://github.com/yourusername/yapper.git
```

2. Install dependencies:
```bash
cd yapper
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env
```
Edit `.env` with your configuration:
```
POSTGRES_URL=your_database_url
REACT_APP_WS_URL=ws://localhost:3312
```

4. Set up the database:
```bash
psql -U postgres -f schema.sql
```

5. Start the development server:
```bash
npm run dev
```

## Development

### Running Tests
```bash
npm test
```

### Building for Production
```bash
npm run build
```

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE.md](LICENSE.md) file for details

## Acknowledgments

- Thanks to all contributors who have helped shape Yapper
- Built with modern web technologies and best practices
- Inspired by the need for location-based community chat applications
