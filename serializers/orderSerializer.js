// serializers/orderSerializer.js

/**
 * Enterprise Order Serializer (Task #29)
 * Sanitizes order responses by removing unnecessary internal fields and conditionally 
 * exposing administrative metrics (like COGS, margins, and warehouse references) only to authorized staff.
 * 
 * @param {Object} order - Mongoose Order document or plain object
 * @param {Object} [user] - Requesting user object with role information
 * @returns {Object} Sanitized order response object
 */
const serializeOrder = (order, user = null) => {
  if (!order) return null;

  // Convert Mongoose doc to plain object if necessary
  const orderObj = typeof order.toObject === 'function' ? order.toObject() : { ...order };

  const isPrivilegedStaff = user && ['admin', 'super_admin', 'operations_manager', 'finance_manager', 'warehouse_manager', 'customer_support'].includes(user.role);

  // Base public order response structure (safe for customers)
  const serialized = {
    id: orderObj._id ? orderObj._id.toString() : orderObj.id,
    userId: orderObj.userId,
    orderNumber: orderObj.orderNumber || orderObj._id?.toString(),
    items: (orderObj.items || []).map(item => ({
      productId: item.productId,
      title: item.title || item.name,
      quantity: item.quantity,
      pricePaise: item.pricePaise,
      totalPaise: item.totalPaise || (item.pricePaise * item.quantity),
      image: item.image
    })),
    totalAmount: orderObj.totalAmount,
    totalPaise: orderObj.totalPaise,
    subtotalPaise: orderObj.subtotalPaise,
    taxAmountPaise: orderObj.taxAmountPaise,
    shippingCostPaise: orderObj.shippingCostPaise,
    discountPaise: orderObj.discountPaise,
    status: orderObj.status,
    paymentMethod: orderObj.paymentMethod,
    paymentDetails: {
      gatewayOrderId: orderObj.paymentDetails?.gatewayOrderId,
      gatewayPaymentId: orderObj.paymentDetails?.gatewayPaymentId
    },
    address: orderObj.address,
    userDetails: orderObj.userDetails,
    shipment: orderObj.shipment,
    trackingId: orderObj.trackingId,
    courierPartner: orderObj.courierPartner,
    estimatedDelivery: orderObj.estimatedDelivery,
    refundStatus: orderObj.refundStatus,
    createdAt: orderObj.createdAt,
    updatedAt: orderObj.updatedAt
  };

  // Privileged staff get administrative financial metrics & internal references
  if (isPrivilegedStaff) {
    serialized.cogsPaise = orderObj.cogsPaise;
    serialized.paymentFeePaise = orderObj.paymentFeePaise;
    serialized.codFeePaise = orderObj.codFeePaise;
    serialized.contributionPaise = orderObj.contributionPaise;
    serialized.rtoCostPaise = orderObj.rtoCostPaise;
    serialized.fulfilledFromWarehouse = orderObj.fulfilledFromWarehouse;
    serialized.adminNotes = orderObj.adminNotes;
    serialized.idempotencyKey = orderObj.idempotencyKey;
  }

  return serialized;
};

/**
 * Serializes an array of order documents.
 * @param {Array} orders - Array of orders
 * @param {Object} [user] - Requesting user object
 * @returns {Array} Array of sanitized order objects
 */
const serializeOrderList = (orders, user = null) => {
  if (!orders || !Array.isArray(orders)) return [];
  return orders.map(order => serializeOrder(order, user));
};

module.exports = {
  serializeOrder,
  serializeOrderList
};