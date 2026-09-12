const { getReplacementEligibility } = require('./replacementTools');

// Return eligibility shares the exact same logic as replacement eligibility (time window from delivery)
const getReturnEligibility = async (args, customerId) => {
  // Delegate to existing logic to prevent duplication
  return await getReplacementEligibility(args, customerId);
};

module.exports = { getReturnEligibility };