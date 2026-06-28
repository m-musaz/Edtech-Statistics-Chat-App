import React from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/context/ThemeContext";
import { useAdminAuth } from "@/context/AdminAuthContext";
import { Sun, Moon, User, LogOut } from "lucide-react";

const AdminHeader: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { isDarkMode, toggleTheme } = useTheme();
  const { user, logout } = useAdminAuth();
  const isSettings = location.pathname.endsWith('/admin/settings');

  const handleLogout = async () => {
    await logout();
    navigate('/admin/login');
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">{isSettings ? "AI Chatbot Settings" : "AI Chatbot Analytics"}</h1>
          <p className="text-sm md:text-base text-muted-foreground">{isSettings ? 'Modify your Chatbot Settings' : 'Monitor your chatbot\'s performance and usage'}</p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
          {/* Page Nav */}
          <div className="flex items-center gap-2">
            <Link to="/admin">
              <Button variant={isSettings ? "outline" : "default"} size="sm">Analytics</Button>
            </Link>
            <Link to="/admin/settings">
              <Button variant={isSettings ? "default" : "outline"} size="sm">Settings</Button>
            </Link>
          </div>

          {/* Theme toggle and User Actions */}
          <div className="flex items-center gap-3 sm:gap-4">
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

            {/* Admin User Info and Logout */}
            <div className="flex items-center gap-3 pl-3 sm:pl-4 border-l border-border">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs sm:text-sm text-foreground truncate max-w-32 sm:max-w-none">{user?.email}</span>
              </div>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleLogout}
                className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm px-2 sm:px-3"
              >
                <LogOut className="h-3 w-3 sm:h-4 sm:w-4" />
                <span className="hidden xs:inline">Logout</span>
                <span className="xs:hidden">Exit</span>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminHeader;


