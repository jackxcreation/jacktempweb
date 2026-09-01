// services/shipping/providers/bluedartProvider.js
class BlueDartProvider {
  constructor() {
    this.name = 'bluedart';
    this.baseUrl = process.env.BLUEDART_API_URL || 'https://api.bluedart.com/in/transport/v1'; // Standard BlueDart API base URL
  }

  async getAuthHeaders() {
    if (!process.env.BLUEDART_JWT_TOKEN && (!process.env.BLUEDART_CLIENT_ID || !process.env.BLUEDART_CLIENT_SECRET)) {
      throw new Error("BlueDart API credentials (Token or Client ID/Secret) are missing in environment configuration.");
    }
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.BLUEDART_JWT_TOKEN || process.env.BLUEDART_CLIENT_SECRET}`
    };
  }

  async generateAWB(order) {
    const headers = await this.getAuthHeaders();

    const payload = {
      Shipper: {
        CustomerCode: process.env.BLUEDART_CUSTOMER_CODE || "DEFAULT_CODE",
        IsCod: String(order.paymentMethod || '').toLowerCase().includes('cod') ? "Y" : "N"
      },
      Consignee: {
        ConsigneeName: order.address?.name || order.userDetails?.name || "Customer",
        ConsigneeAddress1: order.address?.flat || order.address?.street || "Address line 1",
        ConsigneeCity: order.address?.city || "City",
        ConsigneeState: order.address?.state || "State",
        ConsigneePincode: order.address?.pincode || "110001",
        ConsigneeMobile: order.address?.primaryPhone || order.userDetails?.phone || "9999999999"
      },
      ShipmentDetails: {
        ProductCode: "A", // Air Domestic / Surface default
        SubProductCode: "",
        PieceCount: (order.items || []).reduce((sum, item) => sum + (item.quantity || 1), 0),
        ActualWeight: 0.5,
        DeclaredValue: order.totalAmount || (order.totalPaise ? order.totalPaise / 100 : 0),
        ItemDescription: (order.items || []).map(i => i.title || "Product").join(", ").substring(0, 100)
      }
    };

    const res = await fetch(`${this.baseUrl}/shipment/waybill`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (!data.WayBillNo && !data.success) {
      throw new Error(`BlueDart AWB Generation Failed: ${data.Message || JSON.stringify(data)}`);
    }

    return {
      success: true,
      provider: 'bluedart',
      waybill: data.WayBillNo || data.waybill,
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
      rate: data.Rate || data.amount || 120,
      estimatedDays: data.TransitDays || 3,
      provider: 'bluedart'
    };
  }

  async trackShipment(awb) {
    const headers = await this.getAuthHeaders();
    const res = await fetch(`${this.baseUrl}/tracking/waybill?wbn=${awb}`, {
      method: 'GET',
      headers
    });
    const data = await res.json();
    return {
      awb,
      status: data.Status || data.CurrentStatus || 'In Transit',
      history: data.ScanDetail || []
    };
  }

  async cancelShipment(waybill) {
    const headers = await this.getAuthHeaders();
    const res = await fetch(`${this.baseUrl}/shipment/cancel`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ WayBillNo: waybill })
    });
    const data = await res.json();
    return data;
  }

  async schedulePickup(packageCount, locationName) {
    const headers = await this.getAuthHeaders();
    const res = await fetch(`${this.baseUrl}/pickup/register`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ Pieces: packageCount, PickupLocation: locationName || "Primary" })
    });
    const data = await res.json();
    return data;
  }

  async getLabel(awb) {
    const headers = await this.getAuthHeaders();
    const res = await fetch(`${this.baseUrl}/waybill/label?wbn=${awb}`, {
      method: 'GET',
      headers
    });
    const data = await res.json();
    return data;
  }

  async createManifest(awbs) {
    const headers = await this.getAuthHeaders();
    const res = await fetch(`${this.baseUrl}/manifest/generate`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ WayBillNos: awbs })
    });
    const data = await res.json();
    return data;
  }
}

module.exports = BlueDartProvider;