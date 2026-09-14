// jack-frontend/src/api/crmService.js
import axiosInstance from './axiosInstance';

/**
 * Naya Email Campaign launch karne ke liye function
 * @param {Object} campaignConfig - { campaignId, segmentName, campaignType, customMessage, productData }
 */
export const launchCampaign = async (campaignConfig) => {
  try {
    // 🔥 FIX: Removed leading '/api' to prevent double '/api/api/' prefix duplication with axiosInstance baseURL
    const response = await axiosInstance.post('/crm/campaign', {
      action: 'LAUNCH',
      campaignConfig
    });
    return response.data;
  } catch (error) {
    throw error.response?.data || error.message;
  }
};

/**
 * Email Open, Click ya Purchase (ROI) track karne ke liye function
 * @param {Object} eventData - { campaignId, userId, eventType, orderValue }
 */
export const trackCampaignEvent = async (eventData) => {
  try {
    const response = await axiosInstance.post('/crm/campaign', {
      action: 'TRACK',
      eventData
    });
    return response.data;
  } catch (error) {
    throw error.response?.data || error.message;
  }
};

/**
 * Fetch all active or past CRM campaigns list
 */
export const fetchCampaignsList = async () => {
  try {
    const response = await axiosInstance.get('/crm/campaigns');
    return response.data;
  } catch (error) {
    throw error.response?.data || error.message;
  }
};