import type React from "react";
import { useTheme } from "../context/ThemeContext";
import MessageList from "./MessageList";
import { Loader2 } from "lucide-react";
import ChatInput from "./ChatInput";

interface Message {
  id: string;
  content: string;
  role: "user" | "assistant";
  timestamp: Date;
  chartImages?: string[];
  fileNames?: string[];
  fileIds?: string[];
  assistant_message_id?: string;
  response_id?: string;
  rating?: "thumbs_up" | "thumbs_down" | null;
}

interface ChatInterfaceProps {
  messages: Message[];
  onSendMessage: (message: string) => void;
  isLoadingMessages: boolean;
  storeType?: "control" | "plan";
}

const ChatInterface: React.FC<ChatInterfaceProps> = ({
  messages,
  onSendMessage,
  isLoadingMessages,
  storeType = "control",
}) => {
  const { isDarkMode } = useTheme();

  const handleSendMessage = async (message: string) => {
    await onSendMessage(message);
  };

  return (
    <div
      className={`h-full flex flex-col transition-colors duration-300 ${
        isDarkMode ? "bg-dark-background" : "bg-light-background"
      }`}
    >
      {isLoadingMessages ? (
        // Show loading spinner when loading messages
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div
              className={`inline-flex items-center space-x-2 ${
                isDarkMode
                  ? "text-dark-textSecondary"
                  : "text-light-textSecondary"
              }`}
            >
            <Loader2 className="animate-spin h-8 w-8 text-hthgse-500" />
              <span className="text-lg">Loading messages...</span>
            </div>
          </div>
        </div>
      ) : messages.length > 0 ? (
        // Show messages if we have them and not loading
        <>
          <MessageList messages={messages} />
          <div className="flex-shrink-0">
            <ChatInput onSendMessage={handleSendMessage} storeType={storeType} />
          </div>
        </>
      ) : (
        <div className="flex-1 flex items-center justify-center min-h-0">
          <div className="text-center max-w-4xl mx-auto px-4">
            {/* ChatGPT-style logo */}
            <div className="mb-8">
              <div className="w-16 h-16 mx-auto mb-4">
                <div
                  className={`w-full h-full rounded-full flex items-center justify-center bg-transparent`}
                >
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
              </div>
            </div>

            {/* ChatGPT-style title */}
            <h1
              className={`text-4xl font-semibold mb-2 ${
                isDarkMode ? "text-white" : "text-gray-900"
              }`}
            >
              How can I help you today?
            </h1>

            {/* ChatGPT-style suggestion cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-8 mb-8">
              <div
                className={`p-4 rounded-lg border cursor-pointer transition-colors hover:shadow-md ${
                  isDarkMode
                    ? "border-gray-600 hover:bg-gray-800 text-white"
                    : "border-gray-200 hover:bg-gray-50 text-gray-900"
                }`}
              >
                <h3 className="font-medium mb-1">Create a control chart</h3>
                <p className="text-sm text-gray-500">
                  Upload your data and I'll help you create the right control
                  chart
                </p>
              </div>
              <div
                className={`p-4 rounded-lg border cursor-pointer transition-colors hover:shadow-md ${
                  isDarkMode
                    ? "border-gray-600 hover:bg-gray-800 text-white"
                    : "border-gray-200 hover:bg-gray-50 text-gray-900"
                }`}
              >
                <h3 className="font-medium mb-1">Analyze data patterns</h3>
                <p className="text-sm text-gray-500">
                  Get insights from your process data and identify trends
                </p>
              </div>
              <div
                className={`p-4 rounded-lg border cursor-pointer transition-colors hover:shadow-md ${
                  isDarkMode
                    ? "border-gray-600 hover:bg-gray-800 text-white"
                    : "border-gray-200 hover:bg-gray-50 text-gray-900"
                }`}
              >
                <h3 className="font-medium mb-1">Interpret results</h3>
                <p className="text-sm text-gray-500">
                  Understand what your control charts are telling you
                </p>
              </div>
              <div
                className={`p-4 rounded-lg border cursor-pointer transition-colors hover:shadow-md ${
                  isDarkMode
                    ? "border-gray-600 hover:bg-gray-800 text-white"
                    : "border-gray-200 hover:bg-gray-50 text-gray-900"
                }`}
              >
                <h3 className="font-medium mb-1">Learn about charts</h3>
                <p className="text-sm text-gray-500">
                  Understand different types of control charts and when to use
                  them
                </p>
              </div>
            </div>

            {/* ChatGPT-style input */}
            <div className="max-w-2xl mx-auto">
              <ChatInput onSendMessage={handleSendMessage} storeType={storeType} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatInterface;
