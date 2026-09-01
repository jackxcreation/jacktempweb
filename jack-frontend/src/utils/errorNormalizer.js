// ==========================================
// 🛡️ FRONTEND ERROR NORMALIZER & TELEMETRY
// ==========================================

export const normalizeError = (error) => {
  // If error is from backend with standard envelope
  if (error.response && error.response.data) {
    const data = error.response.data;
    return {
      success: false,
      code: data.code || 'API_ERROR',
      message: data.message || error.message || 'An unexpected error occurred.',
      requestId: data.requestId || error.response.headers?.['x-request-id'] || 'unknown',
      retryable: data.retryable ?? (error.response.status >= 500)
    };
  }

  // Network connection or timeout error
  if (error.code === 'ECONNABORTED' || !error.response) {
    return {
      success: false,
      code: 'NETWORK_ERROR',
      message: 'Network connection failed or request timed out. Please check your internet.',
      requestId: 'client-timeout',
      retryable: true
    };
  }

  // Generic fallback
  return {
    success: false,
    code: 'UNKNOWN_ERROR',
    message: error.message || 'Something went wrong.',
    requestId: 'client-local',
    retryable: false
  };
};

export const reportTelemetry = (normalizedError) => {
  // Report error to monitoring/logging sink in production
  if (process.env.NODE_ENV === 'production') {
    console.warn('[Telemetry Report Sent]:', normalizedError);
  }
};

export const notifyUser = (normalizedError) => {
  // Unified UI Toast notification handling
  if (typeof window !== 'undefined') {
    console.error(`[UI Toast Error] (${normalizedError.code}): ${normalizedError.message}`);
    
    // Yahan par tum apni toast library (jaise react-hot-toast ya react-toastify) laga sakte ho
    // Example: toast.error(normalizedError.message);
  }
};