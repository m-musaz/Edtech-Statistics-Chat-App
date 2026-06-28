/**
 * Backend API Route Constants
 * All backend endpoints used by the frontend
 */

// Base URL
export const API_BASE_URL = (import.meta as any).env?.VITE_API_BASE_URL || "http://localhost:8000";

// Health & Utility Routes
export const API_V1_ROUTE = `${API_BASE_URL}/api/v1`;
export const HEALTH_ROUTE = `${API_V1_ROUTE}/healthz`;

// Chat Routes
export const CHAT_ROUTE = `${API_V1_ROUTE}/chat`;
export const UPLOAD_FILE_ROUTE = `${API_V1_ROUTE}/upload-file`;
export const RATE_ROUTE = `${API_V1_ROUTE}/rate`;
export const LOGOUT_ROUTE = `${API_V1_ROUTE}/logout`;

// Thread Routes
export const THREADS_ROUTE = `${API_V1_ROUTE}/threads`;
export const THREAD_MESSAGES_ROUTE = (threadId: string) => `${THREADS_ROUTE}/${threadId}/messages`;
export const THREAD_DELETE_ROUTE = (threadId: string) => `${THREADS_ROUTE}/${threadId}`;

// Feedback Routes
export const FEEDBACK_DELETE_ROUTE = (messageId: string) => `${API_BASE_URL}/api/v1/feedback/${messageId}`;

// Analytics Routes
export const ANALYTICS_ROUTE = `${API_V1_ROUTE}/analytics`;
export const ANALYTICS_LATENCY_ROUTE = `${ANALYTICS_ROUTE}/metrics/latency`;
export const ANALYTICS_COST_ROUTE = `${ANALYTICS_ROUTE}/metrics/cost`;
export const ANALYTICS_CHARTS_ROUTE = `${ANALYTICS_ROUTE}/metrics/charts`;
export const ANALYTICS_USAGE_ROUTE = `${ANALYTICS_ROUTE}/metrics/usage`;
export const ANALYTICS_RECENT_LATENCIES_ROUTE = `${ANALYTICS_ROUTE}/metrics/recent-latencies`;

// Admin Routes
export const ADMIN_ROUTE = `${API_V1_ROUTE}/admin`;
export const ADMIN_LOGIN_ROUTE = `${ADMIN_ROUTE}/login`;
export const ADMIN_VERIFY_ROUTE = `${ADMIN_ROUTE}/verify`;
export const ADMIN_LOGOUT_ROUTE = `${ADMIN_ROUTE}/logout`;
export const ADMIN_SETTINGS_ROUTE = `${ADMIN_ROUTE}/settings`;
export const ADMIN_VECTOR_STORE_FILES_ROUTE = `${ADMIN_ROUTE}/vector-store-files`;
export const ADMIN_VECTOR_STORE_FILE_DELETE_ROUTE = (fileId: string) => `${ADMIN_VECTOR_STORE_FILES_ROUTE}/${fileId}`;
export const ADMIN_VECTOR_STORE_INFO_ROUTE = `${ADMIN_ROUTE}/vector-store`;
export const PUBLIC_HELP_TEXT_ROUTE = `${ADMIN_ROUTE}/help-text`;
export const PUBLIC_ABOUT_TEXT_ROUTE = `${ADMIN_ROUTE}/about-text`;
