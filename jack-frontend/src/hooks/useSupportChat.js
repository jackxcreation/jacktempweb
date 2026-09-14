// jack-frontend/src/hooks/support/useSupportChat.js
import { useState, useCallback, useRef, useEffect } from 'react';

export const useSupportChat = () => {
  const [messages, setMessages] = useState([]);
  const [isTyping, setIsTyping] = useState(false);
  
  // AbortController to cancel pending AI requests if component unmounts
  const abortControllerRef = useRef(null);

  // 🔥 UPGRADE: Bulletproof message addition with Race-Condition protection
  const addMessage = useCallback((newMessage) => {
    if (!newMessage) return;
    
    // 1. Strict ID Normalization (Handles MongoDB _id, Backend messageId, or Frontend id)
    const normalizedId = newMessage.messageId || newMessage._id || newMessage.id || `msg-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    
    // Normalize text content to match backend schema
    const content = newMessage.content || newMessage.text || "";

    const normalizedMsg = {
      ...newMessage,
      id: normalizedId,
      content: content,
      timestamp: newMessage.createdAt || newMessage.timestamp || new Date().toISOString()
    };

    setMessages((prevMessages) => {
      // 2. Exact ID Check
      if (prevMessages.some((msg) => msg.id === normalizedId)) {
        return prevMessages;
      }

      // 3. 🔥 THE DOUBLE-BUBBLE FIX (Content Deduplication for API + Socket race conditions)
      // If AI sends the exact same text within a 5-second window via both Socket and API, ignore the duplicate.
      const isAiDuplicate = prevMessages.some((msg) => {
        const isBot = ['AI', 'BOT', 'SYSTEM', 'AGENT', 'ADMIN'].includes(String(msg.senderType || msg.sender).toUpperCase());
        const isRecent = (new Date().getTime() - new Date(msg.timestamp).getTime()) < 5000;
        return isBot && isRecent && msg.content === content;
      });

      if (isAiDuplicate) {
        return prevMessages; // Skip adding the duplicate bubble
      }

      return [...prevMessages, normalizedMsg];
    });
  }, []);

  // Update an existing message status or fields (e.g. changing 'sending' to 'sent')
  const updateMessage = useCallback((messageId, updatedFields) => {
    if (!messageId) return;
    setMessages((prevMessages) =>
      prevMessages.map((msg) => {
        if (msg.id === messageId || msg.messageId === messageId || msg._id === messageId) {
          return { ...msg, ...updatedFields };
        }
        return msg;
      })
    );
  }, []);

  // 🔥 NEW HELPER: Remove a message entirely (Useful if an optimistic message fails to send)
  const removeMessage = useCallback((messageId) => {
    if (!messageId) return;
    setMessages((prevMessages) => 
      prevMessages.filter((msg) => msg.id !== messageId && msg.messageId !== messageId && msg._id !== messageId)
    );
  }, []);

  // 🔥 UPGRADE: Bulk set messages with guaranteed Chronological Sorting
  const loadMessages = useCallback((initialMessages) => {
    if (Array.isArray(initialMessages)) {
      const normalized = initialMessages.map(msg => ({
        ...msg,
        id: msg.messageId || msg._id || msg.id || `msg-${Math.random().toString(36).substring(2, 7)}`,
        content: msg.content || msg.text || "",
        timestamp: msg.createdAt || msg.timestamp || new Date().toISOString()
      }));

      // Ensure oldest messages are at the top, newest at the bottom
      const sorted = normalized.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
      setMessages(sorted);
    } else {
      setMessages([]);
    }
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
    updateMessage, 
    removeMessage, // Exported the new helper
    loadMessages,
    clearMessages,
    createAbortSignal
  };
};