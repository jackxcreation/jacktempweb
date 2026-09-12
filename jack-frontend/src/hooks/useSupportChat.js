import { useState, useCallback, useRef, useEffect } from 'react';

export const useSupportChat = () => {
  const [messages, setMessages] = useState([]);
  const [isTyping, setIsTyping] = useState(false);
  
  // AbortController to cancel pending AI requests if component unmounts
  const abortControllerRef = useRef(null);

  // Safe message addition with deduplication (prevents double messages from Socket + Optimistic UI)
  const addMessage = useCallback((newMessage) => {
    setMessages((prevMessages) => {
      // Check if message with this ID already exists
      if (prevMessages.some((msg) => msg.id === newMessage.id)) {
        return prevMessages;
      }
      return [...prevMessages, newMessage];
    });
  }, []);

  // Bulk set messages (useful for initial load)
  const loadMessages = useCallback((initialMessages) => {
    setMessages(initialMessages);
  }, []);

  // Clear messages
  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  // Create a new AbortController for a new request
  const createAbortSignal = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();
    return abortControllerRef.current.signal;
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return {
    messages,
    isTyping,
    setIsTyping,
    addMessage,
    loadMessages,
    clearMessages,
    createAbortSignal
  };
};