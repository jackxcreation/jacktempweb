import { useState, useCallback } from 'react';

export const SUPPORT_STATUS = {
  AI_ACTIVE: 'AI_ACTIVE',
  ESCALATING: 'ESCALATING',
  HUMAN_ACTIVE: 'HUMAN_ACTIVE',
  RESOLVED: 'RESOLVED',
  CLOSED: 'CLOSED'
};

export const useSupportState = () => {
  const [status, setStatus] = useState(SUPPORT_STATUS.AI_ACTIVE);
  const [agent, setAgent] = useState(null);

  const setEscalating = useCallback(() => {
    setStatus(SUPPORT_STATUS.ESCALATING);
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

  const resetState = useCallback(() => {
    setStatus(SUPPORT_STATUS.AI_ACTIVE);
    setAgent(null);
  }, []);

  return {
    status,
    agent,
    isEscalated: status === SUPPORT_STATUS.ESCALATING || status === SUPPORT_STATUS.HUMAN_ACTIVE,
    isResolved: status === SUPPORT_STATUS.RESOLVED,
    setEscalating,
    setHumanActive,
    setResolved,
    resetState
  };
};