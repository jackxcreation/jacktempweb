const express = require('express');
const router = express.Router();
const mongoose = require('mongoose'); // 🔥 ADDED FOR TRANSACTIONS
const { Order, Product } = require('../models'); // 🔥 Added Product model

// 🚨 IMPORT AUTH MIDDLEWARES
const { protect, admin } = require('../middleware/authMiddleware');

// ==========================================
// 🛒 3. ORDER APIs (Real-time Socket.IO Enabled)
// ==========================================

// 1. AWB GENERATION ROUTE - STRICTLY ADMIN ONLY
router.post('/api/orders/:id/generate-awb', protect, admin, async (req, res) => {
  try {
    const { id } = req.params;
    const order = await Order.findById(id);
    
    if (!order) return res.status(404).json({ message: "Order not found" });

    res.status(200).json({ success: true, message: "AWB Generated Successfully", waybill: "JACK-" + Date.now() });
  } catch (error) {
    console.error("AWB Generation Error:", error);
    res.status(500).json({ success: false, message: "Error generating AWB" });
  }
});

// ==========================================
// 🖨️ FETCH DELHIIVERY LABEL - STRICTLY ADMIN ONLY
// ==========================================
router.get('/api/orders/label/:awb', protect, admin, async (req, res) => {
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
    res.status(500).json({ success: false, message: "Server error fetching label" });
  }
});

// ==========================================
// 🚚 SCHEDULE PICKUP / MANIFEST - STRICTLY ADMIN ONLY
// ==========================================
router.post('/api/orders/pickup', protect, admin, async (req, res) => {
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
    res.status(500).json({ success: false, message: "Error scheduling pickup" });
  }
});

// ==========================================
// 🚫 CANCEL DELHIIVERY SHIPMENT - STRICTLY ADMIN ONLY
// ==========================================
router.post('/api/orders/:id/cancel-shipment', protect, admin, async (req, res) => {
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
    res.status(500).json({ success: false, message: "Error cancelling shipment" });
  }
});

// ==========================================
// 🛒 MAIN ORDER CREATION ROUTE - WITH INVENTORY TRANSACTION FLOW 🔥
// ==========================================
router.post('/api/orders', protect, async (req, res) => {
  // Start a Mongoose Session for ACID Transaction
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { items, totalAmount, address, paymentMethod, userDetails, trafficSource } = req.body;
    
    if (!items || !Array.isArray(items) || items.length === 0) {
      await session.endSession();
      return res.status(400).json({ message: "Order must contain items" });
    }

    const secureUserId = req.user._id; 
    const safeStatus = 'Pending'; 

    // 🔥 INVENTORY RESERVATION CHECK & DECREMENT 🔥
    for (const item of items) {
      const productId = item.productId || item._id;
      const orderQty = Number(item.quantity) || 1;

      const product = await Product.findById(productId).session(session);
      if (!product) {
        await session.abortTransaction();
        session.endSession();
        return res.status(404).json({ message: `Product not found: ${item.title || productId}` });
      }

      // Check stock (assuming field name is 'stock' or 'inventory')
      const currentStock = product.stock !== undefined ? product.stock : (product.inventory || 0);
      if (currentStock < orderQty) {
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({ message: `Insufficient stock for product: ${product.title || productId}. Available: ${currentStock}` });
      }

      // Decrement stock safely within transaction
      if (product.stock !== undefined) {
        product.stock -= orderQty;
      } else {
        product.inventory -= orderQty;
      }
      await product.save({ session });
    }

    const deviceInfo = req.headers['user-agent']?.includes('Mobile') ? 'Mobile Device' : 'Desktop / PC';
    const io = req.app.get("io"); 

    const newOrder = new Order({ 
      userId: secureUserId, 
      items, 
      totalAmount, 
      status: safeStatus, 
      address, 
      paymentMethod, 
      userDetails, 
      deviceInfo, 
      trafficSource 
    });
    
    const savedOrder = await newOrder.save({ session });
    
    // Commit Transaction (Sab kuch successful raha toh save ho gaya)
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

            const rawAmount = parseFloat(String(totalAmount).replace(/[^0-9.]/g, '')) || 0;
            const finalNumericAmount = Math.round(rawAmount);

            const payString = String(paymentMethod || '').toLowerCase();
            const isCod = payString.includes('cod') || payString.includes('cash');

            let productsDescription = items.map(i => i.title || i.name || i.productName || "Product").join(", ");
            let totalQuantity = items.reduce((sum, item) => sum + (Number(item.quantity) || 1), 0);

            let totalWeight = 0, maxL = 15, maxB = 15, totalH = 10;
            items.forEach(item => {
                const qty = Number(item.quantity) || 1;
                totalWeight += (Number(item.weight) || 500) * qty;
                maxL = Math.max(maxL, Number(item.length) || 15);
                maxB = Math.max(maxB, Number(item.breadth) || 15);
                totalH += (Number(item.height) || 10) * qty;
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
    // Rollback transaction if any error occurs
    await session.abortTransaction();
    session.endSession();
    console.error("Order Creation Error & Inventory Rollback:", error);
    res.status(500).json({ message: "Order failed", error: error.message }); 
  }
});

// ==========================================
// ✏️ UPDATE ORDER STATUS - STRICTLY ADMIN ONLY
// ==========================================
router.put('/api/orders/:id', protect, admin, async (req, res) => {
  try {
    const { status, adminNotes, refundStatus } = req.body;
    const io = req.app.get("io"); 

    const updatedOrder = await Order.findByIdAndUpdate(
        req.params.id, 
        { status, adminNotes, refundStatus }, 
        { returnDocument: 'after' }
    );

    const orderResponse = { ...updatedOrder._doc, id: updatedOrder._id.toString() };
    if(io) { try { io.emit("order_status_updated", orderResponse); } catch(e){} }

    res.json(orderResponse);
  } catch (error) { 
    res.status(500).json({ message: "Failed to update order status" }); 
  }
});

// ==========================================
// 👤 GET USER ORDERS - IDOR FIXED
// ==========================================
router.get('/api/orders/user/:userId', protect, async (req, res) => {
  try {
    if (req.user._id.toString() !== req.params.userId && req.user.role !== 'admin') {
       return res.status(403).json({ message: "Access Denied: You can only view your own orders." });
    }

    const orders = await Order.find({ userId: req.params.userId }).sort({ createdAt: -1 }).lean();
    res.json(orders.map(o => ({ ...o, id: o._id.toString() })));
  } catch (error) { res.status(500).json({ message: "Failed to fetch orders" }); }
});

// ==========================================
// 📦 GET ALL ORDERS - STRICTLY ADMIN ONLY
// ==========================================
router.get('/api/orders', protect, admin, async (req, res) => {
  try {
    const orders = await Order.find().sort({ createdAt: -1 }).lean();
    res.json(orders.map(o => ({ ...o, id: o._id.toString() })));
  } catch (error) { res.status(500).json({ message: "Failed to fetch orders" }); }
});

module.exports = router;