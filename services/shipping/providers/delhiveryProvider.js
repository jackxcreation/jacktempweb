// services/shipping/providers/delhiveryProvider.js
const { Setting } = require('../../../models');

class DelhiveryProvider {
  constructor() {
    this.name = 'delhivery';
    this.baseUrl = 'https://track.delhivery.com';
  }

  async createShipment(order) {
    return await this.generateAWB(order);
  }

  async getRate(payload) {
    // Delhivery rate calculator stub
    return { estimatedCost: 50, courier: 'Delhivery Surface' };
  }

  async generateAWB(order) {
    if (!process.env.DELHIVERY_TOKEN) {
      throw new Error("Delhivery API Token is missing in backend configuration.");
    }

    let storeConfig = null;
    try {
      const settingDoc = await Setting.findOne().lean();
      storeConfig = settingDoc?.storeShippingConfig || {};
    } catch (e) {
      storeConfig = {};
    }

    const pickupHubName = storeConfig?.defaultWarehouse || "JACK_HUB";
    const returnAddressVal = storeConfig?.returnAddress || "Jack Essentials Return Address";
    const returnPhoneVal = storeConfig?.returnPhone || "N/A";
    const returnPincodeVal = storeConfig?.returnPincode || "754132";
    const returnCityVal = storeConfig?.returnCity || "Jagatsinghpur";
    const returnStateVal = storeConfig?.returnState || "Odisha";

    let cleanPhone = (order.address?.primaryPhone || order.userDetails?.phone || "N/A").replace(/[^0-9]/g, '');
    if (cleanPhone.length > 10) cleanPhone = cleanPhone.slice(-10);
    if (cleanPhone.length < 10) cleanPhone = "9999999999";

    let cleanPincode = (order.address?.pincode || "110001").replace(/[^0-9]/g, '');
    const finalNumericAmount = Math.round((order.totalAmount || (order.totalPaise ? order.totalPaise / 100 : 0)));
    const isCod = String(order.paymentMethod || '').toLowerCase().includes('cod');

    const productsDescription = (order.items || []).map(i => i.title || "Product").join(", ");
    const totalQuantity = (order.items || []).reduce((sum, item) => sum + (item.quantity || 1), 0);

    let totalWeight = 0, maxL = 15, maxB = 15, totalH = 10;
    (order.items || []).forEach(item => {
      totalWeight += 500 * (item.quantity || 1); 
    });

    const payloadData = {
      shipments: [{
        name: (order.userDetails?.name || order.address?.name || "Customer").substring(0, 40),
        add: `${order.address?.flat || ''}, ${order.address?.street || ''}`.trim().substring(0, 100) || "Default Address",
        pin: cleanPincode, 
        city: order.address?.city || "Jagatsinghpur", 
        state: order.address?.state || "Odisha", 
        country: "India",
        phone: cleanPhone, 
        order: String(order.id || order._id) + "-" + Date.now().toString().slice(-4),
        payment_mode: isCod ? "COD" : "Pre-paid",
        return_pin: returnPincodeVal, 
        return_city: returnCityVal, 
        return_phone: returnPhoneVal, 
        return_add: returnAddressVal, 
        return_state: returnStateVal, 
        return_country: "India",
        products_desc: productsDescription.substring(0, 120),
        hsn_code: "",
        weight: String(Math.round(totalWeight)), 
        length: String(Math.round(maxL)), 
        breadth: String(Math.round(maxB)), 
        height: String(Math.round(totalH)),
        shipment_length: String(Math.round(maxL)), 
        shipment_width: String(Math.round(maxB)), 
        shipment_height: String(Math.round(totalH)),
        cod_amount: isCod ? finalNumericAmount : 0,
        order_date: new Date().toISOString(), 
        total_amount: finalNumericAmount,
        seller_inv: "", quantity: totalQuantity, waybill: ""
      }],
      pickup_location: { name: pickupHubName }
    };

    const urlEncodedData = new URLSearchParams();
    urlEncodedData.append("format", "json");
    urlEncodedData.append("data", JSON.stringify(payloadData));

    const dRes = await fetch(`${this.baseUrl}/api/cmu/create.json`, {
      method: 'POST', 
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Authorization': `Token ${process.env.DELHIVERY_TOKEN}` },
      body: urlEncodedData.toString()
    });
    
    const rawDText = await dRes.text();
    let dData;
    try {
      dData = JSON.parse(rawDText);
    } catch (e) {
      throw new Error(`Invalid JSON response from Delhivery API: ${rawDText}`);
    }

    if (dData.success === false || (dData.error && typeof dData.error === 'string')) {
      throw new Error(`Delhivery Error: ${dData.error || dData.rmk}`);
    }

    if (dData.packages && dData.packages.length > 0 && dData.packages[0].status === "Fail") {
      const exactReason = Array.isArray(dData.packages[0].remarks) ? dData.packages[0].remarks.join(", ") : dData.packages[0].remarks;
      throw new Error(`Delhivery Reject: ${exactReason}`);
    }

    const waybillNo = dData.packages?.[0]?.waybill || dData.waybill;
    if (!waybillNo) {
      throw new Error("Delhivery responded successfully, but no AWB was found.");
    }

    return {
      success: true,
      provider: 'delhivery',
      waybill: waybillNo,
      providerOrderId: dData.packages?.[0]?.refnum || '',
      trackingStatus: 'Manifested'
    };
  }

  async getLabel(awb) {
    const response = await fetch(`${this.baseUrl}/api/p/packing_slip?format=json&wbns=${awb}`, {
      method: 'GET',
      headers: { 'Authorization': `Token ${process.env.DELHIVERY_TOKEN}`, 'Content-Type': 'application/json' }
    });
    const rawText = await response.text();
    try {
      return JSON.parse(rawText);
    } catch (e) {
      return { isHtml: true, htmlContent: rawText };
    }
  }

  async schedulePickup(packageCount, locationName) {
    let hubName = locationName;
    if (!hubName) {
      const settingDoc = await Setting.findOne().lean();
      hubName = settingDoc?.storeShippingConfig?.defaultWarehouse || "JACK_HUB";
    }

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1); 

    const payload = {
      "pickup_time": "14:00:00", 
      "pickup_date": tomorrow.toISOString().split('T')[0], 
      "pickup_location": hubName, 
      "expected_package_count": packageCount || 1
    };

    const response = await fetch(`${this.baseUrl}/fm/request/new/`, {
      method: 'POST',
      headers: { 'Authorization': `Token ${process.env.DELHIVERY_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const rawText = await response.text();
    try {
      return JSON.parse(rawText);
    } catch (e) {
      return { success: false, raw: rawText };
    }
  }

  async cancelShipment(waybill) {
    const response = await fetch(`${this.baseUrl}/api/p/edit`, {
      method: 'POST',
      headers: { 'Authorization': `Token ${process.env.DELHIVERY_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ "waybill": waybill, "cancellation": true })
    });
    const rawText = await response.text();
    try {
      return JSON.parse(rawText);
    } catch (e) {
      return { success: false, raw: rawText };
    }
  }

  async trackShipment(awb) {
    const response = await fetch(`${this.baseUrl}/api/v1/packages/json/?waybill=${awb}`, {
      method: 'GET',
      headers: { 'Authorization': `Token ${process.env.DELHIVERY_TOKEN}` }
    });
    const data = await response.json();
    return { status: data?.ShipmentData?.[0]?.Shipment?.Status?.Status || 'In Transit' };
  }

  async createManifest(awbs) {
    return await this.schedulePickup(awbs.length);
  }
}

module.exports = DelhiveryProvider;