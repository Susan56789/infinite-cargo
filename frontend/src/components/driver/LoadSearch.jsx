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
        return getAuthHeader(false);
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
      const params = new URLSearchParams();
      params.append('page', page.toString());
      params.append('limit', limit.toString());
      
      // Add search query
      if (searchQuery?.trim()) {
        params.append('search', searchQuery.trim());
      }
      
      // Add filters (only non-empty values)
      Object.entries(filters).forEach(([key, value]) => {
        if (value && value.trim() !== '') {
          params.append(key, value.toString());
        }
      });

      const url = `https://infinite-cargo-api.onrender.com/api/loads?${params.toString()}`;
      console.log('Fetching loads from:', url);

      // Make request without requiring authentication
      const headers = {
        'Content-Type': 'application/json',
        ...getAuthHeaders() // Include auth headers if available, but don't require them
      };

      const response = await fetch(url, { 
        method: 'GET',
        headers 
      });
      
      console.log('Response status:', response.status);

      if (response.ok) {
        const data = await response.json();
        console.log('Response data:', data);
        
        if (data.status === 'success' && data.data) {
          const loadsData = data.data.loads || [];
          console.log('Loads received:', loadsData.length);
          
          setLoads(loadsData);
          setCurrentPage(data.data.pagination?.currentPage || page);
          setTotalPages(data.data.pagination?.totalPages || 1);
          setTotalLoads(data.data.pagination?.totalLoads || 0);
          
        } else {
          const errorMsg = data.message || 'Failed to fetch loads';
          setError(errorMsg);
          console.error('API returned error:', data);
        }
      } else {
        let errorMessage = `Failed to load loads (${response.status})`;
        
        try {
          const errorData = await response.json();
          if (errorData.message) {
            errorMessage = errorData.message;
          }
        } catch (e) {
          // Use default error message
        }

        if (response.status === 500) {
          errorMessage = 'Server error. Please try again later.';
        } else if (response.status === 404) {
          errorMessage = 'Service not available. Please try again later.';
        }
        
        setError(errorMessage);
      }
    } catch (error) {
      console.error('Fetch error:', error);
      let errorMessage = 'Network error. Please check your connection and try again.';
      
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        errorMessage = 'Could not connect to server. Please try again later.';
      }
      
      setError(errorMessage);
    } finally {
      setLoading(false);
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
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      minimumFractionDigits: 0
    }).format(amount);
  };

  const formatDate = (dateString) => {
    return new Intl.DateTimeFormat('en-KE', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(new Date(dateString));
  };

  const getCargoTypeLabel = (type) => {
    return cargoTypes.find(t => t.value === type)?.label || type;
  };

  const getVehicleTypeLabel = (type) => {
    return vehicleTypes.find(t => t.value === type)?.label || type;
  };

  const handleRefresh = () => {
    checkAuthStatus();
    fetchLoads(currentPage);
  };

  const handleViewDetails = (load) => {
    setSelectedLoad(load);
    setShowLoadModal(true);
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

    // Proceed with bidding logic
    console.log('Opening bid modal for load:', load._id);
    // You can add your bid modal logic here
  };

  const handleLogin = () => {
    setShowLoginPrompt(false);
    // Redirect to login page or open login modal
    window.location.href = '/login';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading available loads...</p>
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
                      <span>Welcome, {user.name}</span>
                      <span className={`px-2 py-1 rounded text-xs ${
                        user.userType === 'driver' 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-blue-100 text-blue-800'
                      }`}>
                        {user.userType}
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
                >
                  <RefreshCw size={16} className="mr-2" />
                  Refresh
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Error State */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <div className="flex items-center">
              <AlertCircle className="h-5 w-5 text-red-400 mr-3" />
              <div className="flex-1">
                <p className="text-sm text-red-800 font-medium">Error:</p>
                <p className="text-sm text-red-700 mt-1">{error}</p>
              </div>
              <button
                onClick={() => setError('')}
                className="text-red-400 hover:text-red-600"
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
              />
            </div>
            <button
              onClick={() => fetchLoads(1)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Search
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
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm"
            >
              Apply Filters
            </button>
          </div>
        </div>

        {/* Results */}
        {loads.length === 0 && !loading ? (
          <div className="text-center py-12">
            <Package className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No loads found</h3>
            <p className="text-gray-600">Try adjusting your search criteria or check back later for new loads</p>
            <button
              onClick={() => fetchLoads(1)}
              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Reload
            </button>
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
                      <h3 className="text-lg font-semibold text-gray-900 line-clamp-2">{load.title}</h3>
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
                    
                    <p className="text-gray-600 text-sm mb-4 line-clamp-3">{load.description}</p>

                    {/* Route */}
                    <div className="space-y-2 mb-4">
                      <div className="flex items-center text-sm text-gray-600">
                        <MapPin className="w-4 h-4 mr-2 text-green-500 flex-shrink-0" />
                        <span className="font-medium">From:</span>
                        <span className="ml-1 truncate">{load.pickupLocation}</span>
                      </div>
                      <div className="flex items-center text-sm text-gray-600">
                        <MapPin className="w-4 h-4 mr-2 text-red-500 flex-shrink-0" />
                        <span className="font-medium">To:</span>
                        <span className="ml-1 truncate">{load.deliveryLocation}</span>
                      </div>
                    </div>

                    {/* Details */}
                    <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
                      <div className="flex items-center text-gray-600">
                        <Weight className="w-4 h-4 mr-2 flex-shrink-0" />
                        <span>{load.weight} kg</span>
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
                        <span>By {load.postedBy?.name || 'User'}</span>
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
                  disabled={currentPage === 1}
                  className="px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                
                <span className="px-3 py-2 text-sm text-gray-700">
                  Page {currentPage} of {totalPages}
                </span>

                <button
                  onClick={() => fetchLoads(currentPage + 1)}
                  disabled={currentPage === totalPages}
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
                <h4 className="font-semibold text-gray-900">{selectedLoad.title}</h4>
                <p className="text-gray-600 mt-1">{selectedLoad.description}</p>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Pickup Location</label>
                  <p className="text-gray-900">{selectedLoad.pickupLocation}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Delivery Location</label>
                  <p className="text-gray-900">{selectedLoad.deliveryLocation}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Weight</label>
                  <p className="text-gray-900">{selectedLoad.weight} kg</p>
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

              {selectedLoad.pickupDate && (
                <div>
                  <label className="block text-sm font-medium text-gray-700">Pickup Date</label>
                  <p className="text-gray-900">{formatDate(selectedLoad.pickupDate)}</p>
                </div>
              )}

              {selectedLoad.specialInstructions && (
                <div>
                  <label className="block text-sm font-medium text-gray-700">Special Instructions</label>
                  <p className="text-gray-900">{selectedLoad.specialInstructions}</p>
                </div>
              )}
            </div>

            <div className="flex space-x-3 mt-6">
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