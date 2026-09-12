const POLICIES = {
  RETURN_WINDOW_DAYS: 7,
  FREE_SHIPPING_THRESHOLD: 999,
  ALLOWED_CANCELLATION_STATUSES: ['PROCESSING', 'PLACED'],
};

const canCancelOrder = (orderStatus) => {
  return POLICIES.ALLOWED_CANCELLATION_STATUSES.includes(orderStatus);
};

const canReturnOrder = (deliveryDate) => {
  if (!deliveryDate) return false;
  const daysSinceDelivery = (Date.now() - new Date(deliveryDate).getTime()) / (1000 * 60 * 60 * 24);
  return daysSinceDelivery <= POLICIES.RETURN_WINDOW_DAYS;
};

module.exports = { POLICIES, canCancelOrder, canReturnOrder };