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
import type { Message, Chat } from './chatStore';
import {
  saveDownloadableFilesToStorage,
  getDownloadableFilesFromStorage,
  removeDownloadableFilesFromStorage,
  clearAllDownloadableFilesFromStorage,
} from './downloadableFilesStorage';

// ============================================================================
// Store State Interface (same as chatStore)
// ============================================================================

interface PlanChatState {
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
  isStreaming: boolean;
  isLoadingMessages: boolean;
  isLoadingThreads: boolean;
  deletingThreads: Set<string>;

  // File Management
  currentFileId: string | null;
  currentFileName: string | null;
  currentFileSize: number | null;
  currentFileType: string | null;
  isFileUploading: boolean;
  lastResponseId: string | null;
  fileJustUploaded: boolean;

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

interface PlanChatActions {
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
  addFilesToMessage: (messageId: string, files: any[]) => void;

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

const initialState: PlanChatState = {
  userId: null,
  isSessionActive: false,
  currentThreadId: null,
  threads: [],
  messages: [],
  messageCache: {},
  titleGenerated: {},
  isThinking: false,
  isStreaming: false,
  isLoadingMessages: false,
  isLoadingThreads: false,
  deletingThreads: new Set<string>(),
  currentFileId: null,
  currentFileName: null,
  currentFileSize: null,
  currentFileType: null,
  isFileUploading: false,
  lastResponseId: null,
  fileJustUploaded: false,
  helpText: null,
  isHelpTextLoading: false,
  aboutText: null,
  isAboutTextLoading: false,
};

// ============================================================================
// Plan Chat Store (admin_settings_id = 2)
// ============================================================================

export const usePlanChatStore = create<PlanChatState & PlanChatActions>()(
  persist(
    subscribeWithSelector((set, get) => ({
    ...initialState,

    // Session Management
    setUser: (userId) => {
      set({ userId, isSessionActive: !!userId });
    },

    setSessionActive: (active) => {
      set({ isSessionActive: active });
    },

    resetSession: () => {
      set(() => ({ ...initialState, isSessionActive: false }));
    },

    // Thread Management
    setCurrentThreadId: (threadId) => {
      set({ currentThreadId: threadId });
    },

    setThreads: (threads) => {
      set({ threads });
    },

    addThread: (thread) => {
      set((state) => ({ threads: [thread, ...state.threads] }));
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
      get().clearMessageCache(threadId);
      // Clear downloadable files from localStorage
      removeDownloadableFilesFromStorage(threadId);
      if (get().currentThreadId === threadId) {
        set({ currentThreadId: null, messages: [] });
      }
    },

    clearThreadsOnAuthError: () => {
      set({ threads: [], currentThreadId: null, messages: [], isSessionActive: false });
      get().clearMessageCache();
      // Clear all downloadable files from localStorage
      clearAllDownloadableFilesFromStorage();
    },

    // Message Management
    setMessages: (messages) => {
      set({ messages });
    },

    addMessage: (message) => {
      set((state) => ({ messages: [...state.messages, message] }));
      const currentThreadId = get().currentThreadId;
      if (currentThreadId) {
        const updatedMessages = [...get().messages];
        get().cacheMessages(currentThreadId, updatedMessages);
      }
    },

    cacheMessages: (threadId, messages) => {
      set((state) => ({
        messageCache: { ...state.messageCache, [threadId]: messages }
      }));
    },

    getCachedMessages: (threadId) => {
      return get().messageCache[threadId] || null;
    },

    clearMessageCache: (threadId) => {
      if (threadId) {
        set((state) => {
          const newCache = { ...state.messageCache };
          delete newCache[threadId];
          return { messageCache: newCache };
        });
      } else {
        set({ messageCache: {} });
      }
    },

    // Streaming Message Actions
    updateMessageContent: (messageId, content) => {
      set((state) => ({
        messages: state.messages.map(msg =>
          msg.id === messageId ? { ...msg, content } : msg
        )
      }));
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
                  ? msg.content.slice(0, -1) + contentChunk + '|'
                  : msg.content + contentChunk
              }
            : msg
        )
      }));
      const currentThreadId = get().currentThreadId;
      if (currentThreadId) {
        const cachedMessages = get().getCachedMessages(currentThreadId);
        if (cachedMessages) {
          const updatedCache = cachedMessages.map(msg =>
            msg.id === messageId
              ? {
                  ...msg,
                  content: msg.content.endsWith('|')
                    ? msg.content.slice(0, -1) + contentChunk + '|'
                    : msg.content + contentChunk
                }
              : msg
          );
          get().cacheMessages(currentThreadId, updatedCache);
        }
      }
    },

    addStreamingMessage: (message) => {
      const streamingMessage: Message = { content: '', ...message };
      get().addMessage(streamingMessage);
      return streamingMessage.id;
    },

    addImageToMessage: (messageId, imageData) => {
      set((state) => ({
        messages: state.messages.map(msg =>
          msg.id === messageId
            ? { ...msg, chartImages: Array.from(new Set([...(msg.chartImages || []), imageData])) }
            : msg
        )
      }));
      const currentThreadId = get().currentThreadId;
      if (currentThreadId) {
        const cachedMessages = get().getCachedMessages(currentThreadId);
        if (cachedMessages) {
          const updatedCache = cachedMessages.map(msg =>
            msg.id === messageId
              ? { ...msg, chartImages: Array.from(new Set([...(msg.chartImages || []), imageData])) }
              : msg
          );
          get().cacheMessages(currentThreadId, updatedCache);
        }
      }
    },

    addImagesToMessage: (messageId, imageDataArray) => {
      set((state) => ({
        messages: state.messages.map(msg =>
          msg.id === messageId
            ? { ...msg, chartImages: Array.from(new Set([...(msg.chartImages || []), ...imageDataArray])) }
            : msg
        )
      }));
      const currentThreadId = get().currentThreadId;
      if (currentThreadId) {
        const cachedMessages = get().getCachedMessages(currentThreadId);
        if (cachedMessages) {
          const updatedCache = cachedMessages.map(msg =>
            msg.id === messageId
              ? { ...msg, chartImages: Array.from(new Set([...(msg.chartImages || []), ...imageDataArray])) }
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

    // Title Management
    setTitleGenerated: (threadId, generated) => {
      set((state) => ({
        titleGenerated: { ...state.titleGenerated, [threadId]: generated }
      }));
    },

    isTitleGenerated: (threadId) => {
      return get().titleGenerated[threadId] || false;
    },

    // UI State Management
    setThinking: (thinking) => set({ isThinking: thinking }),
    setStreaming: (streaming) => set({ isStreaming: streaming }),
    setLoadingMessages: (loading) => set({ isLoadingMessages: loading }),
    setLoadingThreads: (loading) => set({ isLoadingThreads: loading }),

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

    // File Management
    setCurrentFileId: (fileId) => set({ currentFileId: fileId }),

    setCurrentFileInfo: (info) => {
      set({
        currentFileId: info.fileId,
        currentFileName: info.fileName !== undefined ? info.fileName : get().currentFileName,
        currentFileSize: info.fileSize !== undefined ? info.fileSize : get().currentFileSize,
        currentFileType: info.fileType !== undefined ? info.fileType : get().currentFileType,
        fileJustUploaded: true
      });
    },

    setFileUploading: (uploading) => set({ isFileUploading: uploading }),

    clearCurrentFile: () => {
      set({
        currentFileId: null,
        currentFileName: null,
        currentFileSize: null,
        currentFileType: null,
        isFileUploading: false,
        fileJustUploaded: false,
      });
    },

    setLastResponseId: (responseId) => set({ lastResponseId: responseId }),

    getMostRecentFileId: (): string | null => {
      const currentThreadId = get().currentThreadId;
      if (!currentThreadId) return null;
      const messages = get().getCachedMessages(currentThreadId) || get().messages;
      for (let i = messages.length - 1; i >= 0; i--) {
        const message = messages[i];
        if (message && message.fileIds && message.fileIds.length > 0) {
          return message.fileIds[0] || null;
        }
      }
      return null;
    },

    getMostRecentResponseId: (): string | null => {
      const currentThreadId = get().currentThreadId;
      if (!currentThreadId) return null;
      const messages = get().getCachedMessages(currentThreadId) || get().messages;
      for (let i = messages.length - 1; i >= 0; i--) {
        const message = messages[i];
        if (message && message.role === "assistant" && message.response_id) {
          return message.response_id;
        }
      }
      return null;
    },

    // Help Text
    fetchHelpText: async () => {
      if (get().helpText) return get().helpText as string;
      try {
        set({ isHelpTextLoading: true });
        const res = await getPublicHelpText();
        const text = res?.help_text || '';
        set({ helpText: text });
        return text;
      } catch (e) {
        set({ helpText: '' });
        return '';
      } finally {
        set({ isHelpTextLoading: false });
      }
    },

    // About Text
    fetchAboutText: async () => {
      if (get().aboutText) return get().aboutText as string;
      try {
        set({ isAboutTextLoading: true });
        const res = await getPublicAboutText();
        const text = res?.about_text || '';
        set({ aboutText: text });
        return text;
      } catch (e) {
        set({ aboutText: '' });
        return '';
      } finally {
        set({ isAboutTextLoading: false });
      }
    },

    // API Integrated Thread Actions - Uses admin_settings_id = 2 for plan
    loadThreads: async (silent = false) => {
      const currentThreads = get().threads;
      if (!silent && currentThreads.length === 0) {
        get().setLoadingThreads(true);
      }

      try {
        // Use admin_settings_id = 2 for plan
        const response = await getThreads(2);

        if (response && response.threads && Array.isArray(response.threads)) {
          const formattedChats: Chat[] = response.threads.map((thread: any) => ({
            id: thread.id,
            title: thread.title || "Untitled Conversation",
            messages: [],
            lastUpdated: new Date(thread.updated_at),
            message_count: thread.message_count,
            thread_id: thread.id,
          }));
          get().setThreads(formattedChats);
        }
      } catch (error) {
        if (isAuthError(error)) {
          get().clearThreadsOnAuthError();
        }
        throw error;
      } finally {
        if (!silent || currentThreads.length === 0) {
          get().setLoadingThreads(false);
        }
      }
    },

    loadThreadMessages: async (threadId: string) => {
      const cached = get().getCachedMessages(threadId);
      if (cached) {
        get().setMessages(cached);
        get().setCurrentThreadId(threadId);
        return;
      }

      if (threadId === get().currentThreadId && get().isLoadingMessages) {
        return;
      }

      get().setLoadingMessages(true);
      try {
        const response = await getThreadMessages(threadId);
        if (response && response.messages && Array.isArray(response.messages)) {
          const parsedMessages: Message[] = response.messages.map((msg: any) => {
            let content = "";

            if (msg.role === "user") {
              content = msg.content?.text || msg.content || "";
            } else if (msg.role === "assistant") {
              if (msg.content && msg.content.output && Array.isArray(msg.content.output)) {
                const messageContents: string[] = [];
                for (const outputItem of msg.content.output) {
                  if (outputItem.type === "message" && outputItem.content && Array.isArray(outputItem.content)) {
                    const messageText = outputItem.content.map((c: any) => c.text || "").join("").trim();
                    if (messageText) messageContents.push(messageText);
                  }
                }
                if (messageContents.length > 0) content = messageContents.join("\n\n");
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

          get().cacheMessages(threadId, parsedMessages);
          get().setMessages(parsedMessages);
          get().setCurrentThreadId(threadId);

          const lastAssistantMessage = parsedMessages.filter((msg) => msg.role === "assistant").pop();
          if (lastAssistantMessage?.assistant_message_id) {
            get().setLastResponseId(lastAssistantMessage.assistant_message_id);
          }
        }
      } catch (error) {
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
        get().setThreadDeleting(threadId, true);
        await deleteThread(threadId);
        get().removeThread(threadId);
      } catch (error) {
        get().setThreadDeleting(threadId, false);
        if (isAuthError(error)) {
          get().clearThreadsOnAuthError();
        }
        throw error;
      } finally {
        get().setThreadDeleting(threadId, false);
      }
    },

    // API Integrated Message Actions
    sendMessageToAPI: async (content: string, useStreaming = true, experimentType = "plan") => {
      get().setThinking(true);

      const currentFileName = get().currentFileName;
      const fileJustUploaded = get().fileJustUploaded;

      const userMessage: Message = {
        id: Date.now().toString(),
        content,
        role: "user",
        timestamp: new Date(),
        ...(fileJustUploaded && currentFileName && { fileNames: [currentFileName] }),
      };

      const assistantMessageId = (Date.now() + 1).toString();
      const emptyAssistantMessage: Message = {
        id: assistantMessageId,
        content: '|',
        role: "assistant",
        timestamp: new Date(),
      };

      get().addMessage(userMessage);
      get().addMessage(emptyAssistantMessage);

      try {
        let effectiveFileId = get().currentFileId;
        let effectiveResponseId = get().getMostRecentResponseId();

        if (!effectiveFileId) {
          effectiveFileId = get().getMostRecentFileId();
        }

        const currentThreadId = get().currentThreadId;

        const response = await sendMessage({
          user_message: content,
          ...(effectiveFileId && { existing_file_id: effectiveFileId }),
          ...(fileJustUploaded && currentFileName && { file_name: currentFileName }),
          ...(effectiveResponseId && { previous_response_id: effectiveResponseId }),
          ...(currentThreadId && { thread_id: currentThreadId }),
          stream: useStreaming,
          experiment_type: experimentType,
        });

        if (fileJustUploaded) {
          set({ fileJustUploaded: false });
        }

        if (useStreaming && response && typeof response === 'object' && 'read' in response) {
          get().setStreaming(true);

          const decoder = new TextDecoder();
          let fullResponse = '';
          let firstChunkReceived = false;
          let sseBuffer = '';
          let responseMetadata: any = null;

          try {
            while (true) {
              const { done, value } = await response.read();
              if (done) break;

              const chunk = decoder.decode(value, { stream: true });
              sseBuffer += chunk;

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

                if (dataLines.length === 0) continue;

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
                    get().addImageToMessage(assistantMessageId, evt.data);
                  } else if (evtType === 'images') {
                    if (Array.isArray(evt.data)) {
                      get().addImagesToMessage(assistantMessageId, evt.data);
                    }
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
                  // JSON parse failed
                }
              }
            }

            const currentMessage = get().messages.find(msg => msg.id === assistantMessageId);
            if (currentMessage && currentMessage.content.endsWith('|')) {
              get().updateMessageContent(assistantMessageId, currentMessage.content.slice(0, -1));
            }

            get().setStreaming(false);

            if (responseMetadata) {
              if (responseMetadata.id) {
                get().setLastResponseId(responseMetadata.id);
              }

              if (responseMetadata.thread_id && !get().currentThreadId) {
                get().setCurrentThreadId(responseMetadata.thread_id);
                const newThread: Chat = {
                  id: responseMetadata.thread_id,
                  title: "New Chat",
                  messages: [],
                  lastUpdated: new Date(),
                  thread_id: responseMetadata.thread_id,
                };
                get().addThread(newThread);
              }

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

              if (responseMetadata.thread_id && !get().currentThreadId) {
                await get().loadThreads(true);
              }

              return finalResponse;
            } else {
              return { id: assistantMessageId, content: fullResponse };
            }

          } catch (streamError) {
            get().updateMessageContent(assistantMessageId, "Error receiving streaming response. Please try again.");
            get().setThinking(false);
            get().setStreaming(false);
            throw streamError;
          }

        } else {
          // Non-streaming response handling
          let responseContent = "No response received";
          let chartImages: string[] | undefined;

          if (response) {
            if (response.output && Array.isArray(response.output)) {
              const messageContents: string[] = [];
              for (const outputItem of response.output) {
                if (outputItem.type === "message" && outputItem.content && Array.isArray(outputItem.content)) {
                  const messageText = outputItem.content.map((c: any) => c.text || "").join("").trim();
                  if (messageText) messageContents.push(messageText);
                }
              }
              if (messageContents.length > 0) responseContent = messageContents.join("\n\n");
            } else if (response.text && typeof response.text === "string") {
              responseContent = response.text;
            } else if (typeof response === "string") {
              responseContent = response;
            }

            if (response.chart_outputs && Array.isArray(response.chart_outputs)) {
              chartImages = Array.from(new Set(response.chart_outputs));
            }
          }

          get().updateMessageContent(assistantMessageId, responseContent);

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

          get().setThinking(false);

          if (response.id) {
            get().setLastResponseId(response.id);
          }

          if (response.thread_id && !get().currentThreadId) {
            get().setCurrentThreadId(response.thread_id);
            const newThread: Chat = {
              id: response.thread_id,
              title: "New Chat",
              messages: [],
              lastUpdated: new Date(),
              thread_id: response.thread_id,
            };
            get().addThread(newThread);
          }

          if (response.thread_id && !get().currentThreadId) {
            await get().loadThreads(true);
          }

          return response;
        }
      } catch (error) {
        let errorContent = "Sorry, I encountered an error. Please try again.";

        if (error instanceof Error) {
          if (error.message.includes("quota") || error.message.includes("429")) {
            errorContent = "⚠️ OpenAI API quota exceeded. Please check your OpenAI account billing and usage limits.";
          } else if (error.message.includes("401") || error.message.includes("unauthorized")) {
            errorContent = "🔑 Session expired. Please refresh the page to continue.";
            get().clearThreadsOnAuthError();
          } else if (error.message.includes("500")) {
            errorContent = "🔧 Server error. Please try again in a moment.";
          }
        }

        get().updateMessageContent(assistantMessageId, errorContent);
        get().setThinking(false);
        get().setStreaming(false);

        throw error;
      }
    },

    uploadFileForChat: async (file: File) => {
      try {
        get().setFileUploading(true);
        const fileId = await uploadFile(file);
        get().setCurrentFileInfo({
          fileId,
          fileName: file.name,
          fileSize: file.size,
          fileType: file.type || 'unknown',
        });
        return fileId;
      } catch (error) {
        get().clearCurrentFile();
        if (isAuthError(error)) {
          get().clearThreadsOnAuthError();
        }
        throw error;
      } finally {
        get().setFileUploading(false);
      }
    },
  })),
  {
    name: 'ncie-plan-chat-storage', // Different localStorage key for plan
    storage: createJSONStorage(() => localStorage),
    partialize: (state) => ({
      userId: state.userId,
      isSessionActive: state.isSessionActive,
      threads: state.threads,
      titleGenerated: state.titleGenerated,
    }),
    version: 1,
    onRehydrateStorage: () => (state, error) => {
      if (error) {
        console.error('Failed to rehydrate plan chat storage:', error);
        return;
      }
      if (state) {
        state.clearCurrentFile();
      }
    },
  }
))

// ============================================================================
// Utility Hooks for Plan Chat
// ============================================================================

export const usePlanSession = () => {
  const userId = usePlanChatStore((state) => state.userId);
  const isSessionActive = usePlanChatStore((state) => state.isSessionActive);
  const setUser = usePlanChatStore((state) => state.setUser);
  const resetSession = usePlanChatStore((state) => state.resetSession);
  const endSession = useMemo(() => () => setUser(null), [setUser]);

  return { userId, isSessionActive, setUser, resetSession, endSession };
};

export const usePlanThreads = () => {
  const currentThreadId = usePlanChatStore((state) => state.currentThreadId);
  const threads = usePlanChatStore((state) => state.threads);
  const isLoadingThreads = usePlanChatStore((state) => state.isLoadingThreads);
  const deletingThreads = usePlanChatStore((state) => state.deletingThreads);
  const setCurrentThreadId = usePlanChatStore((state) => state.setCurrentThreadId);
  const setThreads = usePlanChatStore((state) => state.setThreads);
  const addThread = usePlanChatStore((state) => state.addThread);
  const updateThread = usePlanChatStore((state) => state.updateThread);
  const removeThread = usePlanChatStore((state) => state.removeThread);
  const loadThreads = usePlanChatStore((state) => state.loadThreads);
  const loadThreadMessages = usePlanChatStore((state) => state.loadThreadMessages);
  const deleteChat = usePlanChatStore((state) => state.deleteChat);
  const clearThreadsOnAuthError = usePlanChatStore((state) => state.clearThreadsOnAuthError);

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

export const usePlanMessages = () => {
  const messages = usePlanChatStore((state) => state.messages);
  const isThinking = usePlanChatStore((state) => state.isThinking);
  const isStreaming = usePlanChatStore((state) => state.isStreaming);
  const isLoadingMessages = usePlanChatStore((state) => state.isLoadingMessages);
  const currentFileId = usePlanChatStore((state) => state.currentFileId);
  const currentFileName = usePlanChatStore((state) => state.currentFileName);
  const currentFileSize = usePlanChatStore((state) => state.currentFileSize);
  const currentFileType = usePlanChatStore((state) => state.currentFileType);
  const isFileUploading = usePlanChatStore((state) => state.isFileUploading);
  const setMessages = usePlanChatStore((state) => state.setMessages);
  const addMessage = usePlanChatStore((state) => state.addMessage);
  const cacheMessages = usePlanChatStore((state) => state.cacheMessages);
  const getCachedMessages = usePlanChatStore((state) => state.getCachedMessages);
  const clearMessageCache = usePlanChatStore((state) => state.clearMessageCache);
  const sendMessageToAPI = usePlanChatStore((state) => state.sendMessageToAPI);
  const uploadFileForChat = usePlanChatStore((state) => state.uploadFileForChat);
  const setCurrentFileId = usePlanChatStore((state) => state.setCurrentFileId);
  const setCurrentFileInfo = usePlanChatStore((state) => state.setCurrentFileInfo);
  const setFileUploading = usePlanChatStore((state) => state.setFileUploading);
  const clearCurrentFile = usePlanChatStore((state) => state.clearCurrentFile);
  const getMostRecentFileId = usePlanChatStore((state) => state.getMostRecentFileId);
  const getMostRecentResponseId = usePlanChatStore((state) => state.getMostRecentResponseId);
  const updateMessageContent = usePlanChatStore((state) => state.updateMessageContent);
  const appendToMessageContent = usePlanChatStore((state) => state.appendToMessageContent);
  const addStreamingMessage = usePlanChatStore((state) => state.addStreamingMessage);
  const addImageToMessage = usePlanChatStore((state) => state.addImageToMessage);
  const addImagesToMessage = usePlanChatStore((state) => state.addImagesToMessage);

  return {
    messages,
    isThinking,
    isStreaming,
    isLoadingMessages,
    currentFileId,
    currentFileName,
    currentFileSize,
    currentFileType,
    isFileUploading,
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
    updateMessageContent,
    appendToMessageContent,
    addStreamingMessage,
    addImageToMessage,
    addImagesToMessage,
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

export default usePlanChatStore;
