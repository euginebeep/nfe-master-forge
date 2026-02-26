import { useState, useCallback } from 'react';
import { ChatNotificationPopup } from './ChatNotificationPopup';
import { ChatMiniWindow } from './ChatMiniWindow';

interface ActiveChat {
  recipientId: string;
  recipientName: string;
}

export function ChatGlobalProvider() {
  const [activeChat, setActiveChat] = useState<ActiveChat | null>(null);

  const handleOpenChat = useCallback((senderId: string, senderName: string) => {
    setActiveChat({ recipientId: senderId, recipientName: senderName });
  }, []);

  const handleCloseChat = useCallback(() => {
    setActiveChat(null);
  }, []);

  return (
    <>
      <ChatNotificationPopup onOpenChat={handleOpenChat} />
      {activeChat && (
        <ChatMiniWindow
          recipientId={activeChat.recipientId}
          recipientName={activeChat.recipientName}
          onClose={handleCloseChat}
        />
      )}
    </>
  );
}
