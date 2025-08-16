// scripts/error_handler.js

class ErrorHandler {

    static createError(errorInfo) {
        let message = 'An unknown error occurred.';
        let suggestion = null;

        if (typeof errorInfo === 'string') {
            message = errorInfo;
        } else if (errorInfo instanceof Error) {
            // Handle native JavaScript Error objects
            message = errorInfo.message;
        } else if (typeof errorInfo === 'object' && errorInfo !== null) {
            // Handle our custom error objects or other object types
            message = errorInfo.message || JSON.stringify(errorInfo);
            suggestion = errorInfo.suggestion || null;
        }

        return {
            success: false,
            error: { message, suggestion },
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