// components/support/ChatInput.jsx
import React, { useState } from 'react';
import { FiSend, FiCheckCircle } from 'react-icons/fi';
import { predefinedOptions } from '../../utils/chatBrain';

const ChatInput = ({ onSend, isTyping, isEscalated, messagesCount, supportStatus }) => {
  const [inputText, setInputText] = useState('');
  const [isComposing, setIsComposing] = useState(false);

  const handleSend = () => {
    if (!inputText.trim() || isTyping) return;
    onSend(inputText.trim());
    setInputText('');
  };

  const handleKeyDown = (e) => {
    // Prevent sending if user is currently selecting a Japanese/Hindi character via IME
    if (e.key === 'Enter' && !e.shiftKey && !isComposing) {
      e.preventDefault();
      handleSend();
    }
  };

  const isResolved = supportStatus === 'RESOLVED';

  return (
    <div className="bg-white border-t border-slate-200 pb-safe flex flex-col">
      {/* QUICK OPTIONS (Only show early in chat, when not escalating/resolved) */}
      {messagesCount < 4 && !isTyping && !isEscalated && !isResolved && (
        <div className="p-3 bg-slate-50 border-b border-slate-200 flex overflow-x-auto scrollbar-hide gap-2 flex-shrink-0">
          {predefinedOptions.map((opt, idx) => (
            <button
              key={idx}
              onClick={() => onSend(opt.label, opt.reply)}
              className="whitespace-nowrap px-4 py-2 bg-white border border-[#FF4500]/30 text-[#FF4500] hover:bg-[#FF4500] hover:text-white rounded-full text-xs font-bold transition-colors shadow-sm focus:outline-none focus:ring-2 focus:ring-[#FF4500]"
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}

      {/* INPUT AREA */}
      <div className="p-4 relative flex flex-col">
        <div className="flex items-center gap-3 relative">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onCompositionStart={() => setIsComposing(true)}
            onCompositionEnd={() => setIsComposing(false)}
            onKeyDown={handleKeyDown}
            disabled={isResolved || isTyping}
            placeholder={isResolved ? "This chat is resolved." : "Type your issue..."}
            aria-label="Message Input"
            className="flex-1 bg-slate-50 border border-slate-200 rounded-full py-3.5 pl-5 pr-12 text-sm focus:outline-none focus:border-[#FF4500] focus:bg-white transition-colors disabled:opacity-60 disabled:bg-slate-100"
          />
          <button
            onClick={handleSend}
            disabled={!inputText.trim() || isTyping || isResolved}
            aria-label="Send Message"
            className="absolute right-2 p-2 bg-[#FF4500] disabled:bg-slate-300 text-white rounded-full hover:bg-orange-600 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-[#FF4500]"
          >
            <FiSend size={16} className="relative right-0.5 top-0.5" />
          </button>
        </div>
        <p className="text-center text-[10px] text-slate-400 mt-3 font-medium flex items-center justify-center gap-1">
          <FiCheckCircle /> Secured by Jack Support {isEscalated ? 'Enterprise' : 'API'}
        </p>
      </div>
    </div>
  );
};

export default ChatInput;