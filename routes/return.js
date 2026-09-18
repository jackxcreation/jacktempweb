// routes/return.js
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { Order, Product, User } = require('../models');
const { z } = require('zod'); // 🔥 Zod for strict input validation
const { logger } = require('../utils/logger');

// 🚨 IMPORT AUTH & ZERO-TRUST RBAC MIDDLEWARES
const { protect } = require('../middleware/authMiddleware');
const { checkPermission } = require('../middleware/rbacMiddleware');

// ==========================================
// 🛡️ ZOD VALIDATION SCHEMAS FOR RETURNS
// ==========================================
const returnRequestSchema = z.object({
  orderId: z.string().min(1, "Order ID is required"),
  reason: z.string().min(3, "Return reason is required").max(200),
  comments: z.string().max(500).optional()
});

const returnStatusUpdateSchema = z.object({
  status: z.enum(['ReturnApproved', 'Returned', 'Rejected', 'Refunded']),
  adminNotes: z.string().max(300).optional()
});

// Helper for error responses
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

// Privileged staff roles for administrative review
const PRIVILEGED_ROLES = [
  'admin', 'super_admin', 'operations_manager', 'customer_support', 
  'finance_manager', 'warehouse_manager', 'manager', 'support'
];

// ==========================================
// 📦 1. CREATE RETURN REQUEST (CUSTOMER FACING)
// ==========================================
router.post('/api/returns', protect, async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const validationResult = returnRequestSchema.safeParse(req.body);
    if (!validationResult.success) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ 
        success: false, 
        message: "Validation failed", 
        errors: validationResult.error.format(),
        requestId: req.requestId 
      });
    }

    const { orderId, reason, comments } = validationResult.data;

    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ success: false, message: "Invalid Order ID format", requestId: req.requestId });
    }

    const order = await Order.findById(orderId).session(session);
    if (!order) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ success: false, message: "Order not found", requestId: req.requestId });
    }

    // 🔥 STRICT BOLA / IDOR OWNERSHIP VERIFICATION
    const isOwner = order.userId && order.userId.toString() === req.user._id.toString();
    if (!isOwner) {
      logger.warn({
        message: `UNAUTHORIZED RETURN ATTEMPT: User ${req.user.email} tried to return Order #${orderId} owned by User ${order.userId}`,
        requestId: req.requestId
      });
      await session.abortTransaction();
      session.endSession();
      return res.status(403).json({ success: false, message: "Access Denied: You do not own this order.", requestId: req.requestId });
    }

    // Check if order is eligible for return (e.g., must be Delivered)
    if (order.status !== 'Delivered') {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ 
        success: false, 
        message: `Orders with status '${order.status}' are not eligible for return. Only delivered items can be returned within policy window.`, 
        requestId: req.requestId 
      });
    }

    // Update order status to ReturnRequested
    order.status = 'ReturnRequested';
    order.adminNotes = `Return Requested: ${reason} - ${comments || 'No comments'}`;
    await order.save({ session });

    await session.commitTransaction();
    session.endSession();

    const io = req.app.get("io");
    if (io) {
      try {
        io.to('orders').emit('order.return.requested', { orderId: order._id, userId: req.user._id });
      } catch (e) {}
    }

    return res.status(200).json({
      success: true,
      message: "Return request submitted successfully. Our team will review and update within 24-48 hours.",
      order: { ...order._doc, id: order._id.toString() }
    });

  } catch (error) {
    if (session.inTransaction()) await session.abortTransaction();
    session.endSession();
    return sendErrorResponse(res, req, error, "Failed to submit return request");
  }
});

// ==========================================
// 🔍 2. GET RETURN/ORDER DETAILS BY ID (IDOR & BOLA PROTECTED)
// ==========================================
router.get('/api/returns/:id', protect, async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Invalid Return/Order ID format", requestId: req.requestId });
    }

    const order = await Order.findById(id).lean();
    if (!order) {
      return res.status(404).json({ success: false, message: "Return record / Order not found", requestId: req.requestId });
    }

    const isPrivilegedStaff = PRIVILEGED_ROLES.includes(req.user.role);
    const isOwner = order.userId && order.userId.toString() === req.user._id.toString();

    // 🔥 STRICT IDOR / BOLA ENFORCEMENT
    if (!isOwner && !isPrivilegedStaff) {
      logger.warn({
        message: `UNAUTHORIZED ACCESS ATTEMPT: User ${req.user.email} tried to access Return record #${id}`,
        requestId: req.requestId
      });
      return res.status(403).json({ success: false, message: "Access Denied: You do not own this return record.", requestId: req.requestId });
    }

    return res.status(200).json({
      success: true,
      returnRecord: {
        ...order,
        id: order._id.toString(),
        isReturnActive: ['ReturnRequested', 'ReturnApproved', 'Returned'].includes(order.status)
      }
    });

  } catch (error) {
    return sendErrorResponse(res, req, error, "Failed to fetch return details");
  }
});

// ==========================================
// 📋 3. GET ALL RETURNS (ADMIN / STAFF VIEW)
// ==========================================
router.get('/api/returns', protect, checkPermission('orders:view'), async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit) || 20, 1), 100);
    const skip = (page - 1) * limit;

    const query = {
      status: { $in: ['ReturnRequested', 'ReturnApproved', 'Returned', 'RTO'] }
    };

    const [orders, totalCount] = await Promise.all([
      Order.find(query).sort({ updatedAt: -1 }).skip(skip).limit(limit).lean(),
      Order.countDocuments(query)
    ]);

    return res.status(200).json({
      success: true,
      total: totalCount,
      page,
      pages: Math.ceil(totalCount / limit) || 1,
      returns: orders.map(o => ({ ...o, id: o._id.toString() }))
    });

  } catch (error) {
    return sendErrorResponse(res, req, error, "Failed to fetch returns list");
  }
});

// ==========================================
// ✏️ 4. UPDATE RETURN STATUS (ADMIN / STAFF ONLY)
// ==========================================
router.put('/api/returns/:id/status', protect, checkPermission('orders:edit'), async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ success: false, message: "Invalid ID format", requestId: req.requestId });
    }

    const validationResult = returnStatusUpdateSchema.safeParse(req.body);
    if (!validationResult.success) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ success: false, message: "Validation failed", errors: validationResult.error.format(), requestId: req.requestId });
    }

    const { status, adminNotes } = validationResult.data;

    const order = await Order.findById(id).session(session);
    if (!order) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ success: false, message: "Order not found", requestId: req.requestId });
    }

    order.status = status;
    if (adminNotes) {
      order.adminNotes = `${order.adminNotes || ''} | [Staff Update]: ${adminNotes}`;
    }

    await order.save({ session });
    await session.commitTransaction();
    session.endSession();

    const io = req.app.get("io");
    if (io) {
      try {
        io.to('orders').emit('order.return.updated', { orderId: order._id, status });
      } catch (e) {}
    }

    return res.status(200).json({
      success: true,
      message: `Return status updated to ${status} successfully`,
      order: { ...order._doc, id: order._id.toString() }
    });

  } catch (error) {
    if (session.inTransaction()) await session.abortTransaction();
    session.endSession();
    return sendErrorResponse(res, req, error, "Failed to update return status");
  }
});

module.exports = router;