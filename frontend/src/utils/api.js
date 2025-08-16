// utils/api.js
import { authManager } from './auth';

class ApiClient {
  constructor() {
    this.baseURL = process.env.REACT_APP_API_URL || 
      (process.env.NODE_ENV === 'production' 
        ? 'https://infinite-cargo-api.onrender.com/api' 
        : 'http://localhost:5000/api');
  }

  // Helper method to get default headers
  getHeaders(includeAuth = true) {
    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };

    if (includeAuth) {
      const authHeaders = authManager.getAuthHeader();
      Object.assign(headers, authHeaders);
    }

    return headers;
  }

  // Generic request method with error handling and token refresh
  async request(endpoint, options = {}) {
    const config = {
      method: 'GET',
      credentials: 'include',
      mode: 'cors',
      ...options,
      headers: {
        ...this.getHeaders(options.includeAuth !== false),
        ...options.headers
      }
    };

    const url = `${this.baseURL}${endpoint}`;
    
    try {
      console.log(`Making ${config.method} request to ${url}`);
      
      let response = await fetch(url, config);

      // Handle token expiration
      if (response.status === 401 && options.includeAuth !== false) {
        const responseData = await response.json().catch(() => ({}));
        
        if (responseData.expired || responseData.message?.includes('expired')) {
          console.log('Token expired, attempting refresh...');
          
          try {
            // Try to refresh token
            await authManager.refreshToken();
            
            // Retry request with new token
            config.headers = {
              ...config.headers,
              ...authManager.getAuthHeader()
            };
            
            response = await fetch(url, config);
          } catch (refreshError) {
            console.error('Token refresh failed:', refreshError);
            authManager.clearAuth();
            window.location.href = '/login';
            throw new Error('Session expired. Please log in again.');
          }
        }
      }

      // Parse response
      let responseData;
      const contentType = response.headers.get('content-type');
      
      if (contentType && contentType.includes('application/json')) {
        responseData = await response.json();
      } else {
        responseData = await response.text();
      }

      // Handle non-2xx responses
      if (!response.ok) {
        const error = new Error(
          responseData?.message || 
          responseData || 
          `HTTP ${response.status}: ${response.statusText}`
        );
        error.status = response.status;
        error.response = responseData;
        throw error;
      }

      console.log(`${config.method} ${url} - Success:`, response.status);
      return responseData;

    } catch (error) {
      console.error(`${config.method} ${url} - Error:`, error);
      
      // Handle network errors
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        throw new Error('Network error: Unable to connect to server. Please check your internet connection.');
      }
      
      // Handle CORS errors
      if (error.message.includes('CORS')) {
        throw new Error('Connection error: Unable to communicate with server.');
      }
      
      throw error;
    }
  }

  // GET request
  async get(endpoint, options = {}) {
    return this.request(endpoint, {
      method: 'GET',
      ...options
    });
  }

  // POST request
  async post(endpoint, data = null, options = {}) {
    return this.request(endpoint, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
      ...options
    });
  }

  // PUT request
  async put(endpoint, data = null, options = {}) {
    return this.request(endpoint, {
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
      ...options
    });
  }

  // PATCH request
  async patch(endpoint, data = null, options = {}) {
    return this.request(endpoint, {
      method: 'PATCH',
      body: data ? JSON.stringify(data) : undefined,
      ...options
    });
  }

  // DELETE request
  async delete(endpoint, options = {}) {
    return this.request(endpoint, {
      method: 'DELETE',
      ...options
    });
  }

  // Upload file
  async uploadFile(endpoint, file, additionalData = {}) {
    const formData = new FormData();
    formData.append('file', file);
    
    // Add additional form data
    Object.keys(additionalData).forEach(key => {
      formData.append(key, additionalData[key]);
    });

    return this.request(endpoint, {
      method: 'POST',
      body: formData,
      headers: {
        // Don't set Content-Type for FormData, let browser set it with boundary
        ...authManager.getAuthHeader()
      }
    });
  }
}

// Create singleton instance
export const apiClient = new ApiClient();

// Convenience methods for common API endpoints
export const authAPI = {
  login: (credentials) => apiClient.post('/users/login', credentials, { includeAuth: false }),
  register: (userData) => apiClient.post('/users/register', userData, { includeAuth: false }),
  logout: () => apiClient.post('/users/logout'),
  getCurrentUser: () => apiClient.get('/users/me'),
  refreshToken: () => apiClient.post('/users/refresh-token'),
  forgotPassword: (email) => apiClient.post('/users/forgot-password', { email }, { includeAuth: false }),
  resetPassword: (token, newPassword) => apiClient.post('/users/reset-password', { token, password: newPassword }, { includeAuth: false }),
  changePassword: (currentPassword, newPassword) => apiClient.post('/users/change-password', { currentPassword, newPassword }),
  updateProfile: (profileData) => apiClient.put('/users/profile', profileData),
  uploadProfileImage: (imageFile) => apiClient.uploadFile('/users/profile-image', imageFile)
};

export const driverAPI = {
  getProfile: () => apiClient.get('/drivers/profile'),
  updateProfile: (profileData) => apiClient.put('/drivers/profile', profileData),
  getJobs: (filters = {}) => apiClient.get('/drivers/jobs', { params: filters }),
  applyForJob: (jobId) => apiClient.post(`/drivers/jobs/${jobId}/apply`),
  updateAvailability: (isAvailable) => apiClient.patch('/drivers/availability', { isAvailable }),
  getEarnings: (period = 'month') => apiClient.get(`/drivers/earnings?period=${period}`),
  uploadDocuments: (documents) => apiClient.uploadFile('/drivers/documents', documents),
  getTrips: () => apiClient.get('/drivers/trips'),
  updateTripStatus: (tripId, status) => apiClient.patch(`/drivers/trips/${tripId}/status`, { status })
};

export const cargoAPI = {
  getProfile: () => apiClient.get('/cargo-owners/profile'),
  updateProfile: (profileData) => apiClient.put('/cargo-owners/profile', profileData),
  createShipment: (shipmentData) => apiClient.post('/cargo-owners/shipments', shipmentData),
  getShipments: (filters = {}) => apiClient.get('/cargo-owners/shipments', { params: filters }),
  getShipment: (shipmentId) => apiClient.get(`/cargo-owners/shipments/${shipmentId}`),
  updateShipment: (shipmentId, updateData) => apiClient.put(`/cargo-owners/shipments/${shipmentId}`, updateData),
  cancelShipment: (shipmentId) => apiClient.delete(`/cargo-owners/shipments/${shipmentId}`),
  getDriverBids: (shipmentId) => apiClient.get(`/cargo-owners/shipments/${shipmentId}/bids`),
  acceptBid: (shipmentId, bidId) => apiClient.post(`/cargo-owners/shipments/${shipmentId}/bids/${bidId}/accept`),
  trackShipment: (shipmentId) => apiClient.get(`/cargo-owners/shipments/${shipmentId}/tracking`)
};

export const notificationAPI = {
  getNotifications: () => apiClient.get('/notifications'),
  markAsRead: (notificationId) => apiClient.patch(`/notifications/${notificationId}/read`),
  markAllAsRead: () => apiClient.patch('/notifications/read-all'),
  getUnreadCount: () => apiClient.get('/notifications/unread-count'),
  updatePreferences: (preferences) => apiClient.put('/notifications/preferences', preferences)
};

export default apiClient;