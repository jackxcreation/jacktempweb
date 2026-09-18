// utils/socketEvents.js

/**
 * Centralized definition of Socket.io Support Events.
 * Enhanced with synchronized event keys used across all backend services.
 */
const SUPPORT_EVENTS = {
  // Connection & Rooms
  JOIN_USER_ROOM: 'join_user_room',
  SUBSCRIBE_ADMIN_CHANNELS: 'subscribe_admin_channels',
  
  // Escalation & Tickets
  ESCALATE_TO_HUMAN: 'escalate_to_human',
  TICKET_CREATED: 'support:ticket_created',
  TICKET_RESOLVED: 'ticket_resolved',
  
  // Messaging
  CUSTOMER_MESSAGE: 'support:message',
  ADMIN_REPLY: 'admin_reply',
  RECEIVE_ADMIN_REPLY: 'receive_admin_reply',
  
  // Real-time UI States
  AGENT_JOINED: 'support:agent_joined',
  TYPING: 'support:typing',
  
  // Security
  FORCE_LOGOUT: 'force_logout',

  // 🔥 Synchronized event keys matching our backend services & socket manager
  TICKET_UPDATED: 'ticketUpdated',
  AGENT_WORKLOAD_UPDATED: 'agentWorkloadUpdated',
  NEW_MESSAGE: 'support:new_message',
  ESCALATION_SUCCESS: 'escalation_success'
};

module.exports = SUPPORT_EVENTS;