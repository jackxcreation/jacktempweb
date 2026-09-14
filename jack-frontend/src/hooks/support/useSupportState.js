// jack-frontend/src/hooks/support/useSupportState.js
import { useState, useCallback } from 'react';

// Single Source of Truth for Chat Statuses
export const SUPPORT_STATUS = {
  AI_ACTIVE: 'AI_ACTIVE',
  ESCALATING: 'ESCALATING',
  WAITING_FOR_AGENT: 'WAITING_FOR_AGENT',
  HUMAN_ACTIVE: 'HUMAN_ACTIVE',
  RESOLVED: 'RESOLVED',
  CLOSED: 'CLOSED'
};

export const useSupportState = (initialStatus = SUPPORT_STATUS.AI_ACTIVE) => {
  const [status, setStatus] = useState(initialStatus);
  const [agent, setAgent] = useState(null);

  const setEscalating = useCallback(() => {
    setStatus(SUPPORT_STATUS.ESCALATING);
  }, []);

  const setWaitingForAgent = useCallback(() => {
    setStatus(SUPPORT_STATUS.WAITING_FOR_AGENT);
  }, []);

  const setHumanActive = useCallback((assignedAgent) => {
    setStatus(SUPPORT_STATUS.HUMAN_ACTIVE);
    if (assignedAgent) {
      setAgent(assignedAgent);
    }
  }, []);

  const setResolved = useCallback(() => {
    setStatus(SUPPORT_STATUS.RESOLVED);
  }, []);

  const setClosed = useCallback(() => {
    setStatus(SUPPORT_STATUS.CLOSED);
  }, []);

  const resetState = useCallback(() => {
    setStatus(SUPPORT_STATUS.AI_ACTIVE);
    setAgent(null);
  }, []);

  // 🔥 NEW UPGRADE: Unified handler to process backend API/Socket payloads in one single render cycle
  const syncWithBackend = useCallback((backendStatus, backendAgent = undefined) => {
    if (backendStatus) {
      setStatus(String(backendStatus).toUpperCase());
    }
    if (backendAgent !== undefined) {
      setAgent(backendAgent);
    }
  }, []);

  const upperStatus = String(status || '').toUpperCase();

  return {
    // 🔥 FIX: Always return the strictly uppercase status to prevent UI bugs
    status: upperStatus,
    agent,

    // 🔥 UPGRADE: Comprehensive derived boolean flags for UI Components
    isAiActive: upperStatus === SUPPORT_STATUS.AI_ACTIVE,
    isEscalating: upperStatus === SUPPORT_STATUS.ESCALATING,
    isWaitingForAgent: upperStatus === SUPPORT_STATUS.WAITING_FOR_AGENT || upperStatus === SUPPORT_STATUS.ESCALATING,
    isHumanActive: upperStatus === SUPPORT_STATUS.HUMAN_ACTIVE,
    isResolved: upperStatus === SUPPORT_STATUS.RESOLVED,
    isClosed: upperStatus === SUPPORT_STATUS.CLOSED,
    
    // 🔥 NEW: Instantly tells the UI if the chat input box should be locked/disabled
    isInputDisabled: upperStatus === SUPPORT_STATUS.RESOLVED || upperStatus === SUPPORT_STATUS.CLOSED,
    
    // Catch-all for any human-involved state
    isEscalated: [SUPPORT_STATUS.ESCALATING, SUPPORT_STATUS.WAITING_FOR_AGENT, SUPPORT_STATUS.HUMAN_ACTIVE].includes(upperStatus),

    setEscalating,
    setWaitingForAgent,
    setHumanActive,
    setResolved,
    setClosed,
    resetState,
    setStatus,
    syncWithBackend
  };
};