// lib/crm/campaignEngine.js
import { getSegmentUsers } from './segments';
import sendEmailChannel from '@/lib/mailer'; // Tera email sender
import CampaignLog from '@/models/CampaignLog';

// 🔥 Yeh raha tera root folder wala path (server.js ke paas wali file)
import { 
  getWelcomeTemplate, 
  getPriceDropTemplate, 
  getBulkEmailTemplate 
} from '../emailTemplates'; 

export async function executeCampaign(campaignConfig) {
  const { campaignId, segmentName, campaignType, customMessage, productData } = campaignConfig;

  if (!campaignId || !segmentName) {
    console.error("[Campaign Engine] Missing campaignId or segmentName in config");
    return { success: false, message: "Missing required campaign configuration parameters." };
  }

  // 1. Get Target Users based on segment with safety fallback
  const targetUsers = await getSegmentUsers(segmentName);
  const userList = Array.isArray(targetUsers) ? targetUsers : [];
  console.log(`[Campaign ${campaignId}] Target users: ${userList.length} for segment: ${segmentName}`);

  let successCount = 0;
  let failureCount = 0;

  for (const user of userList) {
    if (!user || !user.email) continue;

    try {
      let emailHtml = '';
      let subject = campaignConfig.subject || 'Special Update from Jack Essentials';

      // 2. Map segment/campaign to your existing templates
      switch (campaignType) {
        case 'WELCOME':
          emailHtml = getWelcomeTemplate(user.name || 'Shopper');
          subject = 'Welcome to the Elite Club, ' + (user.name || 'Shopper') + '! 🎉';
          break;

        case 'PRICE_DROP':
          emailHtml = getPriceDropTemplate(
            user.name || 'Shopper', 
            productData?.title || 'Selected Product', 
            productData?.image || '', 
            productData?.oldPrice || '0', 
            productData?.newPrice || '0', 
            productData?.link || '#'
          );
          subject = `📉 Price Drop Alert on ${productData?.title || 'your wishlist item'}!`;
          break;

        case 'BULK_MARKETING':
        default:
          const formattedMessage = `<p>Hi ${user.name || 'Shopper'},</p><p>${customMessage || ''}</p>`;
          emailHtml = getBulkEmailTemplate(subject, formattedMessage);
          break;
      }

      // 3. Send Email
      await sendEmailChannel({
        to: user.email,
        subject,
        html: emailHtml
      });

      // 4. Log initial delivery in CampaignLog model
      await CampaignLog.create({
        campaignId,
        userId: user._id || user.id,
        eventType: 'DELIVERY',
        timestamp: new Date()
      });

      successCount++;
    } catch (userError) {
      failureCount++;
      console.error(`[Campaign ${campaignId}] Failed to process email for ${user.email}:`, userError);
    }
  }

  console.log(`[Campaign ${campaignId}] Successfully executed. Sent: ${successCount}, Failed: ${failureCount}`);
  return { success: true, successCount, failureCount };
}

// 5. Tracking Webhook Handler (Open, Click, Purchase & ROI)
export async function trackCampaignEvent(reqBody) {
  const { campaignId, userId, eventType, orderValue = 0 } = reqBody;
  
  if (!campaignId || !eventType) {
    console.error("[Campaign Tracking] Missing campaignId or eventType");
    return { success: false, message: "Missing required tracking parameters." };
  }

  await CampaignLog.create({
    campaignId,
    userId: userId || null,
    eventType,
    orderValue: Number(orderValue) || 0,
    timestamp: new Date()
  });

  if (eventType === 'PURCHASE') {
    await calculateCampaignROI(campaignId);
  }

  return { success: true };
}

async function calculateCampaignROI(campaignId) {
  try {
    const analytics = await CampaignLog.aggregate([
      { $match: { campaignId } },
      { 
        $group: { 
          _id: "$campaignId", 
          totalRevenue: { $sum: "$orderValue" },
          totalPurchases: { $sum: { $cond: [{ $eq: ["$eventType", "PURCHASE"] }, 1, 0] } }
        } 
      }
    ]);

    console.log("Campaign ROI Updated for ID:", campaignId, analytics);
    return analytics;
  } catch (error) {
    console.error("Failed to calculate Campaign ROI:", error);
  }
}