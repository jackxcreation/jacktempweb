/**
 * Calculates ticket SLA deadline based on priority level.
 * Enhanced with case-normalization and fallback safety.
 */
const calculateSLA = (priority) => {
  const now = new Date();
  let deadline = new Date(now);

  // 🔥 FIX: Normalize priority to uppercase to handle lowercase inputs safely
  const safePriority = (priority || 'MEDIUM').toUpperCase();

  switch (safePriority) {
    case 'URGENT':
      deadline.setHours(now.getHours() + 1); // 1 hour SLA
      break;
    case 'HIGH':
      deadline.setHours(now.getHours() + 4); // 4 hours SLA
      break;
    case 'LOW':
      deadline.setHours(now.getHours() + 48); // 48 hours SLA
      break;
    case 'MEDIUM':
    default:
      deadline.setHours(now.getHours() + 24); // 24 hours SLA
      break;
  }

  return { deadline, status: 'NORMAL' };
};

/**
 * 🔥 NEW HELPER: Checks if a given SLA deadline has already been breached
 */
const isSLABreached = (deadline) => {
  if (!deadline) return false;
  return new Date() > new Date(deadline);
};

module.exports = { 
  calculateSLA, 
  isSLABreached 
};