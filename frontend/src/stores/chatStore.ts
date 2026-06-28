import { create } from 'zustand';
import { subscribeWithSelector, persist, createJSONStorage } from 'zustand/middleware';
import { useMemo } from 'react';
import {
  sendMessage,
  getThreads,
  getThreadMessages,
  uploadFile,
  deleteThread,
  getPublicHelpText,
  getPublicAboutText,
} from '../lib/api';
import { isAuthError } from '../lib/errorUtils';
import {
  saveDownloadableFilesToStorage,
  getDownloadableFilesFromStorage,
  removeDownloadableFilesFromStorage,
  clearAllDownloadableFilesFromStorage,
  type DownloadableFile,
} from './downloadableFilesStorage';

// Re-export DownloadableFile for backwards compatibility
export type { DownloadableFile } from './downloadableFilesStorage';

// ============================================================================
// TypeScript Interfaces
// ============================================================================

export interface Message {
  id: string;
  content: string;
  role: "user" | "assistant";
  timestamp: Date;
  chartImages?: string[];
  fileNames?: string[];
  fileIds?: string[];
  downloadableFiles?: DownloadableFile[];
  assistant_message_id?: string;
  response_id?: string;
  rating?: "thumbs_up" | "thumbs_down" | null;
  ratingSuccess?: boolean | null;
}

export interface Chat {
  id: string;
  title: string;
  messages: Message[];
  lastUpdated: Date;
  message_count?: number;
  thread_id?: string;
}

// ============================================================================
// Store State Interface
// ============================================================================

interface ChatState {
  // Session Management
  userId: string | null;
  isSessionActive: boolean;
  
  // Thread Management
  currentThreadId: string | null;
  threads: Chat[];
  
  // Message Management
  messages: Message[];
  messageCache: Record<string, Message[]>;
  
  // Title Generation Cache
  titleGenerated: Record<string, boolean>;
  
  // UI State
  isThinking: boolean;
  isStreaming: boolean; // Track if we're currently streaming a response
  isLoadingMessages: boolean;
  isLoadingThreads: boolean;
  deletingThreads: Set<string>; // Track threads being deleted
  
  // File Management
  currentFileId: string | null;
  currentFileName: string | null;
  currentFileSize: number | null;
  currentFileType: string | null;
  isFileUploading: boolean;
  lastResponseId: string | null;
  fileJustUploaded: boolean;  // Track if file was just uploaded vs existing context

  // Help text cache
  helpText: string | null;
  isHelpTextLoading: boolean;

  // About text cache
  aboutText: string | null;
  isAboutTextLoading: boolean;

}

// ============================================================================
// Store Actions Interface
// ============================================================================

interface ChatActions {
  // Session Management
  setUser: (userId: string | null) => void;
  setSessionActive: (active: boolean) => void;
  resetSession: () => void;
  
  // Thread Management
  setCurrentThreadId: (threadId: string | null) => void;
  setThreads: (threads: Chat[]) => void;
  addThread: (thread: Chat) => void;
  updateThread: (threadId: string, updates: Partial<Chat>) => void;
  removeThread: (threadId: string) => void;
  clearThreadsOnAuthError: () => void;
  
  // API Integrated Thread Actions
  loadThreads: (silent?: boolean) => Promise<void>;
  loadThreadMessages: (threadId: string) => Promise<void>;
  deleteChat: (threadId: string) => Promise<void>;
  
  // Message Management
  setMessages: (messages: Message[]) => void;
  addMessage: (message: Message) => void;
  cacheMessages: (threadId: string, messages: Message[]) => void;
  getCachedMessages: (threadId: string) => Message[] | null;
  clearMessageCache: (threadId?: string) => void;
  
  // API Integrated Message Actions
  sendMessageToAPI: (content: string, useStreaming?: boolean, experimentType?: string) => Promise<any>;
  uploadFileForChat: (file: File) => Promise<string>;
  
  // Streaming-specific Message Actions
  updateMessageContent: (messageId: string, content: string) => void;
  appendToMessageContent: (messageId: string, contentChunk: string) => void;
  addStreamingMessage: (message: Omit<Message, 'content'> & { content?: string }) => string;
  addImageToMessage: (messageId: string, imageData: string) => void;
  addImagesToMessage: (messageId: string, imageDataArray: string[]) => void;
  addFilesToMessage: (messageId: string, files: DownloadableFile[]) => void;
  
  // Title Management
  setTitleGenerated: (threadId: string, generated: boolean) => void;
  isTitleGenerated: (threadId: string) => boolean;
  
  // UI State Management
  setThinking: (thinking: boolean) => void;
  setStreaming: (streaming: boolean) => void;
  setLoadingMessages: (loading: boolean) => void;
  setLoadingThreads: (loading: boolean) => void;
  setThreadDeleting: (threadId: string, deleting: boolean) => void;
  
  // File Management
  setCurrentFileId: (fileId: string | null) => void;
  setCurrentFileInfo: (info: {
    fileId: string | null;
    fileName?: string | null;
    fileSize?: number | null;
    fileType?: string | null;
  }) => void;
  setFileUploading: (uploading: boolean) => void;
  clearCurrentFile: () => void;
    setLastResponseId: (responseId: string | null) => void;
    
    // Helper functions for file context and response continuity
    getMostRecentFileId: () => string | null;
    getMostRecentResponseId: () => string | null;   

  // Help text actions
  fetchHelpText: () => Promise<string>;

  // About text actions
  fetchAboutText: () => Promise<string>;

}

// ============================================================================
// Initial State
// ============================================================================

const initialState: ChatState = {
  // Session Management
  userId: null,
  isSessionActive: false,
  
  // Thread Management
  currentThreadId: null,
  threads: [],
  
  // Message Management
  messages: [],
  messageCache: {},
  
  // Title Generation Cache
  titleGenerated: {},
  
  // UI State
  isThinking: false,
  isStreaming: false,
  isLoadingMessages: false,
  isLoadingThreads: false,
  deletingThreads: new Set<string>(),
  
  // File Management
  currentFileId: null,
  currentFileName: null,
  currentFileSize: null,
  currentFileType: null,
  isFileUploading: false,
  lastResponseId: null,
  fileJustUploaded: false,

  // Help text
  helpText: null,
  isHelpTextLoading: false,

  // About text
  aboutText: null,
  isAboutTextLoading: false,
};

// ============================================================================
// Zustand Store
// ============================================================================

export const useChatStore = create<ChatState & ChatActions>()(
  persist(
    subscribeWithSelector((set, get) => ({
    // Initial State
    ...initialState,
    
    // ========================================================================
    // Session Management Actions
    // ========================================================================
    
    setUser: (userId) => {
      console.log('Setting user:', userId);
      set({ 
        userId,
        isSessionActive: !!userId 
      });
    },
    
    setSessionActive: (active) => {
      set({ isSessionActive: active });
    },
    
    resetSession: () => {
      console.log('Resetting session - clearing all state');
      set(() => ({
        ...initialState,
        // Keep session active flag false to indicate we've reset
        isSessionActive: false
      }));
    },
    
    // ========================================================================
    // Thread Management Actions
    // ========================================================================
    
    setCurrentThreadId: (threadId) => {
      set({ currentThreadId: threadId });
    },
    
    setThreads: (threads) => {
      set({ threads });
    },
    
    addThread: (thread) => {
      set((state) => ({
        threads: [thread, ...state.threads],
      }));
    },
    
    updateThread: (threadId, updates) => {
      set((state) => ({
        threads: state.threads.map(thread => 
          thread.id === threadId ? { ...thread, ...updates } : thread
        ),
      }));
    },
    
    removeThread: (threadId) => {
      set((state) => ({
        threads: state.threads.filter(thread => thread.id !== threadId),
      }));
      
      // Clear associated data
      get().clearMessageCache(threadId);
      
      // Clear downloadable files from localStorage
      removeDownloadableFilesFromStorage(threadId);
      
      // Clear current thread if it was removed
      if (get().currentThreadId === threadId) {
        set({ currentThreadId: null, messages: [] });
      }
    },

    clearThreadsOnAuthError: () => {
      console.log('🔑 Session expired - clearing cached threads');
      set({ 
        threads: [], 
        currentThreadId: null,
        messages: [],
        isSessionActive: false
      });
      // Clear all cached messages since session is invalid
      get().clearMessageCache();
      // Clear all downloadable files from localStorage
      clearAllDownloadableFilesFromStorage();
    },
    
    // ========================================================================
    // Message Management Actions
    // ========================================================================
    
    setMessages: (messages) => {
      set({ messages });
    },
    
    addMessage: (message) => {
      set((state) => ({
        messages: [...state.messages, message]
      }));
      
      // Auto-cache messages for current thread
      const currentThreadId = get().currentThreadId;
      if (currentThreadId) {
        const updatedMessages = [...get().messages];
        get().cacheMessages(currentThreadId, updatedMessages);
      }
    },
    
    cacheMessages: (threadId, messages) => {
      set((state) => ({
        messageCache: {
          ...state.messageCache,
          [threadId]: messages
        }
      }));
    },
    
    getCachedMessages: (threadId) => {
      return get().messageCache[threadId] || null;
    },
    
    clearMessageCache: (threadId) => {
      if (threadId) {
        // Clear specific thread cache
        set((state) => {
          const newCache = { ...state.messageCache };
          delete newCache[threadId];
          return { messageCache: newCache };
        });
      } else {
        // Clear all cache
        set({ messageCache: {} });
      }
    },
    
    // ========================================================================
    // Streaming-specific Message Actions
    // ========================================================================
    
    updateMessageContent: (messageId, content) => {
      set((state) => ({
        messages: state.messages.map(msg => 
          msg.id === messageId ? { ...msg, content } : msg
        )
      }));
      
      // Also update cached messages for current thread
      const currentThreadId = get().currentThreadId;
      if (currentThreadId) {
        const cachedMessages = get().getCachedMessages(currentThreadId);
        if (cachedMessages) {
          const updatedCache = cachedMessages.map(msg => 
            msg.id === messageId ? { ...msg, content } : msg
          );
          get().cacheMessages(currentThreadId, updatedCache);
        }
      }
    },
    
    appendToMessageContent: (messageId, contentChunk) => {
      set((state) => ({
        messages: state.messages.map(msg => 
          msg.id === messageId 
            ? { 
                ...msg, 
                content: msg.content.endsWith('|') 
                  ? msg.content.slice(0, -1) + contentChunk + '|'  // Insert before |
                  : msg.content + contentChunk  // Normal append if no |
              }
            : msg
        )
      }));
      
      // Also update cached messages for current thread
      const currentThreadId = get().currentThreadId;
      if (currentThreadId) {
        const cachedMessages = get().getCachedMessages(currentThreadId);
        if (cachedMessages) {
          const updatedCache = cachedMessages.map(msg => 
            msg.id === messageId 
              ? { 
                  ...msg, 
                  content: msg.content.endsWith('|') 
                    ? msg.content.slice(0, -1) + contentChunk + '|'  // Insert before |
                    : msg.content + contentChunk  // Normal append if no |
                }
              : msg
          );
          get().cacheMessages(currentThreadId, updatedCache);
        }
      }
    },
    
    addStreamingMessage: (message) => {
      const streamingMessage: Message = {
        content: '', // Start with empty content
        ...message,
      };
      
      get().addMessage(streamingMessage);
      return streamingMessage.id;
    },
    
    addImageToMessage: (messageId, imageData) => {
      console.log(`📊 [FRONTEND] addImageToMessage called for message: ${messageId}`);

      // Get current message state
      const currentMsg = get().messages.find(m => m.id === messageId);
      const currentChartImages = currentMsg?.chartImages || [];
      console.log(`   Current chart images count: ${currentChartImages.length}`);

      set((state) => ({
        messages: state.messages.map(msg => 
          msg.id === messageId 
            ? { 
                ...msg, 
                chartImages: Array.from(new Set([...(msg.chartImages || []), imageData]))
              }
            : msg
        )
      }));

      // Check after update
      const updatedMsg = get().messages.find(m => m.id === messageId);
      const updatedChartImages = updatedMsg?.chartImages || [];
      console.log(`   Updated chart images count: ${updatedChartImages.length}`);

      // Also update cached messages for current thread
      const currentThreadId = get().currentThreadId;
      if (currentThreadId) {
        const cachedMessages = get().getCachedMessages(currentThreadId);
        if (cachedMessages) {
          const updatedCache = cachedMessages.map(msg => 
            msg.id === messageId 
              ? { 
                  ...msg, 
                  chartImages: Array.from(new Set([...(msg.chartImages || []), imageData]))
                }
              : msg
          );
          get().cacheMessages(currentThreadId, updatedCache);
        }
      }
    },
    
    addImagesToMessage: (messageId, imageDataArray) => {
      console.log(`📊 [FRONTEND] addImagesToMessage called for message: ${messageId}`);
      console.log(`   Received ${imageDataArray.length} images to add`);

      // Get current message state
      const currentMsg = get().messages.find(m => m.id === messageId);
      const currentChartImages = currentMsg?.chartImages || [];
      console.log(`   Current chart images count: ${currentChartImages.length}`);

      // Check for duplicates in incoming array
      const uniqueIncoming = new Set(imageDataArray);
      if (uniqueIncoming.size !== imageDataArray.length) {
        console.log(`   ⚠️  WARNING: Incoming imageDataArray contains DUPLICATES!`);
        console.log(`      Received: ${imageDataArray.length}, Unique: ${uniqueIncoming.size}`);
      }

      set((state) => ({
        messages: state.messages.map(msg => 
          msg.id === messageId 
            ? { 
                ...msg, 
                chartImages: Array.from(new Set([...(msg.chartImages || []), ...imageDataArray]))
              }
            : msg
        )
      }));

      // Check after update
      const updatedMsg = get().messages.find(m => m.id === messageId);
      const updatedChartImages = updatedMsg?.chartImages || [];
      console.log(`   Updated chart images count: ${updatedChartImages.length}`);

      if (updatedChartImages.length !== currentChartImages.length + imageDataArray.length) {
        console.log(`   ℹ️  Some images were deduplicated by Set`);
      }

      // Also update cached messages for current thread
      const currentThreadId = get().currentThreadId;
      if (currentThreadId) {
        const cachedMessages = get().getCachedMessages(currentThreadId);
        if (cachedMessages) {
          const updatedCache = cachedMessages.map(msg => 
            msg.id === messageId 
              ? { 
                  ...msg, 
                  chartImages: Array.from(new Set([...(msg.chartImages || []), ...imageDataArray]))
                }
              : msg
          );
          get().cacheMessages(currentThreadId, updatedCache);
        }
      }
    },

    addFilesToMessage: (messageId, files) => {
      console.log(`📁 [FRONTEND] addFilesToMessage called for message: ${messageId}`);
      console.log(`   Received ${files.length} files to add`);

      set((state) => ({
        messages: state.messages.map(msg => 
          msg.id === messageId 
            ? { 
                ...msg, 
                downloadableFiles: [...(msg.downloadableFiles || []), ...files]
              }
            : msg
        )
      }));

      // Also update cached messages for current thread
      // Note: We don't save to localStorage here because we need to wait for the permanent
      // assistant_message_id from response_metadata. The localStorage save happens after
      // receiving response_metadata in sendMessageToAPI.
      const currentThreadId = get().currentThreadId;
      if (currentThreadId) {
        const cachedMessages = get().getCachedMessages(currentThreadId);
        if (cachedMessages) {
          const updatedCache = cachedMessages.map(msg => 
            msg.id === messageId 
              ? { 
                  ...msg, 
                  downloadableFiles: [...(msg.downloadableFiles || []), ...files]
                }
              : msg
          );
          get().cacheMessages(currentThreadId, updatedCache);
        }
      }
    },
    
    // ========================================================================
    // Title Management Actions
    // ========================================================================
    
    setTitleGenerated: (threadId, generated) => {
      set((state) => ({
        titleGenerated: {
          ...state.titleGenerated,
          [threadId]: generated
        }
      }));
    },
    
    isTitleGenerated: (threadId) => {
      return get().titleGenerated[threadId] || false;
    },
    
    // ========================================================================
    // UI State Management Actions
    // ========================================================================
    
    setThinking: (thinking) => {
      set({ isThinking: thinking });
    },
    
    setStreaming: (streaming) => {
      set({ isStreaming: streaming });
    },
    
    setLoadingMessages: (loading) => {
      set({ isLoadingMessages: loading });
    },
    
    setLoadingThreads: (loading) => {
      set({ isLoadingThreads: loading });
    },
    
    setThreadDeleting: (threadId, deleting) => {
      set((state) => {
        const newDeletingThreads = new Set(state.deletingThreads);
        if (deleting) {
          newDeletingThreads.add(threadId);
        } else {
          newDeletingThreads.delete(threadId);
        }
        return { deletingThreads: newDeletingThreads };
      });
    },
    
    // ========================================================================
    // File Management Actions
    // ========================================================================
    
    setCurrentFileId: (fileId) => {
      console.log('Setting current file ID:', fileId);
      set({ currentFileId: fileId });
    },
    
    setCurrentFileInfo: (info) => {
      console.log('Setting current file info:', info);
      set({
        currentFileId: info.fileId,
        currentFileName: info.fileName !== undefined ? info.fileName : get().currentFileName,
        currentFileSize: info.fileSize !== undefined ? info.fileSize : get().currentFileSize,
        currentFileType: info.fileType !== undefined ? info.fileType : get().currentFileType,
        fileJustUploaded: true  // Mark as just uploaded
      });
    },
    
    setFileUploading: (uploading) => {
      set({ isFileUploading: uploading });
    },
    
    clearCurrentFile: () => {
      console.log('Clearing current file');
      set({
        currentFileId: null,
        currentFileName: null,
        currentFileSize: null,
        currentFileType: null,
        isFileUploading: false,
        fileJustUploaded: false,
      });
    },
    
    setLastResponseId: (responseId) => {
      set({ lastResponseId: responseId });
    },

    // Helper functions for file context
    getMostRecentFileId: (): string | null => {
      const currentThreadId = get().currentThreadId;
      if (!currentThreadId) return null;
      
      const messages = get().getCachedMessages(currentThreadId) || get().messages;
      
      // Look through messages in reverse order (most recent first)
      for (let i = messages.length - 1; i >= 0; i--) {
        const message = messages[i];
        if (message && message.fileIds && message.fileIds.length > 0) {
          return message.fileIds[0] || null; // Return the first (most recent) file ID
        }
      }
      return null;
    },
    
    getMostRecentResponseId: (): string | null => {
      const currentThreadId = get().currentThreadId;
      if (!currentThreadId) return null;
      
      const messages = get().getCachedMessages(currentThreadId) || get().messages;
      
      // Look through messages in reverse order (most recent first)
      for (let i = messages.length - 1; i >= 0; i--) {
        const message = messages[i];
        if (message && message.role === "assistant" && message.response_id) {
          return message.response_id;
        }
      }
      return null;
    },
    
    // ========================================================================
    // Help Text
    // ========================================================================
    fetchHelpText: async () => {
      if (get().helpText) return get().helpText as string;
      try {
        set({ isHelpTextLoading: true });
        const res = await getPublicHelpText();
        const text = res?.help_text || '';
        set({ helpText: text });
        return text;
      } catch (e) {
        console.error('Failed to fetch help text', e);
        set({ helpText: '' });
        return '';
      } finally {
        set({ isHelpTextLoading: false });
      }
    },

    // ========================================================================
    // About Text
    // ========================================================================
    fetchAboutText: async () => {
      if (get().aboutText) return get().aboutText as string;
      try {
        set({ isAboutTextLoading: true });
        const res = await getPublicAboutText();
        const text = res?.about_text || '';
        set({ aboutText: text });
        return text;
      } catch (e) {
        console.error('Failed to fetch about text', e);
        set({ aboutText: '' });
        return '';
      } finally {
        set({ isAboutTextLoading: false });
      }
    },
    
    
    // ========================================================================
    // API Integrated Thread Actions
    // ========================================================================
    
    loadThreads: async (silent = false) => {
      const currentThreads = get().threads;
      
      // Only show loading if we don't have any persisted threads AND it's not a silent refresh
      if (!silent && currentThreads.length === 0) {
        get().setLoadingThreads(true);
      }
      
      try {
        console.log(silent ? 'Silently refreshing threads from API...' : 'Loading threads from API...');
        // Use admin_settings_id = 1 for control
        const response = await getThreads(1);
        
        if (response && response.threads && Array.isArray(response.threads)) {
          const formattedChats: Chat[] = response.threads.map((thread: any) => ({
            id: thread.id,
            title: thread.title || "Untitled Conversation",
            messages: [], // Empty - messages loaded only when chat is selected
            lastUpdated: new Date(thread.updated_at),
            message_count: thread.message_count,
            thread_id: thread.id,
          }));
          
          console.log('Loaded threads:', formattedChats.length, silent ? '(silent update)' : '');
          get().setThreads(formattedChats);
        }
      } catch (error) {
        console.error("Failed to load threads:", error);
        
        // Check if this is a 401 auth error and clear threads
        if (isAuthError(error)) {
          get().clearThreadsOnAuthError();
        }
        
        throw error;
      } finally {
        // Only stop loading if we were showing loading in the first place
        if (!silent || currentThreads.length === 0) {
          get().setLoadingThreads(false);
        }
      }
    },
    
    loadThreadMessages: async (threadId: string) => {
      // Check if we already have messages cached for this thread
      const cached = get().getCachedMessages(threadId);
      if (cached) {
        console.log("Using cached messages for thread:", threadId);
        get().setMessages(cached);
        get().setCurrentThreadId(threadId);
        return;
      }

      // Avoid duplicate loads - check if we're already loading this thread
      if (threadId === get().currentThreadId && get().isLoadingMessages) {
        console.log("Already loading messages for thread:", threadId);
        return;
      }

      get().setLoadingMessages(true);
      try {
        console.log('Loading messages for thread:', threadId);
        const response = await getThreadMessages(threadId);
        console.log('Response:', response);
        if (response && response.messages && Array.isArray(response.messages)) {
          const parsedMessages: Message[] = response.messages.map((msg: any) => {
            let content = "";

            // Extract content based on message type
            if (msg.role === "user") {
              content = msg.content?.text || msg.content || "";
            } else if (msg.role === "assistant") {
              // For assistant messages, extract from the complex nested structure
              if (
                msg.content &&
                msg.content.output &&
                Array.isArray(msg.content.output)
              ) {
                // Collect all message content from the output array
                const messageContents: string[] = [];
                console.log(`Loading message ${msg.id}: processing ${msg.content.output.length} output items`);
                
                for (let i = 0; i < msg.content.output.length; i++) {
                  const outputItem = msg.content.output[i];
                  console.log(`  Output item ${i + 1}: type="${outputItem.type}"`);
                  
                  if (
                    outputItem.type === "message" &&
                    outputItem.content &&
                    Array.isArray(outputItem.content)
                  ) {
                    const messageText = outputItem.content
                      .map((c: any) => c.text || "")
                      .join("")
                      .trim();
                    
                    console.log(`    Message ${i + 1} content length: ${messageText.length}`);
                    
                    if (messageText) {
                      messageContents.push(messageText);
                    }
                  }
                }
                
                console.log(`  Found ${messageContents.length} message contents to combine for loaded message`);
                
                // Join all message contents with newlines
                if (messageContents.length > 0) {
                  content = messageContents.join("\n\n");
                  console.log(`  Combined loaded message content length: ${content.length}`);
                }
              } else if (msg.content?.text) {
                content = msg.content.text;
              } else if (typeof msg.content === "string") {
                content = msg.content;
              }
            }

            // Get downloadable files from localStorage (no longer stored in DB)
            const localStorageFiles = getDownloadableFilesFromStorage(threadId, msg.id);
            
            return {
              id: msg.id,
              content,
              role: msg.role,
              timestamp: new Date(msg.created_at),
              chartImages: Array.from(new Set(msg.content?.chart_outputs || [])),
              fileNames: msg.uploaded_file_names || [],
              fileIds: msg.uploaded_file_ids || [],
              downloadableFiles: localStorageFiles,
              assistant_message_id: msg.assistant_message_id,
              response_id: msg.content?.id || null,
              rating: msg.rating || null,
              ratingSuccess: msg.rating_success || null,
            };
          });

          console.log("Parsed messages:", parsedMessages.length);

          // Cache the messages for this thread
          get().cacheMessages(threadId, parsedMessages);

          // Update thread-scoped messages
          get().setMessages(parsedMessages);
          get().setCurrentThreadId(threadId);

          // Set the last response ID from the most recent assistant message for thread continuity
          const lastAssistantMessage = parsedMessages
            .filter((msg) => msg.role === "assistant")
            .pop();
          if (lastAssistantMessage?.assistant_message_id) {
            get().setLastResponseId(lastAssistantMessage.assistant_message_id);
          }

          // Generate title only if message count is exactly 3 and title hasn't been generated yet
          if (parsedMessages.length === 3 && !get().isTitleGenerated(threadId)) {
            const firstUserMessage = parsedMessages.find(
              (msg) => msg.role === "user",
            );
            if (firstUserMessage && firstUserMessage.content) {
              const messageText = firstUserMessage.content;
              const chatTitle =
                messageText.length > 50
                  ? messageText.substring(0, 50) + "..."
                  : messageText;

              // Mark title as generated for this thread
              get().setTitleGenerated(threadId, true);

              // Update the thread title
              get().updateThread(threadId, { title: chatTitle });
            }
          }
        }
      } catch (error) {
        console.error("Failed to load thread messages2222:", error);
        
        // Check if this is a 401 auth error and clear threads
        if (isAuthError(error)) {
          get().clearThreadsOnAuthError();
        }
        
        throw error;
      } finally {
        get().setLoadingMessages(false);
      }
    },
    

    deleteChat: async (threadId: string) => {
      try {
        // Set thread as deleting (grey out in UI)
        get().setThreadDeleting(threadId, true);
        
        await deleteThread(threadId);
        get().removeThread(threadId);
        console.log(`Chat ${threadId} deleted successfully`);
      } catch (error) {
        console.error("Failed to delete chat:", error);
        // Clear deleting state on error so user can retry
        get().setThreadDeleting(threadId, false);
        
        // Check if this is a 401 auth error and clear threads
        if (isAuthError(error)) {
          get().clearThreadsOnAuthError();
        }
        
        throw error;
      } finally {
        // Clear deleting state (in case of success, thread should be removed anyway)
        get().setThreadDeleting(threadId, false);
      }
    },
    
    // ========================================================================
    // API Integrated Message Actions
    // ========================================================================
    
    sendMessageToAPI: async (content: string, useStreaming = true, experimentType = "control") => {
      // Set thinking state BEFORE adding user message to prevent MessageList from hiding it
      get().setThinking(true);
      
      // Create user message immediately  
      const currentFileName = get().currentFileName;
      const fileJustUploaded = get().fileJustUploaded;
      
      const userMessage: Message = {
        id: Date.now().toString(),
        content,
        role: "user",
        timestamp: new Date(),
        // Only show filename if this message had the file upload
        ...(fileJustUploaded && currentFileName && { fileNames: [currentFileName] }),
      };

      // / Pre-create empty assistant message immediately (eliminates thinking gap)
      const assistantMessageId = (Date.now() + 1).toString();
      const emptyAssistantMessage: Message = {
        id: assistantMessageId,
        content: '|', // Start with cursor, will show thinking until first chunk
        role: "assistant",
        timestamp: new Date(),
      };

      // Add user message to current thread
      get().addMessage(userMessage);
      
      get().addMessage(emptyAssistantMessage);
      
      try {
        console.log("Sending message with currentFileId:", get().currentFileId);
        let effectiveFileId = get().currentFileId;
        let effectiveResponseId = get().getMostRecentResponseId();
        
        // If no current file context, try to get most recent from message history
        if (!effectiveFileId) {
          effectiveFileId = get().getMostRecentFileId();
          console.log("Using fallback file context - fileId:", effectiveFileId);
        }
        
        // // If no current response ID, try to get most recent from message history
        // if (!effectiveResponseId) {
        //   effectiveResponseId = get().getMostRecentResponseId();
        //   console.log("Using fallback response context - responseId:", effectiveResponseId);
        // }
        
        const currentThreadId = get().currentThreadId;
        
        const response = await sendMessage({
          user_message: content,
          // Always send file_id for OpenAI context (if exists)
          ...(effectiveFileId && { existing_file_id: effectiveFileId }),
          // Only send file_name for database storage when newly uploaded
          ...(fileJustUploaded && currentFileName && { file_name: currentFileName }),
          // Always send response_id for conversation continuity (current or fallback)
          ...(effectiveResponseId && { previous_response_id: effectiveResponseId }),
          ...(currentThreadId && { thread_id: currentThreadId }),
          stream: useStreaming,
          experiment_type: experimentType,
        });
        
        // Reset fileJustUploaded after sending message
        if (fileJustUploaded) {
          set({ fileJustUploaded: false });
        }
        
        // Handle streaming vs non-streaming responses
        if (useStreaming && response && typeof response === 'object' && 'read' in response) {
          // Streaming response - response is a ReadableStreamDefaultReader
          console.log("Processing streaming response");
          
          // Set streaming state for continuous scrolling
          get().setStreaming(true);
          
          // Use the pre-created assistant message (no need to create new one)
          // Keep thinking state TRUE until we receive first chunk
          // (setThinking was set to true at the start of sendMessageToAPI)
          
          const decoder = new TextDecoder();
          let fullResponse = '';
          let firstChunkReceived = false;
          // SSE buffering
          let sseBuffer = '';
          let responseMetadata:any = null;
          
          try {
            // Read stream chunks
            while (true) {
              const { done, value } = await response.read();
              if (done) break;
              
              // Decode the chunk and append to SSE buffer
              const chunk = decoder.decode(value, { stream: true });
              sseBuffer += chunk;

              // Process complete SSE events delimited by double newlines
              while (true) {
                const sepIndex = sseBuffer.indexOf('\n\n');
                if (sepIndex === -1) break;

                const eventBlock = sseBuffer.slice(0, sepIndex);
                sseBuffer = sseBuffer.slice(sepIndex + 2);

                const lines = eventBlock.split('\n');
                const dataLines: string[] = [];
                for (const line of lines) {
                  if (line.startsWith('data:')) {
                    dataLines.push(line.slice(5).trimStart());
                  }
                }

                if (dataLines.length === 0) {
                  continue;
                }

                const dataPayload = dataLines.join('\n');
                try {
                  const evt = JSON.parse(dataPayload);
                  const evtType = evt?.type;
                  if (evtType === 'text') {
                    const delta: string = typeof evt.data === 'string' ? evt.data : '';
                    if (delta.length > 0) {
                      if (!firstChunkReceived) {
                        get().setThinking(false);
                        firstChunkReceived = true;
                      }
                      fullResponse += delta;
                      get().appendToMessageContent(assistantMessageId, delta);
                    }
                  } else if (evtType === 'image') {
                    console.log('🖼️  [FRONTEND] Received SSE event type="image" (singular)');
                    console.log('   Adding 1 image to message:', assistantMessageId);
                    get().addImageToMessage(assistantMessageId, evt.data);
                  } else if (evtType === 'images') {
                    console.log('🖼️  [FRONTEND] Received SSE event type="images" (plural)');
                    if (Array.isArray(evt.data)) {
                      console.log(`   Received ${evt.data.length} images`);
                      console.log(`   Adding ${evt.data.length} images to message:`, assistantMessageId);
                      get().addImagesToMessage(assistantMessageId, evt.data);
                    } else {
                      console.log('   ⚠️  WARNING: evt.data is not an array!', typeof evt.data);
                    }
                  // } else if (evtType === 'code_output') {
                  //   const logs: string = typeof evt.data === 'string' ? evt.data : '';
                  //   if (logs.length > 0) {
                  //     if (!firstChunkReceived) {
                  //       get().setThinking(false);
                  //       firstChunkReceived = true;
                  //     }
                  //     const codeBlock = '\n```\n' + logs + '\n```\n';
                  //     fullResponse += codeBlock;
                  //     get().appendToMessageContent(assistantMessageId, codeBlock);
                  //   }
                  } else if (evtType === 'files') {
                    console.log('📁 [FRONTEND] Received SSE event type="files"');
                    if (Array.isArray(evt.data)) {
                      console.log(`   Received ${evt.data.length} downloadable files`);
                      get().addFilesToMessage(assistantMessageId, evt.data);
                    } else {
                      console.log('   ⚠️  WARNING: evt.data is not an array!', typeof evt.data);
                    }
                  } else if (evtType === 'response_metadata') {
                    responseMetadata = evt.data;
                  }
                } catch (e) {
                  console.log('SSE JSON parse failed:', e);
                }
              }
            }
            
            console.log(`Streaming complete. Total content length: ${fullResponse.length}`);
            
            // Remove trailing cursor from message content
            const currentMessage = get().messages.find(msg => msg.id === assistantMessageId);
            if (currentMessage && currentMessage.content.endsWith('|')) {
              get().updateMessageContent(assistantMessageId, currentMessage.content.slice(0, -1));
            }
            
            // Stop streaming state
            get().setStreaming(false);
            
            // Handle metadata from streaming response
            if (responseMetadata) {
              
              // Store the response_id for the next message (thread continuity)
              if (responseMetadata.id) {
                get().setLastResponseId(responseMetadata.id);
              }

              // Update thread ID if this is a new thread
              if (responseMetadata.thread_id && !get().currentThreadId) {
                get().setCurrentThreadId(responseMetadata.thread_id);
                
                // Add new thread to threads list
                const newThread: Chat = {
                  id: responseMetadata.thread_id,
                  title: "New Chat",
                  messages: [],
                  lastUpdated: new Date(),
                  thread_id: responseMetadata.thread_id,
                };
                get().addThread(newThread);
              }

              // Update assistant message with additional metadata
              if (responseMetadata.assistant_message_id) {
                const messageIndex = get().messages.findIndex(msg => msg.id === assistantMessageId);
                if (messageIndex !== -1) {
                  // Get current message to check for downloadable files
                  const currentMsg = get().messages[messageIndex];
                  
                  set((state) => ({
                    messages: state.messages.map((msg, idx) => 
                      idx === messageIndex ? {
                        ...msg,
                        assistant_message_id: responseMetadata.assistant_message_id,
                        response_id: responseMetadata.id || null,
                      } : msg
                    )
                  }));
                  
                  // Save downloadable files to localStorage with the PERMANENT assistant_message_id
                  // This ensures files can be retrieved after page refresh
                  const threadId = responseMetadata.thread_id || get().currentThreadId;
                  if (threadId && currentMsg?.downloadableFiles && currentMsg.downloadableFiles.length > 0) {
                    console.log(`💾 Saving ${currentMsg.downloadableFiles.length} files to localStorage with permanent ID: ${responseMetadata.assistant_message_id}`);
                    saveDownloadableFilesToStorage(threadId, responseMetadata.assistant_message_id, currentMsg.downloadableFiles);
                  }
                }
              }

              const finalResponse = {
                id: assistantMessageId,
                content: fullResponse,
                thread_id: responseMetadata.thread_id,
                user_id: responseMetadata.user_id,
                assistant_message_id: responseMetadata.assistant_message_id,
                response_id: responseMetadata.id,
              };

              // Check if we should generate a title (when message count reaches 3)
              const finalThreadId = responseMetadata.thread_id || get().currentThreadId;
              if (finalThreadId) {
                const currentMessages = get().getCachedMessages(finalThreadId) || get().messages;
                if (currentMessages.length === 3 && !get().isTitleGenerated(finalThreadId)) {
                  // Generate title from first user message
                  const firstUserMessage = currentMessages.find(
                    (msg) => msg.role === "user",
                  );
                  if (firstUserMessage && firstUserMessage.content) {
                    const messageText = firstUserMessage.content;
                    const newTitle =
                      messageText.length > 50
                        ? messageText.substring(0, 50) + "..."
                        : messageText;

                    // Mark title as generated for this thread
                    get().setTitleGenerated(finalThreadId, true);

                    // Update the thread title
                    get().updateThread(finalThreadId, { title: newTitle });
                  }
                }
              }

              // Reload threads if this was a new thread (silent refresh)
              if (responseMetadata.thread_id && !get().currentThreadId) {
                await get().loadThreads(true); // Silent since we already have threads
              }

              return finalResponse;
            } else {
              // Fallback for streaming responses without metadata
              return {
                id: assistantMessageId,
                content: fullResponse,
              };
            }
            
          } catch (streamError) {
            console.error("Streaming error:", streamError);
            // Update message with error and stop thinking and streaming
            get().updateMessageContent(assistantMessageId, "Error receiving streaming response. Please try again.");
            get().setThinking(false);
            get().setStreaming(false);
            throw streamError;
          }
          
        } else {
          // Non-streaming response - handle as JSON
          console.log("Processing non-streaming JSON response:", response);
          
          // Extract response content and charts (existing logic)
        let responseContent = "No response received";
        let chartImages: string[] | undefined;

        if (response) {
          // Handle the specific response structure from backend
          if (response.output && Array.isArray(response.output)) {
            // Collect all message content in the output array
            const messageContents: string[] = [];
            console.log(`Processing ${response.output.length} output items from response`);
            
            for (let i = 0; i < response.output.length; i++) {
              const outputItem = response.output[i];
              console.log(`Output item ${i + 1}: type="${outputItem.type}"`);
              
              if (
                outputItem.type === "message" &&
                outputItem.content &&
                Array.isArray(outputItem.content)
              ) {
                // Extract text from the message content
                const messageText = outputItem.content
                  .map((c: any) => c.text || "")
                  .join("")
                  .trim();
                
                console.log(`Message ${i + 1} content length: ${messageText.length}`);
                
                if (messageText) {
                  messageContents.push(messageText);
                }
              }
            }
            
            console.log(`Found ${messageContents.length} message contents to combine`);
            
            // Join all message contents with newlines
            if (messageContents.length > 0) {
              responseContent = messageContents.join("\n\n");
              console.log(`Combined response content length: ${responseContent.length}`);
            }
          } else if (response.text && typeof response.text === "string") {
            responseContent = response.text;
          } else if (typeof response === "string") {
            responseContent = response;
          }

          if (response.chart_outputs && Array.isArray(response.chart_outputs)) {
            chartImages = Array.from(new Set(response.chart_outputs));
          }

          // Append code interpreter stdout (tables, printed output) as code blocks
          // if (response.code_interpreter_logs && Array.isArray(response.code_interpreter_logs)) {
          //   const logsBlock = response.code_interpreter_logs
          //     .map((log: string) => '```\n' + log + '\n```')
          //     .join('\n\n');
          //   if (logsBlock) {
          //     responseContent = responseContent
          //       ? responseContent + '\n\n' + logsBlock
          //       : logsBlock;
          //   }
          // }
        }

          // Update the pre-created assistant message with actual content
          get().updateMessageContent(assistantMessageId, responseContent);
          
          // Update the pre-created message with additional data
          const currentMessages = get().messages;
          const messageIndex = currentMessages.findIndex(msg => msg.id === assistantMessageId);
          if (messageIndex !== -1) {
            set((state) => ({
              messages: state.messages.map((msg, idx) => 
                idx === messageIndex ? {
                  ...msg,
          ...(chartImages && { chartImages }),
          assistant_message_id: response.assistant_message_id,
          response_id: response.id || null,
                } : msg
              )
            }));
          }
        
        // Clear thinking state immediately since we have the response
        get().setThinking(false);

        // Store the response_id for the next message (thread continuity)
        if (response.id) {
          get().setLastResponseId(response.id);
        }

        // Update thread ID if this is a new thread
        if (response.thread_id && !get().currentThreadId) {
          get().setCurrentThreadId(response.thread_id);
          
          // Add new thread to threads list
          const newThread: Chat = {
            id: response.thread_id,
            title: "New Chat",
            messages: [],
            lastUpdated: new Date(),
            thread_id: response.thread_id,
          };
          get().addThread(newThread);
        }

        // Check if we should generate a title (when message count reaches 3)
        const finalThreadId = response.thread_id || get().currentThreadId;
        if (finalThreadId) {
          const currentMessages = get().getCachedMessages(finalThreadId) || get().messages;
          if (currentMessages.length === 3 && !get().isTitleGenerated(finalThreadId)) {
            // Generate title from first user message
            const firstUserMessage = currentMessages.find(
              (msg) => msg.role === "user",
            );
            if (firstUserMessage && firstUserMessage.content) {
              const messageText = firstUserMessage.content;
              const newTitle =
                messageText.length > 50
                  ? messageText.substring(0, 50) + "..."
                  : messageText;

              // Mark title as generated for this thread
              get().setTitleGenerated(finalThreadId, true);

              // Update the thread title
              get().updateThread(finalThreadId, { title: newTitle });
            }
          }
        }

        // Reload threads if this was a new thread (silent refresh)
        if (response.thread_id && !get().currentThreadId) {
          await get().loadThreads(true); // Silent since we already have threads
        }

        // Return response for navigation
        return response;
        }
      } catch (error) {
        console.error("Failed to send message:", error);

        // Determine specific error message based on error type
        let errorContent = "Sorry, I encountered an error. Please try again.";

        if (error instanceof Error) {
          if (
            error.message.includes("quota") ||
            error.message.includes("429")
          ) {
            errorContent =
              "⚠️ OpenAI API quota exceeded. Please check your OpenAI account billing and usage limits at https://platform.openai.com/account/billing";
          } else if (
            error.message.includes("401") ||
            error.message.includes("unauthorized")
          ) {
            errorContent =
              "🔑 Session expired. Please refresh the page to continue.";
            // Clear threads on auth error  
            get().clearThreadsOnAuthError();
          } else if (error.message.includes("500")) {
            errorContent = "🔧 Server error. Please try again in a moment.";
          }
        }

        // Update the pre-created assistant message with error content  
        get().updateMessageContent(assistantMessageId, errorContent);
        get().setThinking(false);
        get().setStreaming(false);
        
        throw error;
      }
    },
    
    uploadFileForChat: async (file: File) => {
      try {
        console.log('Uploading file:', file.name, 'Size:', file.size, 'Type:', file.type);
        
        // Set uploading state
        get().setFileUploading(true);
        
        // Upload file to backend
        const fileId = await uploadFile(file);
        
        // Store complete file information
        get().setCurrentFileInfo({
          fileId,
          fileName: file.name,
          fileSize: file.size,
          fileType: file.type || 'unknown',
        });
        
        console.log('File upload successful - ID:', fileId);
        return fileId;
      } catch (error) {
        console.error("Failed to upload file:", error);
        // Clear file state on error
        get().clearCurrentFile();
        
        // Check if this is a 401 auth error and clear threads
        if (isAuthError(error)) {
          get().clearThreadsOnAuthError();
        }
        
        throw error;
      } finally {
        // Always clear uploading state
        get().setFileUploading(false);
      }
    },
  })),
  {
    name: 'ncie-chat-storage', // unique name for localStorage key
    storage: createJSONStorage(() => localStorage),
    partialize: (state) => ({
      // Persist these values
      userId: state.userId,
      isSessionActive: state.isSessionActive,
      threads: state.threads,
      titleGenerated: state.titleGenerated,
      
      // Don't persist currentThreadId - URL should be source of truth
      
      // Don't persist these (they should be fresh on reload)
      // messages: [], 
      // messageCache: {},
      // isThinking: false,
      // isLoadingMessages: false,
      // isLoadingThreads: false,
      // deletingThreads: new Set(),
      // currentFileId: null,
      // currentFileName: null,
      // currentFileSize: null,
      // currentFileType: null,
      // isFileUploading: false,
      // lastResponseId: null,
    }),
    version: 1,
    onRehydrateStorage: () => (state, error) => {
      if (error) {
        console.error('Failed to rehydrate chat storage:', error);
        return;
      }
      
      if (state) {
        console.log('Chat storage rehydrated:', {
          userId: state.userId,
          threadsCount: state.threads.length,
        });
        
        // Clear any stale file upload state that might have been left over
        state.clearCurrentFile();
      }
    },
  }
))

// ============================================================================
// Session Management Subscription
// ============================================================================

// Subscribe to user ID changes for automatic session management
useChatStore.subscribe(
  (state) => state.userId,
  (userId, previousUserId) => {
    console.log('User ID changed:', { previousUserId, userId });
    
    // If we had a user and now we don't, reset the session
    if (previousUserId && !userId) {
      console.log('Session ended - triggering reset');
      useChatStore.getState().resetSession();
    }
    
    // If we now have a user, mark session as active
    if (userId) {
      console.log('Session started for user:', userId);
      useChatStore.getState().setSessionActive(true);
    }
  }
);

// ============================================================================
// Utility Hooks
// ============================================================================

// Convenience hook for session management
export const useSession = () => {
  const userId = useChatStore((state) => state.userId);
  const isSessionActive = useChatStore((state) => state.isSessionActive);
  const setUser = useChatStore((state) => state.setUser);
  const resetSession = useChatStore((state) => state.resetSession);
  
  // Memoize the endSession helper to prevent new function on each render
  const endSession = useMemo(() => () => setUser(null), [setUser]);
  
  return {
    userId,
    isSessionActive,
    setUser,
    resetSession,
    endSession,
  };
};

// Fixed hook for thread management - no infinite re-renders
export const useThreads = () => {
  // Individual selectors to avoid creating new objects
  const currentThreadId = useChatStore((state) => state.currentThreadId);
  const threads = useChatStore((state) => state.threads);
  const isLoadingThreads = useChatStore((state) => state.isLoadingThreads);
  const deletingThreads = useChatStore((state) => state.deletingThreads);
  const setCurrentThreadId = useChatStore((state) => state.setCurrentThreadId);
  const setThreads = useChatStore((state) => state.setThreads);
  const addThread = useChatStore((state) => state.addThread);
  const updateThread = useChatStore((state) => state.updateThread);
  const removeThread = useChatStore((state) => state.removeThread);
  const loadThreads = useChatStore((state) => state.loadThreads);
  const loadThreadMessages = useChatStore((state) => state.loadThreadMessages);
  const deleteChat = useChatStore((state) => state.deleteChat);
  const clearThreadsOnAuthError = useChatStore((state) => state.clearThreadsOnAuthError);
  
  return {
    currentThreadId,
    threads,
    isLoadingThreads,
    deletingThreads,
    setCurrentThreadId,
    setThreads,
    addThread,
    updateThread,
    removeThread,
    loadThreads,
    loadThreadMessages,
    deleteChat,
    clearThreadsOnAuthError,
  };
};

// Fixed hook for message management - no infinite re-renders
export const useMessages = () => {
  // Individual selectors to avoid creating new objects
  const messages = useChatStore((state) => state.messages);
  const isThinking = useChatStore((state) => state.isThinking);
  const isStreaming = useChatStore((state) => state.isStreaming);
  const isLoadingMessages = useChatStore((state) => state.isLoadingMessages);
  
  // File state
  const currentFileId = useChatStore((state) => state.currentFileId);
  const currentFileName = useChatStore((state) => state.currentFileName);
  const currentFileSize = useChatStore((state) => state.currentFileSize);
  const currentFileType = useChatStore((state) => state.currentFileType);
  const isFileUploading = useChatStore((state) => state.isFileUploading);
  
  // Actions
  const setMessages = useChatStore((state) => state.setMessages);
  const addMessage = useChatStore((state) => state.addMessage);
  const cacheMessages = useChatStore((state) => state.cacheMessages);
  const getCachedMessages = useChatStore((state) => state.getCachedMessages);
  const clearMessageCache = useChatStore((state) => state.clearMessageCache);
  const sendMessageToAPI = useChatStore((state) => state.sendMessageToAPI);
  const uploadFileForChat = useChatStore((state) => state.uploadFileForChat);
  const setCurrentFileId = useChatStore((state) => state.setCurrentFileId);
  const setCurrentFileInfo = useChatStore((state) => state.setCurrentFileInfo);
  const setFileUploading = useChatStore((state) => state.setFileUploading);
  const clearCurrentFile = useChatStore((state) => state.clearCurrentFile);
  const getMostRecentFileId = useChatStore((state) => state.getMostRecentFileId);
  const getMostRecentResponseId = useChatStore((state) => state.getMostRecentResponseId);
  
  // Streaming actions
  const updateMessageContent = useChatStore((state) => state.updateMessageContent);
  const appendToMessageContent = useChatStore((state) => state.appendToMessageContent);
  const addStreamingMessage = useChatStore((state) => state.addStreamingMessage);
  const addImageToMessage = useChatStore((state) => state.addImageToMessage);
  const addImagesToMessage = useChatStore((state) => state.addImagesToMessage);
  
  return {
    // Message state
    messages,
    isThinking,
    isStreaming,
    isLoadingMessages,
    
    // File state  
    currentFileId,
    currentFileName,
    currentFileSize,
    currentFileType,
    isFileUploading,
    
    // Actions
    setMessages,
    addMessage,
    cacheMessages,
    getCachedMessages,
    clearMessageCache,
    sendMessageToAPI,
    uploadFileForChat,
    setCurrentFileId,
    setCurrentFileInfo,
    setFileUploading,
    clearCurrentFile,
    getMostRecentFileId,
    getMostRecentResponseId,
    
    // Streaming actions
    updateMessageContent,
    appendToMessageContent,
    addStreamingMessage,
    addImageToMessage,
    addImagesToMessage,
    
    // Computed helpers (memoized to prevent new objects on each render)
    hasFile: !!currentFileId,
    fileInfo: useMemo(() => 
      currentFileId ? {
        id: currentFileId,
        name: currentFileName,
        size: currentFileSize,
        type: currentFileType,
      } : null, 
      [currentFileId, currentFileName, currentFileSize, currentFileType]
    ),
  };
};

export default useChatStore;
