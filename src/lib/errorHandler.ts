/**
 * Centralized error handling utility
 */

/**
 * Extract error message from unknown error type
 * @param error - The error object (can be Error, string, or unknown)
 * @returns Human-readable error message
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  if (error && typeof error === "object" && "message" in error) {
    return String(error.message);
  }
  return "An unknown error occurred";
}

/**
 * Log error with context and return user-friendly message
 * @param error - The error to handle
 * @param context - Where the error occurred (e.g., "FileUpload", "API:uploadFiles")
 * @param silent - If true, only log to console without returning message
 * @returns User-friendly error message
 */
export function handleError(
  error: unknown,
  context: string,
  silent = false,
): string {
  const message = getErrorMessage(error);

  if (process.env.NODE_ENV !== "production") {
    console.error(`[${context}]`, message, error);
  } else if (!silent) {
    // In production, log less verbosely
    console.error(`[${context}]`, message);
  }

  return message;
}

/**
 * Handle API errors specifically
 * @param error - API error
 * @param endpoint - API endpoint that failed
 * @returns Formatted error message
 */
export function handleApiError(error: unknown, endpoint: string): string {
  const message = getErrorMessage(error);

  // Check for common HTTP error patterns
  if (message.includes("404")) {
    return "Resource not found";
  }
  if (message.includes("401") || message.includes("403")) {
    return "Authentication required";
  }
  if (message.includes("500")) {
    return "Server error. Please try again later";
  }
  if (message.includes("Network")) {
    return "Network error. Please check your connection";
  }

  console.error(`[API:${endpoint}]`, message, error);
  return message || "Failed to complete request";
}
