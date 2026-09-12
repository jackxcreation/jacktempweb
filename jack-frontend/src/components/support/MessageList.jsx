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
    <div className="flex-1 overflow-y-auto p-4 bg-slate-50 relative flex flex-col">
      {messages.map((msg) => {
        // Special System Messages
        if (msg.type === 'agent_joined') {
          return <AgentConnectedCard key={msg.id} agent={msg.agent} />;
        }
        
        // Standard Text & Rich Card Messages
        return <MessageBubble key={msg.id} msg={msg} />;
      })}

      {/* AI Processing / Human Typing Indicator */}
      {isTyping && supportStatus !== 'RESOLVED' && (
        <AIThinkingIndicator />
      )}

      {/* End of Chat Lifecycle */}
      {supportStatus === 'RESOLVED' && (
        <ConversationResolved onRestart={onRestart} />
      )}

      {/* Auto-scroll Anchor */}
      <div ref={chatEndRef} className="h-2 flex-shrink-0" />
    </div>
  );
};

export default MessageList;