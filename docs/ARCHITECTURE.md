# 🏛️ Jack Essentials — System Architecture & Data Flow

## 1. Technical Stack Overview
- **Backend Runtime:** Node.js / Express.js
- **Database:** MongoDB (Mongoose with strict transactions and indexes)
- **Caching & Workers:** Redis & BullMQ (for background processing like abandoned carts and analytics)
- **Real-Time Communication:** Socket.IO with handshake cookie authentication and room isolation
- **Payment Gateway:** Razorpay (with HMAC SHA-256 signature verification and webhook idempotency)
- **Testing:** Vitest (Integration/Unit) & Playwright (E2E)

---

## 2. Directory Structure & Separation of Concerns