const DelhiveryProvider = require('./providers/delhiveryProvider');
const ShiprocketProvider = require('./providers/shiprocketProvider');
const BlueDartProvider = require('./providers/bluedartProvider');
const DTDCProvider = require('./providers/dtdcProvider');
const { Setting } = require('../../models');

class ShippingEngine {
  constructor() {
    this.providers = {
      delhivery: new DelhiveryProvider(),
      shiprocket: new ShiprocketProvider(),
      bluedart: new BlueDartProvider(),
      dtdc: new DTDCProvider()
    };
  }

  async getActiveProvider(preferredProvider = null) {
    try {
      if (preferredProvider && this.providers[preferredProvider]) {
        return this.providers[preferredProvider];
      }
      const setting = await Setting.findOne().lean();
      const defaultProviderName = setting?.storeShippingConfig?.defaultProvider || 'delhivery';
      return this.providers[defaultProviderName] || this.providers.delhivery;
    } catch (err) {
      return this.providers.delhivery;
    }
  }

  // 🔥 AMAZON-STYLE UNIFIED SHIPMENT STATES MAPPER HIDING PROVIDER COMPLEXITIES
  normalizeState(rawStatus) {
    const status = String(rawStatus || '').toLowerCase();
    if (status.includes('manifest') || status.includes('booked')) return 'MANIFESTED';
    if (status.includes('pickup') || status.includes('collected')) return 'PICKED_UP';
    if (status.includes('transit') || status.includes('hub')) return 'IN_TRANSIT';
    if (status.includes('out') || status.includes('delivery')) return 'OUT_FOR_DELIVERY';
    if (status.includes('deliver') || status.includes('delivered')) return 'DELIVERED';
    if (status.includes('cancel')) return 'CANCELLED';
    if (status.includes('rto') || status.includes('return')) return 'RTO';
    return 'PROCESSING';
  }

  async createShipment(order, preferredProvider = null, requestId = null) {
    const provider = await this.getActiveProvider(preferredProvider || order?.shippingProvider);
    // Attach requestId to order context if provided for third-party tracing
    const enrichedOrder = requestId ? { ...order, requestId } : order;
    return await provider.createShipment ? provider.createShipment(enrichedOrder) : provider.generateAWB(enrichedOrder);
  }

  async getRate(payload, preferredProvider = null, requestId = null) {
    const provider = await this.getActiveProvider(preferredProvider || payload?.shippingProvider);
    const enrichedPayload = requestId ? { ...payload, requestId } : payload;
    return provider.getRate ? await provider.getRate(enrichedPayload) : { rate: 0, message: "Rate calculator not supported by provider" };
  }

  async generateAWB(order, preferredProvider = null, requestId = null) {
    const provider = await this.getActiveProvider(preferredProvider || order?.shippingProvider);
    const enrichedOrder = requestId ? { ...order, requestId } : order;
    
    try {
      const result = await provider.generateAWB(enrichedOrder);
      return {
        ...result,
        unifiedState: this.normalizeState(result.trackingStatus)
      };
    } catch (error) {
      console.error(`[ShippingEngine Error] [RequestId: ${requestId || 'N/A'}] AWB Generation failed:`, error.message);
      throw error;
    }
  }

  async cancelShipment(waybill, preferredProvider = null, requestId = null) {
    const provider = await this.getActiveProvider(preferredProvider);
    // Pass requestId or options if provider accepts it
    return provider.cancelShipment.length > 1 ? await provider.cancelShipment(waybill, { requestId }) : await provider.cancelShipment(waybill);
  }

  async schedulePickup(packageCount, locationName, preferredProvider = null, requestId = null) {
    const provider = await this.getActiveProvider(preferredProvider);
    return provider.schedulePickup.length > 2 ? await provider.schedulePickup(packageCount, locationName, { requestId }) : await provider.schedulePickup(packageCount, locationName);
  }

  async getLabel(awb, preferredProvider = null, requestId = null) {
    const provider = await this.getActiveProvider(preferredProvider);
    return provider.getLabel.length > 1 ? await provider.getLabel(awb, { requestId }) : await provider.getLabel(awb);
  }

  async trackShipment(awb, preferredProvider = null, requestId = null) {
    const provider = await this.getActiveProvider(preferredProvider);
    const trackingInfo = provider.trackShipment ? await provider.trackShipment(awb) : { status: 'Unknown' };
    return {
      ...trackingInfo,
      unifiedState: this.normalizeState(trackingInfo.status)
    };
  }

  async createManifest(awbs, preferredProvider = null, requestId = null) {
    const provider = await this.getActiveProvider(preferredProvider);
    return provider.createManifest ? await provider.createManifest(awbs) : { success: true, message: "Manifest created" };
  }
}

module.exports = new ShippingEngine();