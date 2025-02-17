const WS_URL = process.env.REACT_APP_WS_URL || 'ws://localhost:5432';

export const createWebSocket = (roomId: string, userId: string) => {
    const ws = new WebSocket(`${WS_URL}/chat?roomId=${roomId}&userId=${userId}`);
    
    ws.onopen = () => {
        console.log('Connected to chat');
    };

    ws.onerror = (error) => {
        console.error('WebSocket error:', error);
    };

    return ws;
}; 