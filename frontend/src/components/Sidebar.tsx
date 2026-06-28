import type React from "react";
import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { PanelLeft, Plus, Search, MoreHorizontal, User, Loader2 } from "lucide-react";
import { useTheme } from "../context/ThemeContext";
import ChatContextMenu from "./ChatContextMenu";
import type { Chat } from "../stores";

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  isMobile?: boolean;
  onMobileClose?: () => void;
  onCreateNewChat?: () => void;
  basePath?: string;
  // Store data passed as props
  threads: Chat[];
  isLoadingThreads: boolean;
  deletingThreads: Set<string>;
  deleteChat: (threadId: string) => Promise<void>;
}

const Sidebar: React.FC<SidebarProps> = ({
  collapsed,
  onToggle,
  isMobile = false,
  onMobileClose,
  onCreateNewChat,
  basePath = "/chat",
  threads,
  isLoadingThreads,
  deletingThreads,
  deleteChat,
}) => {
  const { isDarkMode } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{
    isOpen: boolean;
    threadId: string | null;
    position: { x: number; y: number };
  }>({
    isOpen: false,
    threadId: null,
    position: { x: 0, y: 0 },
  });

  const handleNewChat = () => {
    if (onCreateNewChat) {
      onCreateNewChat();
    }
    navigate(basePath);
    // Close mobile menu after creating new chat
    if (isMobile && onMobileClose) {
      onMobileClose();
    }
  };

  const handleThreadSelect = (threadId: string) => {
    navigate(`${basePath}/${threadId}`);
    // Close mobile menu after selection
    if (isMobile && onMobileClose) {
      onMobileClose();
    }
  };

  const handleContextMenu = (e: React.MouseEvent, threadId: string) => {
    e.preventDefault();
    e.stopPropagation();

    let position;
    if (isMobile) {
      // On mobile, position the menu on the left side
      position = { x: e.clientX - 150, y: e.clientY };
    } else {
      // On desktop, position at cursor location
      position = { x: e.clientX, y: e.clientY };
    }

    setContextMenu({
      isOpen: true,
      threadId,
      position,
    });
  };

  const closeContextMenu = () => {
    setContextMenu({
      isOpen: false,
      threadId: null,
      position: { x: 0, y: 0 },
    });
  };

  const handleDeleteChat = async (threadId: string) => {
    try {
      // Show confirmation dialog
      const confirmed = window.confirm(
        "Are you sure you want to delete this chat? This action cannot be undone.",
      );
      if (!confirmed) {
        closeContextMenu();
        return;
      }

      await deleteChat(threadId);

      // If this was the current thread, navigate to new chat
      if (location.pathname === `${basePath}/${threadId}`) {
        navigate(basePath);
      }

      closeContextMenu();
    } catch (error) {
      console.error("Failed to delete chat:", error);
      // You could add a toast notification here
    }
  };

  const handleSearch = (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    // Filter threads locally by title (case-insensitive)
    const filteredThreads = threads.filter((thread) =>
      thread.title.toLowerCase().includes(query.toLowerCase()),
    );

    setSearchResults(filteredThreads);
  };

  const handleSearchInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    setSearchQuery(query);

    // Immediate search since it's just local filtering
    handleSearch(query);
  };

  return (
    <div
      className={`flex flex-col h-full transition-all duration-300 ease-in-out ${
        isDarkMode ? "bg-dark-surface" : "bg-light-surface"
      } ${
        isMobile 
          ? "w-full" 
          : `flex-shrink-0 ${collapsed ? "w-16" : "w-64"}`
      }`}
    >
      {/* Top section with toggle button and logo */}
      <div
        className={`px-3 py-[0.87rem] border-b flex items-center justify-between ${
          isDarkMode ? "border-dark-border" : "border-light-border"
        }`}
      >
        {(!collapsed || isMobile) && (
          <a href="https://hthgse.edu/ncie" className="flex items-center space-x-2">
            <div className="w-6 h-6 flex items-center justify-center">
              <img
                src="/NCIE-Logo_FullColor.png"
                alt="NCIE Logo"
                className="w-6 h-6"
                onError={(e) => {
                  e.currentTarget.style.display = "none";
                  e.currentTarget.nextElementSibling?.classList.remove(
                    "hidden",
                  );
                }}
              />
              <div className="w-6 h-6 bg-hthgse-600 rounded-sm flex items-center justify-center text-xs font-bold text-white hidden">
                N
              </div>
            </div>
            {!collapsed && (
              <span
                className={`font-medium text-sm ${
                  isDarkMode ? "text-dark-text" : "text-light-text"
                }`}
              >
                NCIE
              </span>
            )}
          </a>
        )}
        <button
          onClick={isMobile ? onMobileClose : onToggle}
          className={`p-1 rounded transition-colors ${
            isDarkMode ? "hover:bg-dark-border" : "hover:bg-light-border"
          }`}
        >
          <PanelLeft
            className={`w-5 h-5 ${
              isDarkMode
                ? "text-dark-textSecondary"
                : "text-light-textSecondary"
            } ${isMobile ? "rotate-180" : ""}`}
          />
        </button>
      </div>

      {/* Navigation Items */}
      <div
        className={`p-3 border-b ${
          isDarkMode ? "border-dark-border" : "border-light-border"
        }`}
      >
        <div className="space-y-1">
          <button
            onClick={handleNewChat}
            className={`flex items-center space-x-3 w-full p-2 text-left rounded-lg text-sm transition-colors ${
              isDarkMode
                ? "hover:bg-dark-border text-dark-text"
                : "hover:bg-light-border text-light-text"
            }`}
            title="New chat"
          >
            <Plus
              className={`w-4 h-4 ${
                isDarkMode
                  ? "text-dark-textSecondary"
                  : "text-light-textSecondary"
              }`}
            />
            {(!collapsed || isMobile) && <span>New chat</span>}
          </button>

          {(!collapsed || isMobile) && (
            <div className="relative">
              <input
                type="text"
                placeholder="Search chats..."
                value={searchQuery}
                onChange={handleSearchInputChange}
                className={`w-full p-2 pl-8 rounded-lg text-sm border transition-colors ${
                  isDarkMode
                    ? "bg-dark-surface border-dark-border text-dark-text placeholder-dark-textSecondary"
                    : "bg-light-background border-light-border text-light-text placeholder-light-textSecondary"
                }`}
              />
              <Search
                className={`absolute left-2 top-2.5 w-4 h-4 ${
                  isDarkMode
                    ? "text-dark-textSecondary"
                    : "text-light-textSecondary"
                }`}
              />
            </div>
          )}
        </div>
      </div>

      {/* Chats Section */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-3">
          {(!collapsed || isMobile) && (
            <h3
              className={`text-xs font-medium mb-2 ${
                isDarkMode
                  ? "text-dark-textSecondary"
                  : "text-light-textSecondary"
              }`}
            >
              {searchQuery
                ? `Search results (${searchResults.length})`
                : "Recent"}
            </h3>
          )}
          <div className="space-y-1">
            {isLoadingThreads ? (
              // Show loading spinner when loading threads
              <div className="flex items-center justify-center py-8">
                <div className="text-center">
                  <div
                    className={`inline-flex items-center space-x-2 ${
                      isDarkMode
                        ? "text-dark-textSecondary"
                        : "text-light-textSecondary"
                    }`}
                  >
                    <Loader2 className="animate-spin h-5 w-5 text-hthgse-500" />
                    {(!collapsed || isMobile) && <span className="text-sm">Loading chats...</span>}
                  </div>
                </div>
              </div>
            ) : (searchQuery ? searchResults : threads).length === 0 ? (
              // Show "no chats" message when not loading and no threads
              <div
                className={`text-center py-4 text-sm ${
                  isDarkMode
                    ? "text-dark-textSecondary"
                    : "text-light-textSecondary"
                }`}
              >
                {searchQuery ? `No chats found for "${searchQuery}"` : "No chats yet"}
              </div>
            ) : (
              // Show threads when loaded
              (searchQuery ? searchResults : threads).map((thread) => {
                const displayTitle =
                  thread.title.length > 30
                    ? thread.title.split(" ").slice(0, 4).join(" ") + "..."
                    : thread.title;
                
                const isDeleting = deletingThreads.has(thread.id);

                return (
                  <div
                    key={thread.id}
                    className={`group relative flex items-center rounded-lg transition-all duration-200 ${
                      isDeleting
                        ? "opacity-50 pointer-events-none" // Grey out and disable interaction when deleting
                        : location.pathname === `${basePath}/${thread.id}`
                          ? isDarkMode
                            ? "bg-dark-border"
                            : "bg-light-border"
                          : isDarkMode
                            ? "hover:bg-dark-border"
                            : "hover:bg-light-border"
                    }`}
                  >
                    <button
                      onClick={() => handleThreadSelect(thread.id)}
                      className={`flex-1 text-left p-2 text-sm transition-colors ${
                        isDarkMode ? "text-dark-text" : "text-light-text"
                      }`}
                      title={thread.title}
                    >
                      {collapsed && !isMobile ? (
                        <div className="truncate text-center">💬</div>
                      ) : (
                        <div className="flex items-center space-x-2">
                          <div className="truncate max-w-44" title={isDeleting ? "Deleting..." : thread.title}>
                            {displayTitle}
                          </div>
                          {isDeleting && (
                            <div className="flex items-center space-x-1 flex-shrink-0">
                              <Loader2 className={`w-3 h-3 animate-spin ${isDarkMode ? 'text-dark-textSecondary' : 'text-light-textSecondary'}`} />
                              <span className={`text-xs ${
                                isDarkMode ? 'text-dark-textSecondary' : 'text-light-textSecondary'  
                              }`}>
                                Deleting...
                              </span>
                            </div>
                          )}
                        </div>
                      )}
                    </button>

                    {/* Three dots menu - only show on hover and when not collapsed */}
                    {(!collapsed || isMobile) && (
                      <button
                        onClick={(e) => handleContextMenu(e, thread.id)}
                        className={`mr-2 p-1 rounded transition-opacity ${
                          isMobile 
                            ? "opacity-100" 
                            : "opacity-0 group-hover:opacity-100"
                        } ${
                          isDarkMode
                            ? "hover:bg-gray-700 text-gray-400"
                            : "hover:bg-gray-200 text-gray-500"
                        }`}
                        title="More options"
                      >
                        <MoreHorizontal className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Bottom Section - Anonymous User */}
      <div
        className={`p-3 border-t ${
          isDarkMode ? "border-dark-border" : "border-light-border"
        }`}
      >
        <div className="flex items-center space-x-2">
          <div className="w-6 h-6 bg-hthgse-500 rounded-full flex items-center justify-center text-xs font-bold text-white">
            <User className="w-4 h-4" />
          </div>
          {(!collapsed || isMobile) && (
            <div className="flex-1">
              <div
                className={`text-sm font-medium ${
                  isDarkMode ? "text-dark-text" : "text-light-text"
                }`}
              >
                Anonymous User
              </div>
              <div
                className={`text-xs ${
                  isDarkMode
                    ? "text-dark-textSecondary"
                    : "text-light-textSecondary"
                }`}
              >
                User Unknown
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Context Menu */}
      <ChatContextMenu
        isOpen={contextMenu.isOpen}
        onClose={closeContextMenu}
        onDelete={() =>
          contextMenu.threadId && handleDeleteChat(contextMenu.threadId)
        }
        position={contextMenu.position}
      />
    </div>
  );
};

export default Sidebar;
