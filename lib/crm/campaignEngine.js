// lib/crm/campaignEngine.js
import { getSegmentUsers } from './segments';
import sendEmailChannel from '@/lib/mailer'; // Tera email sender
import CampaignLog from '@/models/CampaignLog';

// 🔥 Yeh raha tera root folder wala path (server.js ke paas wali file)
import { 
  getWelcomeTemplate, 
  getPriceDropTemplate, 
  getBulkEmailTemplate 
} from '../emailTemplates'; // Agar lib folder ke andar hai toh '../emailTemplates' ya agar root se import kar raha hai toh path adjust kar liyo

export async function executeCampaign(campaignConfig) {
  const { campaignId, segmentName, campaignType, customMessage, productData } = campaignConfig;

  // 1. Get Target Users based on segment
  const targetUsers = await getSegmentUsers(segmentName);
  console.log(`[Campaign ${campaignId}] Target users: ${targetUsers.length} for segment: ${segmentName}`);

  for (const user of targetUsers) {
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
          user.name, 
          productData?.title, 
          productData?.image, 
          productData?.oldPrice, 
          productData?.newPrice, 
          productData?.link
        );
        subject = `📉 Price Drop Alert on ${productData?.title || 'your wishlist item'}!`;
        break;

      case 'BULK_MARKETING':
      default:
        const formattedMessage = `<p>Hi ${user.name || 'Shopper'},</p><p>${customMessage}</p>`;
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
      userId: user._id,
      eventType: 'DELIVERY',
      timestamp: new Date()
    });
  }

  console.log(`[Campaign ${campaignId}] Successfully executed for segment: ${segmentName}`);
}

// 5. Tracking Webhook Handler (Open, Click, Purchase & ROI)
export async function trackCampaignEvent(reqBody) {
  const { campaignId, userId, eventType, orderValue = 0 } = reqBody;
  
  await CampaignLog.create({
    campaignId,
    userId,
    eventType,
    orderValue,
    timestamp: new Date()
  });

  if (eventType === 'PURCHASE') {
    await calculateCampaignROI(campaignId);
  }
}

async function calculateCampaignROI(campaignId) {
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
}