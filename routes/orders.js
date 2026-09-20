// routes/orders.js
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose'); 
const { Order, Product, Setting, User, Warehouse, PaymentIntent, PaymentAttempt, Refund } = require('../models'); 
const { logger } = require('../utils/logger'); // Production Winston Logger with redaction
const { calculateOrderTotal } = require('../services/orderPricingService'); // Server-side authoritative pricing engine (Task #59)
const { reserveInventoryAtomic } = require('../services/inventoryService'); // Atomic stock reservation service
const { isValidTransition } = require('../services/orderStateMachine'); // Strict state machine validator
const { queryOrders } = require('../services/orderQueryService'); // Advanced pagination & query service
const { serializeOrder, serializeOrderList } = require('../serializers/orderSerializer'); // Response sanitizer serializer

// 🔥 TASK #48: IMPORT CENTRALIZED ZOD VALIDATORS FOR ORDERS
const { orderCreationValidator, orderUpdateValidator } = require('../validators/order');

// 🔥 TASK #49: IMPORT STANDARDIZED API RESPONSE HELPERS
const { sendSuccess, sendError } = require('../utils/apiResponse');

// 🚨 IMPORT AUTH & ZERO-TRUST RBAC MIDDLEWARES
const { protect } = require('../middleware/authMiddleware');
const { checkPermission } = require('../middleware/rbacMiddleware');

// 🛡️ IMPORT IDEMPOTENCY MIDDLEWARE (Task #62)
const { requireIdempotency } = require('../middleware/idempotencyMiddleware');

// 🔥 TASK #47: IMPORT GRANULAR RATE LIMITERS
const { paymentLimiter } = require('../middleware/rateLimit');

// 🔥 TASK #44: IMPORT SEPARATED UNIFIED SHIPPING ENGINE (Task #61)
const shippingEngine = require('../services/shipping/shippingEngine');

// 📊 IMPORT ANALYTICS QUEUE PRODUCER
const { trackEvent } = require('../services/analyticsQueue');

const sendErrorResponse = (res, req, error, defaultMessage = "Internal Server Error", statusCode = 500) => {
  logger.error({
    message: defaultMessage,
    requestId: req.requestId,
    error: error.message,
    stack: error.stack,
    route: req.originalUrl,
    errorCode: error.code || 'ORDER_OPERATION_FAILED'
  });

  return sendError(
    res, 
    error.code || 'ORDER_OPERATION_FAILED', 
    process.env.NODE_ENV === 'production' ? defaultMessage : error.message, 
    statusCode, 
    req, 
    error.errors || error.issues || null
  );
};

// ==========================================
// 🛡️ CENTRALIZED AUDIT HELPER
// ==========================================
const logAdminAction = async (req, action, details, beforeState = null, afterState = null) => {
  try {
    if (!req.user) return;
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'Unknown IP';
    const auditEntry = {
      action,
      details,
      ip,
      timestamp: new Date()
    };

    await User.findByIdAndUpdate(req.user._id, {
      $push: { auditLogs: auditEntry }
    });

    logger.info({
      message: `AUDIT TRAIL: [${action}]`,
      requestId: req.requestId,
      admin: req.user.email,
      role: req.user.role,
      ip,
      before: beforeState,
      after: afterState,
      details
    });
  } catch (err) {
    console.error("Failed to record audit log:", err);
  }
};

// ==========================================
// 🛒 ORDER & SHIPPING APIs (🔥 TASK #43 & #44 INTEGRATED)
// ==========================================

router.post('/api/orders/:id/generate-awb', protect, checkPermission('orders:ship'), requireIdempotency, async (req, res) => {
  try {
    const { id } = req.params;
    const { provider } = req.body; 
    
    // 🔥 TASK #64: Lean query with precise projection for AWB generation
    const order = await Order.findById(id).lean();
    
    if (!order) {
      return sendError(res, 'ORDER_NOT_FOUND', "Order not found", 404, req);
    }

    if (order.shipment && order.shipment.awb) {
      return sendSuccess(res, { 
        waybill: order.shipment.awb,
        provider: order.shipment.provider,
        order: serializeOrder(order, req.user)
      }, "AWB already exists (Idempotent Replay)", 200, req);
    }

    const shipmentResult = await shippingEngine.generateAWB(order, provider);

    const previousShipment = order.shipment ? { ...order.shipment } : {};
    const newShipmentData = {
        provider: shipmentResult.provider || provider || 'delhivery',
        awb: shipmentResult.awb || shipmentResult.waybill || '',
        trackingNumber: shipmentResult.trackingNumber || shipmentResult.awb || '',
        carrier: shipmentResult.carrier || 'Delhivery Surface',
        courier: shipmentResult.courier || 'Delhivery Express',
        shipmentId: shipmentResult.shipmentId || '',
        providerOrderId: shipmentResult.providerOrderId || '',
        trackingStatus: shipmentResult.trackingStatus || 'Manifested',
        lastSyncedAt: new Date(),
        cancellationStatus: false
    };
    
    const updatedOrderDoc = await Order.findByIdAndUpdate(
      id,
      { $set: { shipment: newShipmentData } },
      { new: true }
    ).lean();

    await logAdminAction(
      req,
      'GENERATE_AWB',
      `Generated AWB via [${String(newShipmentData.provider).toUpperCase()}] - AWB: ${newShipmentData.awb} for Order #${order._id}`,
      { shipment: previousShipment?.awb ? `Existing AWB: ${previousShipment.awb}` : 'No AWB assigned' },
      { shipment: newShipmentData.awb, provider: newShipmentData.provider }
    );

    const io = req.app.get("io");
    if (io) {
      try {
        io.to('orders').emit('shipment.created', { orderId: order._id, awb: newShipmentData.awb, provider: newShipmentData.provider });
      } catch (e) {}
    }

    return sendSuccess(res, { 
        waybill: newShipmentData.awb,
        provider: newShipmentData.provider,
        order: serializeOrder(updatedOrderDoc, req.user)
    }, "AWB Generated Successfully", 200, req);

  } catch (error) {
    return sendErrorResponse(res, req, error, error.message || "Network or Server Error while generating AWB");
  }
});

router.get('/api/orders/label/:awb', protect, checkPermission('orders:ship'), async (req, res) => {
  try {
    const { awb } = req.params;
    const labelData = await shippingEngine.getLabel(awb);
    return sendSuccess(res, labelData, "Label fetched successfully", 200, req);
  } catch (error) {
    return sendErrorResponse(res, req, error, "Server error fetching label");
  }
});

router.post('/api/orders/pickup', protect, checkPermission('warehouse:all'), requireIdempotency, async (req, res) => {
  try {
    const { package_count, location_name } = req.body;
    const responseData = await shippingEngine.schedulePickup(package_count, location_name);
    return sendSuccess(res, responseData, "Pickup scheduled successfully", 200, req);
  } catch (error) {
    return sendErrorResponse(res, req, error, "Error scheduling pickup");
  }
});

router.post('/api/orders/:id/cancel-shipment', protect, checkPermission('orders:cancel'), requireIdempotency, async (req, res) => {
  try {
    const { waybill, auditReason } = req.body;
    const responseData = await shippingEngine.cancelShipment(waybill);

    await logAdminAction(
      req,
      'CANCEL_SHIPMENT',
      `Cancelled shipment AWB: ${waybill}. Reason: ${auditReason || 'No reason provided'}`,
      { waybill, status: 'Active' },
      { waybill, status: 'Cancelled' }
    );

    return sendSuccess(res, responseData, "Shipment cancelled successfully", 200, req);
  } catch (error) {
    return sendErrorResponse(res, req, error, "Error cancelling shipment");
  }
});

// ==========================================
// 🛒 MAIN ORDER CREATION ROUTE (TASKS #59 - #65)
// ==========================================
router.post('/api/orders', protect, paymentLimiter, requireIdempotency, async (req, res) => {
  const validationResult = orderCreationValidator.safeParse(req.body);
  if (!validationResult.success) {
    return sendError(
      res, 
      'VALIDATION_FAILED', 
      "Validation failed", 
      400, 
      req, 
      validationResult.error.format()
    );
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { items, address, paymentMethod, userDetails, trafficSource, couponCode, idempotencyKey } = validationResult.data;
    const secureUserId = req.user._id; 
    const safeStatus = 'Pending'; 

    // 🔥 TASK #62 & #63: Idempotency Duplicate Request Prevention with lean check
    if (idempotencyKey) {
      const existingOrder = await Order.findOne({ idempotencyKey }).select('_id userId status totalPaise createdAt').lean().session(session);
      if (existingOrder) {
        await session.abortTransaction();
        session.endSession();
        return sendSuccess(res, { 
          order: serializeOrder(existingOrder, req.user) 
        }, "Order already created (Idempotent Replay)", 200, req);
      }
    }

    // 🔥 TASK #59, #60, #61: Authoritative Server-Side Pricing, Coupon & Shipping Calculation
    const pricingResult = await calculateOrderTotal(items, couponCode);
    if (!pricingResult.success) {
      await session.abortTransaction();
      session.endSession();
      return sendError(res, 'PRICING_CALCULATION_FAILED', pricingResult.message, 400, req);
    }

    const calculatedServerTotalPaise = pricingResult.subtotalPaise;
    const taxAmountPaise = pricingResult.taxPaise;
    const shippingCostPaise = pricingResult.shippingPaise; 
    const discountPaise = pricingResult.discountPaise; 
    let finalTotalPaise = pricingResult.totalPaise; 

    const payString = String(paymentMethod || '').toLowerCase();
    const isCod = payString.includes('cod') || payString.includes('cash');

    let paymentFeePaise = 0;
    let codFeePaise = 0;

    if (!isCod) {
      paymentFeePaise = Math.round(finalTotalPaise * 0.02); 
    }
    
    if (isCod) {
      codFeePaise = 5000; 
      finalTotalPaise += codFeePaise;
    }

    // 🔥 TASK #65: Atomic Inventory Reservation & Stock Validation inside ACID Transaction
    const inventoryReservation = await reserveInventoryAtomic(items, null, secureUserId, session);
    const verifiedOrderItems = inventoryReservation.verifiedItems;
    const selectedWarehouseId = inventoryReservation.selectedWarehouseId;

    let totalCogsPaise = verifiedOrderItems.reduce((acc, item) => acc + (item.cogsPaise * item.quantity), 0);
    let contributionPaise = finalTotalPaise - totalCogsPaise - shippingCostPaise - paymentFeePaise;

    const deviceInfo = req.headers['user-agent']?.includes('Mobile') ? 'Mobile Device' : 'Desktop / PC';
    const io = req.app.get("io"); 

    const newOrder = new Order({ 
      userId: secureUserId, 
      items: verifiedOrderItems, 
      totalAmount: (finalTotalPaise / 100).toString(),
      totalPaise: finalTotalPaise, 
      subtotalPaise: calculatedServerTotalPaise,
      status: safeStatus, 
      address, 
      paymentMethod, 
      userDetails, 
      deviceInfo, 
      trafficSource,
      idempotencyKey: idempotencyKey || undefined, 
      fulfilledFromWarehouse: selectedWarehouseId,

      cogsPaise: totalCogsPaise,
      shippingCostPaise,
      paymentFeePaise,
      codFeePaise,
      taxAmountPaise,
      discountPaise,
      contributionPaise,
      refundAmountPaise: 0,
      rtoCostPaise: 0
    });
    
    const savedOrder = await newOrder.save({ session });

    for (const item of verifiedOrderItems) {
      await Product.updateOne(
        { _id: item.productId, "stockLedger.referenceId": "PENDING_ORDER" },
        { $set: { "stockLedger.$.referenceId": savedOrder._id.toString() } },
        { session }
      );
    }

    const dummyGatewayOrderId = `pending_tx_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    
    const createdIntent = await PaymentIntent.create([{
      userId: secureUserId,
      orderId: savedOrder._id,
      gatewayOrderId: dummyGatewayOrderId,
      amountPaise: finalTotalPaise,
      currency: 'INR',
      status: 'CREATED',
      paymentGateway: 'razorpay'
    }], { session });

    savedOrder.paymentDetails = { 
      gatewayOrderId: dummyGatewayOrderId,
      paymentIntentId: createdIntent[0]._id 
    };
    await savedOrder.save({ session });
    
    await session.commitTransaction();
    session.endSession();

    trackEvent('ORDER_COMPLETED', {
      orderId: savedOrder._id,
      totalPaise: finalTotalPaise,
      cogsPaise: totalCogsPaise,
      contributionPaise,
      items: verifiedOrderItems,
      trafficSource,
      userId: secureUserId
    });

    const serializedResponse = serializeOrder(savedOrder, req.user);

    if (io) {
        try { 
          io.to('orders').emit('order.created', serializedResponse);
          io.emit("new_order", serializedResponse); 
        } catch(e){}
    }

    return sendSuccess(res, serializedResponse, "Order created successfully", 201, req);
  } catch (error) { 
    if (session.inTransaction()) await session.abortTransaction();
    session.endSession();
    return sendErrorResponse(res, req, error, error.message || "Order creation failed");
  }
});

// ==========================================
// ✏️ UPDATE ORDER STATUS & STRICT STATE MACHINE VALIDATION
// ==========================================
router.put('/api/orders/:id', protect, checkPermission('orders:edit'), async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const validationResult = orderUpdateValidator.safeParse(req.body);
    if (!validationResult.success) {
      await session.abortTransaction();
      session.endSession();
      return sendError(res, 'VALIDATION_FAILED', "Validation failed", 400, req, validationResult.error.format());
    }

    const { status, adminNotes, refundStatus, auditReason } = validationResult.data;

    if (refundStatus && refundStatus !== 'N-A' && refundStatus !== 'N/A') {
      const userPermissions = req.user.role === 'admin' || req.user.role === 'super_admin' ? ['all'] : (require('../middleware/rbacMiddleware').ROLE_PERMISSIONS[req.user.role] || []);
      const canRefund = userPermissions.includes('finance:refund') || userPermissions.includes('finance:all') || userPermissions.includes('orders:refund') || userPermissions.includes('orders:all') || userPermissions.includes('all');
      if (!canRefund) {
        await session.abortTransaction();
        session.endSession();
        return sendError(res, 'ACCESS_DENIED', "Access Denied: Your role lacks permission to process refunds.", 403, req);
      }
    }

    const existingOrder = await Order.findById(req.params.id).session(session);
    if (!existingOrder) {
      await session.abortTransaction();
      session.endSession();
      return sendError(res, 'ORDER_NOT_FOUND', "Order not found", 404, req);
    }

    if (status && status !== existingOrder.status) {
      if (!isValidTransition(existingOrder.status, status)) {
        await session.abortTransaction();
        session.endSession();
        return sendError(res, 'INVALID_STATE_TRANSITION', `Invalid state transition. Cannot move order from '${existingOrder.status}' to '${status}'.`, 400, req);
      }
    }

    const beforeStatus = existingOrder.status;
    const beforeRefund = existingOrder.refundStatus;

    const updateFields = {};
    if (status === 'RTO' && beforeStatus !== 'RTO') {
      updateFields.rtoCostPaise = existingOrder.shippingCostPaise || 6000;
      updateFields.contributionPaise = (existingOrder.contributionPaise || 0) - updateFields.rtoCostPaise;
    }

    if (status && status !== beforeStatus) {
      for (const item of (existingOrder.items || [])) {
        const prodId = item.productId;
        const qty = item.quantity || 1;
        const product = await Product.findById(prodId).session(session);
        if (!product || !product.inventoryState) continue;

        if (status === 'Packed' && beforeStatus !== 'Packed') {
          product.inventoryState.reserved = Math.max(0, (product.inventoryState.reserved || 0) - qty);
          product.inventoryState.packed = (product.inventoryState.packed || 0) + qty;
          product.stockLedger.push({
            type: 'TRANSFER',
            quantity: qty,
            previousAvailable: product.inventoryState.available,
            newAvailable: product.inventoryState.available,
            source: 'Order',
            referenceId: existingOrder._id.toString(),
            reason: 'Order packed',
            warehouseId: existingOrder.fulfilledFromWarehouse,
            performedBy: req.user._id,
            timestamp: new Date()
          });
        }

        if (status === 'Shipped' && beforeStatus !== 'Shipped') {
          if (beforeStatus === 'Packed') {
            product.inventoryState.packed = Math.max(0, (product.inventoryState.packed || 0) - qty);
          } else {
            product.inventoryState.reserved = Math.max(0, (product.inventoryState.reserved || 0) - qty);
          }
          product.inventoryState.inTransit = (product.inventoryState.inTransit || 0) + qty;
          product.stockLedger.push({
            type: 'OUT',
            quantity: qty,
            previousAvailable: product.inventoryState.available,
            newAvailable: product.inventoryState.available,
            source: 'Order',
            referenceId: existingOrder._id.toString(),
            reason: 'Order shipped - stock moved out',
            warehouseId: existingOrder.fulfilledFromWarehouse,
            performedBy: req.user._id,
            timestamp: new Date()
          });
        }

        if (status === 'Cancelled' && beforeStatus !== 'Cancelled') {
          product.inventoryState.reserved = Math.max(0, (product.inventoryState.reserved || 0) - qty);
          product.inventoryState.available += qty;
          product.inventory = product.inventoryState.available;
          product.stockLedger.push({
            type: 'RELEASED',
            quantity: qty,
            previousAvailable: product.inventoryState.available - qty,
            newAvailable: product.inventoryState.available,
            source: 'Order',
            referenceId: existingOrder._id.toString(),
            reason: 'Order cancelled - stock released',
            warehouseId: existingOrder.fulfilledFromWarehouse,
            performedBy: req.user._id,
            timestamp: new Date()
          });

          updateFields.contributionPaise = 0;
        }

        if ((status === 'Returned' || status === 'RTO') && beforeStatus !== 'Returned' && beforeStatus !== 'RTO') {
          product.inventoryState.inTransit = Math.max(0, (product.inventoryState.inTransit || 0) - qty);
          product.inventoryState.returned = (product.inventoryState.returned || 0) + qty;
          product.inventoryState.qcPending = (product.inventoryState.qcPending || 0) + qty;
          product.stockLedger.push({
            type: 'RETURN',
            quantity: qty,
            previousAvailable: product.inventoryState.available,
            newAvailable: product.inventoryState.available,
            source: 'Return',
            referenceId: existingOrder._id.toString(),
            reason: 'Order returned / RTO received',
            warehouseId: existingOrder.fulfilledFromWarehouse,
            performedBy: req.user._id,
            timestamp: new Date()
          });

          trackEvent('ORDER_RETURN_OR_RTO', {
            orderId: existingOrder._id,
            type: status,
            items: existingOrder.items
          });
        }

        await product.save({ session });
      }
    }

    const io = req.app.get("io"); 

    if (status) updateFields.status = status;
    if (adminNotes !== undefined) updateFields.adminNotes = adminNotes;
    
    if (refundStatus !== undefined) {
      updateFields.refundStatus = refundStatus;
      if (refundStatus === 'Refunded' || refundStatus === 'Processed' || refundStatus === 'Refund Completed') {
         updateFields.refundAmountPaise = existingOrder.totalPaise;
         updateFields.contributionPaise = 0 - (existingOrder.paymentFeePaise || 0) - (existingOrder.shippingCostPaise || 0);
         
         if (existingOrder.paymentDetails?.gatewayOrderId) {
           const intent = await PaymentIntent.findOne({ gatewayOrderId: existingOrder.paymentDetails.gatewayOrderId }).session(session);
           if (intent) {
             await Refund.create([{
               orderId: existingOrder._id,
               paymentIntentId: intent._id,
               gatewayRefundId: `ref_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
               amountPaise: existingOrder.totalPaise,
               status: 'PROCESSED',
               reason: auditReason || 'Admin processed refund'
             }], { session });
           }
         }

         if (io) {
           try { io.to('payments').emit('refund.created', { orderId: existingOrder._id, amountPaise: existingOrder.totalPaise }); } catch (e) {}
         }
      }
    }

    const updatedOrder = await Order.findByIdAndUpdate(
        req.params.id, 
        updateFields, 
        { new: true, session } 
    );

    await session.commitTransaction();
    session.endSession();

    let actionType = 'UPDATE_ORDER';
    let auditDescription = `Updated order #${updatedOrder._id}`;

    if (status && status !== beforeStatus) {
      actionType = 'ORDER_STATUS_CHANGE';
      auditDescription = `Changed order status: ${beforeStatus} → ${status}`;
    }

    if (refundStatus && refundStatus !== beforeRefund && refundStatus !== 'N/A') {
      actionType = 'REFUND_PROCESSED';
      const orderAmountRupees = Math.round((updatedOrder.totalPaise || 0) / 100);
      auditDescription = `Refund initiated for ₹${orderAmountRupees}. Status: ${refundStatus}. Approved by: ${req.user.name} (${req.user.role})`;
    }

    await logAdminAction(
      req,
      actionType,
      `${auditDescription}. Reason: ${auditReason || 'No reason provided'}`,
      { status: beforeStatus, refundStatus: beforeRefund },
      { status: updatedOrder.status, refundStatus: updatedOrder.refundStatus }
    );

    const serializedResponse = serializeOrder(updatedOrder, req.user);
    
    if(io) { 
      try { 
        io.to('orders').emit('order.status.changed', serializedResponse);
        io.emit("order_status_updated", serializedResponse); 
      } catch(e){} 
    }

    return sendSuccess(res, serializedResponse, "Order updated successfully", 200, req);
  } catch (error) { 
    if (session.inTransaction()) await session.abortTransaction();
    session.endSession();
    return sendErrorResponse(res, req, error, "Failed to update order status");
  }
});

// ==========================================
// 👤 GET SPECIFIC ORDER BY ID (TASK #64: Lean + Projection)
// ==========================================
router.get('/api/orders/:id', protect, async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return sendError(res, 'INVALID_ID_FORMAT', "Invalid Order ID format", 400, req);
    }

    // 🔥 TASK #64: Lean query with targeted field projection for optimal memory performance
    const order = await Order.findById(id)
      .select('userId orderNumber items totalAmount totalPaise status paymentMethod paymentDetails address userDetails shipment createdAt updatedAt')
      .lean();

    if (!order) {
      return sendError(res, 'ORDER_NOT_FOUND', "Order not found", 404, req);
    }

    const privilegedRoles = [
      'admin', 'super_admin', 'operations_manager', 'catalog_manager', 
      'warehouse_manager', 'customer_support', 'finance_manager', 
      'marketing_manager', 'content_manager', 'analyst', 'read_only_auditor', 
      'manager', 'catalog', 'support'
    ];

    const isPrivilegedStaff = privilegedRoles.includes(req.user.role);
    const isOwner = order.userId && order.userId.toString() === req.user._id.toString();

    if (!isOwner && !isPrivilegedStaff) {
      logger.warn({
        message: `UNAUTHORIZED ACCESS ATTEMPT: User tried to access Order #${id}`,
        requestId: req.requestId,
        userId: req.user._id
      });
      return sendError(res, 'ACCESS_DENIED', "Access Denied: You do not own this order.", 403, req);
    }

    return sendSuccess(res, { order: serializeOrder(order, req.user) }, "Order fetched successfully", 200, req);
  } catch (error) {
    return sendErrorResponse(res, req, error, "Failed to fetch order details");
  }
});

// ==========================================
// 👤 GET USER ORDERS (TASK #64: Lean + Projection)
// ==========================================
router.get('/api/orders/user/:userId', protect, async (req, res) => {
  try {
    const privilegedRoles = [
      'admin', 'super_admin', 'operations_manager', 'catalog_manager', 
      'warehouse_manager', 'customer_support', 'finance_manager', 
      'marketing_manager', 'content_manager', 'analyst', 'read_only_auditor', 
      'manager', 'catalog', 'support'
    ];
    const isPrivilegedStaff = privilegedRoles.includes(req.user.role);

    if (req.user._id.toString() !== req.params.userId && !isPrivilegedStaff) {
       logger.warn({
         message: `IDOR VIOLATION ATTEMPT: User attempted to view orders for another userId`,
         requestId: req.requestId,
         authUserId: req.user._id
       });
       return sendError(res, 'ACCESS_DENIED', "Access Denied: You can only view your own orders.", 403, req);
    }

    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, parseInt(req.query.limit) || 10);
    const skip = (page - 1) * limit;

    // 🔥 TASK #64: Lean query with targeted field projection for high-speed list rendering
    const orders = await Order.find({ userId: req.params.userId })
      .select('userId orderNumber items totalAmount totalPaise status paymentMethod shipment createdAt')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    return sendSuccess(res, serializeOrderList(orders, req.user), "User orders fetched successfully", 200, req);
  } catch (error) { 
    return sendErrorResponse(res, req, error, "Failed to fetch orders"); 
  }
});

// ==========================================
// 📦 GET ALL ORDERS
// ==========================================
router.get('/api/orders', protect, checkPermission('orders:view'), async (req, res) => {
  try {
    const queryResult = await queryOrders(req.query);
    queryResult.orders = serializeOrderList(queryResult.orders, req.user);
    return sendSuccess(res, queryResult, "Orders queried successfully", 200, req);
  } catch (error) { 
    return sendErrorResponse(res, req, error, "Failed to fetch paginated orders"); 
  }
});

module.exports = router;