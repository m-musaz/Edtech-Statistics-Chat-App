import React, { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Moon, Sun, HelpCircle, PanelLeft, Loader2 } from "lucide-react";
import { Button } from "../components/ui/button";
import Sidebar from "../components/Sidebar";
import ChatInterface from "../components/ChatInterface";
import HelpModal from "../components/HelpModal";
import { usePlanThreads, usePlanMessages, usePlanChatStore } from "../stores";
import { useTheme } from "../context/ThemeContext";
import { isAuthError } from "../lib/errorUtils";

const BASE_PATH = "/plan-3321";

const PlanChatPage: React.FC = () => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [helpModalOpen, setHelpModalOpen] = useState(false);
  const { isDarkMode, toggleTheme } = useTheme();
  const HELP_MODAL_SEEN_KEY = 'helpModalSeen';
  const {
    setCurrentThreadId,
    loadThreadMessages,
    loadThreads,
    threads,
    isLoadingThreads,
    deletingThreads,
    deleteChat,
  } = usePlanThreads();
  const {
    messages,
    sendMessageToAPI,
    isLoadingMessages,
    setMessages,
    clearCurrentFile,
  } = usePlanMessages();
  const { threadId } = useParams<{ threadId?: string }>();
  const navigate = useNavigate();
  const fetchHelpText = usePlanChatStore((s) => s.fetchHelpText);
  const isHelpTextLoading = usePlanChatStore((s) => s.isHelpTextLoading);

  // Determine if this is a new chat or existing thread
  const isNewChat = !threadId;

  // Create new chat functionality
  const createNewChat = useCallback(() => {
    setCurrentThreadId(null);
    setMessages([]);
    clearCurrentFile();
    navigate(BASE_PATH, { replace: true });
  }, [setCurrentThreadId, setMessages, clearCurrentFile, navigate]);

  // Load threads on mount - silent refresh if we have persisted data
  useEffect(() => {
    // Prefetch help text for HelpModal
    fetchHelpText();

    const hasPersistedThreads = threads.length > 0;
    const silent = hasPersistedThreads; // Silent if we already have threads from persistence

    console.log(`[Plan] Loading threads: ${hasPersistedThreads ? 'silent refresh' : 'initial load'} (${threads.length} persisted threads)`);

    loadThreads(silent).catch(error => {
      console.error('[Plan] Failed to load threads:', error);
    });
  }, [loadThreads]); // Only run once on mount, loadThreads is stable

  useEffect(() => {
    const hasSeenHelpModal = localStorage.getItem(HELP_MODAL_SEEN_KEY);

    if (hasSeenHelpModal) return;

    const timer = setTimeout(() => {
      setHelpModalOpen(true);
    }, 500);

    return () => clearTimeout(timer);
  }, []);

  // Handle initialization based on chat mode
  useEffect(() => {
    if (isNewChat) {
      // New chat mode: clear state to ensure clean start
      setCurrentThreadId(null);
      setMessages([]);
      clearCurrentFile();
    } else if (threadId) {
      // Existing thread mode: always load fresh messages on mount/navigation
      console.log('[Plan] Loading thread messages for:', threadId);
      setCurrentThreadId(threadId);

      // Always load fresh messages (don't trust cached data after page reload)
      loadThreadMessages(threadId).catch(error => {
        console.error('[Plan] Failed to load messages for thread:', threadId, error);

        // If session expired/unauthorized, redirect to clean chat
        if (isAuthError(error)) {
          console.log('[Plan] Session expired while loading thread, redirecting to new chat');
          navigate(BASE_PATH, { replace: true });
        }
        // If thread doesn't exist anymore, redirect to new chat
        else if (error?.response?.status === 404) {
          console.log('[Plan] Thread not found, redirecting to new chat');
          navigate(BASE_PATH, { replace: true });
        }
      });
    }
  }, [threadId, isNewChat, setCurrentThreadId, setMessages, clearCurrentFile, loadThreadMessages, navigate]);

  const handleSendMessage = async (message: string) => {
    try {
      // Use experiment_type = "plan" for this page
      const response = await sendMessageToAPI(message, true, "plan");

      // If this was a new chat and we got a thread_id, update the URL without navigation
      if (isNewChat && response?.thread_id) {
        const url = `${BASE_PATH}/${response.thread_id}`;
        window.history.replaceState(null, '', url);
      }
    } catch (error) {
      console.error("[Plan] Failed to send message:", error);
    }
  };

  const handleHelpModalClose = () => {
    setHelpModalOpen(false);
    localStorage.setItem(HELP_MODAL_SEEN_KEY, 'true');
  };

  return (
    <div
      className={`flex h-screen overflow-hidden relative ${
        isDarkMode ? "bg-gray-900" : "bg-white"
      }`}
    >
      {/* Desktop Sidebar - Hidden on mobile */}
      <div className="hidden md:block">
        <Sidebar
          collapsed={sidebarCollapsed}
          onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
          onCreateNewChat={createNewChat}
          basePath={BASE_PATH}
          threads={threads}
          isLoadingThreads={isLoadingThreads}
          deletingThreads={deletingThreads}
          deleteChat={deleteChat}
        />
      </div>

      {/* Mobile Sidebar Overlay */}
      <>
        {/* Backdrop */}
        <div
          className={`fixed inset-0 bg-black transition-opacity duration-300 z-40 md:hidden ${
            mobileMenuOpen
              ? "bg-opacity-50 pointer-events-auto"
              : "bg-opacity-0 pointer-events-none"
          }`}
          onClick={() => setMobileMenuOpen(false)}
        />
        {/* Sidebar */}
        <div
          className={`fixed inset-y-0 left-0 z-50 w-80 transform transition-transform duration-300 ease-in-out md:hidden ${
            mobileMenuOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <Sidebar
            collapsed={false}
            onToggle={() => setMobileMenuOpen(false)}
            isMobile={true}
            onMobileClose={() => setMobileMenuOpen(false)}
            onCreateNewChat={createNewChat}
            basePath={BASE_PATH}
            threads={threads}
            isLoadingThreads={isLoadingThreads}
            deletingThreads={deletingThreads}
            deleteChat={deleteChat}
          />
        </div>
      </>

      <div className="flex-1 flex flex-col min-w-0">
        {/* ChatGPT-style header */}
        <div
          className={`flex items-center justify-between px-4 py-3 border-b relative z-10 ${
            isDarkMode
              ? "border-gray-700 bg-gray-800"
              : "border-gray-200 bg-white"
          }`}
        >
          <div className="flex items-center space-x-3">
            {/* Mobile Menu Button */}
            <Button
              variant="outline"
              size="sm"
              className="p-2 md:hidden"
              onClick={() => setMobileMenuOpen(true)}
              title="Open menu"
            >
              <PanelLeft className="h-4 w-4" />
            </Button>
            <div className="flex items-center space-x-2">
              <span
                className={`text-sm font-medium ${
                  isDarkMode ? "text-gray-200" : "text-gray-800"
                }`}
              >
                Planned Experiment Generator
              </span>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={toggleTheme}
              className="p-2"
              title={isDarkMode ? "Switch to light mode" : "Switch to dark mode"}
            >
              {isDarkMode ? (
                <Sun className="h-4 w-4" />
              ) : (
                <Moon className="h-4 w-4" />
              )}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/about')}
              className="px-3 py-2"
              title="About"
            >
              About
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="p-2"
              onClick={() => setHelpModalOpen(true)}
              title="Help"
            >
              {isHelpTextLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <HelpCircle className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>

        {/* Chat Interface Container - Takes remaining height */}
        <div className="flex-1 overflow-hidden">
          <ChatInterface
            messages={messages}
            onSendMessage={handleSendMessage}
            isLoadingMessages={isLoadingMessages}
            storeType="plan"
          />
        </div>
      </div>

      {/* Help Modal */}
      <HelpModal
        isOpen={helpModalOpen}
        onClose={handleHelpModalClose}
      />
    </div>
  );
};

export default PlanChatPage;
