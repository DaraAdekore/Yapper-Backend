import { formatMessageDate, sortMessagesByDate } from '../utils/dateUtils';

const ChatRoom = () => {
    // ... other code ...

    const sortedMessages = sortMessagesByDate(messages);

    return (
        <div className="chat-container">
            {sortedMessages.map(message => (
                <div key={message.id} className="message">
                    <div className="message-header">
                        <span className="username">{message.username}</span>
                        <span className="timestamp">
                            {formatMessageDate(message.timestamp)}
                        </span>
                    </div>
                    <div className="message-content">{message.content}</div>
                </div>
            ))}
        </div>
    );
}; 