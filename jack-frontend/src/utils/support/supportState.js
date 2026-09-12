// jack-frontend/src/utils/support/supportState.js

/**
 * Core Enums for the Support Lifecycle
 */
export const SUPPORT_STATUS = {
  AI_ACTIVE: 'AI_ACTIVE',
  ESCALATING: 'ESCALATING',
  WAITING_FOR_AGENT: 'WAITING_FOR_AGENT',
  HUMAN_ACTIVE: 'HUMAN_ACTIVE',
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
export const isChatInputDisabled = (status) => {
  return [SUPPORT_STATUS.RESOLVED, SUPPORT_STATUS.CLOSED].includes(status);
};

/**
 * Determines if the user is actively connected to a human agent.
 */
export const isHumanActive = (status) => {
  return status === SUPPORT_STATUS.HUMAN_ACTIVE;
};