// services/orderStateMachine.js
/**
 * Enterprise Order State Machine
 * Enforces strict allowable state transitions for orders.
 */
const ALLOWED_STATE_TRANSITIONS = {
  'Pending': ['Paid', 'Processing', 'Shipped', 'Cancelled'],
  'Paid': ['Processing', 'Shipped', 'Cancelled'],
  'Processing': ['Shipped', 'Cancelled'],
  'Shipped': ['OutForDelivery', 'Delivered'],
  'OutForDelivery': ['Delivered'],
  'Delivered': [],
  'Cancelled': []
};

/**
 * Validates if a state transition from currentStatus to nextStatus is permitted.
 * 
 * @param {string} currentStatus 
 * @param {string} nextStatus 
 * @returns {boolean}
 */
const isValidTransition = (currentStatus, nextStatus) => {
  if (!currentStatus || !nextStatus) return false;
  if (currentStatus === nextStatus) return true; // Idempotent no-op state update
  
  const allowedNextStates = ALLOWED_STATE_TRANSITIONS[currentStatus] || [];
  return allowedNextStates.includes(nextStatus);
};

module.exports = {
  ALLOWED_STATE_TRANSITIONS,
  isValidTransition
};