const express = require('express');
const router = express.Router();
const mongoose = require('mongoose'); 
const { Order, Product, Setting, User, Warehouse, PaymentIntent, PaymentAttempt, Refund } = require('../models'); 
const { z } = require('zod'); // 🔥 Zod for strict input validation
const { logger } = require('../utils/logger'); // 🔥 Production Winston Logger

// 🚨 IMPORT AUTH & ZERO-TRUST RBAC MIDDLEWARES
const { protect } = require('../middleware/authMiddleware');
const { checkPermission } = require('../middleware/rbacMiddleware');

// 🛡️ IMPORT IDEMPOTENCY MIDDLEWARE
const { requireIdempotency } = require('../middleware/idempotencyMiddleware');

// 🚚 IMPORT UNIFIED SHIPPING ENGINE ABSTRACTION
const shippingEngine = require('../services/shipping/shippingEngine');

// 📊 IMPORT ANALYTICS QUEUE PRODUCER
const { trackEvent } = require('../services/analyticsQueue');

// ==========================================
// 🛡️ ZOD VALIDATION SCHEMAS FOR ORDERS
// ==========================================
const orderCreationSchema = z.object({
  items: z.array(z.object({
    productId: z.string().min(1, "Product ID is required"),
    quantity: z.number().int().positive("Quantity must be at least 1")
  })).min(1, "Order must contain at least one item"),
  address: z.object({
    name: z.string().min(1, "Name is required"),
    flat: z.string().optional().default("N/A"), 
    street: z.string().optional().default("N/A"), 
    city: z.string().min(1, "City is required"),
    state: z.string().min(1, "State is required"),
    pincode: z.string().regex(/^\d{6}$/, "Invalid pincode. Must be 6 digits"),
    primaryPhone: z.string()
      .regex(/^\d{10}$/, "Invalid phone number. Must be 10 digits")
      .or(z.string().min(10).max(15)) 
      .default("N/A") 
  }),
  paymentMethod: z.string().min(1, "Payment method is required"),
  couponCode: z.string().optional(),
  userDetails: z.object({
    name: z.string().optional(),
    email: z.string().email().optional()
  }).optional(),
  trafficSource: z.any().optional()
});

const orderUpdateSchema = z.object({
  status: z.enum([
    'Pending Review', 'Pending', 'Paid', 'Processing', 'Packed', 
    'Shipped', 'OutForDelivery', 'Delivered', 'Cancelled', 
    'Refunded', 'ReturnRequested', 'ReturnApproved', 'Returned', 'RTO'
  ]).optional(),
  adminNotes: z.string().max(500).optional(),
  refundStatus: z.string().optional(),
  auditReason: z.string().max(300).optional() // 🔥 Audit Reason for enterprise compliance
});

// Helper for secure regex escaping to prevent ReDoS attacks
const escapeRegex = (text) => {
  return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
};

const sendErrorResponse = (res, req, error, defaultMessage = "Internal Server Error", statusCode = 500) => {
  logger.error({
    message: defaultMessage,
    requestId: req.requestId,
    error: error.message,
    stack: error.stack,
    route: req.originalUrl
  });

  return res.status(statusCode).json({
    success: false,
    message: process.env.NODE_ENV === 'production' ? defaultMessage : error.message,
    requestId: req.requestId
  });
};

// ==========================================
// 🛡️ CENTRALIZED AUDIT HELPER (WHO, WHAT, WHEN, WHERE, BEFORE, AFTER, WHY)
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
// 🛒 3. ORDER & SHIPPING APIs (Multi-Warehouse Routing & Inventory Enabled)
// ==========================================

// ==========================================
// 🔥 1. AWB GENERATION ROUTE - DELEGATED TO SHIPPING ENGINE, AUDIT LOGGED & IDEMPOTENCY PROTECTED
// ==========================================
router.post('/api/orders/:id/generate-awb', protect, checkPermission('orders:ship'), requireIdempotency, async (req, res) => {
  try {
    const { id } = req.params;
    // 🔥 FIX: Extract provider from request body
    const { provider } = req.body; 
    
    const order = await Order.findById(id);
    
    if (!order) return res.status(404).json({ success: false, message: "Order not found", requestId: req.requestId });

    // Idempotency check: Agar AWB pehle se hi assigned hai toh duplicate call par wahi return kar do
    if (order.shipment && order.shipment.awb) {
      return res.status(200).json({ 
        success: true, 
        message: "AWB already exists (Idempotent Replay)", 
        waybill: order.shipment.awb,
        provider: order.shipment.provider,
        order: order.toJSON()
      });
    }

    // 🔥 MASTER FIX: Convert Mongoose Document to Plain JS Object
    // Isse Axios ya shipping engine deep cloning ke waqt '_defaultToObjectOptions' error nahi dega.
    const orderPayload = order.toObject();

    // Plain payload pass kiya jaa raha hai
    const shipmentResult = await shippingEngine.generateAWB(orderPayload, provider);

    const previousShipment = order.shipment ? { ...order.shipment } : {};
    
    order.shipment = {
        provider: shipmentResult.provider || provider || 'unknown',
        awb: shipmentResult.waybill || shipmentResult.awb,
        providerOrderId: shipmentResult.providerOrderId || '',
        trackingStatus: shipmentResult.trackingStatus || 'Manifested',
        lastSyncedAt: new Date(),
        cancellationStatus: false
    };
    
    await order.save();

    await logAdminAction(
      req,
      'GENERATE_AWB',
      `Generated AWB via [${String(order.shipment.provider).toUpperCase()}] - AWB: ${order.shipment.awb} for Order #${order._id}`,
      { shipment: previousShipment?.awb ? `Existing AWB: ${previousShipment.awb}` : 'No AWB assigned' },
      { shipment: order.shipment.awb, provider: order.shipment.provider }
    );

    // 🔥 Emit shipment created event over channels
    const io = req.app.get("io");
    if (io) {
      try {
        io.to('orders').emit('shipment.created', { orderId: order._id, awb: order.shipment.awb, provider: order.shipment.provider });
      } catch (e) {}
    }

    res.status(200).json({ 
        success: true, 
        message: "AWB Generated Successfully", 
        waybill: order.shipment.awb,
        provider: order.shipment.provider,
        order: order.toJSON()
    });

  } catch (error) {
    return sendErrorResponse(res, req, error, error.message || "Network or Server Error while generating AWB");
  }
});

// ==========================================
// 🖨️ FETCH DELIVERY LABEL VIA SHIPPING ENGINE
// ==========================================
router.get('/api/orders/label/:awb', protect, checkPermission('orders:ship'), async (req, res) => {
  try {
    const { awb } = req.params;
    const labelData = await shippingEngine.getLabel(awb);
    res.status(200).json(labelData);
  } catch (error) {
    return sendErrorResponse(res, req, error, "Server error fetching label");
  }
});

// ==========================================
// 🚚 SCHEDULE PICKUP VIA SHIPPING ENGINE & IDEMPOTENCY PROTECTED
// ==========================================
router.post('/api/orders/pickup', protect, checkPermission('warehouse:all'), requireIdempotency, async (req, res) => {
  try {
    const { package_count, location_name } = req.body;
    const responseData = await shippingEngine.schedulePickup(package_count, location_name);
    res.status(200).json(responseData);
  } catch (error) {
    return sendErrorResponse(res, req, error, "Error scheduling pickup");
  }
});

// ==========================================
// 🚫 CANCEL SHIPMENT VIA SHIPPING ENGINE - AUDIT LOGGED & IDEMPOTENCY PROTECTED
// ==========================================
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

    res.status(200).json(responseData);
  } catch (error) {
    return sendErrorResponse(res, req, error, "Error cancelling shipment");
  }
});

// ==========================================
// 🛒 MAIN ORDER CREATION ROUTE - ZOD VALIDATED, MULTI-WAREHOUSE ROUTING & IDEMPOTENCY PROTECTED 🔥
// ==========================================
router.post('/api/orders', protect, requireIdempotency, async (req, res) => {
  const validationResult = orderCreationSchema.safeParse(req.body);
  if (!validationResult.success) {
    console.error("❌ ZOD VALIDATION FAILED on /api/orders:", JSON.stringify(validationResult.error.format(), null, 2));
    return res.status(400).json({ 
      success: false, 
      message: "Validation failed", 
      errors: validationResult.error.format(),
      requestId: req.requestId
    });
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { items, address, paymentMethod, userDetails, trafficSource, couponCode } = validationResult.data;
    const secureUserId = req.user._id; 
    const safeStatus = 'Pending'; 
    const customerPincode = address.pincode;

    // 🔥 SMART MULTI-WAREHOUSE ROUTING & SELECTION 🔥
    const activeWarehouses = await Warehouse.find({ isActive: true }).sort({ priority: 1 }).session(session);
    let selectedWarehouse = null;

    for (const wh of activeWarehouses) {
      if (wh.currentLoad >= wh.dailyCapacity) continue;

      let isServiceable = true;
      if (wh.serviceablePincodes && wh.serviceablePincodes.length > 0) {
        isServiceable = wh.serviceablePincodes.includes(customerPincode);
      }
      if (!isServiceable) continue;

      let hasAllStock = true;
      for (const rawItem of items) {
        const product = await Product.findById(rawItem.productId).session(session);
        if (!product) {
          hasAllStock = false;
          break;
        }

        const whInv = product.warehouseInventories?.find(w => w.warehouse.toString() === wh._id.toString());
        const availableInWh = whInv ? (whInv.inventoryState?.available || whInv.inventory) : (product.inventoryState?.available || product.inventory);

        if (availableInWh < rawItem.quantity) {
          hasAllStock = false;
          break;
        }
      }

      if (hasAllStock) {
        selectedWarehouse = wh;
        break;
      }
    }

    // Fallback to highest priority warehouse if no precise match found
    if (!selectedWarehouse && activeWarehouses.length > 0) {
      selectedWarehouse = activeWarehouses[0];
    }

    let calculatedServerTotalPaise = 0;
    let totalCogsPaise = 0; 
    const verifiedOrderItems = [];

    for (const rawItem of items) {
      const productId = rawItem.productId;
      const orderQty = rawItem.quantity;

      const product = await Product.findById(productId).session(session);
      if (!product) {
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({ success: false, message: `Product not found for ID: ${productId}`, requestId: req.requestId });
      }

      if (!product.inventoryState) {
        product.inventoryState = { available: product.inventory || 0, sellable: product.inventory || 0 };
      }

      let prevAvailable = product.inventoryState.available;
      if (selectedWarehouse) {
        let whInv = product.warehouseInventories?.find(w => w.warehouse.toString() === selectedWarehouse._id.toString());
        if (whInv) {
          prevAvailable = whInv.inventoryState?.available !== undefined ? whInv.inventoryState.available : whInv.inventory;
        }
      }

      if (prevAvailable < orderQty) {
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({ success: false, message: `Insufficient available stock for product: ${product.title}`, requestId: req.requestId });
      }

      const newAvailable = prevAvailable - orderQty;

      // Update global inventory state
      product.inventoryState.available = newAvailable;
      product.inventoryState.reserved = (product.inventoryState.reserved || 0) + orderQty;
      product.inventory = newAvailable;

      // Update warehouse-specific inventory if warehouse selected
      if (selectedWarehouse) {
        let whInvIndex = product.warehouseInventories?.findIndex(w => w.warehouse.toString() === selectedWarehouse._id.toString());
        if (whInvIndex !== -1 && whInvIndex !== undefined) {
          product.warehouseInventories[whInvIndex].inventoryState.available = newAvailable;
          product.warehouseInventories[whInvIndex].inventoryState.reserved = (product.warehouseInventories[whInvIndex].inventoryState.reserved || 0) + orderQty;
        } else {
          product.warehouseInventories.push({
            warehouse: selectedWarehouse._id,
            inventory: newAvailable,
            inventoryState: { available: newAvailable, reserved: orderQty, sellable: newAvailable }
          });
        }
      }

      product.stockLedger.push({
        type: 'RESERVED',
        quantity: orderQty,
        previousAvailable: prevAvailable,
        newAvailable: newAvailable,
        source: 'Order',
        referenceId: 'PENDING_ORDER',
        reason: `Order routed to warehouse ${selectedWarehouse ? selectedWarehouse.name : 'Default'} - stock reserved`,
        warehouseId: selectedWarehouse ? selectedWarehouse._id : null,
        performedBy: secureUserId,
        timestamp: new Date()
      });

      await product.save({ session });

      const ioInstance = req.app.get("io");
      if (ioInstance) {
        if (newAvailable === 0) {
          ioInstance.to('inventory').emit('inventory.out', { productId: product._id, title: product.title, sku: product.sku });
        } else if (newAvailable < 5) {
          ioInstance.to('inventory').emit('inventory.low', { productId: product._id, title: product.title, remaining: newAvailable, sku: product.sku });
        }
      }

      const unitPricePaise = product.pricePaise || Math.round(parseFloat(product.price || 0) * 100);
      calculatedServerTotalPaise += unitPricePaise * orderQty;

      const unitCogsPaise = product.cogsPaise || Math.round(parseFloat(product.cogs || 0) * 100);
      totalCogsPaise += unitCogsPaise * orderQty;

      verifiedOrderItems.push({
        productId: product._id,
        title: product.title,
        pricePaise: unitPricePaise,
        cogsPaise: unitCogsPaise,
        quantity: orderQty,
        image: product.image || (product.images ? product.images[0] : '')
      });
    }

    if (selectedWarehouse) {
      await Warehouse.findByIdAndUpdate(selectedWarehouse._id, { $inc: { currentLoad: 1 } }, { session });
    }

    const payString = String(paymentMethod || '').toLowerCase();
    const isCod = payString.includes('cod') || payString.includes('cash');

    let shippingCostPaise = 6000; 
    let discountPaise = 0;
    let paymentFeePaise = 0;
    let codFeePaise = 0;
    let taxAmountPaise = Math.round(calculatedServerTotalPaise * 0.18); 

    let finalTotalPaise = calculatedServerTotalPaise;
    
    if (!isCod) {
      discountPaise = Math.round(calculatedServerTotalPaise * 0.10); 
      finalTotalPaise -= discountPaise;
      paymentFeePaise = Math.round(finalTotalPaise * 0.02); 
    }
    
    if (isCod) {
      codFeePaise = 5000; 
      finalTotalPaise += codFeePaise;
    }

    let contributionPaise = finalTotalPaise - totalCogsPaise - shippingCostPaise - paymentFeePaise;

    const deviceInfo = req.headers['user-agent']?.includes('Mobile') ? 'Mobile Device' : 'Desktop / PC';
    const io = req.app.get("io"); 

    const newOrder = new Order({ 
      userId: secureUserId, 
      items: verifiedOrderItems, 
      totalPaise: finalTotalPaise, 
      status: safeStatus, 
      address, 
      paymentMethod, 
      userDetails, 
      deviceInfo, 
      trafficSource,
      fulfilledFromWarehouse: selectedWarehouse ? selectedWarehouse._id : null,

      cogsPaise: totalCogsPaise,
      shippingCostPaise: shippingCostPaise,
      paymentFeePaise: paymentFeePaise,
      codFeePaise: codFeePaise,
      taxAmountPaise: taxAmountPaise,
      discountPaise: discountPaise,
      contributionPaise: contributionPaise,
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
    await PaymentIntent.create([{
      userId: secureUserId,
      orderId: savedOrder._id,
      gatewayOrderId: dummyGatewayOrderId,
      amountPaise: finalTotalPaise,
      currency: 'INR',
      status: 'CREATED',
      paymentGateway: 'razorpay'
    }], { session });

    savedOrder.paymentDetails = { gatewayOrderId: dummyGatewayOrderId };
    await savedOrder.save({ session });
    
    await session.commitTransaction();
    session.endSession();

    const orderResponse = { ...savedOrder._doc, id: savedOrder._id.toString() };

    trackEvent('ORDER_COMPLETED', {
      orderId: savedOrder._id,
      totalPaise: finalTotalPaise,
      cogsPaise: totalCogsPaise,
      contributionPaise: contributionPaise,
      items: verifiedOrderItems,
      trafficSource,
      userId: secureUserId
    });

    if (io) {
        try { 
          io.to('orders').emit('order.created', orderResponse);
          io.emit("new_order", orderResponse); 
        } catch(e){}
    }

    res.status(201).json(orderResponse);
  } catch (error) { 
    if (session.inTransaction()) await session.abortTransaction();
    session.endSession();
    return sendErrorResponse(res, req, error, "Order creation failed");
  }
});

// ==========================================
// ✏️ UPDATE ORDER STATUS & MULTI-STATE INVENTORY TRANSITIONS - AUDIT LOGGED 🔥
// ==========================================
const ALLOWED_STATE_TRANSITIONS = {
  'Pending Review': ['Pending', 'Paid', 'Processing', 'Cancelled'],
  'Pending': ['Paid', 'Processing', 'Packed', 'Cancelled'],
  'Paid': ['Processing', 'Packed', 'Shipped', 'Refunded', 'Cancelled'],
  'Processing': ['Packed', 'Shipped', 'Cancelled', 'Refunded'],
  'Packed': ['Shipped', 'Cancelled'],
  'Shipped': ['OutForDelivery', 'Delivered', 'RTO', 'Refunded'],
  'OutForDelivery': ['Delivered', 'RTO'],
  'Delivered': ['ReturnRequested', 'Returned', 'Refunded'],
  'ReturnRequested': ['ReturnApproved', 'Returned', 'Cancelled', 'Delivered'],
  'ReturnApproved': ['Returned', 'Refunded'],
  'Returned': ['Refunded'],
  'RTO': ['Refunded', 'Returned'],
  'Cancelled': ['Refunded'],
  'Refunded': []
};

router.put('/api/orders/:id', protect, checkPermission('orders:edit'), async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const validationResult = orderUpdateSchema.safeParse(req.body);
    if (!validationResult.success) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ success: false, message: "Validation failed", errors: validationResult.error.format(), requestId: req.requestId });
    }

    const { status, adminNotes, refundStatus, auditReason } = validationResult.data;

    if (refundStatus && refundStatus !== 'N-A' && refundStatus !== 'N/A') {
      const userPermissions = req.user.role === 'admin' || req.user.role === 'super_admin' ? ['all'] : (require('../middleware/rbacMiddleware').ROLE_PERMISSIONS[req.user.role] || []);
      const canRefund = userPermissions.includes('finance:refund') || userPermissions.includes('finance:all') || userPermissions.includes('orders:refund') || userPermissions.includes('orders:all') || userPermissions.includes('all');
      if (!canRefund) {
        await session.abortTransaction();
        session.endSession();
        return res.status(403).json({ success: false, message: "Access Denied: Your role lacks permission to process refunds." });
      }
    }

    const existingOrder = await Order.findById(req.params.id).session(session);
    if (!existingOrder) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ success: false, message: "Order not found", requestId: req.requestId });
    }

    if (status && status !== existingOrder.status) {
      const validNextStates = ALLOWED_STATE_TRANSITIONS[existingOrder.status] || [];
      if (!validNextStates.includes(status)) {
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({ success: false, message: `Invalid state transition. Cannot move order from '${existingOrder.status}' to '${status}'.`, requestId: req.requestId });
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
        { returnDocument: 'after', session }
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

    const orderResponse = { ...updatedOrder._doc, id: updatedOrder._id.toString() };
    
    if(io) { 
      try { 
        io.to('orders').emit('order.status.changed', orderResponse);
        io.emit("order_status_updated", orderResponse); 
      } catch(e){} 
    }

    res.json(orderResponse);
  } catch (error) { 
    if (session.inTransaction()) await session.abortTransaction();
    session.endSession();
    return sendErrorResponse(res, req, error, "Failed to update order status");
  }
});

// ==========================================
// 👤 GET USER ORDERS
// ==========================================
router.get('/api/orders/user/:userId', protect, async (req, res) => {
  try {
    if (req.user._id.toString() !== req.params.userId && req.user.role !== 'admin' && req.user.role !== 'manager' && req.user.role !== 'super_admin') {
       return res.status(403).json({ success: false, message: "Access Denied: You can only view your own orders.", requestId: req.requestId });
    }

    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, parseInt(req.query.limit) || 10);
    const skip = (page - 1) * limit;

    const orders = await Order.find({ userId: req.params.userId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    res.json(orders.map(o => ({ ...o, id: o._id.toString() })));
  } catch (error) { 
    return sendErrorResponse(res, req, error, "Failed to fetch orders"); 
  }
});

// ==========================================
// 📦 GET ALL ORDERS
// ==========================================
router.get('/api/orders', protect, checkPermission('orders:view'), async (req, res) => {
  try {
    const { status, payment, search, dateFrom, dateTo } = req.query;

    const limit = Math.min(Math.max(parseInt(req.query.limit) || 20, 1), 100);
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const skip = (page - 1) * limit;

    const query = {};

    if (status) {
      if (status === 'pending') {
        query.status = { $in: ['Pending Review', 'Processing'] };
      } else if (status === 'rto') {
        query.status = 'RTO';
      } else if (status === 'returns') {
        query.$or = [
          { status: 'Returned' },
          { refundStatus: { $ne: 'N/A' } }
        ];
      } else {
        query.status = status;
      }
    }

    if (payment) {
      query.paymentMethod = new RegExp(escapeRegex(payment), 'i');
    }

    if (dateFrom || dateTo) {
      query.createdAt = {};
      if (dateFrom) query.createdAt.$gte = new Date(dateFrom);
      if (dateTo && !isNaN(new Date(dateTo).getTime())) {
        const endDate = new Date(dateTo);
        endDate.setHours(23, 59, 59, 999);
        query.createdAt.$lte = endDate;
      }
    }

    if (search && search.trim().length > 0) {
      const cleanSearch = search.trim();
      const safeRegex = new RegExp(escapeRegex(cleanSearch), 'i');

      const searchConditions = [
        { 'address.name': safeRegex },
        { 'userDetails.name': safeRegex },
        { 'address.primaryPhone': safeRegex }
      ];

      if (mongoose.Types.ObjectId.isValid(cleanSearch)) {
        searchConditions.push({ _id: cleanSearch });
      }

      query.$or = searchConditions;
    }

    const [orders, totalCount] = await Promise.all([
      Order.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Order.countDocuments(query)
    ]);

    res.json({
      success: true,
      total: totalCount,
      page,
      pages: Math.ceil(totalCount / limit) || 1,
      orders: orders.map(o => ({ ...o, id: o._id.toString() }))
    });
  } catch (error) { 
    return sendErrorResponse(res, req, error, "Failed to fetch paginated orders"); 
  }
});

module.exports = router;