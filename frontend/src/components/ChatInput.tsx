import type React from "react"
import { useState, useRef, useEffect } from "react"
import { useMessages, usePlanMessages } from "../stores"
import { useTheme } from "../context/ThemeContext"
import { UploadIcon, FileSpreadsheet, File, FileText, X, SendHorizontal, Loader2 } from "lucide-react"

interface ChatInputProps {
  onSendMessage: (message: string) => void
  storeType?: "control" | "plan"
}

const ChatInput: React.FC<ChatInputProps> = ({ onSendMessage, storeType = "control" }) => {
  const [message, setMessage] = useState("")
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  
  // Use the appropriate store based on storeType
  const controlMessages = useMessages()
  const planMessages = usePlanMessages()
  const messagesStore = storeType === "plan" ? planMessages : controlMessages
  
  const {
    uploadFileForChat,
    currentFileId,
    currentFileName,
    currentFileSize,
    currentFileType,
    isThinking,
    isStreaming,
    isFileUploading,
    clearCurrentFile,
    hasFile
  } = messagesStore
  const { isDarkMode } = useTheme()

  // Auto-resize textarea based on content (like ChatGPT/Gemini)
  useEffect(() => {
    const textarea = textareaRef.current
    if (textarea) {
      // Reset height to 0 to get accurate scrollHeight measurement
      textarea.style.height = '0px'

      // Get the actual content height
      const scrollHeight = textarea.scrollHeight
      const maxHeight = 200 // Maximum height (about 8-10 lines)

      // Set height to content or max, whichever is smaller
      textarea.style.height = `${Math.min(scrollHeight, maxHeight)}px`

      // Enable scrolling only when content exceeds max height
      textarea.style.overflowY = scrollHeight > maxHeight ? 'auto' : 'hidden'
    }
  }, [message])

  // Helper function to get file icon based on file type
  const getFileIcon = (fileName?: string, fileType?: string) => {
    const extension = fileName ? '.' + fileName.split('.').pop()?.toLowerCase() : '';
    const type = fileType?.toLowerCase();
    
    if (extension === '.csv' || type?.includes('csv')) {
      return <FileSpreadsheet className="w-4 h-4 text-green-500 flex-shrink-0" />;
    } else if (extension === '.xlsx' || extension === '.xls' || type?.includes('spreadsheet')) {
      return <FileSpreadsheet className="w-4 h-4 text-green-600 flex-shrink-0" />;
    } else if (extension === '.pdf' || type?.includes('pdf')) {
      return <File className="w-4 h-4 text-red-500 flex-shrink-0" />;
    } else if (extension === '.txt' || type?.includes('text')) {
      return <FileText className="w-4 h-4 text-blue-500 flex-shrink-0" />;
    } else {
      return <File className="w-4 h-4 text-hthgse-500 flex-shrink-0" />;
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (message.trim() && !isThinking && !isStreaming) {
      onSendMessage(message.trim())
      setMessage("")
      setUploadedFile(null) // Clear local file display
      clearCurrentFile() // Clear file from store (UI will hide the file)
      // File will still be available for follow-up messages via message history
      if (fileInputRef.current) {
        fileInputRef.current.value = '' // Clear file input
      }
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Submit on Enter, but allow Shift+Enter for new lines
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (message.trim() && !isThinking && !isStreaming) {
        handleSubmit(e as any)
      }
    }
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file size (50MB limit - OpenAI limit for CSV/spreadsheet files)
    const maxSize = 50 * 1024 * 1024; // 50MB
    if (file.size > maxSize) {
      alert(`File too large. Please select a file smaller than ${maxSize / (1024 * 1024)}MB.`);
      return;
    }

    // Validate file type
    const allowedTypes = ['.csv', '.xlsx', '.xls', '.txt', '.pdf'];
    const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();
    if (!allowedTypes.includes(fileExtension)) {
      alert(`Invalid file type. Please select one of: ${allowedTypes.join(', ')}`);
      return;
    }

    try {
      const fileId = await uploadFileForChat(file)
      console.log('File upload successful, file ID:', fileId)
      setUploadedFile(file) // Keep local reference for display
    } catch (error) {
      console.error('File upload failed:', error)
      alert(`File upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  const removeFile = () => {
    setUploadedFile(null)
    clearCurrentFile() // Clear all file data from Zustand store
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  return (
    <div className={`px-3 py-2 sm:px-4 sm:py-3 border-t ${
      isDarkMode ? 'border-dark-border bg-dark-background' : 'border-light-border bg-light-background'
    }`}>
      {/* File Upload Display */}
      {(uploadedFile || hasFile) && (
        <div className={`mb-2 p-2 sm:p-3 rounded-xl flex items-center justify-between ${
          isDarkMode ? 'bg-dark-surface' : 'bg-light-surface'
        }`}>
          <div className="flex items-center space-x-2 flex-1 min-w-0">
            {getFileIcon(currentFileName || uploadedFile?.name, currentFileType || uploadedFile?.type)}
            <div className="flex-1 min-w-0">
              <div className={`text-sm truncate ${
                isDarkMode ? 'text-dark-text' : 'text-light-text'
              }`}>
                {currentFileName || uploadedFile?.name || 'Unknown file'}
              </div>
              {currentFileSize && (
                <div className={`text-xs ${
                  isDarkMode ? 'text-dark-textSecondary' : 'text-light-textSecondary'
                }`}>
                  {(currentFileSize / 1024).toFixed(1)} KB
                </div>
              )}
            </div>
            {currentFileId && !isFileUploading && (
              <span className="text-xs text-hthgse-500 bg-hthgse-500/20 px-2 py-1 rounded flex-shrink-0">
                Ready
              </span>
            )}
            {isFileUploading && (
              <div className="flex items-center space-x-1 text-xs text-blue-500 flex-shrink-0">
                <Loader2 className="w-3 h-3 animate-spin" />
                <span>Uploading...</span>
              </div>
            )}
          </div>
          <div className="flex items-center space-x-2 bg-transparent rounded-full p-1">
          <button
            onClick={removeFile}
            disabled={isFileUploading || isThinking || isStreaming}
            className={`p-1 rounded transition-colors flex-shrink-0 ml-2 ${
              (isFileUploading || isThinking || isStreaming)
                ? 'opacity-50 cursor-not-allowed' 
                : isDarkMode
                  ? 'text-dark-textSecondary bg-light-surface hover:text-dark-text hover:bg-light-border'
                  : 'text-light-textSecondary bg-dark-surface hover:text-light-text hover:bg-dark-border'
            }`}
          >
            <X className="w-4 h-4" color={!isDarkMode ? 'white' : 'black'} />
          </button>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="relative">
        <div className={`flex items-center gap-2 rounded-3xl border shadow-sm ${
          isDarkMode ? 'bg-dark-surface border-dark-border' : 'bg-light-background border-light-border'
        } py-1.5 px-2`}>
          {/* File Upload Button */}
          <button
            type="button"
            className={`p-1.5 relative transition-colors rounded-full flex-shrink-0 ${
              !isDarkMode ? 'bg-dark-surface hover:bg-gray-700' : 'bg-light-surface hover:bg-gray-200'
            } ${
              (isFileUploading || isThinking || isStreaming)
                ? 'opacity-50 cursor-not-allowed'
                : ''
            }`}
            onClick={() => fileInputRef.current?.click()}
            disabled={isFileUploading || isThinking || isStreaming}
          >
            {isFileUploading ? (
              <Loader2 className="w-5 h-5 animate-spin text-dark-textSecondary" />
            ) : (
              <UploadIcon className="w-5 h-5" color={!isDarkMode ? 'white' : 'black'} />
            )}
            <input
              ref={fileInputRef}
              type="file"
              onChange={handleFileUpload}
              className="hidden"
              accept=".csv,.xlsx,.xls,.txt,.pdf"
              disabled={isFileUploading || isThinking || isStreaming}
            />
          </button>

          {/* Textarea - grows with content */}
          <textarea
            ref={textareaRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Upload your dataset"
            disabled={isThinking || isStreaming}
            rows={1}
            className={`flex-1 bg-transparent py-2.5 focus:outline-none disabled:opacity-50 resize-none text-sm sm:text-base leading-5 ${
              isDarkMode
                ? 'text-dark-text placeholder-dark-textSecondary'
                : 'text-light-text placeholder-light-textSecondary'
            }`}
            style={{
              maxHeight: '200px',
              overflowY: 'hidden'
            }}
          />

          {/* Send Button */}
          <button
            type="submit"
            disabled={!message.trim() || isThinking || isStreaming}
            className={`p-1.5 rounded-full flex-shrink-0 transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
              !isDarkMode
                ? 'bg-dark-surface hover:bg-gray-700'
                : 'bg-light-surface hover:bg-gray-200'
            }`}
          >
            <SendHorizontal className="w-5 h-5" color={!isDarkMode ? 'white' : 'black'} />
          </button>
        </div>
      </form>

      <div className={`text-[10px] sm:text-xs text-center mt-2 leading-tight ${
        isDarkMode ? 'text-dark-textSecondary' : 'text-light-textSecondary'
      }`}>
        NCIE Control Chart Generator can make mistakes. Check important info. • Press Enter to send, Shift+Enter for new line
      </div>
    </div>
  )
}

export default ChatInput
