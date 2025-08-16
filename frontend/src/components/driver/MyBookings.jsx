import React, { useState, useEffect, useCallback } from 'react';
import {
  Package, MapPin, Calendar, DollarSign, Clock, 
  CheckCircle, AlertTriangle, Truck, Star,  RefreshCw, Filter,
  Eye, X, MoreVertical,  Award, AlertCircle
} from 'lucide-react';
import { authManager, isAuthenticated } from '../../utils/auth';

// API Configuration
const API_BASE_URL = 'https://infinite-cargo-api.onrender.com/api';

// Custom hook for managing alerts
const useAlert = () => {
  const [alert, setAlert] = useState({ message: '', type: '' });

  const showAlert = (message, type, duration = 3000) => {
    setAlert({ message, type });
    setTimeout(() => setAlert({ message: '', type: '' }), duration);
  };

  const clearAlert = () => {
    setAlert({ message: '', type: '' });
  };

  return { alert, showAlert, clearAlert };
};

const AlertBanner = ({ message, type, onClose }) => {
  if (!message) return null;

  const typeStyles = {
    success: 'bg-green-100 text-green-800 border-green-200',
    error: 'bg-red-100 text-red-800 border-red-200',
    info: 'bg-blue-100 text-blue-800 border-blue-200',
    warning: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  };
  const icon = type === 'success' ? <CheckCircle size={20} /> : 
               type === 'error' ? <AlertCircle size={20} /> : 
               type === 'warning' ? <AlertTriangle size={20} /> :
               <AlertCircle size={20} />;

  return (
    <div className={`p-4 rounded-lg border flex items-center justify-between gap-4 ${typeStyles[type]}`}>
      <div className="flex items-center gap-2">
        {icon}
        <p className="font-medium">{message}</p>
      </div>
      <button onClick={onClose} className="p-1 rounded-full hover:bg-black/10">
        <X size={16} />
      </button>
    </div>
  );
};

// API Service for bookings using AuthManager
class BookingService {
  constructor() {
    this.authManager = authManager;
  }

  getAuthHeaders() {
    const headers = {
      'Content-Type': 'application/json',
    };
    
    // Use AuthManager to get auth headers
    const authHeader = this.authManager.getAuthHeader();
    Object.assign(headers, authHeader);
    
    // Also add x-auth-token for backward compatibility if token exists
    const token = this.authManager.getToken();
    if (token) {
      headers['x-auth-token'] = token;
    }
    
    return headers;
  }

  async request(endpoint, options = {}) {
    // Check if user is authenticated before making requests
    if (!this.authManager.isAuthenticated()) {
      throw new Error('Authentication required. Please log in again.');
    }

    // Check if token is expiring soon and needs refresh
    if (this.authManager.isTokenExpiringSoon()) {
      try {
        await this.authManager.refreshToken();
      } catch (error) {
        console.warn('Token refresh failed:', error);
        // Continue with existing token, let the request fail if needed
      }
    }

    const url = `${API_BASE_URL}${endpoint}`;
    const config = {
      headers: this.getAuthHeaders(),
      ...options,
    };

    try {
      const response = await fetch(url, config);
      const data = await response.json();

      if (!response.ok) {
        // Handle authentication errors
        if (response.status === 401) {
          this.authManager.clearAuth();
          window.location.href = '/login';
          throw new Error('Session expired. Please log in again.');
        }
        
        throw new Error(data.message || `HTTP error! status: ${response.status}`);
      }

      return data;
    } catch (error) {
      console.error('API request error:', error);
      
      // Handle network errors that might indicate auth issues
      if (error.message.includes('Authentication required') || 
          error.message.includes('Session expired')) {
        this.authManager.clearAuth();
        window.location.href = '/login';
      }
      
      throw error;
    }
  }

  async getMyBookings(page = 1, status = null) {
    const queryParams = new URLSearchParams({
      page: page.toString(),
      limit: '20',
      ...(status && { status }),
    });
    
    return this.request(`/bookings?${queryParams}`);
  }

  async getBookingById(id) {
    return this.request(`/bookings/${id}`);
  }

  async updateBookingStatus(id, status, notes = '') {
    return this.request(`/bookings/${id}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status, notes }),
    });
  }

  async rateBooking(id, rating, review = '') {
    return this.request(`/bookings/${id}/rate`, {
      method: 'POST',
      body: JSON.stringify({ rating, review }),
    });
  }

  async getBookingStatistics() {
    return this.request('/bookings/statistics/summary');
  }
}

const MyBookings = () => {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [statistics, setStatistics] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [activeFilter, setActiveFilter] = useState('all');
  const { alert, showAlert, clearAlert } = useAlert();

  const bookingService = new BookingService();

  // Check authentication on component mount
  useEffect(() => {
    if (!isAuthenticated()) {
      authManager.clearAuth();
      window.location.href = '/login';
      return;
    }
  }, []);

  // Status configurations
  const statusConfig = {
    pending: {
      color: 'bg-yellow-100 text-yellow-800',
      icon: <Clock size={16} />,
      label: 'Pending Approval',
      description: 'Waiting for cargo owner to approve your request'
    },
    accepted: {
      color: 'bg-blue-100 text-blue-800',
      icon: <CheckCircle size={16} />,
      label: 'Accepted',
      description: 'Ready to start pickup'
    },
    in_progress: {
      color: 'bg-purple-100 text-purple-800',
      icon: <Truck size={16} />,
      label: 'In Progress',
      description: 'Load in transit'
    },
    completed: {
      color: 'bg-green-100 text-green-800',
      icon: <Award size={16} />,
      label: 'Completed',
      description: 'Successfully delivered'
    },
    cancelled: {
      color: 'bg-gray-100 text-gray-800',
      icon: <X size={16} />,
      label: 'Cancelled',
      description: 'Booking was cancelled'
    },
    rejected: {
      color: 'bg-red-100 text-red-800',
      icon: <AlertTriangle size={16} />,
      label: 'Rejected',
      description: 'Request was declined'
    }
  };

  const fetchBookings = useCallback(async (page = 1, status = null, isRefresh = false) => {
    // Double-check authentication before fetching
    if (!isAuthenticated()) {
      authManager.clearAuth();
      window.location.href = '/login';
      return;
    }

    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const response = await bookingService.getMyBookings(page, status);
      if (response && response.data) {
        setBookings(response.data.bookings);
        if (response.data.pagination) {
          setCurrentPage(response.data.pagination.currentPage);
          setTotalPages(response.data.pagination.totalPages);
        }
      }
    } catch (error) {
      console.error('Error fetching bookings:', error);
      showAlert('Failed to load bookings: ' + error.message, 'error');
    } finally {
      if (isRefresh) {
        setRefreshing(false);
      } else {
        setLoading(false);
      }
    }
  }, [showAlert]);

  const fetchStatistics = useCallback(async () => {
    if (!isAuthenticated()) {
      return;
    }

    try {
      const response = await bookingService.getBookingStatistics();
      if (response && response.data) {
        setStatistics(response.data.summary);
      }
    } catch (error) {
      console.warn('Failed to load statistics:', error);
      // Don't show error for statistics as it's not critical
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated()) {
      fetchBookings();
      fetchStatistics();
    }
  }, [fetchBookings, fetchStatistics]);

  const handleFilterChange = (filter) => {
    setActiveFilter(filter);
    setCurrentPage(1);
    const status = filter === 'all' ? null : filter;
    fetchBookings(1, status);
  };

  const handlePageChange = (page) => {
    const status = activeFilter === 'all' ? null : activeFilter;
    fetchBookings(page, status);
  };

  const handleViewDetails = (booking) => {
    setSelectedBooking(booking);
    setShowDetailsModal(true);
  };

  const handleStatusUpdate = async (status, notes = '') => {
    if (!selectedBooking) return;

    try {
      const currentLoading = loading;
      setLoading(true);
      await bookingService.updateBookingStatus(selectedBooking._id, status, notes);
      showAlert(`Booking ${status} successfully`, 'success');
      setShowStatusModal(false);
      await fetchBookings(currentPage, activeFilter === 'all' ? null : activeFilter);
    } catch (error) {
      console.error('Error updating booking status:', error);
      showAlert('Failed to update booking status: ' + error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitRating = async (rating, review) => {
    if (!selectedBooking) return;

    try {
      const currentLoading = loading;
      setLoading(true);
      await bookingService.rateBooking(selectedBooking._id, rating, review);
      showAlert('Rating submitted successfully', 'success');
      setShowRatingModal(false);
      await fetchBookings(currentPage, activeFilter === 'all' ? null : activeFilter);
    } catch (error) {
      console.error('Error submitting rating:', error);
      showAlert('Failed to submit rating: ' + error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = () => {
    fetchBookings(currentPage, activeFilter === 'all' ? null : activeFilter, true);
  };

  const formatCurrency = (amount) => new Intl.NumberFormat('en-KE', { 
    style: 'currency', 
    currency: 'KES' 
  }).format(amount || 0);

  const formatDate = (dateString) => new Date(dateString).toLocaleDateString('en-KE', { 
    year: 'numeric', 
    month: 'short', 
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  // Get current user info for display
  const currentUser = authManager.getUser();

  // Statistics Cards Component
  const StatisticsCards = () => {
    if (!statistics) return null;

    return (
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Total Bookings</p>
              <p className="text-2xl font-bold text-gray-900">{statistics.total || 0}</p>
            </div>
            <div className="p-3 rounded-full bg-blue-100">
              <Package className="h-6 w-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Completed</p>
              <p className="text-2xl font-bold text-green-600">{statistics.completed || 0}</p>
            </div>
            <div className="p-3 rounded-full bg-green-100">
              <CheckCircle className="h-6 w-6 text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Active Jobs</p>
              <p className="text-2xl font-bold text-purple-600">{(statistics.accepted + statistics.inProgress) || 0}</p>
            </div>
            <div className="p-3 rounded-full bg-purple-100">
              <Truck className="h-6 w-6 text-purple-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Total Revenue</p>
              <p className="text-2xl font-bold text-orange-600">{formatCurrency(statistics.totalRevenue || 0)}</p>
            </div>
            <div className="p-3 rounded-full bg-orange-100">
              <DollarSign className="h-6 w-6 text-orange-600" />
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Filter Tabs Component
  const FilterTabs = () => {
    const filters = [
      { key: 'all', label: 'All Bookings', count: statistics?.total || 0 },
      { key: 'pending', label: 'Pending', count: statistics?.pending || 0 },
      { key: 'accepted', label: 'Accepted', count: statistics?.accepted || 0 },
      { key: 'in_progress', label: 'In Progress', count: statistics?.inProgress || 0 },
      { key: 'completed', label: 'Completed', count: statistics?.completed || 0 },
    ];

    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
        <div className="flex items-center gap-4 mb-4">
          <Filter size={20} className="text-gray-600" />
          <h3 className="text-lg font-semibold text-gray-800">Filter Bookings</h3>
          {currentUser && (
            <span className="text-sm text-gray-500 ml-auto">
              Welcome, {currentUser.firstName || currentUser.name || 'Driver'}
            </span>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {filters.map(filter => (
            <button
              key={filter.key}
              onClick={() => handleFilterChange(filter.key)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeFilter === filter.key
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {filter.label} ({filter.count})
            </button>
          ))}
        </div>
      </div>
    );
  };

  // Booking Card Component
  const BookingCard = ({ booking }) => {
    const config = statusConfig[booking.status] || statusConfig.pending;
    const canStart = booking.status === 'accepted';
    const canComplete = booking.status === 'in_progress';
    const canRate = booking.status === 'completed' && !booking.driverRating;

    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
        <div className="flex justify-between items-start mb-4">
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-gray-800 mb-2">{booking.loadTitle}</h3>
            <div className="flex items-center gap-2 text-gray-600 mb-2">
              <MapPin size={16} />
              <span className="text-sm">{booking.pickupLocation} → {booking.deliveryLocation}</span>
            </div>
            <div className="flex items-center gap-4 text-sm text-gray-600">
              <div className="flex items-center gap-1">
                <Calendar size={14} />
                <span>Pickup: {formatDate(booking.pickupDate)}</span>
              </div>
              <div className="flex items-center gap-1">
                <DollarSign size={14} />
                <span className="font-medium text-green-600">{formatCurrency(booking.proposedPrice)}</span>
              </div>
            </div>
          </div>
          
          <div className="flex flex-col items-end gap-2">
            <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium ${config.color}`}>
              {config.icon}
              {config.label}
            </span>
            
            <div className="relative">
              <button 
                onClick={() => handleViewDetails(booking)}
                className="p-2 hover:bg-gray-100 rounded-full"
                title="More options"
              >
                <MoreVertical size={16} />
              </button>
            </div>
          </div>
        </div>

        {booking.notes && (
          <div className="mb-4 p-3 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-700">
              <strong>Notes:</strong> {booking.notes}
            </p>
          </div>
        )}

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4 text-xs text-gray-500">
            <span>Booking Type: {booking.bookingType?.replace('_', ' ')}</span>
            <span>Created: {formatDate(booking.createdAt)}</span>
          </div>

          <div className="flex items-center gap-2">
            {canRate && (
              <button
                onClick={() => {
                  setSelectedBooking(booking);
                  setShowRatingModal(true);
                }}
                className="px-3 py-1 text-xs bg-yellow-100 text-yellow-700 rounded-lg hover:bg-yellow-200 flex items-center gap-1"
              >
                <Star size={12} />
                Rate
              </button>
            )}
            
            {canStart && (
              <button
                onClick={() => {
                  setSelectedBooking(booking);
                  setShowStatusModal(true);
                }}
                className="px-3 py-1 text-xs bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 flex items-center gap-1"
              >
                <Truck size={12} />
                Start Trip
              </button>
            )}
            
            {canComplete && (
              <button
                onClick={() => {
                  setSelectedBooking(booking);
                  setShowStatusModal(true);
                }}
                className="px-3 py-1 text-xs bg-green-100 text-green-700 rounded-lg hover:bg-green-200 flex items-center gap-1"
              >
                <CheckCircle size={12} />
                Complete
              </button>
            )}
            
            <button
              onClick={() => handleViewDetails(booking)}
              className="px-3 py-1 text-xs bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 flex items-center gap-1"
            >
              <Eye size={12} />
              View Details
            </button>
          </div>
        </div>
      </div>
    );
  };

  // Booking Details Modal Component
  const BookingDetailsModal = () => {
    if (!selectedBooking || !showDetailsModal) return null;

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
          <div className="sticky top-0 bg-white border-b border-gray-200 p-6">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-800">Booking Details</h2>
              <button
                onClick={() => setShowDetailsModal(false)}
                className="p-2 hover:bg-gray-100 rounded-full"
              >
                <X size={20} />
              </button>
            </div>
          </div>

          <div className="p-6 space-y-6">
            {/* Load Information */}
            <div>
              <h3 className="text-lg font-semibold text-gray-800 mb-3">Load Information</h3>
              <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                <div>
                  <label className="text-sm font-medium text-gray-600">Title</label>
                  <p className="text-gray-800">{selectedBooking.loadTitle}</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-600">Pickup Location</label>
                    <p className="text-gray-800">{selectedBooking.pickupLocation}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-600">Delivery Location</label>
                    <p className="text-gray-800">{selectedBooking.deliveryLocation}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-600">Pickup Date</label>
                    <p className="text-gray-800">{formatDate(selectedBooking.pickupDate)}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-600">Delivery Date</label>
                    <p className="text-gray-800">{formatDate(selectedBooking.deliveryDate)}</p>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600">Proposed Price</label>
                  <p className="text-xl font-bold text-green-600">{formatCurrency(selectedBooking.proposedPrice)}</p>
                </div>
              </div>
            </div>

            {/* Load Snapshot */}
            {selectedBooking.loadSnapshot && (
              <div>
                <h3 className="text-lg font-semibold text-gray-800 mb-3">Load Details</h3>
                <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-gray-600">Weight</label>
                      <p className="text-gray-800">{selectedBooking.loadSnapshot.weight} tonnes</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-600">Cargo Type</label>
                      <p className="text-gray-800">{selectedBooking.loadSnapshot.cargoType?.replace('_', ' ')}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-gray-600">Vehicle Type</label>
                      <p className="text-gray-800">{selectedBooking.loadSnapshot.vehicleType?.replace('_', ' ')}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-600">Budget</label>
                      <p className="text-gray-800">{formatCurrency(selectedBooking.loadSnapshot.budget)}</p>
                    </div>
                  </div>
                  {selectedBooking.loadSnapshot.description && (
                    <div>
                      <label className="text-sm font-medium text-gray-600">Description</label>
                      <p className="text-gray-800">{selectedBooking.loadSnapshot.description}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Status Information */}
            <div>
              <h3 className="text-lg font-semibold text-gray-800 mb-3">Status Information</h3>
              <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-600">Current Status</span>
                  <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium ${statusConfig[selectedBooking.status].color}`}>
                    {statusConfig[selectedBooking.status].icon}
                    {statusConfig[selectedBooking.status].label}
                  </span>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600">Booking Type</label>
                  <p className="text-gray-800">{selectedBooking.bookingType?.replace('_', ' ')}</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-600">Created At</label>
                    <p className="text-gray-800">{formatDate(selectedBooking.createdAt)}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-600">Updated At</label>
                    <p className="text-gray-800">{formatDate(selectedBooking.updatedAt)}</p>
                  </div>
                </div>
                {selectedBooking.notes && (
                  <div>
                    <label className="text-sm font-medium text-gray-600">Notes</label>
                    <p className="text-gray-800">{selectedBooking.notes}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Ratings */}
            {(selectedBooking.driverRating || selectedBooking.cargoOwnerRating) && (
              <div>
                <h3 className="text-lg font-semibold text-gray-800 mb-3">Ratings</h3>
                <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                  {selectedBooking.driverRating && (
                    <div>
                      <label className="text-sm font-medium text-gray-600">Your Rating</label>
                      <div className="flex items-center gap-2">
                        <div className="flex items-center">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <Star
                              key={star}
                              size={16}
                              className={star <= selectedBooking.driverRating.rating ? 'text-yellow-400 fill-current' : 'text-gray-300'}
                            />
                          ))}
                        </div>
                        <span className="text-sm text-gray-600">({selectedBooking.driverRating.rating}/5)</span>
                      </div>
                      {selectedBooking.driverRating.review && (
                        <p className="text-sm text-gray-700 mt-2">{selectedBooking.driverRating.review}</p>
                      )}
                    </div>
                  )}
                  
                  {selectedBooking.cargoOwnerRating && (
                    <div>
                      <label className="text-sm font-medium text-gray-600">Cargo Owner's Rating</label>
                      <div className="flex items-center gap-2">
                        <div className="flex items-center">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <Star
                              key={star}
                              size={16}
                              className={star <= selectedBooking.cargoOwnerRating.rating ? 'text-yellow-400 fill-current' : 'text-gray-300'}
                            />
                          ))}
                        </div>
                        <span className="text-sm text-gray-600">({selectedBooking.cargoOwnerRating.rating}/5)</span>
                      </div>
                      {selectedBooking.cargoOwnerRating.review && (
                        <p className="text-sm text-gray-700 mt-2">{selectedBooking.cargoOwnerRating.review}</p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="sticky bottom-0 bg-white border-t border-gray-200 p-6">
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowDetailsModal(false)}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Rating Modal Component
  const RatingModal = () => {
    const [rating, setRating] = useState(0);
    const [review, setReview] = useState('');
    const [submitting, setSubmitting] = useState(false);

    if (!selectedBooking || !showRatingModal) return null;

    const handleSubmit = async () => {
      if (rating === 0) {
        showAlert('Please select a rating', 'warning');
        return;
      }

      setSubmitting(true);
      try {
        await handleSubmitRating(rating, review);
      } finally {
        setSubmitting(false);
      }
    };

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-xl max-w-md w-full p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold text-gray-800">Rate Cargo Owner</h2>
            <button
              onClick={() => setShowRatingModal(false)}
              className="p-2 hover:bg-gray-100 rounded-full"
              disabled={submitting}
            >
              <X size={20} />
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Rating *</label>
              <div className="flex items-center gap-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    onClick={() => setRating(star)}
                    className={`p-1 ${star <= rating ? 'text-yellow-400' : 'text-gray-300'} hover:text-yellow-400`}
                    disabled={submitting}
                  >
                    <Star size={24} className={star <= rating ? 'fill-current' : ''} />
                  </button>
                ))}
                <span className="ml-2 text-sm text-gray-600">({rating}/5)</span>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Review (Optional)</label>
              <textarea
                value={review}
                onChange={(e) => setReview(e.target.value)}
                rows="4"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Share your experience working with this cargo owner..."
                maxLength="1000"
                disabled={submitting}
              />
              <p className="text-xs text-gray-500 mt-1">{review.length}/1000 characters</p>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-sm text-blue-800">
                <strong>Load:</strong> {selectedBooking.loadTitle}
              </p>
              <p className="text-xs text-blue-600 mt-1">Rate your overall experience with this cargo owner</p>
            </div>

            <div className="flex gap-3 pt-4">
              <button
                onClick={() => setShowRatingModal(false)}
                disabled={submitting}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting || rating === 0}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <>
                    <RefreshCw size={16} className="animate-spin" />
                    Submitting...
                  </>
                ) : (
                  'Submit Rating'
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Status Update Modal Component
  const StatusUpdateModal = () => {
    const [notes, setNotes] = useState('');
    const [submitting, setSubmitting] = useState(false);

    if (!selectedBooking || !showStatusModal) return null;

    const canStart = selectedBooking.status === 'accepted';
    const canComplete = selectedBooking.status === 'in_progress';

    if (!canStart && !canComplete) {
      setShowStatusModal(false);
      return null;
    }

    const targetStatus = canStart ? 'in_progress' : 'completed';
    const actionLabel = canStart ? 'Start Trip' : 'Complete Delivery';
    const actionDescription = canStart 
      ? 'Mark this booking as in progress and begin transportation'
      : 'Mark this delivery as completed';

    const handleSubmit = async () => {
      setSubmitting(true);
      try {
        await handleStatusUpdate(targetStatus, notes);
      } finally {
        setSubmitting(false);
      }
    };

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-xl max-w-md w-full p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold text-gray-800">{actionLabel}</h2>
            <button
              onClick={() => setShowStatusModal(false)}
              className="p-2 hover:bg-gray-100 rounded-full"
              disabled={submitting}
            >
              <X size={20} />
            </button>
          </div>

          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                {canStart ? <Truck className="h-5 w-5 text-blue-600" /> : <CheckCircle className="h-5 w-5 text-blue-600" />}
                <h3 className="font-medium text-blue-800">{selectedBooking.loadTitle}</h3>
              </div>
              <p className="text-sm text-blue-700">{actionDescription}</p>
              <div className="mt-2 text-xs text-blue-600">
                {selectedBooking.pickupLocation} → {selectedBooking.deliveryLocation}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {canStart ? 'Trip Notes (Optional)' : 'Delivery Notes (Optional)'}
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows="3"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder={canStart 
                  ? "Any special notes or observations about starting the trip..."
                  : "Delivery details, recipient information, any issues encountered..."
                }
                maxLength="500"
                disabled={submitting}
              />
              <p className="text-xs text-gray-500 mt-1">{notes.length}/500 characters</p>
            </div>

            {canComplete && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-yellow-600" />
                  <p className="text-sm text-yellow-800">
                    <strong>Important:</strong> Only mark as completed after successful delivery
                  </p>
                </div>
              </div>
            )}

            <div className="flex gap-3 pt-4">
              <button
                onClick={() => setShowStatusModal(false)}
                disabled={submitting}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className={`flex-1 px-4 py-2 text-white rounded-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 ${
                  canStart ? 'bg-blue-600' : 'bg-green-600'
                }`}
              >
                {submitting ? (
                  <>
                    <RefreshCw size={16} className="animate-spin" />
                    Updating...
                  </>
                ) : (
                  <>
                    {canStart ? <Truck size={16} /> : <CheckCircle size={16} />}
                    {actionLabel}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Pagination Component
  const Pagination = () => {
    if (totalPages <= 1) return null;

    return (
      <div className="flex items-center justify-between mt-8">
        <div className="text-sm text-gray-600">
          Page {currentPage} of {totalPages}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage === 1 || loading}
            className="px-3 py-1 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Previous
          </button>
          
          {[...Array(Math.min(5, totalPages))].map((_, index) => {
            const pageNumber = Math.max(1, currentPage - 2) + index;
            if (pageNumber > totalPages) return null;
            
            return (
              <button
                key={pageNumber}
                onClick={() => handlePageChange(pageNumber)}
                disabled={loading}
                className={`px-3 py-1 text-sm rounded-lg ${
                  currentPage === pageNumber
                    ? 'bg-blue-600 text-white'
                    : 'border border-gray-300 hover:bg-gray-50 disabled:opacity-50'
                }`}
              >
                {pageNumber}
              </button>
            );
          })}
          
          <button
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={currentPage === totalPages || loading}
            className="px-3 py-1 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Next
          </button>
        </div>
      </div>
    );
  };

  // Empty State Component
  const EmptyState = () => (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
      <Package className="h-16 w-16 text-gray-400 mx-auto mb-4" />
      <h3 className="text-lg font-medium text-gray-800 mb-2">No bookings found</h3>
      <p className="text-gray-600 mb-6">
        {activeFilter === 'all' 
          ? "You haven't received any bookings yet. Start bidding on available loads to get your first booking!"
          : `No ${activeFilter} bookings at the moment.`
        }
      </p>
      {activeFilter === 'all' && (
        <button
          onClick={() => window.location.href = '/dashboard?tab=loads'}
          className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Browse Available Loads
        </button>
      )}
    </div>
  );

  // Loading State Component
  const LoadingState = () => (
    <div className="space-y-4">
      {[1, 2, 3].map((item) => (
        <div key={item} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="animate-pulse">
            <div className="flex justify-between items-start mb-4">
              <div className="flex-1">
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-3"></div>
                <div className="h-3 bg-gray-200 rounded w-1/2 mb-2"></div>
                <div className="h-3 bg-gray-200 rounded w-2/3"></div>
              </div>
              <div className="h-6 bg-gray-200 rounded-full w-20"></div>
            </div>
            <div className="flex justify-between">
              <div className="h-3 bg-gray-200 rounded w-1/4"></div>
              <div className="flex gap-2">
                <div className="h-6 bg-gray-200 rounded w-16"></div>
                <div className="h-6 bg-gray-200 rounded w-20"></div>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );

  // Authentication check before rendering
  if (!isAuthenticated()) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="h-16 w-16 text-red-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-800 mb-2">Authentication Required</h2>
          <p className="text-gray-600 mb-6">Please log in to access your bookings.</p>
          <button
            onClick={() => window.location.href = '/login'}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  // Main Render
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Alert Banner */}
      {alert.message && (
        <div className="fixed top-4 right-4 z-50 max-w-md">
          <AlertBanner message={alert.message} type={alert.type} onClose={clearAlert} />
        </div>
      )}

      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-800 mb-2">My Bookings</h1>
              <p className="text-gray-600">Manage your delivery bookings and track your jobs</p>
            </div>
            
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
            >
              <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
              Refresh
            </button>
          </div>
        </div>

        {/* Statistics Cards */}
        <StatisticsCards />

        {/* Filter Tabs */}
        <FilterTabs />

        {/* Bookings List */}
        <div className="space-y-4">
          {loading ? (
            <LoadingState />
          ) : bookings.length > 0 ? (
            <>
              {bookings.map((booking) => (
                <BookingCard key={booking._id} booking={booking} />
              ))}
              <Pagination />
            </>
          ) : (
            <EmptyState />
          )}
        </div>
      </div>

      {/* Modals */}
      <BookingDetailsModal />
      <RatingModal />
      <StatusUpdateModal />
    </div>
  );
};

export default MyBookings;