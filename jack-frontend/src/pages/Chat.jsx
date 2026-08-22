import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiX, FiSend, FiCheckCircle } from 'react-icons/fi';
import { io } from 'socket.io-client';
import { API_URL } from '../config';

// ✅ IMPORT BRAIN
import {
  predefinedOptions,
  fetchAIResponse,
  processBotResponse
} from '../utils/chatBrain';

const Chat = ({ isOpen, onClose, contextData, user }) => {

  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isEscalated, setIsEscalated] = useState(false);

  const chatEndRef = useRef(null);
  const socketRef = useRef(null);

  // ✅ BACKEND API
  const BACKEND_API_URL = `${API_URL}/chat`;

  useEffect(() => {

    if (isOpen) {

      const initialMessage = {
        id: Date.now(),
        sender: 'bot',
        text: `Hi ${user?.name || 'there'}! Welcome to Jack Essentials Support. I am Jack, your AI Support Manager. Kaise help kar sakta hoon aaj aapki?`,
        time: new Date().toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit'
        })
      };

      if (messages.length === 0) {
        setMessages([initialMessage]);
      }

      socketRef.current = io(API_URL);

      const userIdForSocket = user?.id || 'guest_user';

      socketRef.current.emit(
        'join_user_room',
        userIdForSocket
      );

      socketRef.current.on(
        'receive_admin_reply',
        (data) => {

          const adminMsg = {
            id: Date.now(),
            sender: 'admin',
            text: data.text,
            time: data.time
          };

          setMessages(prev => [...prev, adminMsg]);

          setIsEscalated(true);
        }
      );
    }

    return () => {

      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };

    // eslint-disable-next-line react-hooks/exhaustive-deps

  }, [isOpen, user]);



  useEffect(() => {
    chatEndRef.current?.scrollIntoView({
      behavior: 'smooth'
    });
  }, [messages, isTyping]);



  // ✅ UPDATED HANDLE SEND
  const handleSend = async (
    text,
    predefinedReply = null
  ) => {

    if (!text.trim()) return;

    const userMsg = {
      id: Date.now(),
      sender: 'user',
      text,
      time: new Date().toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit'
      })
    };

    setMessages(prev => [...prev, userMsg]);

    setInputText('');



    // ✅ HUMAN ESCALATED
    if (isEscalated) {

      socketRef.current.emit(
        'escalate_to_human',
        {
          userId: user?.id || 'guest_user',
          userName: user?.name || 'Guest',
          orderId: contextData?.id || null,
          history: [
            {
              sender: 'user',
              text
            }
          ]
        }
      );

      return;
    }



    setIsTyping(true);

    let rawBotResponse = predefinedReply;



    // ✅ AI RESPONSE
    if (!rawBotResponse) {

      rawBotResponse = await fetchAIResponse({
        userText: text,
        messages,
        contextData,
        user,
        BACKEND_API_URL
      });
    }



    // ✅ PROCESS RESPONSE
    const {
      finalBotText,
      triggerEscalation
    } = processBotResponse(rawBotResponse);



    const botMsg = {
      id: Date.now() + 1,
      sender: 'bot',
      text: finalBotText,
      time: new Date().toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit'
      })
    };



    setMessages(prev => [...prev, botMsg]);

    setIsTyping(false);



    // ✅ ESCALATION
    if (triggerEscalation) {

      setIsEscalated(true);

      socketRef.current.emit(
        'escalate_to_human',
        {
          userId: user?.id || 'guest_user',
          userName: user?.name || 'Guest',
          orderId: contextData?.id || null,
          history: [...messages, userMsg].slice(-5)
        }
      );
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
            transition={{
              type: 'spring',
              damping: 25,
              stiffness: 200
            }}
            className="fixed top-0 right-0 h-full w-full sm:w-[400px] bg-slate-50 shadow-2xl z-[101] flex flex-col border-l border-slate-200"
          >

            {/* HEADER */}
            <div className={`text-white p-4 sm:p-5 flex items-center justify-between shadow-md z-10 transition-colors ${isEscalated ? 'bg-indigo-600' : 'bg-slate-900'}`}>

              <div>
                <h2 className="font-black text-lg flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                  Jack Support
                </h2>

                <p className="text-xs text-slate-300 mt-0.5">
                  {
                    isEscalated
                      ? 'Live Human Agent'
                      : 'AI Assistant (Powered by Groq)'
                  }
                </p>
              </div>

              <button
                onClick={onClose}
                className="p-2 hover:bg-white/10 rounded-full transition-colors text-slate-100"
              >
                <FiX size={24} />
              </button>

            </div>



            {/* ORDER CONTEXT */}
            {contextData && (

              <div className="bg-white p-4 border-b border-slate-200 flex items-center gap-4 shadow-sm z-10">

                <div className="w-16 h-16 bg-slate-100 rounded-xl overflow-hidden border border-slate-200 flex-shrink-0">

                  <img
                    src={
                      contextData.items?.[0]?.image ||
                      'https://via.placeholder.com/150'
                    }
                    alt="Context Product"
                    className="w-full h-full object-cover"
                  />

                </div>

                <div>

                  <span className="text-[10px] font-black text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded uppercase tracking-widest">
                    Order Context
                  </span>

                  <h3 className="font-bold text-slate-800 text-sm mt-1 line-clamp-1">
                    {
                      contextData.items?.[0]?.title ||
                      'Order Details'
                    }
                  </h3>

                  <p className="text-xs text-slate-500 font-mono mt-0.5">
                    ID: #{contextData.id}
                  </p>

                </div>

              </div>
            )}



            {/* CHAT */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50">

              {messages.map((msg) => (

                <div
                  key={msg.id}
                  className={`flex flex-col max-w-[85%] ${
                    msg.sender === 'user'
                      ? 'ml-auto items-end'
                      : 'mr-auto items-start'
                  }`}
                >

                  <div
                    className={`p-3.5 rounded-2xl text-sm shadow-sm leading-relaxed 
                    ${
                      msg.sender === 'user'
                        ? 'bg-[#FF4500] text-white rounded-tr-sm'
                        : msg.sender === 'admin'
                        ? 'bg-indigo-100 border border-indigo-200 text-indigo-900 rounded-tl-sm'
                        : 'bg-white border border-slate-200 text-slate-800 rounded-tl-sm'
                    }`}
                  >

                    {msg.sender === 'admin' && (
                      <span className="block text-[10px] font-black text-indigo-500 uppercase tracking-widest mb-1">
                        Support Agent
                      </span>
                    )}

                    {msg.text}

                  </div>

                  <span className="text-[10px] text-slate-400 mt-1 px-1 font-medium">
                    {msg.time}
                  </span>

                </div>
              ))}



              {/* TYPING */}
              {isTyping && (

                <div className="flex bg-white border border-slate-200 rounded-2xl rounded-tl-sm p-4 shadow-sm max-w-[80px] mr-auto items-center gap-1.5">

                  <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce"></div>

                  <div
                    className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce"
                    style={{ animationDelay: '0.1s' }}
                  ></div>

                  <div
                    className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce"
                    style={{ animationDelay: '0.2s' }}
                  ></div>

                </div>
              )}

              <div ref={chatEndRef} />

            </div>



            {/* QUICK OPTIONS */}
            {
              messages.length < 3 &&
              !isTyping &&
              !isEscalated && (

                <div className="p-3 bg-slate-50 border-t border-slate-200 flex overflow-x-auto scrollbar-hide gap-2 flex-shrink-0">

                  {predefinedOptions.map((opt, idx) => (

                    <button
                      key={idx}
                      onClick={() =>
                        handleSend(
                          opt.label,
                          opt.reply
                        )
                      }
                      className="whitespace-nowrap px-4 py-2 bg-white border border-[#FF4500]/30 text-[#FF4500] hover:bg-[#FF4500] hover:text-white rounded-full text-xs font-bold transition-colors shadow-sm"
                    >
                      {opt.label}
                    </button>
                  ))}

                </div>
              )
            }



            {/* INPUT */}
            <div className="p-4 bg-white border-t border-slate-200 pb-safe">

              <div className="flex items-center gap-3 relative">

                <input
                  type="text"
                  value={inputText}
                  onChange={(e) =>
                    setInputText(e.target.value)
                  }
                  onKeyDown={(e) =>
                    e.key === 'Enter' &&
                    handleSend(inputText)
                  }
                  placeholder="Type your issue..."
                  className="flex-1 bg-slate-50 border border-slate-200 rounded-full py-3.5 pl-5 pr-12 text-sm focus:outline-none focus:border-[#FF4500] focus:bg-white transition-colors"
                />

                <button
                  onClick={() =>
                    handleSend(inputText)
                  }
                  disabled={
                    !inputText.trim() || isTyping
                  }
                  className="absolute right-2 p-2 bg-[#FF4500] disabled:bg-slate-300 text-white rounded-full hover:bg-orange-600 transition-colors"
                >
                  <FiSend
                    size={16}
                    className="relative right-0.5 top-0.5"
                  />
                </button>

              </div>



              <p className="text-center text-[10px] text-slate-400 mt-3 font-medium flex items-center justify-center gap-1">

                <FiCheckCircle />

                Secured by Jack Support {
                  isEscalated ? '' : 'API'
                }

              </p>

            </div>

          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default Chat;