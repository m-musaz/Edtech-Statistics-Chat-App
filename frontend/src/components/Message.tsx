import type React from "react"
import { useState } from "react"
import { ThumbsUp, ThumbsDown, Download, Copy, Check, BarChart3, FileText } from "lucide-react"
import Markdown from 'react-markdown'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark, oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { rateMessage, deleteFeedback } from "../lib/api"
import { useTheme } from "../context/ThemeContext"
import { useMessages } from "../stores"
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import 'katex/dist/katex.min.css'

interface DownloadableFile {
  filename: string
  data: string
  mime_type: string
  sandbox_path: string
}

interface MessageProps {
  message: {
    id: string
    content: string
    role: "user" | "assistant"
    timestamp: Date
    chartImages?: string[]
    fileNames?: string[]
    fileIds?: string[]
    downloadableFiles?: DownloadableFile[]
    assistant_message_id?: string
    response_id?: string
    rating?: 'thumbs_up' | 'thumbs_down' | null
  }
}

const Message: React.FC<MessageProps> = ({ message }) => {
  const isUser = message.role === "user"
  const [rating, setRating] = useState<'thumbs_up' | 'thumbs_down' | null>(message.rating || null)
  const [isRating, setIsRating] = useState(false)
  const [loadingButton, setLoadingButton] = useState<'thumbs_up' | 'thumbs_down' | null>(null)
  const [copied, setCopied] = useState(false)
  const { isDarkMode } = useTheme()
  const { isStreaming, messages } = useMessages()
  
  // Show thinking indicator if assistant message has no content or only cursor
  const shouldShowThinking = !isUser && (message.content.length === 0 || message.content === '|')
  
  // Check if this is the latest assistant message and currently streaming
  const isLatestAssistantMessage = !isUser && messages.length > 0 && messages[messages.length - 1]?.id === message.id
  const isMessageStreaming = isLatestAssistantMessage && message.content.length > 1 && isStreaming

  // Custom markdown components
  const MarkdownComponents = {
    code: ({ node, inline, className, children, ...props }: any) => {
      const match = /language-(\w+)/.exec(className || '')
      const language = match ? match[1] : ''
      
      return !inline ? (
        <div className="overflow-x-auto -mx-1 sm:mx-0">
          <SyntaxHighlighter
            style={isDarkMode ? oneDark : oneLight}
            language={language}
            PreTag="div"
            className="rounded-lg !mt-2 !mb-2 text-xs sm:text-sm"
            wrapLongLines={true}
            {...props}
          >
            {String(children).replace(/\n$/, '')}
          </SyntaxHighlighter>
        </div>
      ) : (
        <code
          className={`px-1.5 py-0.5 rounded-md text-xs sm:text-sm font-mono break-all ${
            isDarkMode
              ? 'bg-dark-surface text-dark-text border border-dark-border'
              : 'bg-light-surface text-light-text border border-light-border'
          }`}
          {...props}
        >
          {children}
        </code>
      )
    },
    pre: ({ children }: any) => (
      <pre className="overflow-x-auto max-w-full">{children}</pre>
    ),
    p: ({ children }: any) => (
      <p className="mb-2 last:mb-0 break-words overflow-wrap-anywhere">{children}</p>
    ),
    ul: ({ children }: any) => (
      <ul className={`list-disc pl-5 sm:pl-6 mb-3 mt-2 space-y-1.5 ${
        isDarkMode ? 'text-dark-text' : 'text-light-text'
      }`}>
        {children}
      </ul>
    ),
    ol: ({ children }: any) => (
      <ol className={`list-decimal pl-5 sm:pl-6 mb-3 mt-2 space-y-1.5 ${
        isDarkMode ? 'text-dark-text' : 'text-light-text'
      }`}>
        {children}
      </ol>
    ),
    li: ({ children }: any) => (
      <li className="ml-0 break-words overflow-wrap-anywhere leading-relaxed pl-1">{children}</li>
    ),
    blockquote: ({ children }: any) => (
      <blockquote className={`border-l-4 pl-3 sm:pl-4 py-2 my-2 italic break-words ${
        isDarkMode
          ? 'border-dark-border bg-dark-surface text-dark-textSecondary'
          : 'border-light-border bg-light-surface text-light-textSecondary'
      }`}>
        {children}
      </blockquote>
    ),
    h1: ({ children }: any) => (
      <h1 className={`text-lg sm:text-xl font-bold mb-3 mt-4 break-words ${
        isDarkMode ? 'text-dark-text' : 'text-light-text'
      }`}>
        {children}
      </h1>
    ),
    h2: ({ children }: any) => (
      <h2 className={`text-base sm:text-lg font-bold mb-2 mt-3 break-words ${
        isDarkMode ? 'text-dark-text' : 'text-light-text'
      }`}>
        {children}
      </h2>
    ),
    h3: ({ children }: any) => (
      <h3 className={`text-sm sm:text-base font-bold mb-2 mt-2 break-words ${
        isDarkMode ? 'text-dark-text' : 'text-light-text'
      }`}>
        {children}
      </h3>
    ),
    table: ({ children }: any) => (
      <div className="overflow-x-auto -mx-2 sm:mx-0 my-4">
        <table className="min-w-full">{children}</table>
      </div>
    ),
    img: ({ src, alt, ...props }: any) => (
      <img
        src={src}
        alt={alt}
        className="max-w-full h-auto rounded-lg my-2"
        {...props}
      />
    ),
    a: ({ href, children, ...props }: any) => {
      // Check if this is a sandbox URL that needs to be replaced with downloadable file
      if (href && href.startsWith('sandbox:/mnt/data/')) {
        const filename = href.replace('sandbox:/mnt/data/', '')
        
        // First check current message
        let file = message.downloadableFiles?.find(f => 
          f.filename === filename || f.sandbox_path === href
        )
        
        // If not found, search ALL messages in the conversation
        // (files might be in an earlier message from when code interpreter ran)
        if (!file) {
          for (const msg of messages) {
            if (msg.downloadableFiles) {
              const found = msg.downloadableFiles.find((f: DownloadableFile) => 
                f.filename === filename || f.sandbox_path === href
              )
              if (found) {
                file = found
                break
              }
            }
          }
        }
        
        if (file) {
          const dataUrl = `data:${file.mime_type};base64,${file.data}`
          return (
            <a
              href={dataUrl}
              download={file.filename}
              className={`break-all underline cursor-pointer ${
                isDarkMode ? 'text-hthgse-400 hover:text-hthgse-300' : 'text-hthgse-600 hover:text-hthgse-700'
              }`}
              {...props}
            >
              {children}
            </a>
          )
        }
        
        // File not found yet - show loading state (looks like a link while waiting)
        return (
          <span 
            className={`break-all underline cursor-wait ${
              isDarkMode ? 'text-hthgse-400/70' : 'text-hthgse-600/70'
            }`}
          >
            {children}
            <span className="ml-1 inline-block animate-pulse text-xs">⏳</span>
          </span>
        )
      }
      
      // Regular external link
      return (
        <a
          href={href}
          className={`break-all underline ${
            isDarkMode ? 'text-hthgse-400 hover:text-hthgse-300' : 'text-hthgse-600 hover:text-hthgse-700'
          }`}
          target="_blank"
          rel="noopener noreferrer"
          {...props}
        >
          {children}
        </a>
      )
    },
  }

  const handleRating = async (ratingType: 'thumbs_up' | 'thumbs_down') => {
    if (!message.id || isRating) return
    
    // Determine what the new rating should be
    let newRating: 'thumbs_up' | 'thumbs_down' | null
    if (rating === ratingType) {
      // If clicking the same rating, remove it (toggle off)
      newRating = null
    } else {
      // Otherwise, set the new rating
      newRating = ratingType
    }
    
    // Show loading state - track which button was clicked
    setIsRating(true)
    setLoadingButton(ratingType)
    
    try {
      if (newRating === null) {
        await deleteFeedback(message.id)
        console.log('Rating removed successfully')
      } else {
        // Create or update feedback record
        await rateMessage(message.id, newRating)
        console.log('Rating saved successfully')
      }
      
      setRating(newRating)
      
    } catch (error) {
      console.error('Failed to update rating:', error)
    } finally {
      // Always clear loading state
      setIsRating(false)
      setLoadingButton(null)
    }
  }

  const handleDownloadChart = (chartImage: string, index: number) => {
    try {
      // Create a link element and trigger download
      const link = document.createElement('a')
      link.href = `data:image/png;base64,${chartImage}`
      link.download = `chart-${message.id}-${index + 1}.png`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    } catch (error) {
      console.error('Failed to download chart:', error)
    }
  }

  const handleCopyResponse = async () => {
    try {
      await navigator.clipboard.writeText(message.content)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      console.error('Failed to copy text:', error)
    }
  }


  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"} px-2 py-3 sm:px-4 sm:py-4`}>
      <div className={`${isUser ? "max-w-[85%] sm:max-w-[75%] md:max-w-2xl" : "w-full max-w-3xl"} ${isUser ? "ml-0 sm:ml-8 md:ml-12" : "mr-0 sm:mr-8 md:mr-12"}`}>
        {!isUser && (
          <div className="flex items-start space-x-2 sm:space-x-3">
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center overflow-hidden flex-shrink-0">
              <img
                src="/NCIE-Logo_FullColor.png"
                alt="NCIE Logo"
                className="w-full h-full object-contain"
                onError={(e) => {
                  // Fallback to text if image fails to load
                  e.currentTarget.style.display = 'none'
                  e.currentTarget.nextElementSibling?.classList.remove('hidden')
                }}
              />
            </div>
            <div className="flex-1 min-w-0 overflow-hidden">
              <div className="bg-transparent rounded-lg">
                {shouldShowThinking ? (
                  // Show thinking indicator for empty assistant messages
                  <div className="p-2 sm:p-4">
                    <div className={`flex items-center space-x-2 ${
                      isDarkMode ? 'text-dark-textSecondary' : 'text-light-textSecondary'
                    }`}>
                      <div className="flex space-x-1">
                        <div className={`w-2 h-2 rounded-full animate-bounce ${
                          isDarkMode ? 'bg-dark-textSecondary' : 'bg-light-textSecondary'
                        }`}></div>
                        <div className={`w-2 h-2 rounded-full animate-bounce ${
                          isDarkMode ? 'bg-dark-textSecondary' : 'bg-light-textSecondary'
                        }`} style={{ animationDelay: '0.1s' }}></div>
                        <div className={`w-2 h-2 rounded-full animate-bounce ${
                          isDarkMode ? 'bg-dark-textSecondary' : 'bg-light-textSecondary'
                        }`} style={{ animationDelay: '0.2s' }}></div>
                      </div>
                      <span className="text-xs sm:text-sm">Thinking...</span>
                    </div>
                  </div>
                ) : (
                  // Show actual content
                  <div className={`prose prose-sm ${isDarkMode ? 'prose-invert' : ''} max-w-none overflow-hidden ${isMessageStreaming ? 'animate-pulse' : ''}`}
                    style={{ wordWrap: 'break-word', overflowWrap: 'anywhere' }}>
                    <Markdown
                      key={`${message.id}-${messages.reduce((acc, m) => acc + (m.downloadableFiles?.length || 0), 0)}`}
                      remarkPlugins={[remarkGfm, remarkMath]}
                      rehypePlugins={[rehypeKatex]}
                      components={MarkdownComponents}
                      urlTransform={(url) => url}
                    >
                      {message.content}
                    </Markdown>
                  </div>
                )}
                
                {/* Charts Display */}
                {message.chartImages && message.chartImages.length > 0 && !shouldShowThinking && (
                  (() => {
                    console.log(`🎨 [RENDER] Message ${message.id}: Rendering ${message.chartImages.length} chart(s)`);

                    // Check for duplicate images in the array
                    const uniqueImages = new Set(message.chartImages);
                    if (uniqueImages.size !== message.chartImages.length) {
                      console.log(`   ⚠️  WARNING: Message has DUPLICATE images in chartImages array!`);
                      console.log(`      Array length: ${message.chartImages.length}, Unique images: ${uniqueImages.size}`);
                    }

                    return (
                      <div className={`mt-4 p-2 sm:p-4 rounded-lg border ${
                        isDarkMode
                          ? 'bg-dark-surface border-dark-border'
                          : 'bg-light-surface border-light-border'
                      }`}>
                        <div className="flex items-center justify-between mb-2 sm:mb-3">
                          <div className="flex items-center space-x-1 sm:space-x-2">
                            <BarChart3 className="w-4 h-4 sm:w-5 sm:h-5 text-hthgse-500 flex-shrink-0" />
                            <span className={`text-xs sm:text-sm font-medium ${
                              isDarkMode ? 'text-dark-text' : 'text-light-text'
                            }`}>
                              Generated Chart{message.chartImages.length > 1 ? 's' : ''}
                              {message.chartImages.length > 1 && ` (${message.chartImages.length})`}
                            </span>
                          </div>
                        </div>

                        {/* Charts Grid */}
                        <div className={`grid gap-2 sm:gap-4 ${
                          message.chartImages.length === 1
                            ? 'grid-cols-1'
                            : message.chartImages.length === 2
                              ? 'grid-cols-1 md:grid-cols-2'
                              : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'
                        }`}>
                          {message.chartImages.map((chartImage, index) => {
                            console.log(`   🖼️  Rendering chart #${index + 1} for message ${message.id}`);
                            return (
                              <div key={index} className="relative group">
                                <div className="flex justify-center">
                                  <img
                                    src={`data:image/png;base64,${chartImage}`}
                                    alt={`Generated Chart ${index + 1}`}
                                    className="max-w-full h-auto rounded-lg shadow-lg"
                                    style={{ maxHeight: '400px' }}
                                  />
                                </div>
                                <button
                                  onClick={() => handleDownloadChart(chartImage, index)}
                                  className={`absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity
                                    flex items-center justify-center w-8 h-8 rounded-full ${
                                    isDarkMode
                                      ? 'bg-dark-surface/90 text-dark-text hover:bg-dark-border'
                                      : 'bg-light-surface/90 text-light-text hover:bg-light-border'
                                  } backdrop-blur-sm`}
                                  title={`Download chart ${index + 1}`}
                                >
                                  <Download className="w-4 h-4" />
                                </button>
                                {message.chartImages!.length > 1 && (
                                  <div className={`absolute bottom-2 left-2 px-2 py-1 rounded text-xs font-medium ${
                                    isDarkMode
                                      ? 'bg-dark-surface/90 text-dark-text'
                                      : 'bg-light-surface/90 text-light-text'
                                  } backdrop-blur-sm`}>
                                    {index + 1} of {message.chartImages!.length}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()
                )}

                {/* File Names Display
                {message.fileNames && message.fileNames.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {message.fileNames.map((fileName: string, index: number) => (
                      <span 
                        key={index}
                        className="inline-flex items-center px-2 py-1 rounded-md text-xs bg-hthgse-500/20 text-hthgse-500 border border-hthgse-500/30"
                      >
                        <FileText className="w-3 h-3 mr-1" />
                        {fileName}
                      </span>
                    ))}
                  </div>
                )} */}
              </div>
              {!shouldShowThinking && (
                <div className="flex items-center justify-between mt-2">
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={handleCopyResponse}
                      className={`p-1 rounded transition-colors ${
                        copied
                          ? 'text-green-500 bg-green-500/20' 
                          : (isDarkMode 
                              ? 'text-dark-textSecondary hover:text-dark-text hover:bg-dark-border' 
                              : 'text-light-textSecondary hover:text-light-text hover:bg-light-border')
                      }`}
                      title={copied ? "Copied!" : "Copy response"}
                    >
                      {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  </button>
                    {message.id && (
                    <div className="flex items-center space-x-1">
                      <button
                        onClick={() => handleRating('thumbs_up')}
                        disabled={isRating}
                        className={`p-1 rounded transition-all duration-200 ${
                          rating === 'thumbs_up' 
                            ? 'text-hthgse-500 bg-hthgse-500/20' 
                            : (isDarkMode 
                                ? 'text-dark-textSecondary hover:text-hthgse-500 hover:bg-hthgse-500/10' 
                                : 'text-light-textSecondary hover:text-hthgse-500 hover:bg-hthgse-500/10')
                        } ${loadingButton === 'thumbs_up' ? 'opacity-60 cursor-not-allowed' : ''}`}
                        title={loadingButton === 'thumbs_up' ? "Saving..." : "Good response"}
                      >
                        <ThumbsUp className={`w-4 h-4 ${loadingButton === 'thumbs_up' ? 'animate-pulse text-hthgse-500' : ''}`} />
                  </button>
                      <button
                        onClick={() => handleRating('thumbs_down')}
                        disabled={isRating}
                        className={`p-1 rounded transition-all duration-200 ${
                          rating === 'thumbs_down' 
                            ? 'text-red-500 bg-red-500/20' 
                            : (isDarkMode 
                                ? 'text-dark-textSecondary hover:text-red-500 hover:bg-red-500/10' 
                                : 'text-light-textSecondary hover:text-red-500 hover:bg-red-500/10')
                        } ${loadingButton === 'thumbs_down' ? 'opacity-60 cursor-not-allowed' : ''}`}
                        title={loadingButton === 'thumbs_down' ? "Saving..." : "Poor response"}
                      >
                        <ThumbsDown className={`w-4 h-4 ${loadingButton === 'thumbs_down' ? 'animate-pulse text-red-500' : ''}`} />
                  </button>
                    </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {isUser && (
          <div className={`rounded-lg p-3 sm:p-4 inline-block ${
            isDarkMode ? 'bg-dark-surface' : 'bg-light-surface'
          }`}>
            <div className={`prose prose-sm ${isDarkMode ? 'prose-invert' : ''} max-w-none overflow-hidden`}
              style={{ wordWrap: 'break-word', overflowWrap: 'anywhere' }}>
              <Markdown
                key={`${message.id}-user-${messages.reduce((acc, m) => acc + (m.downloadableFiles?.length || 0), 0)}`}
                remarkPlugins={[remarkGfm, remarkMath]}
                rehypePlugins={[rehypeKatex]}
                components={MarkdownComponents}
                urlTransform={(url) => url}
              >
                {message.content}
              </Markdown>
            </div>
            
            {/* File Names Display for User Messages */}
            {message.fileNames && message.fileNames.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {message.fileNames.map((fileName: string, index: number) => (
                  <span 
                    key={index}
                    className="inline-flex items-center px-2 py-1 rounded-md text-xs bg-hthgse-500/20 text-hthgse-500 border border-hthgse-500/30"
                  >
                    <FileText className="w-3 h-3 mr-1" />
                    {fileName}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default Message