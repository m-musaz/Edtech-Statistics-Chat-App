import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAdminAuth } from '../context/AdminAuthContext';
import { useTheme } from '../context/ThemeContext';

const AdminLoginPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const { login } = useAdminAuth();
  const { isDarkMode } = useTheme();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      await login(email, password);
      navigate('/admin');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={`min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 ${
      isDarkMode ? 'bg-dark-background' : 'bg-light-background'
    }`}>
      <div className="max-w-md w-full space-y-8">
        <div>
          <img src="/NCIE-Logo_FullColor.png" alt="NCIE Logo" className="w-16 h-16 mx-auto mb-4" />
          <h2 className={`mt-6 text-center text-3xl font-extrabold ${
            isDarkMode ? 'text-dark-text' : 'text-light-text'
          }`}>
            NCIE Admin Login
          </h2>
          <p className={`mt-2 text-center text-sm ${
            isDarkMode ? 'text-dark-textSecondary' : 'text-light-textSecondary'
          }`}>
            Access the admin dashboard
          </p>
        </div>
        
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative">
              <span className="block sm:inline">{error}</span>
            </div>
          )}
          
          <div className="space-y-4">
            <div>
              <label htmlFor="email" className={`block text-sm font-medium ${
                isDarkMode ? 'text-dark-text' : 'text-light-text'
              }`}>
                Email address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={`mt-1 appearance-none relative block w-full px-3 py-3 border rounded-md placeholder-gray-500 focus:outline-none focus:ring-hthgse-500 focus:border-hthgse-500 focus:z-10 sm:text-sm ${
                  isDarkMode 
                    ? 'bg-dark-surface border-dark-border text-dark-text' 
                    : 'bg-light-surface border-light-border text-light-text'
                }`}
                placeholder="Enter admin email"
              />
            </div>
            
            <div>
              <label htmlFor="password" className={`block text-sm font-medium ${
                isDarkMode ? 'text-dark-text' : 'text-light-text'
              }`}>
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={`mt-1 appearance-none relative block w-full px-3 py-3 border rounded-md placeholder-gray-500 focus:outline-none focus:ring-hthgse-500 focus:border-hthgse-500 focus:z-10 sm:text-sm ${
                  isDarkMode 
                    ? 'bg-dark-surface border-dark-border text-dark-text' 
                    : 'bg-light-surface border-light-border text-light-text'
                }`}
                placeholder="Enter admin password"
              />
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={isLoading}
              className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-hthgse-600 hover:bg-hthgse-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-hthgse-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <div className="flex items-center">
                  <Loader2 className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" />
                  Signing in...
                </div>
              ) : (
                'Sign in'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AdminLoginPage;
