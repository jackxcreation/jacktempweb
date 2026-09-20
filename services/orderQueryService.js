// services/orderQueryService.js
const { Order } = require('../models');
const mongoose = require('mongoose');

// Helper for secure regex escaping to prevent ReDoS attacks
const escapeRegex = (text) => {
  return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
};

/**
 * Enterprise Order Query & Pagination Service (Task #28 & #64)
 * Supports page, limit, cursor-based pagination, dynamic sorting, multi-filter search, 
 * lean queries, and targeted field projections.
 * 
 * @param {Object} queryParams - Query parameters from request
 * @returns {Promise<{ success: boolean, total: number, page: number, pages: number, hasMore: boolean, nextCursor: string|null, orders: Array, message?: string }>}
 */
const queryOrders = async (queryParams = {}) => {
  try {
    const { 
      status, 
      payment, 
      search, 
      dateFrom, 
      dateTo,
      cursor,
      sort = '-createdAt'
    } = queryParams;

    const limit = Math.min(Math.max(parseInt(queryParams.limit) || 20, 1), 100);
    const page = Math.max(parseInt(queryParams.page) || 1, 1);
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

    if (cursor && mongoose.Types.ObjectId.isValid(cursor)) {
      if (sort.startsWith('-')) {
        query._id = { ...(query._id || {}), $lt: new mongoose.Types.ObjectId(cursor) };
      } else {
        query._id = { ...(query._id || {}), $gt: new mongoose.Types.ObjectId(cursor) };
      }
    }

    // 🔥 TASK #64: Lean queries + targeted field projections for high-speed performance
    const [orders, totalCount] = await Promise.all([
      Order.find(query)
        .select('userId orderNumber items totalAmount totalPaise status paymentMethod address userDetails shipment createdAt updatedAt')
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .lean(),
      Order.countDocuments(query)
    ]);

    const nextCursor = orders.length > 0 ? orders[orders.length - 1]._id.toString() : null;
    const hasMore = (skip + orders.length) < totalCount;

    return {
      success: true,
      total: totalCount,
      page,
      pages: Math.ceil(totalCount / limit) || 1,
      hasMore,
      nextCursor,
      orders: orders.map(o => ({ ...o, id: o._id.toString() }))
    };
  } catch (error) {
    console.error("Order Query Service Error:", error.message);
    throw new Error(error.message || "Failed to query orders");
  }
};

module.exports = {
  queryOrders
};