const express = require('express');
const router = express.Router();
const mongoose = require('mongoose'); 
const { Order, Product } = require('../models'); 
const { z } = require('zod'); // 🔥 Zod for strict input validation
const { logger } = require('../utils/logger'); // 🔥 Production Winston Logger

// 🚨 IMPORT AUTH & RBAC MIDDLEWARES
const { protect } = require('../middleware/authMiddleware');
const { checkPermission } = require('../middleware/rbacMiddleware');

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
    flat: z.string().min(1, "Flat/House info is required"),
    street: z.string().min(1, "Street info is required"),
    city: z.string().min(1, "City is required"),
    state: z.string().min(1, "State is required"),
    pincode: z.string().regex(/^\d{6}$/, "Invalid pincode. Must be 6 digits"),
    primaryPhone: z.string().regex(/^\d{10}$/, "Invalid phone number. Must be 10 digits")
  }),
  paymentMethod: z.string().min(1, "Payment method is required"),
  userDetails: z.object({
    name: z.string().optional(),
    email: z.string().email().optional()
  }).optional(),
  trafficSource: z.any().optional()
});

const orderUpdateSchema = z.object({
  status: z.enum(['Pending', 'Paid', 'Processing', 'Shipped', 'Delivered', 'Cancelled', 'Refunded']).optional(),
  adminNotes: z.string().max(500).optional(),
  refundStatus: z.string().optional()
});

// Helper for secure production error responses
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
// 🛒 3. ORDER APIs (Real-time Socket.IO Enabled)
// ==========================================

// 1. AWB GENERATION ROUTE - MANAGER / ADMIN RBAC
router.post('/api/orders/:id/generate-awb', protect, checkPermission('orders:all'), async (req, res) => {
  try {
    const { id } = req.params;
    const order = await Order.findById(id);
    
    if (!order) return res.status(404).json({ success: false, message: "Order not found", requestId: req.requestId });

    res.status(200).json({ success: true, message: "AWB Generated Successfully", waybill: "JACK-" + Date.now() });
  } catch (error) {
    return sendErrorResponse(res, req, error, "Error generating AWB");
  }
});

// ==========================================
// 🖨️ FETCH DELIVERY LABEL - MANAGER / ADMIN RBAC
// ==========================================
router.get('/api/orders/label/:awb', protect, checkPermission('orders:all'), async (req, res) => {
  try {
    const { awb } = req.params;
    
    const response = await fetch(`https://track.delhivery.com/api/p/packing_slip?format=json&wbns=${awb}`, {
      method: 'GET',
      headers: {
        'Authorization': `Token ${process.env.DELHIVERY_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });
    
    const rawText = await response.text(); 
    
    try {
        const data = JSON.parse(rawText);
        res.status(200).json(data);
    } catch (e) {
        res.status(200).json({ isHtml: true, htmlContent: rawText });
    }
  } catch (error) {
    return sendErrorResponse(res, req, error, "Server error fetching label");
  }
});

// ==========================================
// 🚚 SCHEDULE PICKUP / MANIFEST - WAREHOUSE / ADMIN RBAC
// ==========================================
router.post('/api/orders/pickup', protect, checkPermission('warehouse:all'), async (req, res) => {
  try {
    const { package_count, location_name } = req.body;
    
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1); 

    const payload = {
      "pickup_time": "14:00:00", 
      "pickup_date": tomorrow.toISOString().split('T')[0], 
      "pickup_location": location_name || "JACK_HUB", 
      "expected_package_count": package_count || 1
    };

    const response = await fetch('https://track.delhivery.com/fm/request/new/', {
      method: 'POST',
      headers: {
        'Authorization': `Token ${process.env.DELHIVERY_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const rawText = await response.text();
    try {
        const data = JSON.parse(rawText);
        res.status(200).json(data);
    } catch (e) {
        res.status(200).json({ success: false, error: "Delhivery Response Error", raw: rawText });
    }
  } catch (error) {
    return sendErrorResponse(res, req, error, "Error scheduling pickup");
  }
});

// ==========================================
// 🚫 CANCEL DELHIIVERY SHIPMENT - MANAGER / ADMIN RBAC
// ==========================================
router.post('/api/orders/:id/cancel-shipment', protect, checkPermission('orders:all'), async (req, res) => {
  try {
    const { waybill } = req.body;
    const payload = { "waybill": waybill, "cancellation": true };
    
    const response = await fetch('https://track.delhivery.com/api/p/edit', {
      method: 'POST',
      headers: {
        'Authorization': `Token ${process.env.DELHIVERY_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    
    const rawText = await response.text();
    try {
        const data = JSON.parse(rawText);
        res.status(200).json(data);
    } catch (e) {
        res.status(200).json({ success: false, message: "Delhivery Response Error", raw: rawText });
    }
  } catch (error) {
    return sendErrorResponse(res, req, error, "Error cancelling shipment");
  }
});

// ==========================================
// 🛒 MAIN ORDER CREATION ROUTE - ZOD VALIDATED & ATOMIC RESERVATION 🔥
// ==========================================
router.post('/api/orders', protect, async (req, res) => {
  // 🔥 Strict Zod Validation First
  const validationResult = orderCreationSchema.safeParse(req.body);
  if (!validationResult.success) {
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
    const { items, address, paymentMethod, userDetails, trafficSource } = validationResult.data;
    const secureUserId = req.user._id; 
    const safeStatus = 'Pending'; 

    let calculatedServerTotalPaise = 0;
    const verifiedOrderItems = [];

    for (const rawItem of items) {
      const productId = rawItem.productId;
      const orderQty = rawItem.quantity;

      const updatedProduct = await Product.findOneAndUpdate(
        { _id: productId, inventory: { $gte: orderQty } },
        { $inc: { inventory: -orderQty } },
        { new: true, session }
      );

      if (!updatedProduct) {
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({ success: false, message: `Insufficient stock or product not found for ID: ${productId}`, requestId: req.requestId });
      }

      const unitPricePaise = updatedProduct.pricePaise || Math.round(parseFloat(updatedProduct.price || 0) * 100);
      calculatedServerTotalPaise += unitPricePaise * orderQty;

      verifiedOrderItems.push({
        productId: updatedProduct._id,
        title: updatedProduct.title,
        pricePaise: unitPricePaise,
        quantity: orderQty,
        image: updatedProduct.image || (updatedProduct.images ? updatedProduct.images[0] : '')
      });
    }

    const deviceInfo = req.headers['user-agent']?.includes('Mobile') ? 'Mobile Device' : 'Desktop / PC';
    const io = req.app.get("io"); 

    const newOrder = new Order({ 
      userId: secureUserId, 
      items: verifiedOrderItems, 
      totalPaise: calculatedServerTotalPaise,
      status: safeStatus, 
      address, 
      paymentMethod, 
      userDetails, 
      deviceInfo, 
      trafficSource 
    });
    
    const savedOrder = await newOrder.save({ session });
    
    await session.commitTransaction();
    session.endSession();

    const orderResponse = { ...savedOrder._doc, id: savedOrder._id.toString() };

    if (io) {
        try {
             io.emit("new_order", orderResponse);
        } catch(socketErr) {
             console.error("Socket emit failed:", socketErr);
        }
    }

    // Background Delhivery manifestation
    if (process.env.DELHIVERY_TOKEN && address) {
      setTimeout(async () => {
        try {
            let cleanPhone = (address.primaryPhone || "9999999999").replace(/[^0-9]/g, '');
            if (cleanPhone.length > 10) cleanPhone = cleanPhone.slice(-10);
            let cleanPincode = (address.pincode || "110001").replace(/[^0-9]/g, '');

            const finalNumericAmount = Math.round(calculatedServerTotalPaise / 100);

            const payString = String(paymentMethod || '').toLowerCase();
            const isCod = payString.includes('cod') || payString.includes('cash');

            let productsDescription = verifiedOrderItems.map(i => i.title || "Product").join(", ");
            let totalQuantity = verifiedOrderItems.reduce((sum, item) => sum + item.quantity, 0);

            let totalWeight = 0, maxL = 15, maxB = 15, totalH = 10;
            verifiedOrderItems.forEach(item => {
                const qty = item.quantity;
                totalWeight += 500 * qty; 
            });

            const payloadData = {
                shipments: [{
                    name: (userDetails?.name || address.name || "Customer").substring(0, 40),
                    add: `${address.flat || ''}, ${address.street || ''}`.trim().substring(0, 100) || "Default Address",
                    pin: cleanPincode, 
                    city: address.city || "Jagatsinghpur", 
                    state: address.state || "Odisha", 
                    country: "India",
                    phone: cleanPhone, 
                    order: savedOrder._id.toString(),
                    payment_mode: isCod ? "COD" : "Pre-paid",
                    return_pin: "754132", return_city: "Jagatsinghpur", return_phone: "9999999999", 
                    return_add: "Jack Essentials Return Address", return_state: "Odisha", return_country: "India",
                    products_desc: productsDescription.substring(0, 120),
                    hsn_code: "",
                    weight: String(Math.round(totalWeight)), 
                    length: String(Math.round(maxL)), 
                    breadth: String(Math.round(maxB)), 
                    height: String(Math.round(totalH)),
                    shipment_length: String(Math.round(maxL)), 
                    shipment_width: String(Math.round(maxB)), 
                    shipment_height: String(Math.round(totalH)),
                    cod_amount: isCod ? finalNumericAmount : 0,
                    order_date: new Date().toISOString(), 
                    total_amount: finalNumericAmount,
                    seller_inv: "", quantity: totalQuantity, waybill: ""
                }],
                pickup_location: { name: "JACK_HUB" }
            };

            const urlEncodedData = new URLSearchParams();
            urlEncodedData.append("format", "json");
            urlEncodedData.append("data", JSON.stringify(payloadData));

            const dRes = await fetch('https://track.delhivery.com/api/cmu/create.json', {
                method: 'POST', 
                headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Authorization': `Token ${process.env.DELHIVERY_TOKEN}` },
                body: urlEncodedData.toString()
            });
            
            const rawDText = await dRes.text();
            const dData = JSON.parse(rawDText);
            if (dData.success || (dData.packages && dData.packages.length > 0)) {
                const waybillNo = dData.packages[0]?.waybill || dData.waybill;
                await Order.findByIdAndUpdate(savedOrder._id, { shiprocketOrderId: waybillNo });
            }
        } catch (err) { console.error("Background Delhivery Error:", err); }
      }, 100); 
    }

    res.status(201).json(orderResponse);
  } catch (error) { 
    if (session.inTransaction()) {
      await session.abortTransaction();
    }
    session.endSession();
    return sendErrorResponse(res, req, error, "Order creation failed");
  }
});

// ==========================================
// ✏️ UPDATE ORDER STATUS - MANAGER / ADMIN RBAC & ZOD VALIDATED 🔥
// ==========================================
const ALLOWED_STATE_TRANSITIONS = {
  'Pending': ['Paid', 'Processing', 'Cancelled'],
  'Paid': ['Processing', 'Refunded', 'Cancelled'],
  'Processing': ['Shipped', 'Cancelled', 'Refunded'],
  'Shipped': ['Delivered', 'Refunded'],
  'Delivered': ['Refunded'],
  'Cancelled': [],
  'Refunded': []
};

router.put('/api/orders/:id', protect, checkPermission('orders:all'), async (req, res) => {
  try {
    // 🔥 Strict Zod Validation
    const validationResult = orderUpdateSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({ 
        success: false, 
        message: "Validation failed", 
        errors: validationResult.error.format(),
        requestId: req.requestId
      });
    }

    const { status, adminNotes, refundStatus } = validationResult.data;

    const existingOrder = await Order.findById(req.params.id);
    if (!existingOrder) return res.status(404).json({ success: false, message: "Order not found", requestId: req.requestId });

    // 🔥 ENFORCE STRICT STATE MACHINE TRANSITIONS
    if (status && status !== existingOrder.status) {
      const validNextStates = ALLOWED_STATE_TRANSITIONS[existingOrder.status] || [];
      if (!validNextStates.includes(status)) {
        return res.status(400).json({ 
          success: false,
          message: `Invalid state transition. Cannot move order from '${existingOrder.status}' to '${status}'.`,
          requestId: req.requestId
        });
      }
    }

    const io = req.app.get("io"); 

    const updateFields = {};
    if (status) updateFields.status = status;
    if (adminNotes !== undefined) updateFields.adminNotes = adminNotes;
    if (refundStatus !== undefined) updateFields.refundStatus = refundStatus;

    const updatedOrder = await Order.findByIdAndUpdate(
        req.params.id, 
        updateFields, 
        { returnDocument: 'after' }
    );

    const orderResponse = { ...updatedOrder._doc, id: updatedOrder._id.toString() };
    if(io) { try { io.emit("order_status_updated", orderResponse); } catch(e){} }

    res.json(orderResponse);
  } catch (error) { 
    return sendErrorResponse(res, req, error, "Failed to update order status");
  }
});

// ==========================================
// 👤 GET USER ORDERS - IDOR FIXED & PAGINATED
// ==========================================
router.get('/api/orders/user/:userId', protect, async (req, res) => {
  try {
    if (req.user._id.toString() !== req.params.userId && req.user.role !== 'admin' && req.user.role !== 'manager') {
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
// 📦 GET ALL ORDERS - MANAGER / ADMIN RBAC & PAGINATED
// ==========================================
router.get('/api/orders', protect, checkPermission('orders:all'), async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, parseInt(req.query.limit) || 20);
    const skip = (page - 1) * limit;

    const orders = await Order.find()
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    res.json(orders.map(o => ({ ...o, id: o._id.toString() })));
  } catch (error) { 
    return sendErrorResponse(res, req, error, "Failed to fetch orders"); 
  }
});

module.exports = router;