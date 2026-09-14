// services/shipping/shippingEngine.js
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
        return { name: preferredProvider, provider: this.providers[preferredProvider] };
      }
      const setting = await Setting.findOne().lean();
      const defaultProviderName = setting?.storeShippingConfig?.defaultProvider || 'delhivery';
      const selected = this.providers[defaultProviderName] ? defaultProviderName : 'delhivery';
      return { name: selected, provider: this.providers[selected] };
    } catch (err) {
      return { name: 'delhivery', provider: this.providers.delhivery };
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
    const { name: providerName, provider } = await this.getActiveProvider(preferredProvider || order?.shippingProvider);
    const enrichedOrder = requestId ? { ...order, requestId } : order;
    
    try {
      return provider.createShipment ? await provider.createShipment(enrichedOrder) : await provider.generateAWB(enrichedOrder);
    } catch (error) {
      console.error(`[ShippingEngine] Primary provider [${providerName}] failed createShipment. Attempting auto-failover...`, error.message);
      // 🔥 Pro Feature: Automatic Failover to backup provider
      const backupKey = providerName === 'delhivery' ? 'shiprocket' : 'delhivery';
      const backupProvider = this.providers[backupKey];
      if (backupProvider) {
        return backupProvider.createShipment ? await backupProvider.createShipment(enrichedOrder) : await backupProvider.generateAWB(enrichedOrder);
      }
      throw error;
    }
  }

  async getRate(payload, preferredProvider = null, requestId = null) {
    const { provider } = await this.getActiveProvider(preferredProvider || payload?.shippingProvider);
    const enrichedPayload = requestId ? { ...payload, requestId } : payload;
    return provider.getRate ? await provider.getRate(enrichedPayload) : { rate: 0, message: "Rate calculator not supported by provider" };
  }

  async generateAWB(order, preferredProvider = null, requestId = null) {
    const { name: providerName, provider } = await this.getActiveProvider(preferredProvider || order?.shippingProvider);
    const enrichedOrder = requestId ? { ...order, requestId } : order;
    
    try {
      const result = await provider.generateAWB(enrichedOrder);
      return {
        ...result,
        provider: result.provider || providerName,
        unifiedState: this.normalizeState(result.trackingStatus)
      };
    } catch (error) {
      console.error(`[ShippingEngine Error] [RequestId: ${requestId || 'N/A'}] Primary AWB Generation failed for [${providerName}]:`, error.message);
      
      // 🔥 Pro Feature: Automatic Failover for AWB Generation
      const backupKey = providerName === 'delhivery' ? 'shiprocket' : 'delhivery';
      const backupProvider = this.providers[backupKey];
      if (backupProvider && typeof backupProvider.generateAWB === 'function') {
        try {
          console.warn(`[ShippingEngine] Failing over AWB generation to backup provider: [${backupKey}]`);
          const backupResult = await backupProvider.generateAWB(enrichedOrder);
          return {
            ...backupResult,
            provider: backupResult.provider || backupKey,
            unifiedState: this.normalizeState(backupResult.trackingStatus)
          };
        } catch (backupErr) {
          console.error(`[ShippingEngine] Backup provider [${backupKey}] also failed AWB generation:`, backupErr.message);
        }
      }

      throw error;
    }
  }

  async cancelShipment(waybill, preferredProvider = null, requestId = null) {
    const { provider } = await this.getActiveProvider(preferredProvider);
    return provider.cancelShipment.length > 1 ? await provider.cancelShipment(waybill, { requestId }) : await provider.cancelShipment(waybill);
  }

  async schedulePickup(packageCount, locationName, preferredProvider = null, requestId = null) {
    const { provider } = await this.getActiveProvider(preferredProvider);
    return provider.schedulePickup.length > 2 ? await provider.schedulePickup(packageCount, locationName, { requestId }) : await provider.schedulePickup(packageCount, locationName);
  }

  async getLabel(awb, preferredProvider = null, requestId = null) {
    const { provider } = await this.getActiveProvider(preferredProvider);
    return provider.getLabel.length > 1 ? await provider.getLabel(awb, { requestId }) : await provider.getLabel(awb);
  }

  async trackShipment(awb, preferredProvider = null, requestId = null) {
    const { provider } = await this.getActiveProvider(preferredProvider);
    const trackingInfo = provider.trackShipment ? await provider.trackShipment(awb) : { status: 'Unknown' };
    return {
      ...trackingInfo,
      unifiedState: this.normalizeState(trackingInfo.status)
    };
  }

  async createManifest(awbs, preferredProvider = null, requestId = null) {
    const { provider } = await this.getActiveProvider(preferredProvider);
    return provider.createManifest ? await provider.createManifest(awbs) : { success: true, message: "Manifest created" };
  }
}

module.exports = new ShippingEngine();