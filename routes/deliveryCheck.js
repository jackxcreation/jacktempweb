const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit'); // 🔥 ADDED: For API protection
const Redis = require('ioredis'); // 🔥 ADDED: Redis Cache for Pincode optimization
const { Order } = require('../models');

// 🔥 Initialize Redis Client for Caching (Strictly using REDIS_URL from .env)
const redisClient = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

redisClient.on('error', (err) => console.error('Redis Cache Error:', err));

// ==========================================
// 🛡️ SECURITY: Pincode Check Rate Limiter
// ==========================================
const pincodeLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, 
    max: 30, 
    message: { success: false, message: "Too many requests. Please try again later." }
});

// ==========================================
// 🔥 COD INTELLIGENCE EVALUATION FUNCTION
// ==========================================
const evaluateCodEligibility = async (pincode, cartTotalPaise, userId) => {
  try {
    let codAvailable = true;
    let codFeePaise = 0; 
    let riskLevel = 'LOW';
    let reason = "Serviceable";

    // 1. Check Pincode Blacklist or High Risk Zones (e.g., remote or high RTO zones)
    const restrictedPrefixes = ['82', '83', '84']; 
    if (restrictedPrefixes.some(prefix => pincode.startsWith(prefix))) {
      codAvailable = false;
      reason = "COD unavailable for this location due to high transit risk.";
      return { codAvailable, codFeePaise, riskLevel: 'HIGH', reason };
    }

    // 2. Check Order Value Threshold (COD disabled above ₹5,000 for safety)
    if (cartTotalPaise > 500000) { 
      codAvailable = false;
      reason = "Orders above ₹5,000 require prepaid payment.";
      return { codAvailable, codFeePaise, riskLevel: 'MEDIUM', reason };
    }

    // 3. Evaluate User History & Risk (Check past cancelled/returned orders)
    if (userId) {
      const pastOrders = await Order.find({ user: userId }).lean();
      const cancelledCount = pastOrders.filter(o => o.status === 'Cancelled' || o.status === 'Returned').length;
      
      if (cancelledCount >= 2) {
        riskLevel = 'HIGH';
        codFeePaise = 9900; // Charge ₹99 extra COD risk fee
        reason = "High cancellation history detected. COD fee applicable.";
      } else if (cartTotalPaise > 200000) {
        codFeePaise = 4900; // Standard ₹49 COD handling fee for orders > ₹2,000
      }
    }

    return {
      codAvailable,
      codFeePaise,
      riskLevel,
      reason
    };
  } catch (error) {
    console.error("COD Intelligence Evaluation Error:", error);
    return { codAvailable: true, codFeePaise: 0, riskLevel: 'LOW', reason: "Default fallback" };
  }
};

// ==========================================
// 📍 Pincode Check & ETA Calculation Route (With Redis Cache & COD Intelligence)
// ==========================================
router.get('/delivery-check', pincodeLimiter, async (req, res) => {
    try {
        const { pincode, cartTotal = 0, userId } = req.query;
        
        // 🔥 SECURITY FIX: Strict Regex Validation (Must be exactly 6 numeric digits)
        if (!pincode || !/^\d{6}$/.test(pincode)) {
            return res.status(400).json({ success: false, message: 'Invalid Pincode. Please enter a 6-digit number.' });
        }

        const cacheKey = `delivery_pincode_${pincode}_${cartTotal}_${userId || 'guest'}`;

        // 1. Check Redis Cache First (Cache Hit) to prevent unnecessary external API calls
        const cachedData = await redisClient.get(cacheKey);
        if (cachedData) {
            return res.status(200).json(JSON.parse(cachedData));
        }

        // 2. Backend se Delhivery ko call ja raha hai
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

        let resultResponse;

        // 3. Agar Pincode Delhivery ke paas available hai
        if (data && data.delivery_codes && data.delivery_codes.length > 0) {
            const zoneInfo = data.delivery_codes[0].postal_code;
            const courierCodAvailable = zoneInfo.cod === "Y";
            
            // Evaluate COD Intelligence parameters
            const codIntelligence = await evaluateCodEligibility(pincode, parseInt(cartTotal), userId);
            const finalCodAvailable = courierCodAvailable && codIntelligence.codAvailable;

            // 4. Smart ETA Calculation
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

            resultResponse = {
                success: true,
                isServiceable: true,
                codAvailable: finalCodAvailable,
                codFeePaise: codIntelligence.codFeePaise,
                riskLevel: codIntelligence.riskLevel,
                estimatedDate: formattedDate,
                message: finalCodAvailable ? `Delivery by ${formattedDate}` : codIntelligence.reason
            };
        } else {
            // Pincode galat hai ya Delhivery wahan nahi jata
            resultResponse = { 
                success: true, 
                isServiceable: false, 
                codAvailable: false,
                codFeePaise: 0,
                riskLevel: 'HIGH',
                message: 'Currently not serviceable in this area.' 
            };
        }

        // 5. Store response in Redis Cache with 1 Day TTL (86400 seconds)
        await redisClient.setex(cacheKey, 86400, JSON.stringify(resultResponse));

        return res.json(resultResponse);
    } catch (error) {
        console.error("Delivery Check API Error:", error);
        res.status(500).json({ success: false, message: "Server error while checking pincode" });
    }
});

// ==========================================
// 📮 POSTAL / PINCODE INFO API (Decoupled from Frontend Third-Party Calls)
// ==========================================
router.get('/pincode-info/:pincode', pincodeLimiter, async (req, res) => {
    try {
        const { pincode } = req.params;

        if (!pincode || !/^\d{6}$/.test(pincode)) {
            return res.status(400).json({ success: false, message: 'Invalid Pincode. Must be 6 digits.' });
        }

        const cacheKey = `postal_info_${pincode}`;

        // 1. Check Redis Cache First
        const cachedData = await redisClient.get(cacheKey);
        if (cachedData) {
            return res.status(200).json({ success: true, source: 'cache', data: JSON.parse(cachedData) });
        }

        // 2. Fetch from External Postal API (Decoupled securely via Backend)
        const response = await fetch(`https://api.postalpincode.in/pincode/${pincode}`);
        const data = await response.json();

        if (!response.ok || !data || data[0].Status !== 'Success') {
            return res.status(404).json({ success: false, message: 'Pincode details not found.' });
        }

        const postalDetails = data[0].PostOffice[0];
        const result = {
            district: postalDetails.District,
            state: postalDetails.State,
            city: postalDetails.Block || postalDetails.Division,
            country: postalDetails.Country
        };

        // 3. Cache for 30 Days (Postal data rarely changes)
        await redisClient.setex(cacheKey, 2592000, JSON.stringify(result));

        return res.status(200).json({ success: true, source: 'api', data: result });
    } catch (error) {
        console.error("Postal API Error:", error);
        res.status(500).json({ success: false, message: "Server error fetching pincode details." });
    }
});

module.exports = router;