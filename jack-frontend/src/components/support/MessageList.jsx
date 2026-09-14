// jack-frontend/src/components/support/MessageList.jsx
import React from 'react';
import MessageBubble from './MessageBubble';
import AIThinkingIndicator from './AIThinkingIndicator';
import ConversationResolved from './ConversationResolved';
import AgentConnectedCard from './AgentConnectedCard';

const MessageList = ({ 
  messages, 
  isTyping, 
  chatEndRef, 
  supportStatus, 
  onRestart 
}) => {
  return (
    <div className="flex-1 overflow-y-auto p-4 bg-slate-50 relative flex flex-col space-y-3">
      {Array.isArray(messages) && messages.map((msg, idx) => {
        if (!msg) return null;
        
        const messageKey = msg.id || msg._id || msg.messageId || `msg-${idx}`;

        // Special System Message: Agent Connected
        if (msg.type === 'agent_joined') {
          return <AgentConnectedCard key={messageKey} agent={msg.agent} />;
        }
        
        // Special System Message: Ticket Resolved / System text notification
        if (msg.type === 'system' || msg.type === 'ticket_resolved') {
          return (
            <div key={messageKey} className="flex justify-center my-2">
              <div className="bg-slate-200/70 text-slate-700 text-xs font-semibold px-3 py-1.5 rounded-full shadow-sm text-center max-w-[85%]">
                {msg.text || msg.content || 'System notification'}
              </div>
            </div>
          );
        }

        // Standard Text, Structured & Rich Card Messages
        return <MessageBubble key={messageKey} msg={msg} />;
      })}

      {/* AI Processing / Human Typing Indicator */}
      {isTyping && supportStatus !== 'RESOLVED' && supportStatus !== 'CLOSED' && (
        <AIThinkingIndicator />
      )}

      {/* End of Chat Lifecycle */}
      {(supportStatus === 'RESOLVED' || supportStatus === 'CLOSED') && (
        <ConversationResolved onRestart={onRestart} />
      )}

      {/* Auto-scroll Anchor */}
      <div ref={chatEndRef} className="h-2 flex-shrink-0" />
    </div>
  );
};

export default MessageList;