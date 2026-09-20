// validators/support.js
const { z } = require('zod');

/**
 * 🔥 TASK #48: Centralized Zod Validation Schema for Support Messages
 */
const supportMessageValidator = z.object({
  conversationId: z.string().min(1, "Conversation ID is required"),
  content: z.string().min(1, "Message content cannot be empty").max(2000, "Message is too long")
});

/**
 * 🔥 TASK #48: Centralized Zod Validation Schema for Support Ticket Creation/Updates
 */
const supportTicketValidator = z.object({
  category: z.string().optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
  subject: z.string().min(2, "Subject is required").max(150, "Subject is too long").optional(),
  description: z.string().max(2000, "Description is too long").optional(),
  orderId: z.string().optional()
});

/**
 * 🔥 TASK #48: Centralized Zod Validation Schema for Ticket Escalation
 */
const supportEscalationValidator = z.object({
  conversationId: z.string().min(1, "Conversation ID is required"),
  reason: z.string().max(300, "Escalation reason is too long").optional()
});

module.exports = {
  supportMessageValidator,
  supportTicketValidator,
  supportEscalationValidator
};