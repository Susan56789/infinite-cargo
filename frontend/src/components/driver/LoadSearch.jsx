import React, { useState, useEffect } from 'react';
import { 
  Search, 
  MapPin, 
  Truck, 
  Calendar, 
  DollarSign, 
  Weight, 
  Clock, 
  X, 
  User, 
  Package, 
  AlertCircle, 
  Eye, 
  TrendingUp,
  RefreshCw,
  AlertTriangle
} from 'lucide-react';

import { 
  authManager, 
  isAuthenticated, 
  getUser, 
  getAuthHeader, 
  getUserType,
  logout 
} from '../../utils/auth';

const LoadSearch = () => {
  const [loads, setLoads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLoad, setSelectedLoad] = useState(null);
  const [showLoadModal, setShowLoadModal] = useState(false);
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);
  const [isUserAuthenticated, setIsUserAuthenticated] = useState(false);
  const [user, setUser] = useState(null);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalLoads, setTotalLoads] = useState(0);
  const limit = 12;

  const [filters, setFilters] = useState({
    pickupLocation: '',
    deliveryLocation: '',
    cargoType: '',
    vehicleType: '',
    minBudget: '',
    maxBudget: '',
    minWeight: '',
    maxWeight: '',
    isUrgent: ''
  });

  // Cargo and vehicle types
  const cargoTypes = [
    { value: '', label: 'All Cargo Types' },
    { value: 'electronics', label: 'Electronics' },
    { value: 'furniture', label: 'Furniture' },
    { value: 'construction_materials', label: 'Construction Materials' },
    { value: 'food_beverages', label: 'Food & Beverages' },
    { value: 'textiles', label: 'Textiles' },
    { value: 'machinery', label: 'Machinery' },
    { value: 'medical_supplies', label: 'Medical Supplies' },
    { value: 'automotive_parts', label: 'Automotive Parts' },
    { value: 'agricultural_products', label: 'Agricultural Products' },
    { value: 'chemicals', label: 'Chemicals' },
    { value: 'fragile_items', label: 'Fragile Items' },
    { value: 'hazardous_materials', label: 'Hazardous Materials' },
    { value: 'livestock', label: 'Livestock' },
    { value: 'containers', label: 'Containers' },
    { value: 'other', label: 'Other' }
  ];

  const vehicleTypes = [
    { value: '', label: 'All Vehicle Types' },
    { value: 'pickup', label: 'Pickup' },
    { value: 'van', label: 'Van' },
    { value: 'small_truck', label: 'Small Truck' },
    { value: 'medium_truck', label: 'Medium Truck' },
    { value: 'large_truck', label: 'Large Truck' },
    { value: 'heavy_truck', label: 'Heavy Truck' },
    { value: 'trailer', label: 'Trailer' },
    { value: 'refrigerated_truck', label: 'Refrigerated Truck' },
    { value: 'flatbed', label: 'Flatbed' },
    { value: 'container_truck', label: 'Container Truck' }
  ];

  // Authentication functions
  const checkAuthStatus = () => {
    try {
      const authenticated = isAuthenticated(false);
      const userData = getUser(false);
      
      setIsUserAuthenticated(authenticated);
      setUser(userData);
      
      return authenticated;
    } catch (error) {
      console.warn('Auth check failed:', error);
      setIsUserAuthenticated(false);
      setUser(null);
      return false;
    }
  };

  const getAuthHeaders = () => {
    try {
      if (isUserAuthenticated) {
        const authHeader = getAuthHeader(false);
        // Handle both formats: { Authorization: 'Bearer token' } or { 'x-auth-token': 'token' }
        if (authHeader && typeof authHeader === 'object') {
          return authHeader;
        }
        return {};
      }
      return {};
    } catch (error) {
      console.warn('Failed to get auth headers:', error);
      return {};
    }
  };

  useEffect(() => {
    checkAuthStatus();
    fetchLoads();
  }, []);

  const fetchLoads = async (page = 1) => {
  try {
    setLoading(true);
    setError('');

    // Build query parameters
    const params = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
    });

    if (searchQuery?.trim()) {
      params.append('search', searchQuery.trim());
    }

    // Add filters (only truthy values)
    Object.entries(filters).forEach(([key, value]) => {
      if (String(value).trim()) {
        params.append(key, value.toString());
      }
    });

    const url = `https://infinite-cargo-api.onrender.com/api/loads?${params.toString()}`;
    console.log('Fetching loads:', url);

    // Build headers
    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      ...getAuthHeaders()   // Adds Authorization: Bearer token if exists
    };

    const response = await fetch(url, {
      method: 'GET',
      headers,
      credentials: 'include' // only if your API set Allow-Credentials
    });

    if (!response.ok) {
      // try to extract message
      let serverError = 'Failed to fetch loads.';
      try {
        const resData = await response.json();
        serverError = resData.message || serverError;
      } catch (_) {}
      throw new Error(`${serverError} (HTTP ${response.status})`);
    }

    const data = await response.json();

    if (data.status !== 'success') {
      throw new Error(data.message || 'Unexpected server response.');
    }

    // Success: update state
    const { loads: loadsArr, pagination } = data.data;
    setLoads(loadsArr);
    setCurrentPage(pagination.currentPage);
    setTotalPages(pagination.totalPages);
    setTotalLoads(pagination.totalLoads);

  } catch (err) {
    console.error('Error loading loads:', err);
    setError(
      err.message === 'Failed to fetch'
        ? 'Network error: Could not reach server.'
        : err.message
    );
  } finally {
    setLoading(false);
  }
};

  // FIXED: Add retry mechanism
  const retryFetch = async (retries = 3) => {
    for (let i = 0; i < retries; i++) {
      try {
        await fetchLoads(currentPage);
        break; // Success, exit retry loop
      } catch (error) {
        if (i === retries - 1) {
          // Last retry failed
          setError('Failed to load after multiple attempts. Please refresh the page.');
        } else {
          // Wait before retry
          await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
        }
      }
    }
  };

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const clearFilters = () => {
    setFilters({
      pickupLocation: '',
      deliveryLocation: '',
      cargoType: '',
      vehicleType: '',
      minBudget: '',
      maxBudget: '',
      minWeight: '',
      maxWeight: '',
      isUrgent: ''
    });
    setSearchQuery('');
  };

  const formatCurrency = (amount) => {
    if (!amount || isNaN(amount)) return 'KES 0';
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      minimumFractionDigits: 0
    }).format(amount);
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      return new Intl.DateTimeFormat('en-KE', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }).format(new Date(dateString));
    } catch (error) {
      console.warn('Date formatting error:', error);
      return 'Invalid date';
    }
  };

  const getCargoTypeLabel = (type) => {
    if (!type) return 'N/A';
    const cargoType = cargoTypes.find(t => t.value === type);
    return cargoType ? cargoType.label : type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  const getVehicleTypeLabel = (type) => {
    if (!type) return 'N/A';
    const vehicleType = vehicleTypes.find(t => t.value === type);
    return vehicleType ? vehicleType.label : type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  const handleRefresh = () => {
    checkAuthStatus();
    fetchLoads(currentPage);
  };

  const handleViewDetails = async (load) => {
    try {
      // Fetch detailed load information
      const headers = {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...getAuthHeaders()
      };

      const response = await fetch(`https://infinite-cargo-api.onrender.com/api/loads/${load._id}`, {
        method: 'GET',
        headers,
        credentials: 'include'
      });

      if (response.ok) {
        const data = await response.json();
        if (data.status === 'success' && data.data) {
          setSelectedLoad(data.data.load);
          setShowLoadModal(true);
        } else {
          // Fallback to the basic load data
          setSelectedLoad(load);
          setShowLoadModal(true);
        }
      } else {
        // Fallback to the basic load data
        console.warn('Failed to fetch detailed load info, using basic data');
        setSelectedLoad(load);
        setShowLoadModal(true);
      }
    } catch (error) {
      console.warn('Error fetching load details:', error);
      // Fallback to the basic load data
      setSelectedLoad(load);
      setShowLoadModal(true);
    }
  };

  const handleBidClick = (load) => {
    if (!isUserAuthenticated) {
      setShowLoginPrompt(true);
      return;
    }

    if (user?.userType !== 'driver') {
      setError('Only drivers can place bids on loads.');
      return;
    }

    // FIXED: Add proper bid handling
    console.log('Opening bid functionality for load:', load._id);
    // You can implement bid modal or redirect to bid page here
    // For now, show an alert
    alert('Bid functionality will be implemented here. Load ID: ' + load._id);
  };

  const handleLogin = () => {
    setShowLoginPrompt(false);
    // FIXED: Better routing handling
    try {
      // Check if we're in a React Router environment
      if (window.history && window.history.pushState) {
        window.history.pushState({}, '', '/login');
        window.location.reload(); // Force reload to login page
      } else {
        window.location.href = '/login';
      }
    } catch (error) {
      console.warn('Navigation error:', error);
      window.location.href = '/login';
    }
  };

  // FIXED: Add error boundary style handling
  const handleErrorDismiss = () => {
    setError('');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading available loads...</p>
          <p className="text-sm text-gray-500 mt-2">This may take a few moments</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="py-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Find Loads</h1>
                <p className="text-gray-600">Discover available cargo loads for transport</p>
              </div>
              <div className="flex items-center space-x-4">
                {user ? (
                  <div className="flex items-center space-x-4">
                    <div className="flex items-center space-x-2 text-sm text-gray-600">
                      <User className="w-4 h-4" />
                      <span>Welcome, {user.name || 'User'}</span>
                      <span className={`px-2 py-1 rounded text-xs ${
                        user.userType === 'driver' 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-blue-100 text-blue-800'
                      }`}>
                        {user.userType || 'user'}
                      </span>
                    </div>
                    <button
                      onClick={() => {
                        logout();
                        checkAuthStatus();
                      }}
                      className="text-sm text-gray-600 hover:text-gray-800"
                    >
                      Logout
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={handleLogin}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm"
                  >
                    Login / Register
                  </button>
                )}
                <button
                  onClick={handleRefresh}
                  className="inline-flex items-center px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  disabled={loading}
                >
                  <RefreshCw size={16} className={`mr-2 ${loading ? 'animate-spin' : ''}`} />
                  Refresh
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* FIXED: Enhanced Error State */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <div className="flex items-start">
              <AlertCircle className="h-5 w-5 text-red-400 mr-3 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm text-red-800 font-medium">Error occurred:</p>
                <p className="text-sm text-red-700 mt-1">{error}</p>
                {error.includes('Server error') && (
                  <div className="mt-3 flex space-x-3">
                    <button
                      onClick={retryFetch}
                      className="text-sm bg-red-100 text-red-800 px-3 py-1 rounded hover:bg-red-200 transition-colors"
                    >
                      Retry
                    </button>
                    <button
                      onClick={handleRefresh}
                      className="text-sm bg-blue-100 text-blue-800 px-3 py-1 rounded hover:bg-blue-200 transition-colors"
                    >
                      Refresh Page
                    </button>
                  </div>
                )}
              </div>
              <button
                onClick={handleErrorDismiss}
                className="text-red-400 hover:text-red-600 flex-shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}

        {/* Public Access Notice */}
        {!isUserAuthenticated && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-8">
            <div className="flex items-center">
              <AlertCircle className="h-5 w-5 text-blue-400 mr-3" />
              <div>
                <p className="text-sm text-blue-800">
                  <strong>Browse loads publicly!</strong> To place bids and access full features, please login as a driver or create an account.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Search Bar */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
          <div className="flex flex-col lg:flex-row gap-4 items-center">
            <div className="flex-1 relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                placeholder="Search loads by title, description, or location..."
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    fetchLoads(1);
                  }
                }}
              />
            </div>
            <button
              onClick={() => fetchLoads(1)}
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Searching...' : 'Search'}
            </button>
          </div>

          {/* Filters */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Pickup Location</label>
              <input
                type="text"
                value={filters.pickupLocation}
                onChange={(e) => handleFilterChange('pickupLocation', e.target.value)}
                className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 text-sm"
                placeholder="City, County"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Delivery Location</label>
              <input
                type="text"
                value={filters.deliveryLocation}
                onChange={(e) => handleFilterChange('deliveryLocation', e.target.value)}
                className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 text-sm"
                placeholder="City, County"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Cargo Type</label>
              <select
                value={filters.cargoType}
                onChange={(e) => handleFilterChange('cargoType', e.target.value)}
                className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 text-sm"
              >
                {cargoTypes.map(type => (
                  <option key={type.value} value={type.value}>{type.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Vehicle Type</label>
              <select
                value={filters.vehicleType}
                onChange={(e) => handleFilterChange('vehicleType', e.target.value)}
                className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 text-sm"
              >
                {vehicleTypes.map(type => (
                  <option key={type.value} value={type.value}>{type.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex justify-between items-center mt-4">
            <button
              onClick={clearFilters}
              className="text-sm text-gray-600 hover:text-gray-800 transition-colors"
            >
              Clear Filters
            </button>
            <button
              onClick={() => fetchLoads(1)}
              disabled={loading}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Applying...' : 'Apply Filters'}
            </button>
          </div>
        </div>

        {/* Results */}
        {loads.length === 0 && !loading ? (
          <div className="text-center py-12">
            <Package className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No loads found</h3>
            <p className="text-gray-600 mb-4">
              {searchQuery || Object.values(filters).some(f => f) 
                ? 'Try adjusting your search criteria or filters'
                : 'No loads are currently available'
              }
            </p>
            <div className="flex justify-center space-x-3">
              <button
                onClick={clearFilters}
                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
              >
                Clear Filters
              </button>
              <button
                onClick={() => fetchLoads(1)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Reload
              </button>
            </div>
          </div>
        ) : (
          <div>
            <div className="flex items-center justify-between mb-6">
              <p className="text-gray-600">
                Found {totalLoads} load{totalLoads !== 1 ? 's' : ''}
                {searchQuery && ` matching "${searchQuery}"`}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
              {loads.map((load) => (
                <div key={load._id} className={`bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow border border-gray-200 ${load.isPriorityListing ? 'ring-2 ring-yellow-400' : ''}`}>
                  <div className="p-6">
                    <div className="flex items-start justify-between mb-3">
                      <h3 className="text-lg font-semibold text-gray-900 line-clamp-2">{load.title || 'Untitled Load'}</h3>
                      <div className="flex flex-col items-end space-y-1">
                        {load.isUrgent && (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                            <Clock className="w-3 h-3 mr-1" />
                            Urgent
                          </span>
                        )}
                        {load.isPriorityListing && (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                            <TrendingUp className="w-3 h-3 mr-1" />
                            Featured
                          </span>
                        )}
                      </div>
                    </div>
                    
                    <p className="text-gray-600 text-sm mb-4 line-clamp-3">{load.description || 'No description available'}</p>

                    {/* Route */}
                    <div className="space-y-2 mb-4">
                      <div className="flex items-center text-sm text-gray-600">
                        <MapPin className="w-4 h-4 mr-2 text-green-500 flex-shrink-0" />
                        <span className="font-medium">From:</span>
                        <span className="ml-1 truncate">{load.pickupLocation || 'N/A'}</span>
                      </div>
                      <div className="flex items-center text-sm text-gray-600">
                        <MapPin className="w-4 h-4 mr-2 text-red-500 flex-shrink-0" />
                        <span className="font-medium">To:</span>
                        <span className="ml-1 truncate">{load.deliveryLocation || 'N/A'}</span>
                      </div>
                    </div>

                    {/* Details */}
                    <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
                      <div className="flex items-center text-gray-600">
                        <Weight className="w-4 h-4 mr-2 flex-shrink-0" />
                        <span>{load.weight || 0} kg</span>
                      </div>
                      <div className="flex items-center text-green-600 font-medium">
                        <DollarSign className="w-4 h-4 mr-1 flex-shrink-0" />
                        <span>{formatCurrency(load.budget)}</span>
                      </div>
                    </div>

                    {/* Cargo and Vehicle Type */}
                    <div className="grid grid-cols-2 gap-4 mb-4 text-xs">
                      <div className="flex items-center text-gray-500">
                        <Package className="w-3 h-3 mr-1 flex-shrink-0" />
                        <span className="truncate">{getCargoTypeLabel(load.cargoType)}</span>
                      </div>
                      <div className="flex items-center text-gray-500">
                        <Truck className="w-3 h-3 mr-1 flex-shrink-0" />
                        <span className="truncate">{getVehicleTypeLabel(load.vehicleType)}</span>
                      </div>
                    </div>

                    {/* Posted info */}
                    <div className="text-xs text-gray-500 mb-4">
                      <div className="flex items-center justify-between">
                        <span>By {load.postedBy?.name || 'Anonymous'}</span>
                        <span>{formatDate(load.createdAt)}</span>
                      </div>
                      {load.bidCount > 0 && (
                        <div className="flex items-center mt-1">
                          <Eye className="w-3 h-3 mr-1" />
                          <span>{load.bidCount} bid{load.bidCount !== 1 ? 's' : ''}</span>
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex space-x-2">
                      <button 
                        onClick={() => handleViewDetails(load)}
                        className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors"
                      >
                        View Details
                      </button>
                      <button 
                        onClick={() => handleBidClick(load)}
                        className="flex-1 px-3 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                      >
                        {isUserAuthenticated ? 'Place Bid' : 'Login to Bid'}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center space-x-2">
                <button
                  onClick={() => fetchLoads(currentPage - 1)}
                  disabled={currentPage === 1 || loading}
                  className="px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                
                <span className="px-3 py-2 text-sm text-gray-700">
                  Page {currentPage} of {totalPages}
                </span>

                <button
                  onClick={() => fetchLoads(currentPage + 1)}
                  disabled={currentPage === totalPages || loading}
                  className="px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Login Prompt Modal */}
      {showLoginPrompt && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <div className="flex items-center mb-4">
              <User className="w-6 h-6 text-blue-600 mr-3" />
              <h3 className="text-lg font-semibold text-gray-900">Login Required</h3>
            </div>
            <p className="text-gray-600 mb-6">
              You need to be logged in as a driver to place bids on loads. Please login or create a driver account to continue.
            </p>
            <div className="flex space-x-3">
              <button
                onClick={() => setShowLoginPrompt(false)}
                className="flex-1 px-4 py-2 text-sm border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleLogin}
                className="flex-1 px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
              >
                Login / Register
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Load Details Modal */}
      {showLoadModal && selectedLoad && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Load Details</h3>
              <button
                onClick={() => setShowLoadModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <h4 className="font-semibold text-gray-900">{selectedLoad.title || 'Untitled Load'}</h4>
                <p className="text-gray-600 mt-1">{selectedLoad.description || 'No description available'}</p>
              </div>

              {/* Status and Priority Indicators */}
              <div className="flex flex-wrap gap-2">
                {selectedLoad.isUrgent && (
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-800">
                    <Clock className="w-4 h-4 mr-1" />
                    Urgent
                  </span>
                )}
                {selectedLoad.isPriorityListing && (
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-yellow-100 text-yellow-800">
                    <TrendingUp className="w-4 h-4 mr-1" />
                    Featured
                  </span>
                )}
                <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                  selectedLoad.status === 'posted' ? 'bg-green-100 text-green-800' :
                  selectedLoad.status === 'receiving_bids' ? 'bg-blue-100 text-blue-800' :
                  'bg-gray-100 text-gray-800'
                }`}>
                  {selectedLoad.status?.replace('_', ' ').toUpperCase() || 'UNKNOWN'}
                </span>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Pickup Location</label>
                  <p className="text-gray-900">{selectedLoad.pickupLocation || 'Not specified'}</p>
                  {selectedLoad.pickupAddress && (
                    <p className="text-sm text-gray-600 mt-1">{selectedLoad.pickupAddress}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Delivery Location</label>
                  <p className="text-gray-900">{selectedLoad.deliveryLocation || 'Not specified'}</p>
                  {selectedLoad.deliveryAddress && (
                    <p className="text-sm text-gray-600 mt-1">{selectedLoad.deliveryAddress}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Weight</label>
                  <p className="text-gray-900">{selectedLoad.weight || 0} kg</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Budget</label>
                  <p className="text-green-600 font-semibold">{formatCurrency(selectedLoad.budget)}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Cargo Type</label>
                  <p className="text-gray-900">{getCargoTypeLabel(selectedLoad.cargoType)}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Vehicle Type</label>
                  <p className="text-gray-900">{getVehicleTypeLabel(selectedLoad.vehicleType)}</p>
                </div>
              </div>

              {/* Date Information */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {selectedLoad.pickupDate && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Pickup Date</label>
                    <p className="text-gray-900">{formatDate(selectedLoad.pickupDate)}</p>
                    {selectedLoad.pickupTimeWindow && (
                      <p className="text-sm text-gray-600">Time: {selectedLoad.pickupTimeWindow}</p>
                    )}
                  </div>
                )}
                {selectedLoad.deliveryDate && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Delivery Date</label>
                    <p className="text-gray-900">{formatDate(selectedLoad.deliveryDate)}</p>
                    {selectedLoad.deliveryTimeWindow && (
                      <p className="text-sm text-gray-600">Time: {selectedLoad.deliveryTimeWindow}</p>
                    )}
                  </div>
                )}
              </div>

              {/* Distance */}
              {selectedLoad.distance && (
                <div>
                  <label className="block text-sm font-medium text-gray-700">Distance</label>
                  <p className="text-gray-900">{selectedLoad.distance} km</p>
                </div>
              )}

              {/* Special Requirements and Instructions */}
              {selectedLoad.specialRequirements && (
                <div>
                  <label className="block text-sm font-medium text-gray-700">Special Requirements</label>
                  <p className="text-gray-900">{selectedLoad.specialRequirements}</p>
                </div>
              )}

              {selectedLoad.specialInstructions && (
                <div>
                  <label className="block text-sm font-medium text-gray-700">Special Instructions</label>
                  <p className="text-gray-900">{selectedLoad.specialInstructions}</p>
                </div>
              )}

              {/* Payment and Insurance */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {selectedLoad.paymentTerms && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Payment Terms</label>
                    <p className="text-gray-900">{selectedLoad.paymentTerms.replace('_', ' ').toUpperCase()}</p>
                  </div>
                )}
                {selectedLoad.insuranceRequired && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Insurance</label>
                    <p className="text-gray-900">
                      Required
                      {selectedLoad.insuranceValue && ` - ${formatCurrency(selectedLoad.insuranceValue)}`}
                    </p>
                  </div>
                )}
              </div>

              {/* Posted By Information */}
              {selectedLoad.postedBy && (
                <div className="border-t pt-4">
                  <label className="block text-sm font-medium text-gray-700">Posted By</label>
                  <div className="flex items-center mt-1">
                    <div className="flex items-center">
                      <User className="w-4 h-4 mr-2 text-gray-400" />
                      <span className="text-gray-900">{selectedLoad.postedBy.name || 'Anonymous'}</span>
                      {selectedLoad.postedBy.isVerified && (
                        <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          Verified
                        </span>
                      )}
                    </div>
                  </div>
                  {selectedLoad.postedBy.location && (
                    <div className="flex items-center mt-1 text-sm text-gray-600">
                      <MapPin className="w-3 h-3 mr-1" />
                      <span>{selectedLoad.postedBy.location}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Bid Analytics */}
              {selectedLoad.bidAnalytics && selectedLoad.bidAnalytics.totalBids > 0 && (
                <div className="border-t pt-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Bidding Activity</label>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <p className="text-gray-600">Total Bids</p>
                      <p className="font-semibold text-gray-900">{selectedLoad.bidAnalytics.totalBids}</p>
                    </div>
                    {selectedLoad.bidAnalytics.avgBid && (
                      <div>
                        <p className="text-gray-600">Avg Bid</p>
                        <p className="font-semibold text-gray-900">{formatCurrency(selectedLoad.bidAnalytics.avgBid)}</p>
                      </div>
                    )}
                    {selectedLoad.bidAnalytics.minBid && (
                      <div>
                        <p className="text-gray-600">Lowest Bid</p>
                        <p className="font-semibold text-green-600">{formatCurrency(selectedLoad.bidAnalytics.minBid)}</p>
                      </div>
                    )}
                    {selectedLoad.bidAnalytics.maxBid && (
                      <div>
                        <p className="text-gray-600">Highest Bid</p>
                        <p className="font-semibold text-red-600">{formatCurrency(selectedLoad.bidAnalytics.maxBid)}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Contact Information (for authenticated users) */}
              {isUserAuthenticated && selectedLoad.contactPerson && (
                <div className="border-t pt-4">
                  <label className="block text-sm font-medium text-gray-700">Contact Person</label>
                  <p className="text-gray-900">{selectedLoad.contactPerson}</p>
                </div>
              )}
            </div>

            <div className="flex space-x-3 mt-6 pt-6 border-t">
              <button
                onClick={() => setShowLoadModal(false)}
                className="flex-1 px-4 py-2 text-sm border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Close
              </button>
              <button
                onClick={() => {
                  setShowLoadModal(false);
                  handleBidClick(selectedLoad);
                }}
                className="flex-1 px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
              >
                {isUserAuthenticated ? 'Place Bid' : 'Login to Bid'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LoadSearch;