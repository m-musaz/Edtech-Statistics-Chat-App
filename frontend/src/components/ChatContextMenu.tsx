import React, { useRef, useEffect } from "react";
import { useTheme } from "../context/ThemeContext";

interface ChatContextMenuProps {
  isOpen: boolean;
  onClose: () => void;
  onDelete: () => void;
  position: { x: number; y: number };
}

const ChatContextMenu: React.FC<ChatContextMenuProps> = ({
  isOpen,
  onClose,
  onDelete,
  position,
}) => {
  const { isDarkMode } = useTheme();
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleEscape);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      ref={menuRef}
      className={`fixed z-50 w-48 rounded-lg shadow-lg border ${
        isDarkMode
          ? "bg-gray-800 border-gray-700"
          : "bg-white border-gray-200"
      }`}
      style={{
        left: position.x,
        top: position.y,
      }}
    >
      <div className="py-1">
        {/* Delete Option */}
        <button
          onClick={() => {
            onDelete();
            onClose();
          }}
          className={`w-full px-4 py-2 text-left text-sm flex items-center space-x-3 hover:bg-opacity-10 transition-colors ${
            isDarkMode
              ? "text-red-400 hover:bg-red-900 hover:bg-opacity-20"
              : "text-red-600 hover:bg-red-50"
          }`}
        >
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
            />
          </svg>
          <span>Delete chat</span>
        </button>
      </div>
    </div>
  );
};

export default ChatContextMenu;
