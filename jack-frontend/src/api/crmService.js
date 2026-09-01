// jack-frontend/src/api/crmService.js
import axiosInstance from './axiosInstance';

export const launchCampaign = async (campaignConfig) => {
  try {
    const response = await axiosInstance.post('/api/crm/campaign', {
      action: 'LAUNCH',
      campaignConfig
    });
    return response.data;
  } catch (error) {
    throw error.response?.data || error.message;
  }
};