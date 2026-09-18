// services/orderService.js
const mongoose = require('mongoose');
const { Order, Product, Warehouse, PaymentIntent } = require('../../models'); // Adjust relative path if models folder is at root
const { logger } = require('../../utils/logger');
const { trackEvent } = require('../analyticsQueue');

/**
 * Enterprise-grade Atomic Order Creation & Inventory Deduction Service
 * Prevents race-conditions and overselling using Mongoose Transactions.
 */
const createOrderService = async (userId, orderPayload, reqInstance = null) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { items, address, paymentMethod, userDetails, trafficSource, couponCode } = orderPayload;
    const safeStatus = 'Pending'; 
    const customerPincode = address.pincode;

    // ==========================================
    // 1. SMART MULTI-WAREHOUSE ROUTING & SELECTION
    // ==========================================
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
        const availableInWh = whInv ? (whInv.inventoryState?.available ?? whInv.inventory) : (product.inventoryState?.available ?? product.inventory);

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

    if (!selectedWarehouse && activeWarehouses.length > 0) {
      selectedWarehouse = activeWarehouses[0];
    }

    let calculatedServerTotalPaise = 0;
    let totalCogsPaise = 0; 
    const verifiedOrderItems = [];

    // ==========================================
    // 2. ATOMIC STOCK VERIFICATION & RESERVATION
    // ==========================================
    for (const rawItem of items) {
      const productId = rawItem.productId;
      const orderQty = rawItem.quantity;

      // Atomic query to prevent race condition overselling
      const product = await Product.findOne({
        _id: productId,
        $or: [
          { 'inventoryState.available': { $gte: orderQty } },
          { inventory: { $gte: orderQty } }
        ]
      }).session(session);

      if (!product) {
        await session.abortTransaction();
        session.endSession();
        throw new Error(`Insufficient available stock or product not found for ID: ${productId}`);
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
        throw new Error(`Insufficient available stock for product: ${product.title}`);
      }

      const newAvailable = prevAvailable - orderQty;

      product.inventoryState.available = newAvailable;
      product.inventoryState.reserved = (product.inventoryState.reserved || 0) + orderQty;
      product.inventory = newAvailable;

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
        performedBy: userId,
        timestamp: new Date()
      });

      await product.save({ session });

      // Real-time Socket.io Inventory Alerting
      if (reqInstance && reqInstance.app) {
        const ioInstance = reqInstance.app.get("io");
        if (ioInstance) {
          if (newAvailable === 0) {
            ioInstance.to('inventory').emit('inventory.out', { productId: product._id, title: product.title, sku: product.sku });
          } else if (newAvailable < 5) {
            ioInstance.to('inventory').emit('inventory.low', { productId: product._id, title: product.title, remaining: newAvailable, sku: product.sku });
          }
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

    // ==========================================
    // 3. FINANCIAL CALCULATIONS & PAISIFICATION
    // ==========================================
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
    const deviceInfo = reqInstance ? (reqInstance.headers['user-agent']?.includes('Mobile') ? 'Mobile Device' : 'Desktop / PC') : 'Web Browser / API';

    // ==========================================
    // 4. ORDER CREATION & PAYMENT INTENT PERSISTENCE
    // ==========================================
    const newOrder = new Order({ 
      userId, 
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
    await PaymentIntent.create([{
      userId,
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
      contributionPaise,
      items: verifiedOrderItems,
      trafficSource,
      userId
    });

    // Broadcast real-time order creation event via Socket.io if available
    if (reqInstance && reqInstance.app) {
      const io = reqInstance.app.get("io");
      if (io) {
        try {
          io.to('orders').emit('order.created', orderResponse);
          io.emit("new_order", orderResponse);
        } catch (e) {}
      }
    }

    return { success: true, order: orderResponse };
  } catch (error) {
    if (session.inTransaction()) await session.abortTransaction();
    session.endSession();
    logger.error({ message: "Order Service Execution Failed", error: error.message, stack: error.stack });
    throw error;
  }
};

module.exports = {
  createOrderService
};