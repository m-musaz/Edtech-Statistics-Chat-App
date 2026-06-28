// ============================================================================
// LocalStorage Helpers for Downloadable Files
// ============================================================================

export interface DownloadableFile {
  filename: string;
  data: string;
  mime_type: string;
  sandbox_path: string;
}

const DOWNLOADABLE_FILES_KEY_PREFIX = 'downloadable_files_';

/**
 * Get the localStorage key for a thread's downloadable files
 */
const getFilesStorageKey = (threadId: string): string => {
  return `${DOWNLOADABLE_FILES_KEY_PREFIX}${threadId}`;
};

/**
 * Save downloadable files for a message to localStorage
 */
export const saveDownloadableFilesToStorage = (
  threadId: string,
  messageId: string,
  files: DownloadableFile[]
): void => {
  try {
    const key = getFilesStorageKey(threadId);
    const existing = localStorage.getItem(key);
    const filesMap: Record<string, DownloadableFile[]> = existing ? JSON.parse(existing) : {};
    
    // Merge with existing files for this message
    filesMap[messageId] = [...(filesMap[messageId] || []), ...files];
    
    localStorage.setItem(key, JSON.stringify(filesMap));
    console.log(`💾 Saved ${files.length} files to localStorage for message ${messageId}`);
  } catch (error) {
    console.error('Failed to save downloadable files to localStorage:', error);
  }
};

/**
 * Get downloadable files for a specific message from localStorage
 */
export const getDownloadableFilesFromStorage = (
  threadId: string,
  messageId: string
): DownloadableFile[] => {
  try {
    const key = getFilesStorageKey(threadId);
    const existing = localStorage.getItem(key);
    if (!existing) return [];
    
    const filesMap: Record<string, DownloadableFile[]> = JSON.parse(existing);
    return filesMap[messageId] || [];
  } catch (error) {
    console.error('Failed to get downloadable files from localStorage:', error);
    return [];
  }
};

/**
 * Get all downloadable files for a thread from localStorage
 */
export const getAllDownloadableFilesForThread = (
  threadId: string
): Record<string, DownloadableFile[]> => {
  try {
    const key = getFilesStorageKey(threadId);
    const existing = localStorage.getItem(key);
    if (!existing) return {};
    
    return JSON.parse(existing);
  } catch (error) {
    console.error('Failed to get all downloadable files from localStorage:', error);
    return {};
  }
};

/**
 * Remove downloadable files for a thread from localStorage
 */
export const removeDownloadableFilesFromStorage = (threadId: string): void => {
  try {
    const key = getFilesStorageKey(threadId);
    localStorage.removeItem(key);
    console.log(`🗑️ Removed downloadable files from localStorage for thread ${threadId}`);
  } catch (error) {
    console.error('Failed to remove downloadable files from localStorage:', error);
  }
};

/**
 * Clear all downloadable files from localStorage
 */
export const clearAllDownloadableFilesFromStorage = (): void => {
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(DOWNLOADABLE_FILES_KEY_PREFIX)) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(key => localStorage.removeItem(key));
    console.log(`🗑️ Cleared all downloadable files from localStorage (${keysToRemove.length} threads)`);
  } catch (error) {
    console.error('Failed to clear all downloadable files from localStorage:', error);
  }
};
