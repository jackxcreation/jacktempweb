// ==========================================
// 🛡️ FRONTEND ERROR NORMALIZER & TELEMETRY
// ==========================================

export const normalizeError = (error) => {
  if (!error) {
    return {
      success: false,
      code: 'UNKNOWN_ERROR',
      message: 'An unexpected error occurred.',
      requestId: 'client-local',
      retryable: false
    };
  }

  // 1. If error is from Axios with standard envelope
  if (error.response && error.response.data) {
    const data = error.response.data;
    return {
      success: false,
      code: data.code || data.error || 'API_ERROR',
      message: data.message || data.error || error.message || 'An unexpected error occurred.',
      requestId: data.requestId || error.response.headers?.['x-request-id'] || 'unknown',
      retryable: data.retryable ?? (error.response.status >= 500)
    };
  }

  // 2. 🔥 UPGRADE: Handle Fetch API Response errors or custom thrown error objects with status
  if (error.status || (error.message && error.message.includes('HTTP error'))) {
    return {
      success: false,
      code: error.code || `HTTP_${error.status || 500}`,
      message: error.message || 'Server returned an invalid response.',
      requestId: error.requestId || 'fetch-api',
      retryable: (error.status >= 500)
    };
  }

  // 3. Network connection or timeout error
  if (error.code === 'ECONNABORTED' || error.name === 'AbortError' || !error.response) {
    if (error.name === 'AbortError') {
      return {
        success: false,
        code: 'REQUEST_ABORTED',
        message: 'Request was cancelled.',
        requestId: 'client-abort',
        retryable: false
      };
    }

    return {
      success: false,
      code: 'NETWORK_ERROR',
      message: 'Network connection failed or request timed out. Please check your internet.',
      requestId: 'client-timeout',
      retryable: true
    };
  }

  // 4. Generic fallback
  return {
    success: false,
    code: error.code || 'UNKNOWN_ERROR',
    message: error.message || 'Something went wrong.',
    requestId: 'client-local',
    retryable: false
  };
};

export const reportTelemetry = (normalizedError) => {
  // Report error to monitoring/logging sink in production
  if (typeof window !== 'undefined' && process.env.NODE_ENV === 'production') {
    console.warn('[Telemetry Report Sent]:', normalizedError);
    
    // Example integration hook for Sentry / Datadog if available globally
    if (window.Sentry && typeof window.Sentry.captureException === 'function') {
      window.Sentry.captureException(new Error(normalizedError.message), {
        extra: normalizedError
      });
    }
  }
};

export const notifyUser = (normalizedError) => {
  // Unified UI Toast notification handling
  if (typeof window !== 'undefined') {
    console.error(`[UI Toast Error] (${normalizedError.code}): ${normalizedError.message}`);
    
    // 🔥 UPGRADE: Dispatch a custom browser event so any UI toast component can listen & display it
    try {
      const toastEvent = new CustomEvent('app:toast', {
        detail: {
          type: 'error',
          code: normalizedError.code,
          message: normalizedError.message
        }
      });
      window.dispatchEvent(toastEvent);
    } catch (e) {
      // Fallback if CustomEvent fails in legacy environments
    }
  }
};

/**
 * 🔥 NEW HELPER: Streamlines API calls with automatic error normalization & reporting
 */
export const handleApiCall = async (apiPromise) => {
  try {
    const response = await apiPromise;
    return { success: true, data: response.data || response, error: null };
  } catch (err) {
    const normalized = normalizeError(err);
    reportTelemetry(normalized);
    notifyUser(normalized);
    return { success: false, data: null, error: normalized };
  }
};