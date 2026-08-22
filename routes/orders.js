const express = require('express');
const router = express.Router();
const { Order } = require('../models');

// ==========================================
// 🛒 3. ORDER APIs (Real-time Socket.IO Enabled)
// ==========================================

// 1. AWB GENERATION ROUTE
router.post('/api/orders/:id/generate-awb', async (req, res) => {
  try {
    const { id } = req.params;
    const order = await Order.findById(id);
    
    if (!order) return res.status(404).json({ message: "Order not found" });

    // Yahan tumhara Delhivery/Shiprocket API logic ayega
    res.status(200).json({ success: true, message: "AWB Generated Successfully", waybill: "JACK-" + Date.now() });

  } catch (error) {
    console.error("AWB Generation Error:", error);
    res.status(500).json({ success: false, message: "Error generating AWB" });
  }
});

// ==========================================
// 🖨️ FETCH DELHIIVERY LABEL (FLIPKART-LEVEL BULLETPROOF)
// ==========================================
router.get('/api/orders/label/:awb', async (req, res) => {
  try {
    const { awb } = req.params;
    
    // Delhivery API to get Packing Slip (Forcing format=json)
    const response = await fetch(`https://track.delhivery.com/api/p/packing_slip?format=json&wbns=${awb}`, {
      method: 'GET',
      headers: {
        'Authorization': `Token ${process.env.DELHIVERY_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });
    
    // 🔥 MAKHAAN FIX: Seedha JSON parse mat karo, pehle text lo.
    const rawText = await response.text(); 
    
    try {
        const data = JSON.parse(rawText);
        res.status(200).json(data);
    } catch (e) {
        console.log("Delhivery sent raw HTML instead of JSON for label.");
        res.status(200).json({ isHtml: true, htmlContent: rawText });
    }

  } catch (error) {
    console.error("Label Fetch Catch Error:", error);
    res.status(500).json({ success: false, message: "Server error fetching label" });
  }
});

// ==========================================
// 🚚 SCHEDULE PICKUP / MANIFEST (DYNAMIC)
// ==========================================
router.post('/api/orders/pickup', async (req, res) => {
  try {
    const { package_count, location_name } = req.body;
    
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1); // Agle din ka pickup

    const payload = {
      "pickup_time": "14:00:00", 
      "pickup_date": tomorrow.toISOString().split('T')[0], 
      "pickup_location": location_name || "JACK_HUB", // Ab ye Frontend se dynamic aayega
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
    console.error("Pickup Error:", error);
    res.status(500).json({ success: false, message: "Error scheduling pickup" });
  }
});

// ==========================================
// 🚫 CANCEL DELHIIVERY SHIPMENT (🔥 BULLETPROOF FIXED)
// ==========================================
router.post('/api/orders/:id/cancel-shipment', async (req, res) => {
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
    
    // 🔥 MAKHAAN FIX: Yahan response.json() crash karta tha HTML aane par. Ab text read karega.
    const rawText = await response.text();
    
    try {
        const data = JSON.parse(rawText);
        res.status(200).json(data);
    } catch (e) {
        console.error("Delhivery sent raw HTML/Text during cancellation:", rawText);
        // Backend crash hone ke bajaye frontend ko properly batayega ki error kya tha
        res.status(200).json({ success: false, message: "Delhivery Response Error", raw: rawText });
    }
  } catch (error) {
    console.error("Cancel Error:", error);
    res.status(500).json({ success: false, message: "Error cancelling shipment" });
  }
});

// ==========================================
// MAIN ORDER CREATION ROUTE
// ==========================================
router.post('/api/orders', async (req, res) => {
  try {
    const { userId, items, totalAmount, status, address, paymentMethod, userDetails, trafficSource } = req.body;
    const deviceInfo = req.headers['user-agent']?.includes('Mobile') ? 'Mobile Device' : 'Desktop / PC';
    
    const io = req.app.get("io"); 

    const newOrder = new Order({ 
      userId, items, totalAmount, status, address, paymentMethod, userDetails, deviceInfo, trafficSource 
    });
    
    const savedOrder = await newOrder.save();
    
    const orderResponse = { ...savedOrder._doc, id: savedOrder._id.toString() };

    if (io) {
        try {
             io.emit("new_order", orderResponse);
        } catch(socketErr) {
             console.error("Socket emit failed, but order saved:", socketErr);
        }
    }

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

            let productsDescription = "Jack Essentials Order";
            let totalQuantity = 1;

            if (Array.isArray(items) && items.length > 0) {
                productsDescription = items.map(i => i.title || i.name || i.productName || "Product").join(", ");
                totalQuantity = items.reduce((sum, item) => sum + (Number(item.quantity) || 1), 0);
            }

            let totalWeight = 0;
            let maxL = 0;
            let maxB = 0;
            let totalH = 0;

            if (Array.isArray(items) && items.length > 0) {
                items.forEach(item => {
                    const qty = Number(item.quantity) || 1;
                    totalWeight += (Number(item.weight) || 500) * qty;
                    maxL = Math.max(maxL, Number(item.length) || 15);
                    maxB = Math.max(maxB, Number(item.breadth) || 15);
                    totalH += (Number(item.height) || 10) * qty;
                });
            } else {
                totalWeight = 500;
                maxL = 15;
                maxB = 15;
                totalH = 10;
            }

            const finalW = String(Math.round(totalWeight));
            const finalL = String(Math.round(maxL));
            const finalB = String(Math.round(maxB));
            const finalH = String(Math.round(totalH));

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
                    return_pin: "754132", 
                    return_city: "Jagatsinghpur", 
                    return_phone: "9999999999", 
                    return_add: "Jack Essentials Return Address", 
                    return_state: "Odisha", 
                    return_country: "India",
                    
                    products_desc: productsDescription.substring(0, 120),
                    hsn_code: "",
                    
                    weight: finalW,
                    length: finalL,
                    breadth: finalB,
                    height: finalH,
                    
                    shipment_length: finalL,
                    shipment_width: finalB,
                    shipment_height: finalH,

                    cod_amount: isCod ? finalNumericAmount : 0,
                    order_date: new Date().toISOString(), 
                    total_amount: finalNumericAmount,
                    seller_inv: "", 
                    quantity: totalQuantity, 
                    waybill: ""
                }],
                pickup_location: { name: "JACK_HUB" }
            };

            const urlEncodedData = new URLSearchParams();
            urlEncodedData.append("format", "json");
            urlEncodedData.append("data", JSON.stringify(payloadData));

            const dRes = await fetch('https://track.delhivery.com/api/cmu/create.json', {
                method: 'POST', 
                headers: { 
                  'Content-Type': 'application/x-www-form-urlencoded', 
                  'Authorization': `Token ${process.env.DELHIVERY_TOKEN}` 
                },
                body: urlEncodedData.toString()
            });
            
            // 🔥 MAKHAAN FIX: Background Order creation ko bhi HTML Crash se bacha liya
            const rawDText = await dRes.text();
            try {
                const dData = JSON.parse(rawDText);
                if (dData.success || (dData.packages && dData.packages.length > 0)) {
                    const waybillNo = dData.packages[0]?.waybill || dData.waybill;
                    await Order.findByIdAndUpdate(savedOrder._id, { shiprocketOrderId: waybillNo });
                } else {
                    console.error("❌ Delhivery Manifest Error Response:", dData);
                }
            } catch (e) {
                console.error("❌ Delhivery Manifest Raw HTML Error:", rawDText);
            }

        } catch (err) { console.error("❌ Background Delhivery Error:", err); }
      }, 100); 
    }

    res.status(201).json(orderResponse);
  } catch (error) { 
    console.error("Order Creation Error (Crash Prevented):", error);
    res.status(500).json({ message: "Order failed", error: error.message }); 
  }
});

router.put('/api/orders/:id', async (req, res) => {
  try {
    const { status, adminNotes, refundStatus } = req.body;
    const io = req.app.get("io"); 

    const updatedOrder = await Order.findByIdAndUpdate(
        req.params.id, 
        { status, adminNotes, refundStatus }, 
        { returnDocument: 'after' }
    );

    const orderResponse = { ...updatedOrder._doc, id: updatedOrder._id.toString() };

    if(io) {
        try { io.emit("order_status_updated", orderResponse); } catch(e){}
    }

    res.json(orderResponse);
  } catch (error) { 
    console.error("Order Update Error:", error);
    res.status(500).json({ message: "Failed to update order status" }); 
  }
});

router.get('/api/orders/user/:userId', async (req, res) => {
  try {
    const orders = await Order.find({ userId: req.params.userId }).sort({ createdAt: -1 }).lean();
    res.json(orders.map(o => ({ ...o, id: o._id.toString() })));
  } catch (error) { res.status(500).json({ message: "Failed to fetch orders" }); }
});

router.get('/api/orders', async (req, res) => {
  try {
    const orders = await Order.find().sort({ createdAt: -1 }).lean();
    res.json(orders.map(o => ({ ...o, id: o._id.toString() })));
  } catch (error) { res.status(500).json({ message: "Failed to fetch orders" }); }
});

module.exports = router;