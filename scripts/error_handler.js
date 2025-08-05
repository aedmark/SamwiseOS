// scripts/error_handler.js

class ErrorHandler {
  /**
   * Creates a standardized error object.
   * @param {string|{message: string, suggestion?: string}} errorInfo - A descriptive error message or an object with message and suggestion.
   * @returns {{success: false, error: {message: string, suggestion: string|null}}}
   */
  static createError(errorInfo) {
    if (typeof errorInfo === 'string') {
      // Keep it classic for the old episodes.
      return { success: false, error: { message: errorInfo, suggestion: null } };
    }
    // The new, multi-dimensional character.
    return {
      success: false,
      error: {
        message: errorInfo.message || 'An unknown error occurred.',
        suggestion: errorInfo.suggestion || null,
      },
    };
  }

  static createSuccess(data = null, options = {}) {
    return {
      success: true,
      data: data,
      ...options,
    };
  }
}