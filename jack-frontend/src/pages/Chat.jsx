import React, { useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { API_URL } from '../config'; 
import { fetchAIResponse, processBotResponse } from '../utils/chatBrain'; 

// 🔥 BULLETPROOF HOOKS IMPORTS (Fixed Paths & Duplicates based on your Folder Structure)
import { useSupportChat } from "../hooks/useSupportChat";
import { useConversation } from "../hooks/useConversation";
import { useSupportSocket } from "../hooks/useSupportSocket"; // Added missing import!
import { useSupportState } from '../hooks/support/useSupportState'; // This one is inside 'support' folder

// 🔥 IMPORTED MODULAR UI COMPONENTS
import ChatHeader from '../components/support/ChatHeader';
import ChatInput from '../components/support/ChatInput';
import MessageList from '../components/support/MessageList';
import HumanModeBanner from '../components/support/HumanModeBanner';
import AIThinkingIndicator from '../components/support/AIThinkingIndicator';
import ConversationResolved from '../components/support/ConversationResolved';

const Chat = ({ isOpen, onClose, contextData, user }) => {
  // 1. Context-Aware Conversation (Prevents Chat Bleeding between orders)
  const { conversationId, resetConversation } = useConversation(user, contextData?.id || contextData?._id || 'general');
  
  // 2. Centralized State Manager (Prevents UI bugs)
  const { 
    status, agent, isEscalated, isResolved, isHumanActive, isAiActive,
    setEscalating, setWaitingForAgent, setHumanActive, setResolved, resetState, syncWithBackend 
  } = useSupportState();

  // 3. Robust Chat Manager (Fixes Double-Bubble & manages AbortControllers for API Security)
  const { 
    messages, isTyping, setIsTyping, addMessage, clearMessages, createAbortSignal 
  } = useSupportChat();

  const BACKEND_API_URL = `${API_URL}/support/message`;

  // 4. Secure Socket Connection (No Infinite Re-renders)
  const { escalate } = useSupportSocket({
    API_URL,
    isOpen,
    user,
    conversationId,
    onAdminReply: (msg) => {
      addMessage({ ...msg, sender: 'admin' });
      setHumanActive();
      setIsTyping(false); 
    },
    onSystemEvent: (event) => {
      if (!event) return;
      if (event.type === 'agent_joined') {
        setHumanActive(event.agent);
        addMessage({ id: `sys-${Date.now()}`, type: 'system', text: `${event.agent?.name || 'An agent'} joined the chat.` });
      } else if (event.type === 'ticket_resolved') {
        setResolved();
        addMessage({ id: `sys-${Date.now()}`, type: 'system', text: 'This support ticket has been resolved.' });
      }
    }
  });

  // Safe Close Handler (Instantly aborts pending API calls to save bandwidth)
  const handleSafeClose = useCallback(() => {
    createAbortSignal(); // Cancels any running fetch request
    if (onClose) onClose();
  }, [onClose, createAbortSignal]);

  // Keyboard accessibility
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) handleSafeClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleSafeClose]);

  // Initial Context Load
  useEffect(() => {
    if (isOpen && messages.length === 0) {
      addMessage({
        id: `init-${Date.now()}`,
        sender: 'bot',
        type: 'text',
        text: `Hi ${user?.name || 'there'}! Welcome to Jack Essentials Support. I am Jack, your AI Support Manager. Kaise help kar sakta hoon aaj aapki?`,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      });
    }
  }, [isOpen, user, messages.length, addMessage]);

  const handleRestart = () => {
    resetConversation();
    clearMessages();
    resetState();
    setTimeout(() => {
      addMessage({
        id: `init-${Date.now()}`,
        sender: 'bot',
        type: 'text',
        text: `Hi ${user?.name || 'there'}! Welcome back to Jack Essentials Support. How can I help you today?`,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      });
    }, 100);
  };

  const handleSend = async (text, predefinedReply = null) => {
    // 🔥 SECURITY: Prevent spamming empty requests or double-sending while AI is already typing
    if (!text || !text.trim() || isTyping) return;

    const trimmedText = text.trim();
    const userMsg = {
      id: `usr-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      sender: 'user',
      type: 'text',
      text: trimmedText,
      status: 'sent',
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    addMessage(userMsg);

    // Human Escalation Loop (Bypass AI API to save costs)
    if (isEscalated || isHumanActive) {
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
        // 🔥 SECURITY: Generates a fresh abort signal. If user closes chat, API call drops instantly.
        const activeSignal = createAbortSignal();
        rawBotResponse = await fetchAIResponse({
          userText: trimmedText,
          messages,
          contextData,
          user,
          BACKEND_API_URL,
          token: null, 
          signal: activeSignal
        });
      } catch (error) {
        if (error.name !== 'AbortError') console.error("Chat API Call Failed:", error);
        rawBotResponse = { text: "I'm having trouble connecting right now. Could you please try again?" };
      }
    }

    if (!rawBotResponse) {
      setIsTyping(false);
      return; 
    }

    let { finalBotText, triggerEscalation, structuredData } = processBotResponse(rawBotResponse);

    // Deep Payload Fallback
    if (!finalBotText || typeof finalBotText !== 'string' || finalBotText.trim() === '') {
      finalBotText = rawBotResponse?.data?.message?.content || rawBotResponse?.message?.content || rawBotResponse?.text || "I'm having trouble connecting right now.";
    }

    // Prevent false-positive immediate escalation
    const simpleGreetings = ['hello', 'hi', 'hey', 'good morning', 'good afternoon', 'good evening', 'sup', 'helo', 'namaste'];
    if (simpleGreetings.includes(trimmedText.toLowerCase())) {
      triggerEscalation = false;
    }

    addMessage({
      id: `bot-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      sender: 'bot',
      type: structuredData ? 'structured' : 'text',
      text: finalBotText,
      structuredData: structuredData,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    });
    
    setIsTyping(false);

    if (triggerEscalation) {
      setWaitingForAgent();
      addMessage({ id: `sys-${Date.now()}`, type: 'system', text: 'Transferring chat to a support agent...' });
      
      escalate({
        conversationId,
        userId: user?.id || user?._id || 'guest_user',
        userName: user?.name || 'Guest',
        orderId: contextData?.id || contextData?._id || null,
        history: [...messages, userMsg].slice(-10) 
      });
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={handleSafeClose}
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100]"
          />

          <motion.div
            initial={{ x: '100%', opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: '100%', opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed top-0 right-0 h-full w-full sm:w-[400px] bg-slate-50 shadow-2xl z-[101] flex flex-col border-l border-slate-200"
          >
            <ChatHeader onClose={handleSafeClose} supportStatus={status} agent={agent} />

            {/* 🔥 INTEGRATED UI COMPONENTS FROM YOUR DIRECTORY */}
            {isHumanActive && <HumanModeBanner agent={agent} />}
            {isResolved && <ConversationResolved onRestart={handleRestart} />}

            {contextData && contextData.items?.[0] && !isResolved && (
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

            <div className="flex-1 overflow-y-auto relative p-4 flex flex-col gap-3">
              <MessageList messages={messages} supportStatus={status} />
              
              {/* 🔥 AI THINKING INDICATOR INTEGRATED */}
              {isTyping && isAiActive && (
                <div className="self-start mt-2">
                  <AIThinkingIndicator />
                </div>
              )}
            </div>

            <ChatInput 
              onSend={handleSend} 
              isTyping={isTyping} 
              isEscalated={isEscalated} 
              messagesCount={messages.length} 
              supportStatus={status}
            />
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default Chat;