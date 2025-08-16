// hooks/useAuth.js
import { useState, useEffect, useCallback } from 'react';
import { authManager } from '../utils/auth';
import { authAPI } from '../utils/api';

export const useAuth = () => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Initialize auth state
  useEffect(() => {
    checkAuthStatus();
  }, []);

  const checkAuthStatus = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      if (authManager.isAuthenticated()) {
        const userData = authManager.getUser();
        
        // Verify token is still valid by making a request to /me endpoint
        try {
          const currentUser = await authAPI.getCurrentUser();
          setUser(currentUser.user);
          setIsAuthenticated(true);
        } catch (apiError) {
          // Token might be invalid, clear auth
          console.error('Token validation failed:', apiError);
          authManager.clearAuth();
          setUser(null);
          setIsAuthenticated(false);
        }
      } else {
        setUser(null);
        setIsAuthenticated(false);
      }
    } catch (error) {
      console.error('Auth status check failed:', error);
      setError(error.message);
      setUser(null);
      setIsAuthenticated(false);
    } finally {
      setLoading(false);
    }
  }, []);

  const login = useCallback(async (credentials, rememberMe = false) => {
    try {
      setLoading(true);
      setError(null);

      const response = await authAPI.login(credentials);
      
      if (response.token && response.user) {
        authManager.setAuth(response.token, response.user, rememberMe);
        setUser(response.user);
        setIsAuthenticated(true);
        return response;
      } else {
        throw new Error('Invalid response from server');
      }
    } catch (error) {
      console.error('Login failed:', error);
      setError(error.message);
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);

  const register = useCallback(async (userData) => {
    try {
      setLoading(true);
      setError(null);

      const response = await authAPI.register(userData);
      
      if (response.token && response.user) {
        authManager.setAuth(response.token, response.user, false);
        setUser(response.user);
        setIsAuthenticated(true);
        return response;
      } else {
        throw new Error('Invalid response from server');
      }
    } catch (error) {
      console.error('Registration failed:', error);
      setError(error.message);
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      setLoading(true);
      await authAPI.logout();
    } catch (error) {
      console.error('Logout API call failed:', error);
    } finally {
      authManager.clearAuth();
      setUser(null);
      setIsAuthenticated(false);
      setLoading(false);
      window.location.href = '/login';
    }
  }, []);

  const updateProfile = useCallback(async (profileData) => {
    try {
      const response = await authAPI.updateProfile(profileData);
      const updatedUser = { ...user, ...response.user };
      setUser(updatedUser);
      
      // Update stored user data
      authManager.setAuth(authManager.getToken(), updatedUser, 
        localStorage.getItem('infiniteCargoRememberMe') === 'true');
      
      return response;
    } catch (error) {
      console.error('Profile update failed:', error);
      setError(error.message);
      throw error;
    }
  }, [user]);

  const refreshToken = useCallback(async () => {
    try {
      const newToken = await authManager.refreshToken();
      return newToken;
    } catch (error) {
      console.error('Token refresh failed:', error);
      logout(); // Force logout on refresh failure
      throw error;
    }
  }, [logout]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Auto-refresh token before it expires
  useEffect(() => {
    if (!isAuthenticated) return;

    const checkTokenExpiry = async () => {
      if (authManager.isTokenExpiringSoon()) {
        try {
          await refreshToken();
        } catch (error) {
          console.error('Auto token refresh failed:', error);
        }
      }
    };

    const interval = setInterval(checkTokenExpiry, 5 * 60 * 1000); // Check every 5 minutes
    return () => clearInterval(interval);
  }, [isAuthenticated, refreshToken]);

  return {
    user,
    isAuthenticated,
    loading,
    error,
    login,
    register,
    logout,
    updateProfile,
    refreshToken,
    clearError,
    checkAuthStatus,
    // Utility functions
    getUserType: () => user?.userType || null,
    hasRole: (role) => user?.userType === role,
    isDriver: () => user?.userType === 'driver',
    isCargoOwner: () => user?.userType === 'cargo_owner',
    isAdmin: () => user?.userType === 'admin',
    getDefaultDashboard: () => authManager.getDefaultDashboard()
  };
};

export default useAuth;