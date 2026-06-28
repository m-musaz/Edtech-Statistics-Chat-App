import React from "react";
import { useNavigate } from "react-router-dom";
import { CheckCircle } from "lucide-react";
import { useTheme } from "../context/ThemeContext";

const NotFoundPage: React.FC = () => {
  const { isDarkMode } = useTheme();
  const navigate = useNavigate();

  const handleGoHome = () => {
    navigate("/chat");
  };

  return (
    <div
      className={`min-h-screen flex items-center justify-center ${
        isDarkMode ? "bg-gray-900" : "bg-white"
      }`}
    >
      <div className="text-center">
        <div className="mb-8">
          <div className="w-24 h-24 mx-auto mb-4">
            <div
              className={`w-full h-full rounded-full flex items-center justify-center ${
                isDarkMode ? "bg-gray-700" : "bg-gray-100"
              }`}
            >
              <CheckCircle className="w-12 h-12" />
            </div>
          </div>
        </div>

        <h1
          className={`text-4xl font-semibold mb-4 ${
            isDarkMode ? "text-white" : "text-gray-900"
          }`}
        >
          Page Not Found
        </h1>

        <p
          className={`text-lg mb-8 ${
            isDarkMode ? "text-gray-300" : "text-gray-600"
          }`}
        >
          The page you're looking for doesn't exist.
        </p>

        <button
          onClick={handleGoHome}
          className={`px-6 py-3 rounded-lg font-medium transition-colors ${
            isDarkMode
              ? "bg-blue-600 hover:bg-blue-700 text-white"
              : "bg-blue-500 hover:bg-blue-600 text-white"
          }`}
        >
          Go to New Chat
        </button>
      </div>
    </div>
  );
};

export default NotFoundPage;
