import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { API_URL } from '../../config';

import { fetchAIResponse, processBotResponse } from '../../utils/chatBrain';
import { useSupportSocket } from '../../hooks/useSupportSocket';
import { useConversation } from '../../hooks/support/useConversation';

import ChatHeader from './ChatHeader';
import ChatInput from './ChatInput';
import MessageList from './MessageList';

export const SUPPORT_STATUS = {
  AI_ACTIVE: 'AI_ACTIVE',
  ESCALATING: 'ESCALATING',
  WAITING_FOR_AGENT: 'WAITING_FOR_AGENT',
  HUMAN_ACTIVE: 'HUMAN_ACTIVE',
  RESOLVED: 'RESOLVED',
  CLOSED: 'CLOSED'
};

const SupportChat = ({ isOpen, onClose, contextData, user }) => {
  const [messages, setMessages] = useState([]);
  const [isTyping, setIsTyping] = useState(false);
  const [supportStatus, setSupportStatus] = useState(SUPPORT_STATUS.AI_ACTIVE);
  const [agent, setAgent] = useState(null);
  
  const chatEndRef = useRef(null);
  const abortControllerRef = useRef(null);
  const BACKEND_API_URL = `${API_URL}/chat`;

  // 🔥 UPGRADE: Persistent conversation session tracking
  const { conversationId, resetConversation } = useConversation(user);

  const { escalate, joinRoom } = useSupportSocket({
    API_URL,
    isOpen,
    user,
    conversationId,
    onAdminReply: (msg) => {
      if (!msg) return;
      setMessages(prev => {
        const msgId = msg.id || msg._id || msg.messageId;
        if (msgId && prev.some(m => (m.id === msgId || m._id === msgId))) return prev;
        return [...prev, {
          ...msg,
          id: msgId || `adm-${Date.now()}`,
          sender: msg.sender || 'admin',
          time: msg.time || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }];
      });
      setSupportStatus(SUPPORT_STATUS.HUMAN_ACTIVE);
      setIsTyping(false); // Stop typing if admin replies
    },
    onSystemEvent: (event) => {
      if (!event) return;
      if (event.type === 'agent_joined') {
        setAgent(event.agent);
        setSupportStatus(SUPPORT_STATUS.HUMAN_ACTIVE);
        setMessages(prev => [...prev, { 
          id: `sys-${Date.now()}`, 
          type: 'agent_joined', 
          agent: event.agent,
          text: `${event.agent?.name || 'An agent'} joined the chat.`
        }]);
      } else if (event.type === 'ticket_resolved') {
        setSupportStatus(SUPPORT_STATUS.RESOLVED);
        setMessages(prev => [...prev, { 
          id: `sys-${Date.now()}`, 
          type: 'system', 
          text: 'This support ticket has been resolved.' 
        }]);
      }
    }
  });

  // Safe Close Handler
  const handleSafeClose = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    if (onClose) onClose();
  }, [onClose]);

  // Keyboard accessibility (Escape key closes drawer)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        handleSafeClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleSafeClose]);

  // Init Greeting
  useEffect(() => {
    if (isOpen && messages.length === 0) {
      setMessages([{
        id: `init-${Date.now()}`,
        sender: 'bot',
        type: 'text',
        text: `Hi ${user?.name || 'there'}! Welcome to Jack Essentials Support. I am Jack, your AI Support Manager. Kaise help kar sakta hoon aaj aapki?`,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }]);
    }
    return () => {
      if (!isOpen && abortControllerRef.current) abortControllerRef.current.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, user]);

  const handleSend = async (text, predefinedReply = null) => {
    if (!text || !text.trim()) return;

    const trimmedText = text.trim();
    const userMsg = {
      id: `usr-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      sender: 'user',
      type: 'text',
      text: trimmedText,
      status: 'sent',
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, userMsg]);

    if (supportStatus === SUPPORT_STATUS.HUMAN_ACTIVE || supportStatus === SUPPORT_STATUS.ESCALATING || supportStatus === SUPPORT_STATUS.WAITING_FOR_AGENT) {
      escalate({
        conversationId,
        userId: user?.id || user?._id || 'guest_user',
        userName: user?.name || 'Guest',
        orderId: contextData?.id || contextData?._id || null,
        history: [{ sender: 'user', text: trimmedText }]
      });
      return;
    }

    setIsTyping(true);
    let rawBotResponse = predefinedReply;

    if (!rawBotResponse) {
      try {
        abortControllerRef.current = new AbortController();
        rawBotResponse = await fetchAIResponse({
          userText: trimmedText,
          messages,
          contextData,
          user,
          BACKEND_API_URL,
          token: null,
          signal: abortControllerRef.current.signal
        });
      } catch (error) {
        console.error("Chat API Call Failed:", error);
        rawBotResponse = { text: "I'm having trouble connecting right now. Could you please try again or type 'human' to connect to an agent?" };
      }
    }

    if (rawBotResponse === null) {
      setIsTyping(false);
      return; 
    }

    let { finalBotText, triggerEscalation, structuredData } = processBotResponse(rawBotResponse);

    // Deep Payload Fallback
    if (!finalBotText || typeof finalBotText !== 'string' || finalBotText.trim() === '') {
      finalBotText = 
        rawBotResponse?.data?.message?.content || 
        rawBotResponse?.message?.content || 
        rawBotResponse?.content || 
        rawBotResponse?.text || 
        (typeof rawBotResponse === 'string' ? rawBotResponse : "I'm having trouble connecting right now. Could you please try again?");
    }

    // Smart Escalation Prevention on simple greetings
    const lowerText = trimmedText.toLowerCase();
    const simpleGreetings = ['hello', 'hi', 'hey', 'namaste', 'good morning'];
    const finalEscalation = simpleGreetings.includes(lowerText) ? false : triggerEscalation;

    const botMsg = {
      id: `bot-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      sender: 'bot',
      type: structuredData ? 'structured' : 'text',
      text: finalBotText,
      structuredData: structuredData,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, botMsg]);
    setIsTyping(false);

    if (finalEscalation) {
      setSupportStatus(SUPPORT_STATUS.ESCALATING);
      setMessages(prev => [...prev, { 
        id: `sys-${Date.now()}`, 
        type: 'system', 
        text: 'Transferring chat to a support agent...' 
      }]);
      
      escalate({
        conversationId,
        userId: user?.id || user?._id || 'guest_user',
        userName: user?.name || 'Guest',
        orderId: contextData?.id || contextData?._id || null,
        history: [...messages, userMsg].slice(-10)
      });
    }
  };

  const handleRestart = () => {
    resetConversation();
    setMessages([]);
    setSupportStatus(SUPPORT_STATUS.AI_ACTIVE);
    setAgent(null);
    // Re-trigger greeting
    setTimeout(() => {
      setMessages([{
        id: `init-${Date.now()}`,
        sender: 'bot',
        type: 'text',
        text: `Hi ${user?.name || 'there'}! Welcome back to Jack Essentials Support. How can I help you today?`,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }]);
    }, 100);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleSafeClose}
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100]"
          />
          <motion.div
            initial={{ x: '100%', opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: '100%', opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed top-0 right-0 h-full w-full sm:w-[400px] bg-slate-50 shadow-2xl z-[101] flex flex-col border-l border-slate-200"
          >
            <ChatHeader onClose={handleSafeClose} supportStatus={supportStatus} agent={agent} />

            {contextData && contextData.items?.[0] && (
              <div className="bg-white p-4 border-b border-slate-200 flex items-center gap-4 shadow-sm z-10 flex-shrink-0">
                <div className="w-16 h-16 bg-slate-100 rounded-xl overflow-hidden border border-slate-200 flex-shrink-0">
                  <img
                    src={contextData.items[0].image || '/logo.png'}
                    alt="Context Product"
                    className="w-full h-full object-cover"
                    onError={(e) => { e.target.src = '/logo.png'; }}
                  />
                </div>
                <div className="overflow-hidden">
                  <span className="text-[10px] font-black text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded uppercase tracking-widest">
                    Order Context
                  </span>
                  <h3 className="font-bold text-slate-800 text-sm mt-1 truncate">
                    {contextData.items[0].title || 'Order Details'}
                  </h3>
                  <p className="text-xs text-slate-500 font-mono mt-0.5 truncate">
                    ID: #{contextData.id || contextData._id || 'N/A'}
                  </p>
                </div>
              </div>
            )}

            <MessageList 
              messages={messages}
              isTyping={isTyping}
              chatEndRef={chatEndRef}
              supportStatus={supportStatus}
              onRestart={handleRestart}
            />

            <ChatInput 
              onSend={handleSend} 
              isTyping={isTyping} 
              isEscalated={supportStatus !== SUPPORT_STATUS.AI_ACTIVE} 
              messagesCount={messages.length} 
              supportStatus={supportStatus}
            />
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default SupportChat;