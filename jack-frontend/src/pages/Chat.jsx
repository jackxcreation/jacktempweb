// components/support/Chat.jsx
import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { API_URL } from '../config';

import { fetchAIResponse, processBotResponse } from '../utils/chatBrain';
import { useSupportSocket } from '../hooks/useSupportSocket';
import ChatHeader from './ChatHeader';
import ChatInput from './ChatInput';
import MessageBubble from './MessageBubble';

export const SUPPORT_STATUS = {
  AI_ACTIVE: 'AI_ACTIVE',
  ESCALATING: 'ESCALATING',
  HUMAN_ACTIVE: 'HUMAN_ACTIVE',
  RESOLVED: 'RESOLVED'
};

const Chat = ({ isOpen, onClose, contextData, user }) => {
  const [messages, setMessages] = useState([]);
  const [isTyping, setIsTyping] = useState(false);
  const [isEscalated, setIsEscalated] = useState(false); // Preserved for strict rules
  const [supportStatus, setSupportStatus] = useState(SUPPORT_STATUS.AI_ACTIVE);
  const [agent, setAgent] = useState(null);
  
  const chatEndRef = useRef(null);
  const abortControllerRef = useRef(null);
  const BACKEND_API_URL = `${API_URL}/chat`;

  // Extracted robust socket management
  const { escalate } = useSupportSocket({
    API_URL,
    isOpen,
    user,
    onAdminReply: (msg) => {
      setMessages(prev => {
        if (prev.some(m => m.id === msg.id)) return prev;
        return [...prev, msg];
      });
      setIsEscalated(true);
      setSupportStatus(SUPPORT_STATUS.HUMAN_ACTIVE);
    },
    onSystemEvent: (event) => {
      if (event.type === 'agent_joined') {
        setAgent(event.agent);
        setSupportStatus(SUPPORT_STATUS.HUMAN_ACTIVE);
        setMessages(prev => [...prev, { id: Date.now(), type: 'system', text: `${event.agent?.name || 'An agent'} joined the chat.` }]);
      } else if (event.type === 'ticket_resolved') {
        setSupportStatus(SUPPORT_STATUS.RESOLVED);
        setMessages(prev => [...prev, { id: Date.now(), type: 'system', text: 'This support ticket has been resolved.' }]);
      }
    }
  });

  // Initial Context Load
  useEffect(() => {
    if (isOpen && messages.length === 0) {
      const initialGreeting = {
        id: `init-${Date.now()}`,
        sender: 'bot',
        type: 'text',
        text: `Hi ${user?.name || 'there'}! Welcome to Jack Essentials Support. I am Jack, your AI Support Manager. Kaise help kar sakta hoon aaj aapki?`,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      
      const initialMsgs = [initialGreeting];
      
      // If contextData exists, optionally prepend a context hint message (invisible/system or visual)
      // Here we render it safely at the top of the chat area, per the requirement.
      setMessages(initialMsgs);
    }
    
    // Cleanup pending API calls on unmount or chat close
    return () => {
      if (!isOpen && abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, user]);

  // Auto-scroll
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const handleSend = async (text, predefinedReply = null) => {
    if (!text.trim()) return;

    const userMsg = {
      id: `usr-${Date.now()}-${Math.random()}`,
      sender: 'user',
      type: 'text',
      text,
      status: 'sent',
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, userMsg]);

    // Handle Human Escapement Loop
    if (isEscalated || supportStatus === SUPPORT_STATUS.HUMAN_ACTIVE || supportStatus === SUPPORT_STATUS.ESCALATING) {
      escalate({
        userId: user?.id || 'guest_user',
        userName: user?.name || 'Guest',
        orderId: contextData?.id || null,
        history: [{ sender: 'user', text }]
      });
      return;
    }

    setIsTyping(true);
    let rawBotResponse = predefinedReply;

    // Call API defensively
    if (!rawBotResponse) {
      abortControllerRef.current = new AbortController();
      rawBotResponse = await fetchAIResponse({
        userText: text,
        messages,
        contextData,
        user,
        BACKEND_API_URL,
        token: null, // Let chatBrain automatically resolve from LocalStorage for safety
        signal: abortControllerRef.current.signal
      });
    }

    if (rawBotResponse === null) {
      // Aborted request
      setIsTyping(false);
      return; 
    }

    // Process Bot Response
    const { finalBotText, triggerEscalation, structuredData } = processBotResponse(rawBotResponse);

    // Prevent false-positive immediate escalation on simple greetings
    const lowerText = text.toLowerCase().trim();
    const simpleGreetings = ['hello', 'hi', 'hey', 'good morning', 'good afternoon', 'good evening', 'sup', 'helo', 'namaste'];
    let finalEscalation = triggerEscalation;
    if (simpleGreetings.includes(lowerText)) {
      finalEscalation = false;
    }

    const botMsg = {
      id: `bot-${Date.now()}-${Math.random()}`,
      sender: 'bot',
      type: 'text',
      text: finalBotText,
      structuredData: structuredData,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, botMsg]);
    setIsTyping(false);

    // Handle True Escalation Trigger
    if (finalEscalation) {
      setIsEscalated(true);
      setSupportStatus(SUPPORT_STATUS.ESCALATING);
      setMessages(prev => [...prev, { id: Date.now(), type: 'system', text: 'Transferring chat to a support agent...' }]);
      
      escalate({
        userId: user?.id || 'guest_user',
        userName: user?.name || 'Guest',
        orderId: contextData?.id || null,
        history: [...messages, userMsg].slice(-10) // Sending context up to 10 messages safely
      });
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100]"
          />

          <motion.div
            initial={{ x: '100%', opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: '100%', opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed top-0 right-0 h-full w-full sm:w-[400px] bg-slate-50 shadow-2xl z-[101] flex flex-col border-l border-slate-200"
          >
            <ChatHeader onClose={onClose} supportStatus={supportStatus} agent={agent} />

            {/* ORDER CONTEXT RENDERED SAFELY */}
            {contextData && contextData.items?.[0] && (
              <div className="bg-white p-4 border-b border-slate-200 flex items-center gap-4 shadow-sm z-10 flex-shrink-0">
                <div className="w-16 h-16 bg-slate-100 rounded-xl overflow-hidden border border-slate-200 flex-shrink-0">
                  <img
                    src={contextData.items[0].image || 'https://via.placeholder.com/150'}
                    alt="Context Product"
                    className="w-full h-full object-cover"
                  />
                </div>
                <div>
                  <span className="text-[10px] font-black text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded uppercase tracking-widest">
                    Order Context
                  </span>
                  <h3 className="font-bold text-slate-800 text-sm mt-1 line-clamp-1">
                    {contextData.items[0].title || 'Order Details'}
                  </h3>
                  <p className="text-xs text-slate-500 font-mono mt-0.5">
                    ID: #{contextData.id}
                  </p>
                </div>
              </div>
            )}

            <div className="flex-1 overflow-y-auto p-4 bg-slate-50 relative">
              {messages.map((msg) => (
                <MessageBubble key={msg.id} msg={msg} />
              ))}

              {isTyping && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex bg-white border border-slate-200 rounded-2xl rounded-tl-sm p-4 shadow-sm max-w-[80px] mr-auto items-center gap-1.5 mb-4">
                  <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce"></div>
                  <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                  <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                </motion.div>
              )}
              <div ref={chatEndRef} className="h-1" />
            </div>

            <ChatInput 
              onSend={handleSend} 
              isTyping={isTyping} 
              isEscalated={isEscalated} 
              messagesCount={messages.length} 
              supportStatus={supportStatus}
            />
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default Chat;