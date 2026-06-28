// API configuration and functions
import {
  API_BASE_URL,
  HEALTH_ROUTE,
  CHAT_ROUTE,
  UPLOAD_FILE_ROUTE,
  THREADS_ROUTE,
  THREAD_MESSAGES_ROUTE,
  RATE_ROUTE,
  FEEDBACK_DELETE_ROUTE,
  LOGOUT_ROUTE,
  THREAD_DELETE_ROUTE,
  ANALYTICS_LATENCY_ROUTE,
  ANALYTICS_COST_ROUTE,
  ANALYTICS_CHARTS_ROUTE,
  ANALYTICS_USAGE_ROUTE,
  ANALYTICS_RECENT_LATENCIES_ROUTE
} from "../constants/apiRoutes";
import { ADMIN_SETTINGS_ROUTE, ADMIN_VECTOR_STORE_FILES_ROUTE, ADMIN_VECTOR_STORE_FILE_DELETE_ROUTE, ADMIN_VECTOR_STORE_INFO_ROUTE, PUBLIC_HELP_TEXT_ROUTE, PUBLIC_ABOUT_TEXT_ROUTE } from "../constants/apiRoutes";

// Health check function
export const pingBackend = async () => {
  try {
    const response = await fetch(HEALTH_ROUTE);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    throw new Error(
      `Failed to connect to backend: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
};

// Chat API functions
export const sendMessage = async (data: {
  user_message: string;
  existing_file_id?: string;
  file_name?: string;
  previous_response_id?: string;
  thread_id?: string;
  stream?: boolean;
  experiment_type?: string;
}) => {
  try {
    const formData = new FormData();
    formData.append("user_message", data.user_message);
    if (data.existing_file_id) {
      formData.append("existing_file_id", data.existing_file_id);
    }
    if (data.file_name) {
      formData.append("file_name", data.file_name);
    }
    if (data.previous_response_id) {
      formData.append("previous_response_id", data.previous_response_id);
    }
    if (data.thread_id) {
      formData.append("thread_id", data.thread_id);
    }
    formData.append("stream", data.stream ? "true" : "false");
    formData.append("experiment_type", data.experiment_type || "control");

    const response = await fetch(CHAT_ROUTE, {
      method: "POST",
      body: formData,
      credentials: "include", // Include cookies for session management
    });

    if (!response.ok) {
      // Try to get error details from response
      let errorMessage = `HTTP error! status: ${response.status}`;
      try {
        const errorData = await response.json();
        if (errorData.detail) {
          errorMessage = errorData.detail;
        }
      } catch (parseError) {
        // If we can't parse the error response, use the status
        errorMessage = `HTTP error! status: ${response.status}`;
      }
      throw new Error(errorMessage);
    }

    if (data.stream) {
      if (!response.body) {
        throw new Error("Response body is null for streaming request");
      }

      return response.body.getReader();
    } else {
      return await response.json();
    }
  } catch (error) {
    throw new Error(
      `Failed to send message: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
};

export const uploadFile = async (file: File): Promise<string> => {
  try {
    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch(UPLOAD_FILE_ROUTE, {
      method: "POST",
      body: formData,
      credentials: "include", // Include cookies for session management
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    // Get the response text first to see what we're actually receiving
    const responseText = await response.text();
    console.log("Upload response text:", responseText);

    let fileId: string;

    try {
      // Try to parse as JSON first
      const data = JSON.parse(responseText);
      fileId = typeof data === "string" ? data : data.file_id || data.id;
    } catch (parseError) {
      // If JSON parsing fails, treat the response as a plain string
      fileId = responseText.trim().replace(/"/g, ""); // Remove quotes if present
    }

    if (!fileId) {
      throw new Error("No file ID received from server");
    }

    console.log("Extracted file ID:", fileId);
    return fileId;
  } catch (error) {
    console.error("Upload error details:", error);
    throw new Error(
      `Failed to upload file: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
};

// Thread management API functions
export const getThreads = async (adminSettingsId: number = 1) => {
  try {
    const formData = new FormData();
    formData.append("admin_settings_id", adminSettingsId.toString());

    const response = await fetch(THREADS_ROUTE, {
      method: "POST",
      body: formData,
      credentials: "include",
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    throw new Error(
      `Failed to fetch threads: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
};

export const getThreadMessages = async (threadId: string) => {
  try {
    const response = await fetch(
      THREAD_MESSAGES_ROUTE(threadId),
      {
        method: "POST",
        credentials: "include",
      },
    );

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    throw new Error(
      `Failed to fetch thread messages: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
};

// Rating API function
export const rateMessage = async (
  messageId: string,
  rating: "thumbs_up" | "thumbs_down",
) => {
  try {
    const formData = new FormData();
    formData.append("message_id", messageId);
    formData.append("rating", rating);

    const response = await fetch(RATE_ROUTE, {
      method: "POST",
      body: formData,
      credentials: "include",
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    throw new Error(
      `Failed to rate message: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
};

// Delete feedback/rating function
export const deleteFeedback = async (messageId: string) => {
  try {
    const response = await fetch(FEEDBACK_DELETE_ROUTE(messageId), {
      method: "DELETE",
      credentials: "include",
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    throw new Error(
      `Failed to delete feedback: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
};

// Logout function
export const logout = async () => {
  try {
    const response = await fetch(LOGOUT_ROUTE, {
      method: "POST",
      credentials: "include",
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    throw new Error(
      `Failed to logout: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
};

// Delete thread function
export const deleteThread = async (threadId: string) => {
  try {
    const response = await fetch(THREAD_DELETE_ROUTE(threadId), {
      method: "DELETE",
      credentials: "include",
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    throw new Error(
      `Failed to delete thread: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
};

// Get API root
export const getApiRoot = () => {
  return API_BASE_URL;
};

// Get API health endpoint
export const getApiHealth = () => {
  return HEALTH_ROUTE;
};

// Analytics API functions
export interface LatencyAnalytics {
  summary: {
    p50_ms: number
    p90_ms: number
    p99_ms: number
    mean_ms: number
  }
  series: Array<{
    ts: string
    avg_ms: number
    p90_ms: number
    count: number
  }>
}

export const getLatencyAnalytics = async (params?: {
  from_date?: string
  to_date?: string
  granularity?: 'hour' | 'day' | 'week' | 'month' | 'year'
  user_id?: string
  admin_settings_id?: number
}): Promise<LatencyAnalytics> => {
  try {
    const searchParams = new URLSearchParams()
    if (params?.from_date) searchParams.append('from_date', params.from_date)
    if (params?.to_date) searchParams.append('to_date', params.to_date)
    if (params?.granularity) searchParams.append('granularity', params.granularity)
    if (params?.user_id) searchParams.append('user_id', params.user_id)
    if (params?.admin_settings_id) searchParams.append('admin_settings_id', params.admin_settings_id.toString())

    const url = `${ANALYTICS_LATENCY_ROUTE}${searchParams.toString() ? `?${searchParams.toString()}` : ''}`

    const response = await fetch(url, {
      method: 'GET',
      credentials: 'include',
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    return await response.json()
  } catch (error) {
    throw new Error(`Failed to fetch latency analytics: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

// Cost Analytics API functions
export interface CostAnalytics {
  total_usd: number
  total_input_tokens: number
  total_output_tokens: number
  series: Array<{
    ts: string
    usd: number
    input_tokens: number
    output_tokens: number
  }>
}

export const getCostAnalytics = async (params?: {
  from_date?: string
  to_date?: string
  granularity?: 'hour' | 'day' | 'week' | 'month' | 'year'
  user_id?: string
  admin_settings_id?: number
}): Promise<CostAnalytics> => {
  try {
    const searchParams = new URLSearchParams()
    if (params?.from_date) searchParams.append('from_date', params.from_date)
    if (params?.to_date) searchParams.append('to_date', params.to_date)
    if (params?.granularity) searchParams.append('granularity', params.granularity)
    if (params?.user_id) searchParams.append('user_id', params.user_id)
    if (params?.admin_settings_id) searchParams.append('admin_settings_id', params.admin_settings_id.toString())

    const url = `${ANALYTICS_COST_ROUTE}${searchParams.toString() ? `?${searchParams.toString()}` : ''}`

    const response = await fetch(url, {
      method: 'GET',
      credentials: 'include',
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    return await response.json()
  } catch (error) {
    throw new Error(`Failed to fetch cost analytics: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

// Chart Analytics API functions
export interface ChartAnalytics {
  rate: {
    generated_pct: number
  }
  by_type: Array<{
    chart_type: string
    count: number
  }>
  series: Array<{
    ts: string
    generated: number
    total: number
  }>
}

export const getChartAnalytics = async (params?: {
  from_date?: string
  to_date?: string
  granularity?: 'hour' | 'day' | 'week' | 'month' | 'year'
  user_id?: string
  admin_settings_id?: number
}): Promise<ChartAnalytics> => {
  try {
    const searchParams = new URLSearchParams()
    if (params?.from_date) searchParams.append('from_date', params.from_date)
    if (params?.to_date) searchParams.append('to_date', params.to_date)
    if (params?.granularity) searchParams.append('granularity', params.granularity)
    if (params?.user_id) searchParams.append('user_id', params.user_id)
    if (params?.admin_settings_id) searchParams.append('admin_settings_id', params.admin_settings_id.toString())

    const url = `${ANALYTICS_CHARTS_ROUTE}${searchParams.toString() ? `?${searchParams.toString()}` : ''}`

    const response = await fetch(url, {
      method: 'GET',
      credentials: 'include',
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    return await response.json()
  } catch (error) {
    throw new Error(`Failed to fetch chart analytics: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

// Usage Analytics API functions
export interface UsageAnalytics {
  chats_per_user: Array<{
    user_id: string
    threads: number
  }>
  avg_session_length: {
    messages_per_session: number
    words_per_session: number
  }
  active_users: Array<{
    ts: string
    daily_active_users?: number
    week_active_users?: number
    month_active_users?: number
    year_active_users?: number
  }>
}

export const getUsageAnalytics = async (params?: {
  from_date?: string
  to_date?: string
  granularity?: 'hour' | 'day' | 'week' | 'month' | 'year'
  admin_settings_id?: number
}): Promise<UsageAnalytics> => {
  try {
    const searchParams = new URLSearchParams()
    if (params?.from_date) searchParams.append('from_date', params.from_date)
    if (params?.to_date) searchParams.append('to_date', params.to_date)
    if (params?.granularity) searchParams.append('granularity', params.granularity)
    if (params?.admin_settings_id) searchParams.append('admin_settings_id', params.admin_settings_id.toString())

    const url = `${ANALYTICS_USAGE_ROUTE}${searchParams.toString() ? `?${searchParams.toString()}` : ''}`

    const response = await fetch(url, {
      method: 'GET',
      credentials: 'include',
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    return await response.json()
  } catch (error) {
    throw new Error(`Failed to fetch usage analytics: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

// Recent Latencies Interface
export interface RecentLatency {
  id: number
  timestamp: string
  latency: number
  status: 'success' | 'warning' | 'error'
  message_id?: string
}

export interface RecentLatenciesResponse {
  recent_latencies: RecentLatency[]
}

export const getRecentLatencies = async (limit?: number, admin_settings_id?: number): Promise<RecentLatenciesResponse> => {
  try {
    const searchParams = new URLSearchParams()
    if (limit) searchParams.append('limit', limit.toString())
    if (admin_settings_id) searchParams.append('admin_settings_id', admin_settings_id.toString())

    const url = `${ANALYTICS_RECENT_LATENCIES_ROUTE}${searchParams.toString() ? `?${searchParams.toString()}` : ''}`

    const response = await fetch(url, {
      method: 'GET',
      credentials: 'include',
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    return await response.json()
  } catch (error) {
    throw new Error(`Failed to fetch recent latencies: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

// Admin Settings API
export interface AdminSettings {
  system_prompt: string
  help_text: string
  about_text: string
  vector_id?: string
  id?: number
}

export const getAdminSettings = async (id?: number): Promise<AdminSettings> => {
  const url = id ? `${ADMIN_SETTINGS_ROUTE}?id=${id}` : ADMIN_SETTINGS_ROUTE
  const response = await fetch(url, {
    method: 'GET',
    credentials: 'include'
  })
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`)
  }
  return await response.json()
}

export const updateAdminSettings = async (settings: AdminSettings): Promise<AdminSettings> => {
  const response = await fetch(ADMIN_SETTINGS_ROUTE, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(settings)
  })
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`)
  }
  return await response.json()
}

// Public help text fetcher
export const getPublicHelpText = async (): Promise<{ help_text: string }> => {
  const response = await fetch(PUBLIC_HELP_TEXT_ROUTE, {
    method: 'GET',
    credentials: 'include', // include in case cookie exists, but not required
  })
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`)
  }
  return await response.json()
}

// Public about text fetcher
export const getPublicAboutText = async (): Promise<{ about_text: string }> => {
  const response = await fetch(PUBLIC_ABOUT_TEXT_ROUTE, {
    method: 'GET',
    credentials: 'include', // include in case cookie exists, but not required
  })
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`)
  }
  return await response.json()
}

// Vector Store Files API
export interface VectorStoreFile {
  id: string
  object: string
  created_at: number
  vector_store_id: string
  status: string
  file_id?: string
  filename?: string
  chunking_strategy?: {
    type: string
    static?: {
      max_chunk_size_tokens: number
      chunk_overlap_tokens: number
    }
  }
}

export interface VectorStoreFilesResponse {
  data: VectorStoreFile[]
  object: string
  first_id: string | null
  last_id: string | null
  has_more: boolean
}

export const getVectorStoreFiles = async (params?: {
  settings_id?: number
  after?: string
  before?: string
  filter_status?: 'in_progress' | 'completed' | 'failed' | 'cancelled'
  limit?: number
  order?: 'asc' | 'desc'
}): Promise<VectorStoreFilesResponse> => {
  try {
    const searchParams = new URLSearchParams()
    if (params?.settings_id) searchParams.append('id', params.settings_id.toString())
    if (params?.after) searchParams.append('after', params.after)
    if (params?.before) searchParams.append('before', params.before)
    if (params?.filter_status) searchParams.append('filter_status', params.filter_status)
    if (params?.limit) searchParams.append('limit', params.limit.toString())
    if (params?.order) searchParams.append('order', params.order)

    const url = `${ADMIN_VECTOR_STORE_FILES_ROUTE}${searchParams.toString() ? `?${searchParams.toString()}` : ''}`

    const response = await fetch(url, {
      method: 'GET',
      credentials: 'include',
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    return await response.json()
  } catch (error) {
    throw new Error(`Failed to fetch vector store files: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

// Add file to vector store
export const addVectorStoreFile = async (file: File, settings_id?: number): Promise<VectorStoreFile & { filename: string }> => {
  try {
    const formData = new FormData()
    formData.append('file', file)
    if (settings_id) {
      formData.append('id', settings_id.toString())
    }

    const response = await fetch(ADMIN_VECTOR_STORE_FILES_ROUTE, {
      method: 'POST',
      credentials: 'include',
      body: formData
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    return await response.json()
  } catch (error) {
    throw new Error(`Failed to add file to vector store: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

// Delete file from vector store
export const deleteVectorStoreFile = async (fileId: string, settings_id?: number): Promise<{ message: string }> => {
  try {
    const url = settings_id 
      ? `${ADMIN_VECTOR_STORE_FILE_DELETE_ROUTE(fileId)}?id=${settings_id}`
      : ADMIN_VECTOR_STORE_FILE_DELETE_ROUTE(fileId)
    const response = await fetch(url, {
      method: 'DELETE',
      credentials: 'include',
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    return await response.json()
  } catch (error) {
    throw new Error(`Failed to delete file from vector store: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

// Vector store metadata API
export interface VectorStoreInfo {
  id: string
  object: string
  name?: string
  created_at?: number
  updated_at?: number
  file_count: number
  total_bytes: number
}

export const getVectorStoreInfo = async (settings_id?: number): Promise<VectorStoreInfo> => {
  try {
    const url = settings_id 
      ? `${ADMIN_VECTOR_STORE_INFO_ROUTE}?id=${settings_id}`
      : ADMIN_VECTOR_STORE_INFO_ROUTE
    const response = await fetch(url, {
      method: 'GET',
      credentials: 'include',
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    return await response.json()
  } catch (error) {
    throw new Error(`Failed to fetch vector store info: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

// Vector store file names API
// Removed legacy filename lookup API; filenames are now provided via metadata in getVectorStoreFiles
