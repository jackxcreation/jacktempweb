const { getReplacementEligibility } = require('./replacementTools');

/**
 * Checks whether an order is eligible for return.
 * Enhanced with argument safety, payload preservation, and strict string manipulation.
 */
const getReturnEligibility = async (args = {}, customerId) => {
  if (!customerId || !args.orderId) {
    return { error: 'Auth and Order ID required.' };
  }

  try {
    // Delegate to the heavily optimized replacement logic
    const result = await getReplacementEligibility(args, customerId);
    
    // If result is successful, customize phrasing specifically for returns
    if (result && result.success && result.data) {
      const isEligible = result.data.isEligible;
      const originalReason = result.data.reason || '';
      
      // SAFETY FIX: Ensure we only run regex on a valid string to prevent crashes
      const reasonText = typeof originalReason === 'string' 
        ? originalReason.replace(/replacement/gi, 'return') 
        : 'Return eligibility processed.';

      return {
        success: true,
        data: {
          ...result.data, // Preserve any extra fields passed by the delegate
          orderId: result.data.orderId,
          isEligible: isEligible,
          reason: isEligible ? 'Within return window.' : reasonText
        }
      };
    }

    // Return the original error/result if delegation failed
    return result;
  } catch (error) {
    console.error('Get Return Eligibility Tool Error:', error.message);
    return { error: 'Failed to verify return eligibility due to a server error.' };
  }
};

module.exports = { getReturnEligibility };