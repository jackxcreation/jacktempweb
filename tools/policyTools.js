const { POLICIES } = require('../services/support/supportPolicyService');

const getRefundPolicy = async () => {
  return {
    success: true,
    data: {
      policy: `Refunds are processed within 5-7 business days after the returned item is received and inspected (eligible within the ${POLICIES.RETURN_WINDOW_DAYS || 7}-day return window). Payments are refunded to the original payment method.`
    }
  };
};

const getShippingPolicy = async () => {
  return {
    success: true,
    data: {
      policy: `Standard shipping takes 3-5 business days. Express shipping takes 1-2 business days. Orders over ₹${POLICIES.FREE_SHIPPING_THRESHOLD || 500} qualify for free standard shipping.`
    }
  };
};

const getCancellationPolicy = async () => {
  const allowed = POLICIES.ALLOWED_CANCELLATION_STATUSES ? POLICIES.ALLOWED_CANCELLATION_STATUSES.join(', ') : 'PENDING, PROCESSING';
  return {
    success: true,
    data: {
      policy: `Orders can be cancelled free of charge while they are in the initial processing stages (${allowed}). Once shipped, cancellation is no longer available.`
    }
  };
};

module.exports = { 
  getRefundPolicy, 
  getShippingPolicy, 
  getCancellationPolicy 
};