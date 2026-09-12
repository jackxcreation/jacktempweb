const getRefundPolicy = async () => {
  return {
    success: true,
    data: {
      policy: "Refunds are processed within 5-7 business days after the returned item is received and inspected. Payments are refunded to the original payment method."
    }
  };
};

const getShippingPolicy = async () => {
  return {
    success: true,
    data: {
      policy: "Standard shipping takes 3-5 business days. Express shipping takes 1-2 business days. Orders over ₹999 qualify for free standard shipping."
    }
  };
};

module.exports = { getRefundPolicy, getShippingPolicy };