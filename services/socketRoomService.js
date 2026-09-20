// services/socketRoomService.js
/**
 * Enterprise Socket Room Service (Task #34)
 * Replaces dangerous global io.emit() calls with targeted room-based broadcasts
 * to prevent unnecessary data exposure and conserve bandwidth.
 */
class SocketRoomService {
  constructor(ioInstance = null) {
    this.io = ioInstance;
  }

  setIO(io) {
    this.io = io;
  }

  /**
   * Broadcast order events specifically to admin room and order channels.
   */
  emitOrderEvent(event, data) {
    if (!this.io) return;
    this.io.to('admin_room').to('orders').emit(event, data);
  }

  /**
   * Broadcast inventory updates to admin and inventory rooms.
   */
  emitInventoryEvent(event, data) {
    if (!this.io) return;
    this.io.to('admin_room').to('inventory').emit(event, data);
  }

  /**
   * Broadcast payment events to admin and payment rooms.
   */
  emitPaymentEvent(event, data) {
    if (!this.io) return;
    this.io.to('admin_room').to('payments').emit(event, data);
  }

  /**
   * Send event to a specific user room (e.g. order updates, force logout).
   */
  emitToUser(userId, event, data) {
    if (!this.io || !userId) return;
    this.io.to(String(userId)).emit(event, data);
  }

  /**
   * Send event to a specific support conversation/ticket room.
   */
  emitToConversation(conversationId, event, data) {
    if (!this.io || !conversationId) return;
    this.io.to(String(conversationId)).emit(event, data);
  }

  /**
   * Broadcast support queue alerts to support staff.
   */
  emitSupportQueueEvent(event, data) {
    if (!this.io) return;
    this.io.to('admin_room').to('support').to('support_queue').emit(event, data);
  }

  /**
   * Broadcast live visitor analytics exclusively to admin dashboard rooms.
   */
  emitLiveTraffic(visitorsArray) {
    if (!this.io) return;
    this.io.to('admin_room').emit('customer.live', visitorsArray);
    this.io.to('admin_room').emit('live_traffic_update', visitorsArray);
  }
}

const socketRoomService = new SocketRoomService();
module.exports = socketRoomService;