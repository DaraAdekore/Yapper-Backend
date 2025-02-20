export const formatMessageDate = (timestamp: string) => {
    const date = new Date(timestamp);
    
    // Today's date for comparison
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    // Format time
    const time = date.toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit'
    });
    
    // If message is from today
    if (date.toDateString() === today.toDateString()) {
        return `Today at ${time}`;
    }
    
    // If message is from yesterday
    if (date.toDateString() === yesterday.toDateString()) {
        return `Yesterday at ${time}`;
    }
    
    // Otherwise show full date
    return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: date.getFullYear() !== today.getFullYear() ? 'numeric' : undefined
    }) + ` at ${time}`;
};

export const sortMessagesByDate = (messages: any[]) => {
    return [...messages].sort((a, b) => 
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
}; 