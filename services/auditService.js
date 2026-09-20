// services/auditService.js
const AuditLog = require('../models/AuditLog');
const { logger } = require('../utils/logger');

/**
 * Enterprise Customer Support & Commerce Audit Trail Service (Task #69)
 * Records every critical action: agent metadata, timestamp, old status, new status, 
 * message content, assignment handoffs, and refund operations with absolute precision.
 * 
 * @param {Object} req - Express request object containing authenticated req.user
 * @param {String} action - Action identifier (e.g., 'STATUS_CHANGE', 'ASSIGNMENT', 'REFUND_PROCESSED', 'MESSAGE_ADDED')
 * @param {String} targetType - Target entity type ('TICKET', 'ORDER', 'PAYMENT', 'USER')
 * @param {ObjectId|String} targetId - Target document ID
 * @param {String} details - Human-readable summary of the audit action
 * @param {Object} [options] - Additional parameters: oldStatus, newStatus, message, assignment, refundAction, metadata
 * @returns {Promise<Object|null>} Created audit log entry or null on safe fallback
 */
const logAuditAction = async (req, action, targetType, targetId, details, options = {}) => {
  try {
    if (!req || !req.user) {
      logger.warn({ message: "Audit log attempted without authenticated user context", action, targetId });
      return null;
    }

    const ipAddress = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'Unknown IP';
    const agentId = req.user._id || req.user.id;
    const agentEmail = req.user.email || req.user.name || 'Support Agent';

    const auditPayload = {
      action: action.toUpperCase(),
      targetType: (targetType || 'TICKET').toUpperCase(),
      targetId,
      agentId,
      agentEmail,
      oldStatus: options.oldStatus || '',
      newStatus: options.newStatus || '',
      message: options.message || '',
      assignment: {
        previousAgent: options.assignment?.previousAgent || '',
        newAgent: options.assignment?.newAgent || '',
        assignedAgentId: options.assignment?.assignedAgentId || null
      },
      refundAction: {
        isRefund: !!options.refundAction?.isRefund,
        refundAmountPaise: options.refundAction?.refundAmountPaise || 0,
        gatewayRefundId: options.refundAction?.gatewayRefundId || '',
        reason: options.refundAction?.reason || ''
      },
      details: details || `Performed ${action} on ${targetType}`,
      metadata: options.metadata || {},
      ipAddress,
      timestamp: new Date()
    };

    const auditEntry = await AuditLog.create(auditPayload);

    logger.info({
      message: `AUDIT TRAIL LOGGED: [${auditPayload.action}] on ${auditPayload.targetType} #${targetId}`,
      agent: agentEmail,
      ip: ipAddress
    });

    return auditEntry;
  } catch (error) {
    console.error("Audit Logging Service Error:", error);
    logger.error({ message: "Failed to create audit log entry", error: error.message, stack: error.stack });
    // Fails gracefully to prevent operational database transactions from breaking due to logging errors
    return null;
  }
};

/**
 * Specialized audit helper for recording refund operations (Task #69 specific requirement)
 */
const logRefundAudit = async (req, orderId, refundAmountPaise, gatewayRefundId, reason) => {
  return logAuditAction(req, 'REFUND_PROCESSED', 'ORDER', orderId, `Processed financial refund of ₹${(refundAmountPaise / 100).toFixed(2)}`, {
    refundAction: {
      isRefund: true,
      refundAmountPaise,
      gatewayRefundId,
      reason
    }
  });
};

/**
 * Specialized audit helper for recording ticket status mutations and assignment transfers
 */
const logTicketMutationAudit = async (req, ticketId, oldStatus, newStatus, assignmentInfo, messageText = '') => {
  return logAuditAction(req, 'TICKET_MUTATION', 'TICKET', ticketId, `Ticket transitioned from ${oldStatus} to ${newStatus}`, {
    oldStatus,
    newStatus,
    message: messageText,
    assignment: assignmentInfo
  });
};

module.exports = {
  logAuditAction,
  logRefundAudit,
  logTicketMutationAudit
};