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
    
    this.TOKEN_EXPIRY_DURATION = 6 * 60 * 60 * 1000; // 6 hours
    this.startTokenExpiryCheck();
  }

  setAuth(token, user, rememberMe = false, isAdmin = false) {
    try {
      const tokenKey = isAdmin ? this.ADMIN_TOKEN_KEY : this.TOKEN_KEY;
      const userKey = isAdmin ? this.ADMIN_USER_KEY : this.USER_KEY;
      const timestampKey = isAdmin ? this.ADMIN_TOKEN_TIMESTAMP_KEY : this.TOKEN_TIMESTAMP_KEY;
      
      const currentTime = Date.now();
      
      if (rememberMe && !isAdmin) {
        localStorage.setItem(tokenKey, token);
        localStorage.setItem(userKey, JSON.stringify(user));
        localStorage.setItem(timestampKey, currentTime.toString());
        localStorage.setItem(this.REMEMBER_KEY, 'true');
      } else {
        // For admin or non-remember sessions, use sessionStorage
        sessionStorage.setItem(tokenKey, token);
        sessionStorage.setItem(userKey, JSON.stringify(user));
        sessionStorage.setItem(timestampKey, currentTime.toString());
        
        // Clear localStorage if exists
        localStorage.removeItem(tokenKey);
        localStorage.removeItem(userKey);
        localStorage.removeItem(timestampKey);
        if (!isAdmin) localStorage.removeItem(this.REMEMBER_KEY);
      }

      ;
    } catch (error) {
      console.error('Failed to store auth data:', error);
    }
  }

  getToken(isAdmin = false) {
    try {
      const tokenKey = isAdmin ? this.ADMIN_TOKEN_KEY : this.TOKEN_KEY;
      const token = localStorage.getItem(tokenKey) || sessionStorage.getItem(tokenKey);
      return token;
    } catch (error) {
      console.error('Failed to get token:', error);
      return null;
    }
  }

  getTokenTimestamp(isAdmin = false) {
    try {
      const timestampKey = isAdmin ? this.ADMIN_TOKEN_TIMESTAMP_KEY : this.TOKEN_TIMESTAMP_KEY;
      const timestamp = localStorage.getItem(timestampKey) || sessionStorage.getItem(timestampKey);
      return timestamp ? parseInt(timestamp, 10) : null;
    } catch (error) {
      console.error('Failed to get token timestamp:', error);
      return null;
    }
  }

  getUser(isAdmin = false) {
    try {
      const userKey = isAdmin ? this.ADMIN_USER_KEY : this.USER_KEY;
      const userStr = localStorage.getItem(userKey) || sessionStorage.getItem(userKey);
      return userStr ? JSON.parse(userStr) : null;
    } catch (error) {
      console.error('Failed to get user data:', error);
      return null;
    }
  }

  isTokenExpiredByTime(isAdmin = false) {
    const timestamp = this.getTokenTimestamp(isAdmin);
    if (!timestamp) return true;
    
    const currentTime = Date.now();
    const tokenAge = currentTime - timestamp;
    
    return tokenAge >= this.TOKEN_EXPIRY_DURATION;
  }

  isAuthenticated(isAdmin = false) {
    const token = this.getToken(isAdmin);
    if (!token) {
      console.log(`No token found for ${isAdmin ? 'admin' : 'user'}`);
      return false;
    }

    if (this.isTokenExpiredByTime(isAdmin)) {
      console.log('Token expired after 6 hours, clearing auth data');
      this.clearAuth(isAdmin);
      return false;
    }

    try {
      const decoded = jwtDecode(token);
      const currentTime = Date.now() / 1000;
      
      if (decoded.exp && decoded.exp < currentTime) {
        console.log('JWT token expired, clearing auth data');
        this.clearAuth(isAdmin);
        return false;
      }

      console.log(`User ${isAdmin ? 'admin' : 'user'} is authenticated`);
      return true;
    } catch (error) {
      console.error('Invalid token:', error);
      this.clearAuth(isAdmin);
      return false;
    }
  }

  getTokenPayload(isAdmin = false) {
    const token = this.getToken(isAdmin);
    if (!token) return null;

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

  isTokenExpiringSoon(isAdmin = false) {
    try {
      const timestamp = this.getTokenTimestamp(isAdmin);
      if (!timestamp) return true;
      
      const currentTime = Date.now();
      const tokenAge = currentTime - timestamp;
      const timeUntilExpiry = this.TOKEN_EXPIRY_DURATION - tokenAge;
      
      return timeUntilExpiry < (30 * 60 * 1000);
    } catch (error) {
      return true;
    }
  }

  getTokenRemainingTime(isAdmin = false) {
    try {
      const timestamp = this.getTokenTimestamp(isAdmin);
      if (!timestamp) return 0;
      
      const currentTime = Date.now();
      const tokenAge = currentTime - timestamp;
      const timeUntilExpiry = this.TOKEN_EXPIRY_DURATION - tokenAge;
      
      return Math.max(0, Math.floor(timeUntilExpiry / (60 * 1000)));
    } catch (error) {
      return 0;
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
      }
      console.log(`Auth cleared for ${isAdmin ? 'admin' : 'user'}`);
    } catch (error) {
      console.error('Failed to clear auth data:', error);
    }
  }

  getAuthHeader(isAdmin = false) {
    if (!this.isAuthenticated(isAdmin)) {
      console.log(`Not authenticated for ${isAdmin ? 'admin' : 'user'}, returning empty header`);
      return {};
    }
    
    const token = this.getToken(isAdmin);
    const header = token ? { Authorization: `Bearer ${token}` } : {};
    console.log(`Auth header for ${isAdmin ? 'admin' : 'user'}:`, header.Authorization ? 'Present' : 'Missing');
    return header;
  }

  async refreshToken(isAdmin = false) {
    try {
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

  forceLogoutDueToExpiry(isAdmin = false) {
    this.clearAuth(isAdmin);
    const redirectPath = isAdmin ? '/admin/login' : '/login';
    
    alert('Your session has expired after 6 hours. Please login again.');
    window.location.href = redirectPath;
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

  startTokenExpiryCheck() {
    setInterval(() => {
      if (this.getToken(false) && this.isTokenExpiredByTime(false)) {
        console.log('Regular user token expired, forcing logout');
        this.forceLogoutDueToExpiry(false);
      }
      
      if (this.getToken(true) && this.isTokenExpiredByTime(true)) {
        console.log('Admin token expired, forcing logout');
        this.forceLogoutDueToExpiry(true);
      }
    }, 5 * 60 * 1000);
  }

  showExpiryWarning(isAdmin = false) {
    const remainingMinutes = this.getTokenRemainingTime(isAdmin);
    if (remainingMinutes <= 30 && remainingMinutes > 0) {
      console.warn(`Token expires in ${remainingMinutes} minutes`);
      return true;
    }
    return false;
  }
}

export const authManager = new AuthManager();

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