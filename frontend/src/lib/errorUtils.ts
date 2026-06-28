/**
 * Utility functions for error handling
 */

/**
 * Check if an error is a 401 authentication/authorization error
 */
export const isAuthError = (error: any): boolean => {
  if (typeof error === 'object' && error !== null) {
    const errorMessage = error.message || '';
    const errorString = errorMessage.toLowerCase();
    return errorString.includes('401') || 
           errorString.includes('unauthorized') || 
           errorString.includes('no session found') ||
           errorString.includes('invalid session') ||
           errorString.includes('session expired') || errorString.includes('403');
  }
  return false;
};
