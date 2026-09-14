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

    const isCod = String(order.paymentMethod || '').toLowerCase().includes('cod');
    const declaredVal = order.totalPaise ? order.totalPaise / 100 : (order.totalAmount || 0);

    const payload = {
      Shipper: {
        CustomerCode: process.env.BLUEDART_CUSTOMER_CODE || "DEFAULT_CODE",
        IsCod: isCod ? "Y" : "N"
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
        ActualWeight: order.weight || 0.5,
        DeclaredValue: declaredVal,
        ItemDescription: (order.items || []).map(i => i.title || "Product").join(", ").substring(0, 100)
      }
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    try {
      const res = await fetch(`${this.baseUrl}/shipment/waybill`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        signal: controller.signal
      });

      const data = await res.json();
      if (!res.ok || (!data.WayBillNo && !data.success && !data.waybill)) {
        throw new Error(`BlueDart AWB Generation Failed: ${data.Message || data.message || JSON.stringify(data)}`);
      }

      return {
        success: true,
        provider: 'bluedart',
        waybill: data.WayBillNo || data.waybill || data.WaybillNo,
        trackingStatus: 'Manifested'
      };
    } catch (error) {
      console.error("BlueDart generateAWB Error:", error.message);
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async createShipment(order) {
    return await this.generateAWB(order);
  }

  async getRate(payload) {
    const headers = await this.getAuthHeaders();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    try {
      const res = await fetch(`${this.baseUrl}/rate/calculate`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        signal: controller.signal
      });
      const data = await res.json();
      return {
        rate: data.Rate || data.amount || 120,
        estimatedDays: data.TransitDays || 3,
        provider: 'bluedart'
      };
    } catch (error) {
      console.error("BlueDart getRate Error:", error.message);
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async trackShipment(awb) {
    const headers = await this.getAuthHeaders();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    try {
      const res = await fetch(`${this.baseUrl}/tracking/waybill?wbn=${awb}`, {
        method: 'GET',
        headers,
        signal: controller.signal
      });
      const data = await res.json();
      return {
        awb,
        status: data.Status || data.CurrentStatus || 'In Transit',
        history: data.ScanDetail || []
      };
    } catch (error) {
      console.error("BlueDart trackShipment Error:", error.message);
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async cancelShipment(waybill) {
    const headers = await this.getAuthHeaders();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    try {
      const res = await fetch(`${this.baseUrl}/shipment/cancel`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ WayBillNo: waybill }),
        signal: controller.signal
      });
      const data = await res.json();
      return data;
    } catch (error) {
      console.error("BlueDart cancelShipment Error:", error.message);
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async schedulePickup(packageCount, locationName) {
    const headers = await this.getAuthHeaders();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    try {
      const res = await fetch(`${this.baseUrl}/pickup/register`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ Pieces: packageCount, PickupLocation: locationName || "Primary" }),
        signal: controller.signal
      });
      const data = await res.json();
      return data;
    } catch (error) {
      console.error("BlueDart schedulePickup Error:", error.message);
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async getLabel(awb) {
    const headers = await this.getAuthHeaders();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    try {
      const res = await fetch(`${this.baseUrl}/waybill/label?wbn=${awb}`, {
        method: 'GET',
        headers,
        signal: controller.signal
      });
      const data = await res.json();
      return data;
    } catch (error) {
      console.error("BlueDart getLabel Error:", error.message);
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async createManifest(awbs) {
    const headers = await this.getAuthHeaders();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    try {
      const res = await fetch(`${this.baseUrl}/manifest/generate`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ WayBillNos: awbs }),
        signal: controller.signal
      });
      const data = await res.json();
      return data;
    } catch (error) {
      console.error("BlueDart createManifest Error:", error.message);
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }
}

module.exports = BlueDartProvider;