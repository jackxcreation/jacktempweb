const POLICIES = {
  RETURN_WINDOW_DAYS: 7,
  FREE_SHIPPING_THRESHOLD: 999,
  ALLOWED_CANCELLATION_STATUSES: ['PROCESSING', 'PLACED', 'CONFIRMED', 'PENDING'],
};

/**
 * Checks if an order can be cancelled based on its status.
 * Enhanced with case-normalization.
 */
const canCancelOrder = (orderStatus) => {
  if (!orderStatus || typeof orderStatus !== 'string') return false;
  const safeStatus = orderStatus.toUpperCase();
  return POLICIES.ALLOWED_CANCELLATION_STATUSES.includes(safeStatus);
};

/**
 * Checks if an order is still within the eligible return window.
 */
const canReturnOrder = (deliveryDate) => {
  if (!deliveryDate) return false;
  
  const deliveryTime = new Date(deliveryDate).getTime();
  if (isNaN(deliveryTime)) return false; // Invalid date check

  const daysSinceDelivery = (Date.now() - deliveryTime) / (1000 * 60 * 60 * 24);
  
  // Ensure we don't return true for negative time (future dates)
  if (daysSinceDelivery < 0) return false;

  return daysSinceDelivery <= POLICIES.RETURN_WINDOW_DAYS;
};

/**
 * 🔥 NEW HELPER: Checks if an order total qualifies for free shipping
 */
const isEligibleForFreeShipping = (orderTotal) => {
  const total = parseFloat(orderTotal);
  if (isNaN(total)) return false;
  return total >= POLICIES.FREE_SHIPPING_THRESHOLD;
};

/**
 * 🔥 NEW HELPER: Returns the remaining days left for eligible return
 */
const getRemainingReturnDays = (deliveryDate) => {
  if (!deliveryDate) return 0;
  
  const deliveryTime = new Date(deliveryDate).getTime();
  if (isNaN(deliveryTime)) return 0;

  const daysSinceDelivery = (Date.now() - deliveryTime) / (1000 * 60 * 60 * 24);
  const remaining = POLICIES.RETURN_WINDOW_DAYS - daysSinceDelivery;

  return remaining > 0 ? Math.ceil(remaining) : 0;
};

module.exports = { 
  POLICIES, 
  canCancelOrder, 
  canReturnOrder, 
  isEligibleForFreeShipping, 
  getRemainingReturnDays 
};