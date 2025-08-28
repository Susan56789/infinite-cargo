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
    this.CROSS_TAB_SYNC_KEY = 'infiniteCargoTabSync';
    
    // 6 hours in milliseconds
    this.TOKEN_EXPIRY_DURATION = 6 * 60 * 60 * 1000;
    this.WARNING_THRESHOLD = 30 * 60 * 1000;
    
    // Enhanced state management
    this.isInitialized = false;
    this.authState = null;
    this.adminAuthState = null;
    this.listeners = new Set();
    this.expiryCheckInterval = null;
    this.warningShown = false;
    
    // Cross-tab sync improvements
    this.lastSyncTime = 0;
    this.SYNC_THROTTLE = 50; // Reduced throttle for faster sync
    this.syncInProgress = false;
    this.tabId = this._generateTabId();
    this.lastHeartbeat = Date.now();
    this.heartbeatInterval = null;
    
    // Bind methods to preserve context
    this._handleStorageChange = this._handleStorageChange.bind(this);
    this._handleTabFocus = this._handleTabFocus.bind(this);
    this._handleVisibilityChange = this._handleVisibilityChange.bind(this);
    this._heartbeat = this._heartbeat.bind(this);
  }

  // Generate unique tab identifier
  _generateTabId() {
    return Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  // Enhanced initialize method with immediate sync
  initialize() {
    if (this.isInitialized) return;
    try {
      // Force immediate sync for both user types
      this._forceSyncFromStorage(false); // Regular user
      this._forceSyncFromStorage(true);  // Admin user
      
      // Set up all event listeners
      this._setupEventListeners();
      
      // Start heartbeat for tab coordination
      this._startHeartbeat();
      
      this.isInitialized = true;
      
      
      // Notify listeners after initialization
      this._notifyListeners();
      
    } catch (error) {
      console.error('Failed to initialize auth state:', error);
      this.authState = { token: null, user: null, isAuthenticated: false };
      this.adminAuthState = { token: null, user: null, isAuthenticated: false };
      this.isInitialized = true;
    }
  }

  // Force sync from storage without throttling
  _forceSyncFromStorage(isAdmin = false) {
    if (this.syncInProgress) {
      
      setTimeout(() => this._forceSyncFromStorage(isAdmin), 10);
      return;
    }
    
    this.syncInProgress = true;
    
    try {
      
      const token = this._getTokenFromStorage(isAdmin);
      const user = this._getUserFromStorage(isAdmin);
      
      if (token && user) {
        if (this._validateTokenAndExpiry(token, isAdmin)) {
          const authState = { token, user, isAuthenticated: true };
          
          if (isAdmin) {
            this.adminAuthState = authState;
          } else {
            this.authState = authState;
            this._startExpiryMonitoring(false);
          }
          
          return true;
        } else {
          
          this.clearAuth(isAdmin);
        }
      }
      
      // Set empty state if no valid auth
      const emptyState = { token: null, user: null, isAuthenticated: false };
      if (isAdmin) {
        this.adminAuthState = emptyState;
      } else {
        this.authState = emptyState;
      }
      
      return false;
      
    } catch (error) {
      console.error('Error in force sync from storage:', error);
      return false;
    } finally {
      this.syncInProgress = false;
    }
  }

  // Enhanced event listener setup
  _setupEventListeners() {
    // Storage events for cross-tab sync
    window.addEventListener('storage', this._handleStorageChange);
    
    // Tab focus events
    window.addEventListener('focus', this._handleTabFocus);
    window.addEventListener('blur', () => {
    
    });
    
    // Visibility change events
    document.addEventListener('visibilitychange', this._handleVisibilityChange);
    
    // Before unload cleanup
    window.addEventListener('beforeunload', () => {
      this._stopHeartbeat();
    });
    
    // Page show/hide events (for back/forward navigation)
    window.addEventListener('pageshow', (event) => {
      if (event.persisted) {
        
        setTimeout(() => {
          this._forceSyncFromStorage(false);
          this._forceSyncFromStorage(true);
          this._notifyListeners();
        }, 50);
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
      this.ADMIN_TOKEN_TIMESTAMP_KEY,
      this.CROSS_TAB_SYNC_KEY
    ];
    
    if (authKeys.includes(e.key)) {
     
      
      this._throttledSync();
    }
  }

  // Handle tab becoming active
  _handleTabFocus() {
    
    this.lastHeartbeat = Date.now();
    
    // Always force sync when tab becomes active
    setTimeout(() => {
      this._forceSyncFromStorage(false);
      this._forceSyncFromStorage(true);
      this._notifyListeners();
      this._broadcastTabSync();
    }, 10);
  }

  // Handle visibility change
  _handleVisibilityChange() {
    if (!document.hidden) {
      this._handleTabFocus();
    }
  }

  // Throttled sync with immediate execution option
  _throttledSync(immediate = false) {
    const now = Date.now();
    
    if (!immediate && now - this.lastSyncTime < this.SYNC_THROTTLE) {
      return;
    }
    
    this.lastSyncTime = now;
    
    setTimeout(() => {
      this._forceSyncFromStorage(false);
      this._forceSyncFromStorage(true);
      this._notifyListeners();
    }, immediate ? 0 : 10);
  }

  // Start heartbeat for tab coordination
  _startHeartbeat() {
    this._stopHeartbeat();
    
    this.heartbeatInterval = setInterval(this._heartbeat, 2000); // Every 2 seconds
    this._heartbeat(); // Initial heartbeat
  }

  // Stop heartbeat
  _stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  // Heartbeat function for tab coordination
  _heartbeat() {
    try {
      const heartbeatData = {
        tabId: this.tabId,
        timestamp: Date.now(),
        hasAuth: this.authState?.isAuthenticated || false,
        hasAdminAuth: this.adminAuthState?.isAuthenticated || false,
        userType: this.authState?.user?.userType,
        userId: this.authState?.user?._id || this.authState?.user?.id
      };
      
      localStorage.setItem(this.CROSS_TAB_SYNC_KEY, JSON.stringify(heartbeatData));
      this.lastHeartbeat = Date.now();
      
    } catch (error) {
      console.error('Heartbeat error:', error);
    }
  }

  // Broadcast tab sync event
  _broadcastTabSync() {
    try {
      const syncData = {
        tabId: this.tabId,
        timestamp: Date.now(),
        action: 'sync_request'
      };
      
      localStorage.setItem(this.CROSS_TAB_SYNC_KEY, JSON.stringify(syncData));
    } catch (error) {
      console.error('Broadcast sync error:', error);
    }
  }

  // Get token from storage
  _getTokenFromStorage(isAdmin = false) {
    try {
      const tokenKey = isAdmin ? this.ADMIN_TOKEN_KEY : this.TOKEN_KEY;
      return localStorage.getItem(tokenKey) || sessionStorage.getItem(tokenKey);
    } catch (error) {
      console.error('Error getting token from storage:', error);
      return null;
    }
  }

  // Get user from storage
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

  // Validate token and custom expiry
  _validateTokenAndExpiry(token, isAdmin = false) {
    try {
      if (!token) return false;
      
      // Check JWT expiry
      const decoded = jwtDecode(token);
      const currentTime = Date.now() / 1000;
      
      if (decoded.exp && decoded.exp <= currentTime) {
        return false;
      }
      
      // Check custom 6-hour expiry
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

  // Enhanced setAuth with immediate cross-tab sync
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
      
      // Store auth data
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
      
      if (!isAdmin && !rememberMe) {
        localStorage.removeItem(this.REMEMBER_KEY);
      }

      // Update internal state immediately
      const authStateData = { token, user, isAuthenticated: true };
      if (isAdmin) {
        this.adminAuthState = authStateData;
      } else {
        this.authState = authStateData;
        this._startExpiryMonitoring(false);
      }

      // Immediate cross-tab sync
      this._broadcastTabSync();
      
      // Force sync in other tabs
      setTimeout(() => {
        this._broadcastTabSync();
      }, 50);
      
      // Notify listeners
      this._notifyListeners();
      return true;
      
    } catch (error) {
      console.error('Failed to store auth data:', error);
      return false;
    }
  }

  // Enhanced getToken method
  getToken(isAdmin = false) {
    // Ensure initialized
    if (!this.isInitialized) {
      this.initialize();
    }

    try {
      const stateKey = isAdmin ? 'adminAuthState' : 'authState';
      const currentState = this[stateKey];

      // First try internal state
      if (currentState?.token && currentState.isAuthenticated) {
        if (this._validateTokenAndExpiry(currentState.token, isAdmin)) {
          return currentState.token;
        }
      }

      // Fallback to storage with forced sync
      this._forceSyncFromStorage(isAdmin);
      const updatedState = this[stateKey];
      
      return updatedState?.isAuthenticated ? updatedState.token : null;
      
    } catch (error) {
      console.error('Failed to get token:', error);
      return null;
    }
  }

  // Enhanced getUser method
  getUser(isAdmin = false) {
    // Ensure initialized
    if (!this.isInitialized) {
      this.initialize();
    }

    try {
      const stateKey = isAdmin ? 'adminAuthState' : 'authState';
      const currentState = this[stateKey];

      // First try internal state
      if (currentState?.user && currentState.isAuthenticated) {
        // Verify token is still valid
        if (this.getToken(isAdmin)) {
          return currentState.user;
        }
      }

      // Fallback to storage with forced sync
      this._forceSyncFromStorage(isAdmin);
      const updatedState = this[stateKey];
      
      return updatedState?.isAuthenticated ? updatedState.user : null;
      
    } catch (error) {
      console.error('Failed to get user data:', error);
      return null;
    }
  }

  // Enhanced isAuthenticated method
  isAuthenticated(isAdmin = false) {
    // Ensure initialized
    if (!this.isInitialized) {
      this.initialize();
    }

    try {
      // Force a fresh check
      const token = this.getToken(isAdmin);
      const user = this.getUser(isAdmin);
      const isValid = !!(token && user);
      
      // Update state if changed
      const stateKey = isAdmin ? 'adminAuthState' : 'authState';
      const currentState = this[stateKey];
      
      if (!currentState || currentState.isAuthenticated !== isValid) {
        this[stateKey] = { token, user, isAuthenticated: isValid };
        this._notifyListeners();
      }
      
      return isValid;
      
    } catch (error) {
      console.error('Error checking authentication:', error);
      return false;
    }
  }

  // Enhanced clearAuth method
  clearAuth(isAdmin = false) {
    try {
      

      if (isAdmin) {
        localStorage.removeItem(this.ADMIN_TOKEN_KEY);
        localStorage.removeItem(this.ADMIN_USER_KEY);
        localStorage.removeItem(this.ADMIN_TOKEN_TIMESTAMP_KEY);
        sessionStorage.removeItem(this.ADMIN_TOKEN_KEY);
        sessionStorage.removeItem(this.ADMIN_USER_KEY);
        sessionStorage.removeItem(this.ADMIN_TOKEN_TIMESTAMP_KEY);
        
        this.adminAuthState = { token: null, user: null, isAuthenticated: false };
      } else {
        localStorage.removeItem(this.TOKEN_KEY);
        localStorage.removeItem(this.USER_KEY);
        localStorage.removeItem(this.TOKEN_TIMESTAMP_KEY);
        localStorage.removeItem(this.REMEMBER_KEY);
        sessionStorage.removeItem(this.TOKEN_KEY);
        sessionStorage.removeItem(this.USER_KEY);
        sessionStorage.removeItem(this.TOKEN_TIMESTAMP_KEY);
        
        this.authState = { token: null, user: null, isAuthenticated: false };
        
        // Clear expiry monitoring
        if (this.expiryCheckInterval) {
          clearInterval(this.expiryCheckInterval);
          this.expiryCheckInterval = null;
        }
        this.warningShown = false;
      }
      
      // Broadcast change to other tabs
      this._broadcastTabSync();
      this._notifyListeners();
      
    } catch (error) {
      console.error('Failed to clear auth data:', error);
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
    }, 60000);

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

  // Validate token without side effects
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
    const authData = {
      user: this.authState,
      admin: this.adminAuthState,
      tabId: this.tabId
    };
    
    this.listeners.forEach(listener => {
      try {
        listener(authData);
      } catch (error) {
        console.error('Error in auth listener:', error);
      }
    });
  }

  // Force logout due to expiry
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
      : 'Your session has expired. Please login again.';
    
    // Show alert and redirect
    setTimeout(() => {
      alert(message);
      window.location.href = redirectPath;
    }, 100);
  }

  // Logout method
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

  // Get auth header
  getAuthHeader(isAdmin = false) {
    if (!this.isAuthenticated(isAdmin)) {
      return {};
    }
    
    const token = this.getToken(isAdmin);
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  // Other utility methods remain the same...
  getTokenRemainingTime(isAdmin = false) {
    try {
      const timestampKey = isAdmin ? this.ADMIN_TOKEN_TIMESTAMP_KEY : this.TOKEN_TIMESTAMP_KEY;
      const tokenTimestamp = this._getTokenTimestamp(timestampKey);
      
      if (!tokenTimestamp) return 0;

      const currentTime = Date.now();
      const tokenAge = currentTime - tokenTimestamp;
      const remainingTime = this.TOKEN_EXPIRY_DURATION - tokenAge;
      
      return Math.max(0, Math.floor(remainingTime / (60 * 1000)));
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
}

// Create singleton instance
export const authManager = new AuthManager();

// Enhanced initialization
const initializeAuth = () => {
  if (!authManager.isInitialized) {
    
    authManager.initialize();
  }
};

// Multiple initialization triggers
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeAuth);
} else {
  // DOM is already loaded
  initializeAuth();
}

// Fallback initialization
window.addEventListener('load', initializeAuth);

// Additional safety net - initialize after a short delay
setTimeout(initializeAuth, 100);

// Request notification permission
if ('Notification' in window && Notification.permission === 'default') {
  Notification.requestPermission();
}

// Enhanced exports
export const isAuthenticated = (isAdmin = false) => {
  if (!authManager.isInitialized) {
    authManager.initialize();
  }
  return authManager.isAuthenticated(isAdmin);
};

export const getToken = (isAdmin = false) => {
  if (!authManager.isInitialized) {
    authManager.initialize();
  }
  return authManager.getToken(isAdmin);
};

export const getUser = (isAdmin = false) => {
  if (!authManager.isInitialized) {
    authManager.initialize();
  }
  return authManager.getUser(isAdmin);
};

export const getUserType = (isAdmin = false) => authManager.getUserType(isAdmin);
export const getAuthHeader = (isAdmin = false) => authManager.getAuthHeader(isAdmin);
export const logout = (isAdmin = false) => authManager.logout(isAdmin);
export const clearAuth = (isAdmin = false) => authManager.clearAuth(isAdmin);
export const hasPermission = (permission) => authManager.hasPermission(permission);
export const getTokenRemainingTime = (isAdmin = false) => authManager.getTokenRemainingTime(isAdmin);
export const isTokenExpiringSoon = (isAdmin = false) => authManager.isTokenExpiringSoon(isAdmin);
export const extendSession = (isAdmin = false) => authManager.extendSession(isAdmin);

export default authManager;