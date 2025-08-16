import axios from 'axios';

// Base URL for your API - update this for production
const BASE_URL = process.env.NODE_ENV === 'production' 
  ? 'https://yourdomain.com/api'  // Your cPanel domain
  : 'http://localhost:5000/api';

// Create axios instance
const api = axios.create({
  baseURL: BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle errors
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    // Handle token expiration
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    
    // Handle network errors
    if (!error.response) {
      console.error('Network error:', error.message);
      return Promise.reject({
        message: 'Network error. Please check your internet connection.',
        type: 'network'
      });
    }
    
    return Promise.reject(error.response.data);
  }
);

// Auth API calls
export const authAPI = {
  register: async (userData) => {
    const response = await api.post('/auth/register', userData);
    return response.data;
  },
  
  login: async (credentials) => {
    const response = await api.post('/auth/login', credentials);
    return response.data;
  },
  
  verifyToken: async () => {
    const response = await api.get('/auth/verify');
    return response.data;
  }
};

// User API calls
export const userAPI = {
  getProfile: async (userId) => {
    const response = await api.get(`/users/${userId}`);
    return response.data;
  },
  
  updateProfile: async (userId, userData) => {
    const response = await api.put(`/users/${userId}`, userData);
    return response.data;
  },
  
  getUsers: async (userType) => {
    const response = await api.get(`/users?type=${userType}`);
    return response.data;
  }
};

// Truck API calls
export const truckAPI = {
  getTrucks: async (driverId) => {
    const response = await api.get(`/trucks?driver_id=${driverId}`);
    return response.data;
  },
  
  addTruck: async (truckData) => {
    const response = await api.post('/trucks', truckData);
    return response.data;
  },
  
  updateTruck: async (truckId, truckData) => {
    const response = await api.put(`/trucks/${truckId}`, truckData);
    return response.data;
  },
  
  deleteTruck: async (truckId) => {
    const response = await api.delete(`/trucks/${truckId}`);
    return response.data;
  },
  
  getAvailableTrucks: async (location, capacity) => {
    const params = new URLSearchParams();
    if (location) params.append('location', location);
    if (capacity) params.append('capacity', capacity);
    
    const response = await api.get(`/trucks/available?${params}`);
    return response.data;
  }
};

// Load API calls
export const loadAPI = {
  getLoads: async (filters = {}) => {
    const params = new URLSearchParams();
    Object.keys(filters).forEach(key => {
      if (filters[key]) params.append(key, filters[key]);
    });
    
    const response = await api.get(`/loads?${params}`);
    return response.data;
  },
  
  getLoad: async (loadId) => {
    const response = await api.get(`/loads/${loadId}`);
    return response.data;
  },
  
  createLoad: async (loadData) => {
    const response = await api.post('/loads', loadData);
    return response.data;
  },
  
  updateLoad: async (loadId, loadData) => {
    const response = await api.put(`/loads/${loadId}`, loadData);
    return response.data;
  },
  
  deleteLoad: async (loadId) => {
    const response = await api.delete(`/loads/${loadId}`);
    return response.data;
  },
  
  searchLoads: async (searchParams) => {
    const params = new URLSearchParams();
    Object.keys(searchParams).forEach(key => {
      if (searchParams[key]) params.append(key, searchParams[key]);
    });
    
    const response = await api.get(`/loads/search?${params}`);
    return response.data;
  }
};

// Bid API calls
export const bidAPI = {
  getBids: async (loadId) => {
    const response = await api.get(`/bids?load_id=${loadId}`);
    return response.data;
  },
  
  getMyBids: async (driverId) => {
    const response = await api.get(`/bids?driver_id=${driverId}`);
    return response.data;
  },
  
  createBid: async (bidData) => {
    const response = await api.post('/bids', bidData);
    return response.data;
  },
  
  updateBid: async (bidId, bidData) => {
    const response = await api.put(`/bids/${bidId}`, bidData);
    return response.data;
  },
  
  acceptBid: async (bidId) => {
    const response = await api.post(`/bids/${bidId}/accept`);
    return response.data;
  },
  
  rejectBid: async (bidId) => {
    const response = await api.post(`/bids/${bidId}/reject`);
    return response.data;
  }
};

// Booking API calls
export const bookingAPI = {
  getBookings: async (userId, userType) => {
    const response = await api.get(`/bookings?user_id=${userId}&user_type=${userType}`);
    return response.data;
  },
  
  getBooking: async (bookingId) => {
    const response = await api.get(`/bookings/${bookingId}`);
    return response.data;
  },
  
  updateBookingStatus: async (bookingId, status, notes) => {
    const response = await api.put(`/bookings/${bookingId}/status`, { status, notes });
    return response.data;
  },
  
  addTrackingUpdate: async (bookingId, update) => {
    const response = await api.post(`/bookings/${bookingId}/tracking`, update);
    return response.data;
  }
};

// Utility functions
export const utils = {
  // Test API connection
  healthCheck: async () => {
    try {
      const response = await api.get('/health');
      return response.data;
    } catch (error) {
      throw error;
    }
  },
  
  // Upload file (if needed)
  uploadFile: async (file, type) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('type', type);
    
    const response = await api.post('/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },
  
  // Format currency
  formatCurrency: (amount) => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES'
    }).format(amount);
  },
  
  // Format date
  formatDate: (date) => {
    return new Date(date).toLocaleDateString('en-KE');
  },
  
  // Calculate distance (basic implementation)
  calculateDistance: (lat1, lon1, lat2, lon2) => {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c; // Distance in km
  }
};


export default api;