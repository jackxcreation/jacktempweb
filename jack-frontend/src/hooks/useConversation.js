import { useState, useCallback } from 'react';

export const useConversation = (user) => {
  // Initialize a unique conversation ID for the session
  const generateConversationId = () => {
    const userIdFragment = user?.id ? user.id.slice(-4) : 'gst';
    const timestamp = Date.now().toString(36);
    const randomStr = Math.random().toString(36).substring(2, 7);
    return `conv-${userIdFragment}-${timestamp}-${randomStr}`;
  };

  const [conversationId, setConversationId] = useState(generateConversationId());

  // Function to completely reset the conversation (e.g., when clicking "Start New Conversation")
  const resetConversation = useCallback(() => {
    setConversationId(generateConversationId());
  }, [user]);

  return {
    conversationId,
    resetConversation
  };
};