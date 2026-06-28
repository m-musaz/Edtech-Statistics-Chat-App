import type React from "react"
import { useRef, useEffect } from "react"
import Message from "./Message"
import { useMessages } from "../stores"
import { useTheme } from "../context/ThemeContext"

interface MessageProps {
  id: string
  content: string
  role: "user" | "assistant"
  timestamp: Date
}

interface MessageListProps {
  messages: MessageProps[]
}

const MessageList: React.FC<MessageListProps> = ({ messages }) => {
  const { isStreaming } = useMessages()
  const { isDarkMode } = useTheme()
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const scrollIntervalRef = useRef<NodeJS.Timeout | null>(null)
  
  const scrollToBottom = (immediate = false) => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ 
        behavior: immediate ? 'auto' : 'smooth'
      })
    }
  }

  // Auto-scroll when messages change
  useEffect(() => {
    // Small delay to ensure DOM has updated, especially for new messages
    const timer = setTimeout(() => {
      scrollToBottom()
    }, 100)
    
    return () => clearTimeout(timer)
  }, [messages.length])

  useEffect(() => {
    if (isStreaming) {
      scrollIntervalRef.current = setInterval(() => {
        scrollToBottom(true) // Immediate scroll during streaming
      }, 200) // Scroll every 200ms during streaming
    } else {
      // Stop continuous scrolling when not streaming
      if (scrollIntervalRef.current) {
        clearInterval(scrollIntervalRef.current)
        scrollIntervalRef.current = null
      }
    }

    // Cleanup interval on unmount or when streaming stops
    return () => {
      if (scrollIntervalRef.current) {
        clearInterval(scrollIntervalRef.current)
        scrollIntervalRef.current = null
      }
    }
  }, [isStreaming])

  return (
    <div className={`flex-1 overflow-y-auto overflow-x-hidden ${
      isDarkMode ? 'bg-dark-background' : 'bg-light-background'
    }`}>
      {messages.map((message) => (
        <Message key={message.id} message={message} />
      ))}
      
      {/* Auto-scroll anchor */}
      <div ref={messagesEndRef} />
    </div>
  )
}

export default MessageList