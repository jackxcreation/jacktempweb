// services/shipping/providers/dtdcProvider.js
class DTDCProvider {
  constructor() {
    this.name = 'dtdc';
    this.baseUrl = process.env.DTDC_API_URL || 'https://track.dtdc.com/dtdc-api'; // Standard DTDC API base URL
  }

  async getAuthHeaders() {
    if (!process.env.DTDC_API_KEY) {
      throw new Error("DTDC API Key is missing in environment configuration.");
    }
    return {
      'Content-Type': 'application/json',
      'X-Access-Token': process.env.DTDC_API_KEY,
      'Authorization': `Bearer ${process.env.DTDC_API_KEY}`
    };
  }

  async generateAWB(order) {
    const headers = await this.getAuthHeaders();

    const payload = {
      consignee_name: order.address?.name || order.userDetails?.name || "Customer",
      consignee_address: order.address?.flat || order.address?.street || "Address line 1",
      consignee_city: order.address?.city || "City",
      consignee_state: order.address?.state || "State",
      consignee_pincode: order.address?.pincode || "110001",
      consignee_phone: order.address?.primaryPhone || order.userDetails?.phone || "9999999999",
      order_number: String(order.id || order._id),
      payment_type: (order.paymentMethod || 'COD').toUpperCase() === 'COD' ? 'COD' : 'Prepaid',
      collected_amount: (order.paymentMethod || 'COD').toUpperCase() === 'COD' ? (order.totalAmount || order.totalPaise / 100) : 0,
      pieces: (order.items || []).reduce((sum, item) => sum + (item.quantity || 1), 0),
      weight: 0.5
    };

    const res = await fetch(`${this.baseUrl}/shipment/create`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (!data.success && !data.waybill && !data.awb_number) {
      throw new Error(`DTDC AWB Generation Failed: ${data.message || JSON.stringify(data)}`);
    }

    return {
      success: true,
      provider: 'dtdc',
      waybill: data.waybill || data.awb_number || data.reference_number,
      trackingStatus: 'Manifested'
    };
  }

  async createShipment(order) {
    return await this.generateAWB(order);
  }

  async getRate(payload) {
    const headers = await this.getAuthHeaders();
    const res = await fetch(`${this.baseUrl}/rate/calculate`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    return {
      rate: data.rate || data.amount || 100,
      estimatedDays: data.estimated_days || 3,
      provider: 'dtdc'
    };
  }

  async trackShipment(awb) {
    const headers = await this.getAuthHeaders();
    const res = await fetch(`${this.baseUrl}/shipment/track?awb=${awb}`, {
      method: 'GET',
      headers
    });
    const data = await res.json();
    return {
      awb,
      status: data.status || data.current_status || 'In Transit',
      history: data.track_lines || []
    };
  }

  async cancelShipment(waybill) {
    const headers = await this.getAuthHeaders();
    const res = await fetch(`${this.baseUrl}/shipment/cancel`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ awb: waybill })
    });
    const data = await res.json();
    return data;
  }

  async schedulePickup(packageCount, locationName) {
    const headers = await this.getAuthHeaders();
    const res = await fetch(`${this.baseUrl}/pickup/schedule`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ pieces: packageCount, location: locationName || "Primary" })
    });
    const data = await res.json();
    return data;
  }

  async getLabel(awb) {
    const headers = await this.getAuthHeaders();
    const res = await fetch(`${this.baseUrl}/shipment/label?awb=${awb}`, {
      method: 'GET',
      headers
    });
    const data = await res.json();
    return data;
  }

  async createManifest(awbs) {
    const headers = await this.getAuthHeaders();
    const res = await fetch(`${this.baseUrl}/manifest/create`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ awbs })
    });
    const data = await res.json();
    return data;
  }
}

module.exports = DTDCProvider;