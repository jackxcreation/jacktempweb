const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const Redis = require('ioredis'); 
const { Order } = require('../models');

if (process.env.NODE_ENV === 'production' && !process.env.REDIS_URL) {
    throw new Error('FATAL: REDIS_URL environment variable is required in production.');
}

// 🔥 Robust Upstash / Cloud Redis connection config using REDIS_URL and TLS
const redisClient = process.env.REDIS_URL 
  ? new Redis(process.env.REDIS_URL, {
      tls: {
        rejectUnauthorized: false
      },
      maxRetriesPerRequest: null
    })
  : new Redis('redis://localhost:6379', { maxRetriesPerRequest: null });

redisClient.on('error', (err) => console.error('Redis Cache Error:', err));

const pincodeLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, 
    max: 30, 
    message: { success: false, message: "Too many requests. Please try again later." }
});

const evaluateCodEligibility = async (pincode, cartTotalPaise, userId) => {
  try {
    let codAvailable = true;
    let codFeePaise = 0; 
    let riskLevel = 'LOW';
    let reason = "Serviceable";

    const restrictedPrefixes = ['82', '83', '84']; 
    if (restrictedPrefixes.some(prefix => pincode.startsWith(prefix))) {
      codAvailable = false;
      reason = "COD unavailable for this location due to high transit risk.";
      return { codAvailable, codFeePaise, riskLevel: 'HIGH', reason };
    }

    if (cartTotalPaise > 500000) { 
      codAvailable = false;
      reason = "Orders above ₹5,000 require prepaid payment.";
      return { codAvailable, codFeePaise, riskLevel: 'MEDIUM', reason };
    }

    // 🔥 PHASE 2 FIX: Ultra-fast counting instead of fetching whole DB array
    if (userId) {
      const cancelledCount = await Order.countDocuments({
        userId,
        status: { $in: ['Cancelled', 'Returned'] }
      });
      
      if (cancelledCount >= 2) {
        riskLevel = 'HIGH';
        codFeePaise = 9900; 
        reason = "High cancellation history detected. COD fee applicable.";
      } else if (cartTotalPaise > 200000) {
        codFeePaise = 4900; 
      }
    }

    return { codAvailable, codFeePaise, riskLevel, reason };
  } catch (error) {
    console.error("COD Intelligence Evaluation Error:", error);
    return { codAvailable: true, codFeePaise: 0, riskLevel: 'LOW', reason: "Default fallback" };
  }
};

router.get('/delivery-check', pincodeLimiter, async (req, res) => {
    try {
        const { pincode, cartTotal = 0, userId } = req.query;
        
        if (!pincode || !/^\d{6}$/.test(pincode)) {
            return res.status(400).json({ success: false, message: 'Invalid Pincode. Please enter a 6-digit number.' });
        }

        // 🔥 PHASE 2 FIX: Removed userId from Cache Key. Now 10,000 users hitting the same pincode/amount will share 1 cache!
        const cacheKey = `delivery_pincode_${pincode}_${cartTotal}`;

        const cachedData = await redisClient.get(cacheKey);
        if (cachedData) {
            const parsedData = JSON.parse(cachedData);
            
            // Re-evaluate user risk dynamically outside cache
            if (userId) {
               const codIntel = await evaluateCodEligibility(pincode, parseInt(cartTotal), userId);
               parsedData.codAvailable = parsedData.codAvailable && codIntel.codAvailable;
               parsedData.codFeePaise = codIntel.codFeePaise;
               parsedData.riskLevel = codIntel.riskLevel;
            }
            return res.status(200).json(parsedData);
        }

        const response = await fetch(`https://track.delhivery.com/c/api/pin-codes/json/?filter_codes=${pincode}`, {
            method: 'GET',
            headers: {
                'Authorization': `Token ${process.env.DELHIVERY_TOKEN}`,
                'Content-Type': 'application/json'
            }
        });
        
        const rawText = await response.text();
        let data;
        try {
            data = JSON.parse(rawText);
        } catch (parseError) {
            return res.status(502).json({ success: false, message: "Courier service is temporarily down. Please try again later." });
        }

        let resultResponse;

        if (data && data.delivery_codes && data.delivery_codes.length > 0) {
            const zoneInfo = data.delivery_codes[0].postal_code;
            const courierCodAvailable = zoneInfo.cod === "Y";
            
            // Pure delivery intel for cache
            const baseCodIntel = await evaluateCodEligibility(pincode, parseInt(cartTotal), null);
            
            let transitDays = 5; 
            if (pincode.startsWith('75') || pincode.startsWith('76')) {
                transitDays = 2; 
            } else if (['11', '40', '56', '60', '70', '80'].some(prefix => pincode.startsWith(prefix))) {
                transitDays = 3; 
            }

            const deliveryDate = new Date();
            deliveryDate.setDate(deliveryDate.getDate() + transitDays);
            const formattedDate = deliveryDate.toLocaleDateString('en-IN', { weekday: 'short', month: 'short', day: 'numeric' });

            resultResponse = {
                success: true,
                isServiceable: true,
                codAvailable: courierCodAvailable && baseCodIntel.codAvailable,
                codFeePaise: baseCodIntel.codFeePaise,
                riskLevel: baseCodIntel.riskLevel,
                estimatedDate: formattedDate,
                message: (courierCodAvailable && baseCodIntel.codAvailable) ? `Delivery by ${formattedDate}` : baseCodIntel.reason
            };
        } else {
            resultResponse = { 
                success: true, isServiceable: false, codAvailable: false,
                codFeePaise: 0, riskLevel: 'HIGH', message: 'Currently not serviceable in this area.' 
            };
        }

        // Save pure geo-cache
        await redisClient.setex(cacheKey, 86400, JSON.stringify(resultResponse));

        // Inject specific user risks before sending response
        if (userId) {
            const userCodIntel = await evaluateCodEligibility(pincode, parseInt(cartTotal), userId);
            resultResponse.codAvailable = resultResponse.codAvailable && userCodIntel.codAvailable;
            resultResponse.codFeePaise = userCodIntel.codFeePaise;
            resultResponse.riskLevel = userCodIntel.riskLevel;
        }

        return res.json(resultResponse);
    } catch (error) {
        console.error("Delivery Check API Error:", error);
        res.status(500).json({ success: false, message: "Server error while checking pincode" });
    }
});

router.get('/pincode-info/:pincode', pincodeLimiter, async (req, res) => {
    try {
        const { pincode } = req.params;

        if (!pincode || !/^\d{6}$/.test(pincode)) {
            return res.status(400).json({ success: false, message: 'Invalid Pincode. Must be 6 digits.' });
        }

        const cacheKey = `postal_info_${pincode}`;

        const cachedData = await redisClient.get(cacheKey);
        if (cachedData) {
            return res.status(200).json({ success: true, source: 'cache', data: JSON.parse(cachedData) });
        }

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

        await redisClient.setex(cacheKey, 2592000, JSON.stringify(result));

        return res.status(200).json({ success: true, source: 'api', data: result });
    } catch (error) {
        console.error("Postal API Error:", error);
        res.status(500).json({ success: false, message: "Server error fetching pincode details." });
    }
});

module.exports = router;