import React from 'react';
import { Loader2 } from 'lucide-react';
import { Navigate } from 'react-router-dom';
import { useAdminAuth } from '../../context/AdminAuthContext';
import { useTheme } from '../../context/ThemeContext';

interface ProtectedAdminRouteProps {
  children: React.ReactNode;
}

const ProtectedAdminRoute: React.FC<ProtectedAdminRouteProps> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAdminAuth();
  const { isDarkMode } = useTheme();

  // Show loading spinner while checking auth
  if (isLoading) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${
        isDarkMode ? 'bg-dark-background' : 'bg-light-background'
      }`}>
        <div className="flex flex-col items-center space-y-4">
          <Loader2 className="animate-spin h-12 w-12 text-hthgse-600" />
          <p className={`text-sm ${
            isDarkMode ? 'text-dark-textSecondary' : 'text-light-textSecondary'
          }`}>
            Verifying admin access...
          </p>
        </div>
      </div>
    );
  }

  // Redirect to admin login if not authenticated
  if (!isAuthenticated) {
    return <Navigate to="/admin/login" replace />;
  }

  // Render protected content if authenticated
  return <>{children}</>;
};

export default ProtectedAdminRoute;
