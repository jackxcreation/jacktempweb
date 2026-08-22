const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit'); // 🔥 ADDED: For API protection

// ==========================================
// 🛡️ SECURITY: Pincode Check Rate Limiter
// ==========================================
// Ek IP se 15 minute mein max 30 requests allow hongi
const pincodeLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, 
    max: 30, 
    message: { success: false, message: "Too many requests. Please try again later." }
});

// ==========================================
// 📍 Pincode Check & ETA Calculation Route
// ==========================================
router.get('/delivery-check', pincodeLimiter, async (req, res) => {
    try {
        const { pincode } = req.query;
        
        // 🔥 SECURITY FIX: Strict Regex Validation (Must be exactly 6 numeric digits)
        if (!pincode || !/^\d{6}$/.test(pincode)) {
            return res.status(400).json({ success: false, message: 'Invalid Pincode. Please enter a 6-digit number.' });
        }

        // 1. Backend se Delhivery ko call ja raha hai
        const response = await fetch(`https://track.delhivery.com/c/api/pin-codes/json/?filter_codes=${pincode}`, {
            method: 'GET',
            headers: {
                'Authorization': `Token ${process.env.DELHIVERY_TOKEN}`,
                'Content-Type': 'application/json'
            }
        });
        
        // 🔥 CRASH FIX: Safe JSON Parsing (Prevents crash if Delhivery sends HTML error page)
        const rawText = await response.text();
        let data;
        try {
            data = JSON.parse(rawText);
        } catch (parseError) {
            console.error("Delhivery API returned non-JSON response:", rawText);
            return res.status(502).json({ success: false, message: "Courier service is temporarily down. Please try again later." });
        }

        // 2. Agar Pincode Delhivery ke paas available hai
        if (data && data.delivery_codes && data.delivery_codes.length > 0) {
            const zoneInfo = data.delivery_codes[0].postal_code;
            const isCOD = zoneInfo.cod === "Y";
            
            // 3. Smart ETA Calculation
            let transitDays = 5; // Default poore India ke liye
            
            // 75 or 76 starts means Odisha (Jagatsinghpur/Bhubaneswar region)
            if (pincode.startsWith('75') || pincode.startsWith('76')) {
                transitDays = 2; // Odisha state deliveries (Fastest)
            } else if (['11', '40', '56', '60', '70', '80'].some(prefix => pincode.startsWith(prefix))) {
                transitDays = 3; // Tier 1 / Metro Cities
            }

            // Date Calculate karo
            const deliveryDate = new Date();
            deliveryDate.setDate(deliveryDate.getDate() + transitDays);
            
            // Format karo jaise: "Wed, Aug 19"
            const formattedDate = deliveryDate.toLocaleDateString('en-IN', {
                weekday: 'short', month: 'short', day: 'numeric'
            });

            return res.json({
                success: true,
                isServiceable: true,
                codAvailable: isCOD,
                estimatedDate: formattedDate,
                message: `Delivery by ${formattedDate}`
            });
        } else {
            // Pincode galat hai ya Delhivery wahan nahi jata
            return res.json({ 
                success: true, 
                isServiceable: false, 
                message: 'Currently not serviceable in this area.' 
            });
        }
    } catch (error) {
        console.error("Delivery Check API Error:", error);
        res.status(500).json({ success: false, message: "Server error while checking pincode" });
    }
});

module.exports = router;