// lib/crm/segments.js
import db from '@/lib/db'; // Tera database connection

export async function getSegmentUsers(segmentType) {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.setDate(now.getDate() - 30));
  const ninetyDaysAgo = new Date(now.setDate(now.getDate() - 90));

  switch (segmentType) {
    case 'new_customers':
      // First-time buyers in last 7 days
      return await db.collection('users').find({
        orderCount: 1,
        createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
      }).toArray();

    case 'repeat_customers':
      // Customers with > 1 order
      return await db.collection('users').find({
        orderCount: { $gt: 1 }
      }).toArray();

    case 'high_value':
      // Lifetime value (LTV) > ₹10,000 or high spenders
      return await db.collection('users').find({
        totalSpent: { $gte: 10000 }
      }).toArray();

    case 'dormant':
      // No purchase or login in last 90 days
      return await db.collection('users').find({
        lastActiveDate: { $lte: ninetyDaysAgo }
      }).toArray();

    case 'cart_abandoners':
      // Added to cart in last 3 days but no purchase completed
      return await db.collection('users').find({
        hasActiveCart: true,
        cartUpdatedAt: { $gte: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000) },
        lastOrderDate: { $exists: false } // or cart time > last order time
      }).toArray();

    case 'product_viewers':
      // Viewed products multiple times but never added to cart or bought
      return await db.collection('users').find({
        productViewsCount: { $gt: 2 },
        hasActiveCart: false,
        totalSpent: 0
      }).toArray();

    case 'refund_heavy':
      // Users with high refund rates or multiple refunded orders
      return await db.collection('users').find({
        refundCount: { $gte: 2 }
      }).toArray();

    default:
      return [];
  }
}