// utils/auth.js
import { jwtDecode } from 'jwt-decode';

class AuthManager {
  constructor() {
    this.TOKEN_KEY = 'infiniteCargoToken';
    this.USER_KEY = 'infiniteCargoUser';
    this.REMEMBER_KEY = 'infiniteCargoRememberMe';
    this.TOKEN_TIMESTAMP_KEY = 'infiniteCargoTokenTimestamp';
    this.ADMIN_TOKEN_KEY = 'adminToken';
    this.ADMIN_USER_KEY = 'adminData';
    this.ADMIN_TOKEN_TIMESTAMP_KEY = 'adminTokenTimestamp';
    
    // 6 hours in milliseconds
    this.TOKEN_EXPIRY_DURATION = 6 * 60 * 60 * 1000; // 6 hours
    this.WARNING_THRESHOLD = 30 * 60 * 1000; // 30 minutes before expiry
    
    // Add internal state tracking to prevent race conditions
    this.isInitialized = false;
    this.authState = null;
    this.listeners = new Set();
    this.expiryCheckInterval = null;
    this.warningShown = false;
    
    // Enhanced cross-tab sync
    this.lastSyncTime = 0;
    this.SYNC_THROTTLE = 100; // 100ms throttle for sync operations
  }

  // Enhanced initialize method with better cross-tab support
  initialize() {
    if (this.isInitialized) return;
    
    try {
      // Force a fresh read from storage for new tabs
      this._syncFromStorage();
      
      // Set up enhanced storage listeners
      this._setupStorageListeners();
      
      this.isInitialized = true;
     
      this._notifyListeners();
    } catch (error) {
      console.error('Failed to initialize auth state:', error);
      this.authState = { token: null, user: null, isAuthenticated: false };
      this.isInitialized = true;
    }
  }

  // New method to sync state from storage
  _syncFromStorage(isAdmin = false) {
    try {
      const token = this._getTokenFromStorage(isAdmin);
      const user = this._getUserFromStorage(isAdmin);
      
      if (token && user) {
        // Validate token and check custom expiry
        if (this._validateTokenAndExpiry(token, isAdmin)) {
          if (!isAdmin) {
            this.authState = { token, user, isAuthenticated: true };
            this._startExpiryMonitoring(isAdmin);
          }
          
          return true;
        } else {
          // Clear invalid/expired auth data
          this.clearAuth(isAdmin);
          if (!isAdmin) {
            this.authState = { token: null, user: null, isAuthenticated: false };
          }
         
        }
      } else {
        if (!isAdmin) {
          this.authState = { token: null, user: null, isAuthenticated: false };
        }
      }
      return false;
    } catch (error) {
      console.error('Error syncing from storage:', error);
      return false;
    }
  }

  // New method to get token directly from storage without validation
  _getTokenFromStorage(isAdmin = false) {
    try {
      const tokenKey = isAdmin ? this.ADMIN_TOKEN_KEY : this.TOKEN_KEY;
      return localStorage.getItem(tokenKey) || sessionStorage.getItem(tokenKey);
    } catch (error) {
      console.error('Error getting token from storage:', error);
      return null;
    }
  }

  // New method to get user directly from storage without validation
  _getUserFromStorage(isAdmin = false) {
    try {
      const userKey = isAdmin ? this.ADMIN_USER_KEY : this.USER_KEY;
      const userStr = localStorage.getItem(userKey) || sessionStorage.getItem(userKey);
      return userStr ? JSON.parse(userStr) : null;
    } catch (error) {
      console.error('Error getting user from storage:', error);
      return null;
    }
  }

  // Enhanced storage listener setup
  _setupStorageListeners() {
    // Listen for storage events (cross-tab sync)
    window.addEventListener('storage', (e) => {
      this._handleStorageChange(e);
    });

    // Listen for focus events (tab becomes active)
    window.addEventListener('focus', () => {
      this._handleTabFocus();
    });

    // Listen for visibility change (tab becomes visible)
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        this._handleTabFocus();
      }
    });
  }

  // Handle storage changes from other tabs
  _handleStorageChange(e) {
    const authKeys = [
      this.TOKEN_KEY, 
      this.USER_KEY, 
      this.TOKEN_TIMESTAMP_KEY,
      this.ADMIN_TOKEN_KEY,
      this.ADMIN_USER_KEY,
      this.ADMIN_TOKEN_TIMESTAMP_KEY
    ];
    
    if (authKeys.includes(e.key)) {
      this._throttledSync();
    }
  }

  // Handle tab focus/visibility change
  _handleTabFocus() {
    // Always sync when tab becomes active
    setTimeout(() => {
      this._syncFromStorage();
      this._notifyListeners();
    }, 50);
  }

  // Throttled sync to prevent excessive operations
  _throttledSync() {
    const now = Date.now();
    if (now - this.lastSyncTime < this.SYNC_THROTTLE) {
      return;
    }
    
    this.lastSyncTime = now;
    setTimeout(() => {
      this._syncFromStorage();
      this._notifyListeners();
    }, 10);
  }

  // Private method to validate token and custom expiry
  _validateTokenAndExpiry(token, isAdmin = false) {
    try {
      if (!token) return false;
      
      // First check JWT expiry
      const decoded = jwtDecode(token);
      const currentTime = Date.now() / 1000;
      
      if (decoded.exp && decoded.exp <= currentTime) {
        return false;
      }
      
      // Then check custom 6-hour expiry
      const timestampKey = isAdmin ? this.ADMIN_TOKEN_TIMESTAMP_KEY : this.TOKEN_TIMESTAMP_KEY;
      const tokenTimestamp = this._getTokenTimestamp(timestampKey);
      
      if (!tokenTimestamp) {
        return false;
      }
      
      const currentTimeMs = Date.now();
      const tokenAge = currentTimeMs - tokenTimestamp;
      
      if (tokenAge >= this.TOKEN_EXPIRY_DURATION) {
        return false;
      }
      
      return true;
    } catch (error) {
      console.error('Token validation error:', error);
      return false;
    }
  }

  // Get token timestamp from storage
  _getTokenTimestamp(timestampKey) {
    try {
      const timestamp = localStorage.getItem(timestampKey) || sessionStorage.getItem(timestampKey);
      return timestamp ? parseInt(timestamp, 10) : null;
    } catch (error) {
      console.error('Error getting token timestamp:', error);
      return null;
    }
  }

  // Start monitoring token expiry
  _startExpiryMonitoring(isAdmin = false) {
    // Clear existing interval
    if (this.expiryCheckInterval) {
      clearInterval(this.expiryCheckInterval);
    }

    this.warningShown = false;

    // Check every minute
    this.expiryCheckInterval = setInterval(() => {
      this._checkTokenExpiry(isAdmin);
    }, 60000); // 1 minute

    // Also check immediately
    setTimeout(() => {
      this._checkTokenExpiry(isAdmin);
    }, 1000);
  }

  // Check if token is expired or expiring soon
  _checkTokenExpiry(isAdmin = false) {
    try {
      const timestampKey = isAdmin ? this.ADMIN_TOKEN_TIMESTAMP_KEY : this.TOKEN_TIMESTAMP_KEY;
      const tokenTimestamp = this._getTokenTimestamp(timestampKey);
      
      if (!tokenTimestamp) {
        this._handleTokenExpiry(isAdmin);
        return;
      }

      const currentTime = Date.now();
      const tokenAge = currentTime - tokenTimestamp;
      const remainingTime = this.TOKEN_EXPIRY_DURATION - tokenAge;

      // Token expired
      if (remainingTime <= 0) {
        this._handleTokenExpiry(isAdmin);
        return;
      }

      // Show warning if within 30 minutes of expiry and warning not shown yet
      if (remainingTime <= this.WARNING_THRESHOLD && !this.warningShown && !isAdmin) {
        this.warningShown = true;
        const remainingMinutes = Math.ceil(remainingTime / (60 * 1000));
        this._showExpiryWarning(remainingMinutes);
      }
      
    } catch (error) {
      console.error('Error checking token expiry:', error);
    }
  }

  // Handle token expiry
  _handleTokenExpiry(isAdmin = false) {
    // Clear the monitoring interval
    if (this.expiryCheckInterval) {
      clearInterval(this.expiryCheckInterval);
      this.expiryCheckInterval = null;
    }

    // Clear auth data
    this.clearAuth(isAdmin);

    // Show expiry message and redirect
    this.forceLogoutDueToExpiry(isAdmin);
  }

  // Show expiry warning
  _showExpiryWarning(remainingMinutes) {
    const message = `Your session will expire in ${remainingMinutes} minute${remainingMinutes > 1 ? 's' : ''}. Please save your work and refresh the page to extend your session.`;
    
    // Dispatch custom event for UI components to handle
    window.dispatchEvent(new CustomEvent('tokenExpiryWarning', {
      detail: { remainingMinutes, message }
    }));

    // Also show browser notification if supported
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('Session Expiring Soon', {
        body: message,
        icon: '/logo.png'
      });
    }

    console.warn('Token expiry warning:', message);
  }

  // Add listener for auth state changes
  addAuthListener(listener) {
    this.listeners.add(listener);
    
    // Return unsubscribe function
    return () => {
      this.listeners.delete(listener);
    };
  }

  // Notify all listeners of auth state changes
  _notifyListeners() {
    this.listeners.forEach(listener => {
      try {
        listener(this.authState);
      } catch (error) {
        console.error('Error in auth listener:', error);
      }
    });
  }

  setAuth(token, user, rememberMe = false, isAdmin = false) {
    try {
      const tokenKey = isAdmin ? this.ADMIN_TOKEN_KEY : this.TOKEN_KEY;
      const userKey = isAdmin ? this.ADMIN_USER_KEY : this.USER_KEY;
      const timestampKey = isAdmin ? this.ADMIN_TOKEN_TIMESTAMP_KEY : this.TOKEN_TIMESTAMP_KEY;

      // Validate token before storing
      if (!this._validateToken(token)) {
        console.error('Attempting to store invalid token');
        return false;
      }

      const storage = rememberMe && !isAdmin ? localStorage : sessionStorage;
      const currentTimestamp = Date.now();
      
      // Store token, user, and timestamp
      storage.setItem(tokenKey, token);
      storage.setItem(userKey, JSON.stringify(user));
      storage.setItem(timestampKey, currentTimestamp.toString());
      
      if (rememberMe && !isAdmin) {
        localStorage.setItem(this.REMEMBER_KEY, 'true');
      }
      
      // Clear from other storage type
      const otherStorage = storage === localStorage ? sessionStorage : localStorage;
      otherStorage.removeItem(tokenKey);
      otherStorage.removeItem(userKey);
      otherStorage.removeItem(timestampKey);
      
      if (!isAdmin) {
        if (!rememberMe) {
          localStorage.removeItem(this.REMEMBER_KEY);
        }
      }

      // Update internal state
      if (!isAdmin) {
        this.authState = { token, user, isAuthenticated: true };
        this._notifyListeners();
      }

      // Start expiry monitoring
      this._startExpiryMonitoring(isAdmin);

      
      return true;
    } catch (error) {
      console.error('Failed to store auth data:', error);
      return false;
    }
  }

  // Private method to validate token without side effects
  _validateToken(token) {
    try {
      if (!token) return false;
      
      const decoded = jwtDecode(token);
      const currentTime = Date.now() / 1000;
      
      return decoded.exp && decoded.exp > currentTime;
    } catch (error) {
      return false;
    }
  }

  // Enhanced getToken method
  getToken(isAdmin = false) {
    try {
      // First try to get from internal state for non-admin
      if (!isAdmin && this.authState?.token && this.authState.isAuthenticated) {
        // Still validate expiry
        if (this._validateTokenAndExpiry(this.authState.token, isAdmin)) {
          return this.authState.token;
        }
      }

      // Fallback to storage
      const token = this._getTokenFromStorage(isAdmin);
      
      // Validate token and expiry before returning
      if (token && !this._validateTokenAndExpiry(token, isAdmin)) {
        this.clearAuth(isAdmin);
        return null;
      }
      
      // Update internal state if token is valid and this is for regular user
      if (!isAdmin && token && this.authState) {
        this.authState.token = token;
        this.authState.isAuthenticated = true;
      }
      
      return token;
    } catch (error) {
      console.error('Failed to get token:', error);
      return null;
    }
  }

  // Enhanced getUser method
  getUser(isAdmin = false) {
    try {
      // First try to get from internal state for non-admin
      if (!isAdmin && this.authState?.user && this.authState.isAuthenticated) {
        // Verify we still have a valid token
        const token = this.getToken(isAdmin);
        if (token) {
          return this.authState.user;
        }
      }

      // Fallback to storage
      const user = this._getUserFromStorage(isAdmin);
      
      if (!user) return null;
      
      // If we have user data but no valid token, clear the data
      const token = this.getToken(isAdmin);
      if (!token) {
        this.clearAuth(isAdmin);
        return null;
      }
      
      // Update internal state if user is valid and this is for regular user
      if (!isAdmin && user && this.authState) {
        this.authState.user = user;
        this.authState.isAuthenticated = true;
      }
      
      return user;
    } catch (error) {
      console.error('Failed to get user data:', error);
      return null;
    }
  }

  // Enhanced isAuthenticated method
  isAuthenticated(isAdmin = false) {
    // Initialize if not done already
    if (!this.isInitialized) {
      this.initialize();
    }

    try {
      // For non-admin, first check internal state, but always validate with storage
      const token = this.getToken(isAdmin);
      const user = this.getUser(isAdmin);
      const isValid = !!(token && user);
      
      // Update internal state for non-admin
      if (!isAdmin) {
        if (!this.authState) {
          this.authState = { token, user, isAuthenticated: isValid };
        } else if (this.authState.isAuthenticated !== isValid) {
          this.authState.isAuthenticated = isValid;
          this.authState.token = token;
          this.authState.user = user;
          this._notifyListeners();
        }
        
        if (!isValid && this.expiryCheckInterval) {
          // Stop monitoring if user is no longer authenticated
          clearInterval(this.expiryCheckInterval);
          this.expiryCheckInterval = null;
        } else if (isValid && !this.expiryCheckInterval) {
          // Start monitoring if user is authenticated but monitoring not active
          this._startExpiryMonitoring(isAdmin);
        }
      }
      
      return isValid;
    } catch (error) {
      console.error('Error checking authentication:', error);
      if (!isAdmin && this.authState) {
        this.authState.isAuthenticated = false;
        this._notifyListeners();
      }
      return false;
    }
  }

  getTokenRemainingTime(isAdmin = false) {
    try {
      const timestampKey = isAdmin ? this.ADMIN_TOKEN_TIMESTAMP_KEY : this.TOKEN_TIMESTAMP_KEY;
      const tokenTimestamp = this._getTokenTimestamp(timestampKey);
      
      if (!tokenTimestamp) return 0;

      const currentTime = Date.now();
      const tokenAge = currentTime - tokenTimestamp;
      const remainingTime = this.TOKEN_EXPIRY_DURATION - tokenAge;
      
      return Math.max(0, Math.floor(remainingTime / (60 * 1000))); // Return minutes
    } catch (error) {
      console.error('Error getting token remaining time:', error);
      return 0;
    }
  }

  isTokenExpiringSoon(isAdmin = false) {
    try {
      const remainingTimeMs = this.getTokenRemainingTime(isAdmin) * 60 * 1000;
      return remainingTimeMs <= this.WARNING_THRESHOLD && remainingTimeMs > 0;
    } catch (error) {
      console.error('Error checking token expiry:', error);
      return true;
    }
  }

  async refreshToken(isAdmin = false) {
    try {
      // Define your refresh endpoint
      const endpoint = isAdmin ? '/api/admin/refresh-token' : '/api/users/refresh-token';

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          ...this.getAuthHeader(isAdmin),
          'Content-Type': 'application/json',
        }
      });

      if (!response.ok) {
        throw new Error('Failed to refresh token');
      }

      const data = await response.json();
      const newToken = data.token;
      const user = this.getUser(isAdmin);

      // Save new token and reset timestamp
      this.setAuth(newToken, user, (!isAdmin && localStorage.getItem(this.REMEMBER_KEY) === 'true'), isAdmin);
      return newToken;
    } catch (error) {
      console.error('Error refreshing token:', error);
      throw error;
    }
  }

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
        
        // Update internal state
        this.authState = { token: null, user: null, isAuthenticated: false };
        this._notifyListeners();
        
        // Clear expiry monitoring
        if (this.expiryCheckInterval) {
          clearInterval(this.expiryCheckInterval);
          this.expiryCheckInterval = null;
        }
        this.warningShown = false;
      }
      
     
    } catch (error) {
      console.error('Failed to clear auth data:', error);
    }
  }

  getAuthHeader(isAdmin = false) {
    if (!this.isAuthenticated(isAdmin)) {
      return {};
    }
    
    const token = this.getToken(isAdmin);
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  forceLogoutDueToExpiry(isAdmin = false) {
    // Clear all auth data
    this.clearAuth(isAdmin);
    
    // Dispatch logout event
    window.dispatchEvent(new CustomEvent('userLoggedOut', {
      detail: { reason: 'sessionExpired', isAdmin }
    }));
    
    const redirectPath = isAdmin ? '/admin/login' : '/login';
    const message = isAdmin 
      ? 'Your admin session has expired. Please login again.'
      : 'Your session has expired . Please login again.';
    
    // Show alert and redirect
    setTimeout(() => {
      alert(message);
      window.location.href = redirectPath;
    }, 100);
  }

  async logout(isAdmin = false) {
    try {
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

  // Extended session (refresh page)
  extendSession(isAdmin = false) {
    const user = this.getUser(isAdmin);
    const token = this.getToken(isAdmin);
    const rememberMe = !isAdmin && localStorage.getItem(this.REMEMBER_KEY) === 'true';
    
    if (user && token) {
      // Reset the timestamp to extend the session
      this.setAuth(token, user, rememberMe, isAdmin);
      this.warningShown = false;
      
      // Dispatch session extended event
      window.dispatchEvent(new CustomEvent('sessionExtended', {
        detail: { isAdmin, remainingTime: this.getTokenRemainingTime(isAdmin) }
      }));
      
      return true;
    }
    
    return false;
  }

  getUserType(isAdmin = false) {
    if (!this.isAuthenticated(isAdmin)) return null;
    
    const user = this.getUser(isAdmin);
    if (isAdmin) {
      return user?.role || null;
    }
    return user?.userType || null;
  }

  hasRole(role, isAdmin = false) {
    return this.getUserType(isAdmin) === role;
  }

  hasPermission(permission) {
    if (!this.isAuthenticated(true)) return false;
    
    const admin = this.getUser(true);
    return admin?.permissions?.[permission] || false;
  }

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
}

// Create singleton instance
export const authManager = new AuthManager();

// Enhanced initialization that runs immediately and on DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    authManager.initialize();
  });
} else {
  // DOM is already loaded
  authManager.initialize();
}

// Also initialize on window load as a fallback
window.addEventListener('load', () => {
  if (!authManager.isInitialized) {
    authManager.initialize();
  }
});

// Request notification permission on first load
if ('Notification' in window && Notification.permission === 'default') {
  Notification.requestPermission();
}

// Simplified exports that use the singleton
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
export const extendSession = (isAdmin = false) => authManager.extendSession(isAdmin);

export default authManager;