// jack-frontend/src/hooks/support/useSupportState.js
import { useState, useCallback } from 'react';

// Single Source of Truth for Chat Statuses
export const SUPPORT_STATUS = {
  AI_ACTIVE: 'AI_ACTIVE',
  ESCALATING: 'ESCALATING',
  WAITING_FOR_AGENT: 'WAITING_FOR_AGENT',
  HUMAN_ACTIVE: 'HUMAN_ACTIVE',
  RESOLVED: 'RESOLVED',
  CLOSED: 'CLOSED',
  // 🔥 Added backend sync statuses to prevent mismatch bugs
  OPEN: 'OPEN',
  PENDING: 'PENDING',
  ASSIGNED: 'ASSIGNED',
  IN_PROGRESS: 'IN_PROGRESS',
  ESCALATED: 'ESCALATED'
};

export const useSupportState = (initialStatus = SUPPORT_STATUS.AI_ACTIVE) => {
  // 🔥 Normalize initial status to uppercase for consistency
  const [status, setStatusInternal] = useState(() => String(initialStatus || SUPPORT_STATUS.AI_ACTIVE).toUpperCase());
  const [agent, setAgent] = useState(null);

  // 🔥 Robust status setter that always normalizes input to uppercase
  const setStatus = useCallback((newStatus) => {
    if (newStatus) {
      setStatusInternal(String(newStatus).toUpperCase());
    }
  }, []);

  const setAiActive = useCallback(() => {
    setStatusInternal(SUPPORT_STATUS.AI_ACTIVE);
  }, []);

  const setEscalating = useCallback(() => {
    setStatusInternal(SUPPORT_STATUS.ESCALATING);
  }, []);

  const setWaitingForAgent = useCallback(() => {
    setStatusInternal(SUPPORT_STATUS.WAITING_FOR_AGENT);
  }, []);

  const setHumanActive = useCallback((assignedAgent) => {
    setStatusInternal(SUPPORT_STATUS.HUMAN_ACTIVE);
    if (assignedAgent) {
      setAgent(assignedAgent);
    }
  }, []);

  const setResolved = useCallback(() => {
    setStatusInternal(SUPPORT_STATUS.RESOLVED);
  }, []);

  const setClosed = useCallback(() => {
    setStatusInternal(SUPPORT_STATUS.CLOSED);
  }, []);

  // 🔥 New helper setters for backend ticket statuses without deleting any old ones
  const setOpen = useCallback(() => {
    setStatusInternal(SUPPORT_STATUS.OPEN);
  }, []);

  const setPending = useCallback(() => {
    setStatusInternal(SUPPORT_STATUS.PENDING);
  }, []);

  const setAssigned = useCallback(() => {
    setStatusInternal(SUPPORT_STATUS.ASSIGNED);
  }, []);

  const setInProgress = useCallback(() => {
    setStatusInternal(SUPPORT_STATUS.IN_PROGRESS);
  }, []);

  const resetState = useCallback(() => {
    setStatusInternal(SUPPORT_STATUS.AI_ACTIVE);
    setAgent(null);
  }, []);

  // 🔥 Unified handler to process backend API/Socket payloads in one single render cycle
  const syncWithBackend = useCallback((backendStatus, backendAgent = undefined) => {
    if (backendStatus) {
      setStatusInternal(String(backendStatus).toUpperCase());
    }
    if (backendAgent !== undefined) {
      setAgent(backendAgent);
    }
  }, []);

  const upperStatus = String(status || SUPPORT_STATUS.AI_ACTIVE).toUpperCase();

  return {
    // 🔥 Always return the strictly uppercase status to prevent UI bugs
    status: upperStatus,
    agent,

    // 🔥 Comprehensive derived boolean flags for UI Components
    isAiActive: upperStatus === SUPPORT_STATUS.AI_ACTIVE,
    isEscalating: upperStatus === SUPPORT_STATUS.ESCALATING || upperStatus === SUPPORT_STATUS.ESCALATED,
    isWaitingForAgent: upperStatus === SUPPORT_STATUS.WAITING_FOR_AGENT || upperStatus === SUPPORT_STATUS.ESCALATING || upperStatus === SUPPORT_STATUS.PENDING,
    isHumanActive: upperStatus === SUPPORT_STATUS.HUMAN_ACTIVE || upperStatus === SUPPORT_STATUS.ASSIGNED || upperStatus === SUPPORT_STATUS.IN_PROGRESS,
    isResolved: upperStatus === SUPPORT_STATUS.RESOLVED,
    isClosed: upperStatus === SUPPORT_STATUS.CLOSED,
    
    // 🔥 Backend status flags
    isOpen: upperStatus === SUPPORT_STATUS.OPEN,
    isPending: upperStatus === SUPPORT_STATUS.PENDING,
    isAssigned: upperStatus === SUPPORT_STATUS.ASSIGNED,
    isInProgress: upperStatus === SUPPORT_STATUS.IN_PROGRESS,
    
    // 🔥 Instantly tells the UI if the chat input box should be locked/disabled
    isInputDisabled: upperStatus === SUPPORT_STATUS.RESOLVED || upperStatus === SUPPORT_STATUS.CLOSED,
    
    // Catch-all for any human-involved state
    isEscalated: [SUPPORT_STATUS.ESCALATING, SUPPORT_STATUS.ESCALATED, SUPPORT_STATUS.WAITING_FOR_AGENT, SUPPORT_STATUS.HUMAN_ACTIVE, SUPPORT_STATUS.ASSIGNED, SUPPORT_STATUS.IN_PROGRESS].includes(upperStatus),

    setAiActive,
    setEscalating,
    setWaitingForAgent,
    setHumanActive,
    setResolved,
    setClosed,
    setOpen,
    setPending,
    setAssigned,
    setInProgress,
    resetState,
    setStatus,
    syncWithBackend
  };
};

export default useSupportState;