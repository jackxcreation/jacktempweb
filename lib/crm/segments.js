// lib/crm/segments.js
import db from '@/lib/db'; // Tera database connection

export async function getSegmentUsers(segmentType) {
  try {
    if (!db) {
      console.error("[Segments] Database connection not found.");
      return [];
    }

    // 🔥 Fix: Avoid date mutation bugs by calculating distinct fresh date instances safely
    const nowTime = Date.now();
    const sevenDaysAgo = new Date(nowTime - 7 * 24 * 60 * 60 * 1000);
    const threeDaysAgo = new Date(nowTime - 3 * 24 * 60 * 60 * 1000);
    const ninetyDaysAgo = new Date(nowTime - 90 * 24 * 60 * 60 * 1000);

    let query = {};

    switch (segmentType) {
      case 'new_customers':
        // First-time buyers in last 7 days
        query = {
          orderCount: 1,
          createdAt: { $gte: sevenDaysAgo }
        };
        break;

      case 'repeat_customers':
        // Customers with > 1 order
        query = {
          orderCount: { $gt: 1 }
        };
        break;

      case 'high_value':
        // Lifetime value (LTV) > ₹10,000 or high spenders
        query = {
          totalSpent: { $gte: 10000 }
        };
        break;

      case 'dormant':
        // No purchase or login in last 90 days
        query = {
          lastActiveDate: { $lte: ninetyDaysAgo }
        };
        break;

      case 'cart_abandoners':
        // Added to cart in last 3 days but no purchase completed
        query = {
          hasActiveCart: true,
          cartUpdatedAt: { $gte: threeDaysAgo },
          lastOrderDate: { $exists: false } // or cart time > last order time
        };
        break;

      case 'product_viewers':
        // Viewed products multiple times but never added to cart or bought
        query = {
          productViewsCount: { $gt: 2 },
          hasActiveCart: false,
          totalSpent: 0
        };
        break;

      case 'refund_heavy':
        // Users with high refund rates or multiple refunded orders
        query = {
          refundCount: { $gte: 2 }
        };
        break;

      default:
        return [];
    }

    const users = await db.collection('users').find(query).toArray();
    return Array.isArray(users) ? users : [];
  } catch (error) {
    console.error(`[Segments Error] Failed to fetch users for segment '${segmentType}':`, error);
    return [];
  }
}