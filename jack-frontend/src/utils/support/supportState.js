// jack-frontend/src/utils/support/supportState.js

/**
 * Core Enums for the Support Conversation Lifecycle (Chat Mode)
 */
export const SUPPORT_STATUS = {
  AI_ACTIVE: 'AI_ACTIVE',
  ESCALATING: 'ESCALATING',
  WAITING_FOR_AGENT: 'WAITING_FOR_AGENT',
  HUMAN_ACTIVE: 'HUMAN_ACTIVE',
  RESOLVED: 'RESOLVED',
  CLOSED: 'CLOSED'
};

/**
 * 🔥 NEW: Core Enums for Support Tickets (Admin Dashboard)
 * Directly synced with backend SupportTicket schema
 */
export const TICKET_STATUS = {
  OPEN: 'OPEN',
  PENDING: 'PENDING',
  ASSIGNED: 'ASSIGNED',
  IN_PROGRESS: 'IN_PROGRESS',
  WAITING_CUSTOMER: 'WAITING_CUSTOMER',
  RESOLVED: 'RESOLVED',
  CLOSED: 'CLOSED'
};

export const TICKET_PRIORITY = {
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
  URGENT: 'URGENT'
};

/**
 * Determines if the chat input box should be disabled based on current status.
 */
export const isChatInputDisabled = (status = '') => {
  const upperStatus = String(status || '').toUpperCase();
  return [SUPPORT_STATUS.RESOLVED, SUPPORT_STATUS.CLOSED, TICKET_STATUS.CLOSED, TICKET_STATUS.RESOLVED].includes(upperStatus);
};

/**
 * Determines if the user is actively connected to a human agent.
 */
export const isHumanActive = (status = '') => {
  const upperStatus = String(status || '').toUpperCase();
  return upperStatus === SUPPORT_STATUS.HUMAN_ACTIVE;
};

/**
 * Determines if the user is currently waiting in queue for a human agent.
 */
export const isWaitingForAgent = (status = '') => {
  const upperStatus = String(status || '').toUpperCase();
  return upperStatus === SUPPORT_STATUS.WAITING_FOR_AGENT || upperStatus === SUPPORT_STATUS.ESCALATING;
};

/**
 * Determines if AI support bot is currently active.
 */
export const isAiActive = (status = '') => {
  const upperStatus = String(status || '').toUpperCase();
  return upperStatus === SUPPORT_STATUS.AI_ACTIVE || !upperStatus;
};

/**
 * 🔥 UPGRADE: Returns Tailwind / UI badge color classes for BOTH Conversation and Ticket statuses.
 * This makes it a universal helper for both the Customer Chat widget and the Admin Dashboard.
 */
export const getSupportStatusBadgeColor = (status = '') => {
  const upperStatus = String(status || '').toUpperCase();
  switch (upperStatus) {
    // Active AI & Open Tickets
    case SUPPORT_STATUS.AI_ACTIVE:
    case TICKET_STATUS.OPEN:
      return 'bg-blue-100 text-blue-800 border border-blue-200';
    
    // Transition & Waiting States
    case SUPPORT_STATUS.ESCALATING:
    case SUPPORT_STATUS.WAITING_FOR_AGENT:
      return 'bg-amber-100 text-amber-800 border border-amber-200 animate-pulse';
    
    // In Progress & Human Handled
    case SUPPORT_STATUS.HUMAN_ACTIVE:
    case TICKET_STATUS.ASSIGNED:
    case TICKET_STATUS.IN_PROGRESS:
      return 'bg-indigo-100 text-indigo-800 border border-indigo-200';
      
    // Pending Customer Action
    case TICKET_STATUS.PENDING:
    case TICKET_STATUS.WAITING_CUSTOMER:
      return 'bg-purple-100 text-purple-800 border border-purple-200';

    // Resolved Successfully
    case SUPPORT_STATUS.RESOLVED:
    case TICKET_STATUS.RESOLVED:
      return 'bg-emerald-100 text-emerald-800 border border-emerald-200';

    // Closed / Archived
    case SUPPORT_STATUS.CLOSED:
    case TICKET_STATUS.CLOSED:
      return 'bg-gray-100 text-gray-800 border border-gray-200';
      
    default:
      return 'bg-slate-100 text-slate-800 border border-slate-200';
  }
};

/**
 * Returns Tailwind / UI badge color classes for ticket priority.
 */
export const getPriorityBadgeColor = (priority = '') => {
  const upperPriority = String(priority || '').toUpperCase();
  switch (upperPriority) {
    case TICKET_PRIORITY.URGENT:
      return 'bg-red-100 text-red-800 border border-red-200 font-bold shadow-sm';
    case TICKET_PRIORITY.HIGH:
      return 'bg-orange-100 text-orange-800 border border-orange-200 font-semibold';
    case TICKET_PRIORITY.MEDIUM:
      return 'bg-yellow-100 text-yellow-800 border border-yellow-200';
    case TICKET_PRIORITY.LOW:
      return 'bg-slate-100 text-slate-700 border border-slate-200';
    default:
      return 'bg-blue-100 text-blue-800 border border-blue-200';
  }
};