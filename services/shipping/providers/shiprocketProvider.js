// services/shipping/providers/shiprocketProvider.js
const { Setting } = require('../../../models');

class ShiprocketProvider {
  constructor() {
    this.name = 'shiprocket';
    this.baseUrl = 'https://apiv2.shiprocket.in/v1/external';
  }

  async getToken() {
    if (!process.env.SHIPROCKET_EMAIL || !process.env.SHIPROCKET_PASSWORD) {
      throw new Error("Shiprocket credentials are missing in environment configuration.");
    }

    const res = await fetch(`${this.baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: process.env.SHIPROCKET_EMAIL,
        password: process.env.SHIPROCKET_PASSWORD
      })
    });
    const data = await res.json();
    if (!data.token) throw new Error("Failed to authenticate with Shiprocket");
    return data.token;
  }

  async generateAWB(order) {
    const token = await this.getToken();
    
    // 1. Format order payload for Shiprocket Order Creation API
    const orderPayload = {
      order_id: String(order.id || order._id),
      order_date: new Date().toISOString().split('T')[0],
      pickup_location: order.pickupLocation || "Primary",
      billing_customer_name: order.address?.name || order.userDetails?.name || "Customer",
      billing_last_name: "",
      billing_address: order.address?.flat || order.address?.street || "Address line 1",
      billing_address_2: "",
      billing_city: order.address?.city || "City",
      billing_pincode: order.address?.pincode || "110001",
      billing_state: order.address?.state || "State",
      billing_country: "India",
      billing_email: order.userDetails?.email || "customer@thejackessentials.com",
      billing_phone: order.address?.primaryPhone || order.userDetails?.phone || "9999999999",
      shipping_is_billing: true,
      order_items: (order.items || []).map(item => ({
        name: item.title || "Product",
        sku: item.sku || "SKU-DEFAULT",
        units: item.quantity || 1,
        selling_price: item.price || 0,
        discount: 0,
        tax: 0,
        hsn: 0
      })),
      payment_method: (order.paymentMethod || 'COD').toUpperCase() === 'COD' ? 'COD' : 'Prepaid',
      sub_total: order.totalAmount || (order.totalPaise ? order.totalPaise / 100 : 0),
      length: 10,
      breadth: 10,
      height: 10,
      weight: 0.5
    };

    // 2. Create Order on Shiprocket
    const createRes = await fetch(`${this.baseUrl}/orders/create/adhoc`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(orderPayload)
    });
    
    const createData = await createRes.json();
    if (!createData.order_id && !createData.shipment_id) {
      throw new Error(`Shiprocket Order Creation Failed: ${createData.message || JSON.stringify(createData)}`);
    }

    const shipmentId = createData.shipment_id;

    // 3. Generate AWB for the shipment
    const awbRes = await fetch(`${this.baseUrl}/courier/assign/awb`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        shipment_id: shipmentId
      })
    });

    const awbData = await awbRes.json();
    if (!awbData.response || awbData.response.data.status !== 1) {
      throw new Error(`Shiprocket AWB Generation Failed: ${awbData.message || JSON.stringify(awbData)}`);
    }

    const awbDetails = awbData.response.data;

    return {
      success: true,
      provider: 'shiprocket',
      waybill: awbDetails.awb_code || awbDetails.ladebillabel,
      shiprocketOrderId: createData.order_id,
      shipmentId: shipmentId,
      courierName: awbDetails.courier_name,
      trackingStatus: 'AWB Assigned'
    };
  }

  async getLabel(awb) {
    const token = await this.getToken();
    // Shiprocket label generation endpoint using shipment_id or awb
    const res = await fetch(`${this.baseUrl}/courier/generate/label`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        shipment_id: [awb] // can be shipment ids comma separated or array
      })
    });
    const data = await res.json();
    return data;
  }

  async schedulePickup(packageCount, locationName) {
    const token = await this.getToken();
    const res = await fetch(`${this.baseUrl}/courier/generate/pickup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        pickup_location: locationName || "Primary"
      })
    });
    const data = await res.json();
    return data;
  }

  async cancelShipment(waybill) {
    const token = await this.getToken();
    const res = await fetch(`${this.baseUrl}/orders/cancel/shipment/awb`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        awbs: [waybill]
      })
    });
    const data = await res.json();
    return data;
  }
}

module.exports = ShiprocketProvider;