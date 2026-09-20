// services/inventoryService.js
const { Product, Warehouse } = require('../models');

/**
 * Atomic stock reservation and inventory decrement service (Task #65).
 * Prevents race conditions and overselling during simultaneous checkout attempts
 * by strictly enforcing ACID Mongoose multi-document transaction sessions.
 * 
 * @param {Array<{ productId: string, quantity: number }>} items 
 * @param {string} warehouseId 
 * @param {string} userId 
 * @param {Object} session - Mongoose transaction session (Mandatory for ACID safety)
 * @returns {Promise<{ success: boolean, verifiedItems: Array, selectedWarehouseId: string }>}
 */
const reserveInventoryAtomic = async (items, warehouseId, userId, session) => {
  if (!session) {
    throw new Error("ACID Transaction Session is required for atomic inventory reservation.");
  }

  const verifiedItems = [];
  let targetWarehouse = null;

  if (warehouseId) {
    targetWarehouse = await Warehouse.findOne({ _id: warehouseId, isActive: true }).session(session);
  }

  if (!targetWarehouse) {
    targetWarehouse = await Warehouse.findOne({ isActive: true }).sort({ priority: 1 }).session(session);
  }

  const resolvedWarehouseId = targetWarehouse ? targetWarehouse._id : null;

  for (const rawItem of items) {
    const { productId, quantity } = rawItem;

    // 🔥 TASK #65: ATOMIC RACE-CONDITION SAFE STOCK CHECK & DECREMENT ($gte query bound to session)
    const product = await Product.findOne({
      _id: productId,
      $or: [
        { 'inventoryState.available': { $gte: quantity } },
        { inventory: { $gte: quantity } }
      ]
    }).session(session);

    if (!product) {
      throw new Error(`Insufficient available stock or product not found for ID: ${productId}`);
    }

    if (!product.inventoryState) {
      product.inventoryState = { available: product.inventory || 0, sellable: product.inventory || 0, reserved: 0 };
    }

    let prevAvailable = product.inventoryState.available;
    let whInv = null;

    if (resolvedWarehouseId) {
      whInv = product.warehouseInventories?.find(w => w.warehouse.toString() === resolvedWarehouseId.toString());
      if (whInv) {
        prevAvailable = whInv.inventoryState?.available !== undefined ? whInv.inventoryState.available : whInv.inventory;
      }
    }

    if (prevAvailable < quantity) {
      throw new Error(`Insufficient available stock for product: ${product.title || product.name}`);
    }

    const newAvailable = prevAvailable - quantity;

    // Update global / state inventory
    product.inventoryState.available = newAvailable;
    product.inventoryState.reserved = (product.inventoryState.reserved || 0) + quantity;
    product.inventory = newAvailable;

    // Update warehouse specific inventory if mapped
    if (resolvedWarehouseId) {
      const whInvIndex = product.warehouseInventories?.findIndex(w => w.warehouse.toString() === resolvedWarehouseId.toString());
      if (whInvIndex !== -1 && whInvIndex !== undefined) {
        product.warehouseInventories[whInvIndex].inventoryState.available = newAvailable;
        product.warehouseInventories[whInvIndex].inventoryState.reserved = (product.warehouseInventories[whInvIndex].inventoryState.reserved || 0) + quantity;
      } else {
        product.warehouseInventories.push({
          warehouse: resolvedWarehouseId,
          inventory: newAvailable,
          inventoryState: { available: newAvailable, reserved: quantity, sellable: newAvailable }
        });
      }
    }

    // Push immutable stock ledger entry
    product.stockLedger.push({
      type: 'RESERVED',
      quantity,
      previousAvailable: prevAvailable,
      newAvailable,
      source: 'Order',
      referenceId: 'PENDING_ORDER',
      reason: `Atomic stock reservation for checkout order`,
      warehouseId: resolvedWarehouseId,
      performedBy: userId,
      timestamp: new Date()
    });

    // Save product within the transaction session
    await product.save({ session });

    const unitPricePaise = product.pricePaise || Math.round(parseFloat(product.price || 0) * 100);
    const unitCogsPaise = product.cogsPaise || Math.round(parseFloat(product.cogs || 0) * 100);

    verifiedItems.push({
      productId: product._id,
      title: product.title || product.name,
      pricePaise: unitPricePaise,
      cogsPaise: unitCogsPaise,
      quantity,
      image: product.image || (product.images ? product.images[0] : '')
    });
  }

  if (targetWarehouse) {
    await Warehouse.findByIdAndUpdate(targetWarehouse._id, { $inc: { currentLoad: 1 } }, { session });
  }

  return {
    success: true,
    verifiedItems,
    selectedWarehouseId: resolvedWarehouseId
  };
};

module.exports = {
  reserveInventoryAtomic
};