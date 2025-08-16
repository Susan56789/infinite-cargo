// utils/auth.js
import { jwtDecode } from 'jwt-decode'; 

class AuthManager {
  constructor() {
    this.TOKEN_KEY = 'infiniteCargoToken';
    this.USER_KEY = 'infiniteCargoUser';
    this.REMEMBER_KEY = 'infiniteCargoRememberMe';
    this.ADMIN_TOKEN_KEY = 'adminToken';
    this.ADMIN_USER_KEY = 'adminData';
    this.TOKEN_TIMESTAMP_KEY = 'infiniteCargoTokenTimestamp';
    this.ADMIN_TOKEN_TIMESTAMP_KEY = 'adminTokenTimestamp';
    
    // 6 hours in milliseconds
    this.TOKEN_EXPIRY_DURATION = 6 * 60 * 60 * 1000; // 6 hours
    
    // Start periodic cleanup
    this.startTokenExpiryCheck();
  }

  // Store token and user data with timestamp
  setAuth(token, user, rememberMe = false, isAdmin = false) {
    try {
      const tokenKey = isAdmin ? this.ADMIN_TOKEN_KEY : this.TOKEN_KEY;
      const userKey = isAdmin ? this.ADMIN_USER_KEY : this.USER_KEY;
      const timestampKey = isAdmin ? this.ADMIN_TOKEN_TIMESTAMP_KEY : this.TOKEN_TIMESTAMP_KEY;
      
      // Store current timestamp
      const currentTime = Date.now();
      
      if (rememberMe) {
        // Store in localStorage for persistence
        localStorage.setItem(tokenKey, token);
        localStorage.setItem(userKey, JSON.stringify(user));
        localStorage.setItem(timestampKey, currentTime.toString());
        localStorage.setItem(this.REMEMBER_KEY, 'true');
      } else {
        // Store in sessionStorage (cleared when browser closes)
        sessionStorage.setItem(tokenKey, token);
        sessionStorage.setItem(userKey, JSON.stringify(user));
        sessionStorage.setItem(timestampKey, currentTime.toString());
        // Remove from localStorage if it exists
        localStorage.removeItem(tokenKey);
        localStorage.removeItem(userKey);
        localStorage.removeItem(timestampKey);
        localStorage.removeItem(this.REMEMBER_KEY);
      }
    } catch (error) {
      console.error('Failed to store auth data:', error);
    }
  }

  // Get token from storage
  getToken(isAdmin = false) {
    try {
      const tokenKey = isAdmin ? this.ADMIN_TOKEN_KEY : this.TOKEN_KEY;
      return localStorage.getItem(tokenKey) || 
             sessionStorage.getItem(tokenKey);
    } catch (error) {
      console.error('Failed to get token:', error);
      return null;
    }
  }

  // Get token timestamp
  getTokenTimestamp(isAdmin = false) {
    try {
      const timestampKey = isAdmin ? this.ADMIN_TOKEN_TIMESTAMP_KEY : this.TOKEN_TIMESTAMP_KEY;
      const timestamp = localStorage.getItem(timestampKey) || 
                       sessionStorage.getItem(timestampKey);
      return timestamp ? parseInt(timestamp, 10) : null;
    } catch (error) {
      console.error('Failed to get token timestamp:', error);
      return null;
    }
  }

  // Get user data from storage
  getUser(isAdmin = false) {
    try {
      const userKey = isAdmin ? this.ADMIN_USER_KEY : this.USER_KEY;
      const userStr = localStorage.getItem(userKey) || 
                      sessionStorage.getItem(userKey);
      return userStr ? JSON.parse(userStr) : null;
    } catch (error) {
      console.error('Failed to get user data:', error);
      return null;
    }
  }

  // Check if token is expired based on our 6-hour rule
  isTokenExpiredByTime(isAdmin = false) {
    const timestamp = this.getTokenTimestamp(isAdmin);
    if (!timestamp) return true;
    
    const currentTime = Date.now();
    const tokenAge = currentTime - timestamp;
    
    return tokenAge >= this.TOKEN_EXPIRY_DURATION;
  }

  // Check if user is authenticated
  isAuthenticated(isAdmin = false) {
    const token = this.getToken(isAdmin);
    if (!token) return false;

    // Check our 6-hour expiry first
    if (this.isTokenExpiredByTime(isAdmin)) {
      console.log('Token expired after 6 hours, clearing auth data');
      this.clearAuth(isAdmin);
      return false;
    }

    try {
      const decoded = jwtDecode(token);
      const currentTime = Date.now() / 1000;
      
      // Check JWT expiry as well (if token has exp claim)
      if (decoded.exp && decoded.exp < currentTime) {
        console.log('JWT token expired, clearing auth data');
        this.clearAuth(isAdmin);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Invalid token:', error);
      this.clearAuth(isAdmin);
      return false;
    }
  }

  // Get token payload
  getTokenPayload(isAdmin = false) {
    const token = this.getToken(isAdmin);
    if (!token) return null;

    // Check if token is expired by time before decoding
    if (this.isTokenExpiredByTime(isAdmin)) {
      this.clearAuth(isAdmin);
      return null;
    }

    try {
      return jwtDecode(token);
    } catch (error) {
      console.error('Failed to decode token:', error);
      return null;
    }
  }

  // Check if token is about to expire (within 30 minutes of 6-hour limit)
  isTokenExpiringSoon(isAdmin = false) {
    try {
      const timestamp = this.getTokenTimestamp(isAdmin);
      if (!timestamp) return true;
      
      const currentTime = Date.now();
      const tokenAge = currentTime - timestamp;
      const timeUntilExpiry = this.TOKEN_EXPIRY_DURATION - tokenAge;
      
      // Warning if less than 30 minutes remaining
      return timeUntilExpiry < (30 * 60 * 1000); // 30 minutes
    } catch (error) {
      return true;
    }
  }

  // Get remaining time before token expires (in minutes)
  getTokenRemainingTime(isAdmin = false) {
    try {
      const timestamp = this.getTokenTimestamp(isAdmin);
      if (!timestamp) return 0;
      
      const currentTime = Date.now();
      const tokenAge = currentTime - timestamp;
      const timeUntilExpiry = this.TOKEN_EXPIRY_DURATION - tokenAge;
      
      return Math.max(0, Math.floor(timeUntilExpiry / (60 * 1000))); // Return minutes
    } catch (error) {
      return 0;
    }
  }

  // Clear all auth data
  clearAuth(isAdmin = false) {
    try {
      if (isAdmin) {
        localStorage.removeItem(this.ADMIN_TOKEN_KEY);
        localStorage.removeItem(this.ADMIN_USER_KEY);
        localStorage.removeItem(this.ADMIN_TOKEN_TIMESTAMP_KEY);
        sessionStorage.removeItem(this.ADMIN_TOKEN_KEY);
        sessionStorage.removeItem(this.ADMIN_USER_KEY);
        sessionStorage.removeItem(this.ADMIN_TOKEN_TIMESTAMP_KEY);
      } else {
        localStorage.removeItem(this.TOKEN_KEY);
        localStorage.removeItem(this.USER_KEY);
        localStorage.removeItem(this.TOKEN_TIMESTAMP_KEY);
        localStorage.removeItem(this.REMEMBER_KEY);
        sessionStorage.removeItem(this.TOKEN_KEY);
        sessionStorage.removeItem(this.USER_KEY);
        sessionStorage.removeItem(this.TOKEN_TIMESTAMP_KEY);
      }
    } catch (error) {
      console.error('Failed to clear auth data:', error);
    }
  }

  // Get authorization header for API requests
  getAuthHeader(isAdmin = false) {
    if (!this.isAuthenticated(isAdmin)) {
      return {};
    }
    
    const token = this.getToken(isAdmin);
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  // Refresh token (call your refresh endpoint) - Note: This won't extend the 6-hour limit
  async refreshToken(isAdmin = false) {
    try {
      // Check if we're within the 6-hour window
      if (this.isTokenExpiredByTime(isAdmin)) {
        throw new Error('Token expired after 6 hours, login required');
      }

      const endpoint = isAdmin ? '/api/admin/refresh-token' : '/api/users/refresh-token';
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...this.getAuthHeader(isAdmin)
        }
      });

      if (!response.ok) {
        throw new Error('Token refresh failed');
      }

      const data = await response.json();
      
      if (data.token) {
        const user = this.getUser(isAdmin);
        const rememberMe = localStorage.getItem(this.REMEMBER_KEY) === 'true';
        // Note: This will reset the 6-hour timer with new timestamp
        this.setAuth(data.token, user, rememberMe, isAdmin);
        return data.token;
      }

      throw new Error('No token in refresh response');
    } catch (error) {
      console.error('Token refresh failed:', error);
      this.clearAuth(isAdmin);
      throw error;
    }
  }

  // Force logout due to expiry
  forceLogoutDueToExpiry(isAdmin = false) {
    this.clearAuth(isAdmin);
    const redirectPath = isAdmin ? '/admin/login' : '/login';
    
    // Show expiry message
    alert('Your session has expired after 6 hours. Please login again.');
    window.location.href = redirectPath;
  }

  // Logout user
  async logout(isAdmin = false) {
    try {
      // Call logout endpoint if you have one
      const endpoint = isAdmin ? '/api/admin/logout' : '/api/users/logout';
      await fetch(endpoint, {
        method: 'POST',
        headers: this.getAuthHeader(isAdmin)
      });
    } catch (error) {
      console.error('Logout API call failed:', error);
    } finally {
      this.clearAuth(isAdmin);
      const redirectPath = isAdmin ? '/admin/login' : '/login';
      window.location.href = redirectPath;
    }
  }

  // Get user role/type
  getUserType(isAdmin = false) {
    if (!this.isAuthenticated(isAdmin)) return null;
    
    const user = this.getUser(isAdmin);
    if (isAdmin) {
      return user?.role || null;
    }
    return user?.userType || null;
  }

  // Check if user has specific role
  hasRole(role, isAdmin = false) {
    return this.getUserType(isAdmin) === role;
  }

  // Check admin permissions
  hasPermission(permission) {
    if (!this.isAuthenticated(true)) return false;
    
    const admin = this.getUser(true);
    return admin?.permissions?.[permission] || false;
  }

  // Get redirect path based on user type
  getDefaultDashboard(isAdmin = false) {
    if (isAdmin) {
      return '/admin/dashboard';
    }
    
    const userType = this.getUserType();
    switch (userType) {
      case 'driver':
        return '/driver-dashboard';
      case 'cargo_owner':
        return '/cargo-dashboard';
      case 'admin':
        return '/admin/dashboard';
      default:
        return '/dashboard';
    }
  }

  // Start periodic token expiry check
  startTokenExpiryCheck() {
    // Check every 5 minutes
    setInterval(() => {
      // Check regular user token
      if (this.getToken(false) && this.isTokenExpiredByTime(false)) {
        console.log('Regular user token expired, forcing logout');
        this.forceLogoutDueToExpiry(false);
      }
      
      // Check admin token
      if (this.getToken(true) && this.isTokenExpiredByTime(true)) {
        console.log('Admin token expired, forcing logout');
        this.forceLogoutDueToExpiry(true);
      }
    }, 5 * 60 * 1000); // Every 5 minutes
  }

  // Show expiry warning to user
  showExpiryWarning(isAdmin = false) {
    const remainingMinutes = this.getTokenRemainingTime(isAdmin);
    if (remainingMinutes <= 30 && remainingMinutes > 0) {
      console.warn(`Token expires in ${remainingMinutes} minutes`);
      // You can trigger a UI notification here
      return true;
    }
    return false;
  }
}

// Create and export singleton instance
export const authManager = new AuthManager();

// Helper functions for easier use
export const isAuthenticated = (isAdmin = false) => authManager.isAuthenticated(isAdmin);
export const getToken = (isAdmin = false) => authManager.getToken(isAdmin);
export const getUser = (isAdmin = false) => authManager.getUser(isAdmin);
export const getUserType = (isAdmin = false) => authManager.getUserType(isAdmin);
export const getAuthHeader = (isAdmin = false) => authManager.getAuthHeader(isAdmin);
export const logout = (isAdmin = false) => authManager.logout(isAdmin);
export const clearAuth = (isAdmin = false) => authManager.clearAuth(isAdmin);
export const hasPermission = (permission) => authManager.hasPermission(permission);
export const getTokenRemainingTime = (isAdmin = false) => authManager.getTokenRemainingTime(isAdmin);
export const isTokenExpiringSoon = (isAdmin = false) => authManager.isTokenExpiringSoon(isAdmin);

export default authManager;