import React, { useState, useEffect, useCallback } from 'react';
import { 
  Search, RefreshCw, Package, Plus, Eye, Edit, Ban, 
  MapPin, ArrowRight, ChevronLeft, Calendar, Clock, 
  Zap, Loader2, Filter, SortAsc, SortDesc, Truck,
  AlertCircle, CheckCircle, XCircle
} from 'lucide-react';

import { getAuthHeader, authManager } from '../../utils/auth';
import LoadFormModal from './LoadFormModal'; 

const LoadsTab = () => {
  // State management
  const [filters, setFilters] = useState({
    search: '',
    status: '',
    minBudget: '',
    maxBudget: '',
    pickupDate: '',
    deliveryDate: '',
    urgent: false
  });
  
  const [sortConfig, setSortConfig] = useState({
    key: 'createdAt',
    direction: 'desc'
  });
  
  const [loading, setLoading] = useState(true);
  const [showLoadForm, setShowLoadForm] = useState(false);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [error, setError] = useState('');
  const [selectedLoads, setSelectedLoads] = useState(new Set());
  const [loads, setLoads] = useState([]);
  const [editingLoad, setEditingLoad] = useState(null);
  const [user, setUser] = useState(null); 
  const [loadForm, setLoadForm] = useState({
    title: '',
    description: '',
    pickupLocation: '',
    deliveryLocation: '',
    pickupAddress: '',
    deliveryAddress: '',
    weight: '',
    cargoType: 'other',
    vehicleType: 'small_truck',
    vehicleCapacityRequired: '',
    budget: '',
    pickupDate: '',
    deliveryDate: '',
    specialInstructions: '',
    isUrgent: false
  });
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0
  });

  // API Configuration
  const API_BASE_URL = 'https://infinite-cargo-api.onrender.com/api';
  
  const getAuthHeaders = () => {
    const authHeader = getAuthHeader();
    return {
      ...authHeader,
      'Content-Type': 'application/json'
    };
  };

  // Load form reset function
  const resetForm = () => {
    setLoadForm({
      title: '',
      description: '',
      pickupLocation: '',
      deliveryLocation: '',
      pickupAddress: '',
      deliveryAddress: '',
      weight: '',
      cargoType: 'other',
      vehicleType: 'small_truck',
      vehicleCapacityRequired: '',
      budget: '',
      pickupDate: '',
      deliveryDate: '',
      specialInstructions: '',
      isUrgent: false
    });
  };

  // Fetch user profile
  const fetchUserProfile = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/user/profile`, {
        method: 'GET',
        headers: getAuthHeaders()
      });

      if (response.ok) {
        const data = await response.json();
        if (data.status === 'success') {
          setUser(data.data.user);
        }
      }
    } catch (err) {
      console.error('Error fetching user profile:', err);
    }
  }, [API_BASE_URL]);

  // Enhanced API Functions with better error handling
  const fetchLoads = useCallback(async (page = 1, customFilters = null) => {
    try {
      setLoading(true);
      setError('');
      
      const currentFilters = customFilters || filters;
      
      // Build query parameters
      const queryParams = new URLSearchParams({
        page: page.toString(),
        limit: pagination.limit.toString(),
        sortBy: sortConfig.key,
        sortOrder: sortConfig.direction
      });

      // Add filters only if they have values
      if (currentFilters.search && currentFilters.search.trim()) {
        queryParams.append('search', currentFilters.search.trim());
      }
      if (currentFilters.status) {
        queryParams.append('status', currentFilters.status);
      }
      if (currentFilters.minBudget) {
        queryParams.append('minBudget', currentFilters.minBudget);
      }
      if (currentFilters.maxBudget) {
        queryParams.append('maxBudget', currentFilters.maxBudget);
      }
      if (currentFilters.pickupDate) {
        queryParams.append('pickupDate', currentFilters.pickupDate);
      }
      if (currentFilters.deliveryDate) {
        queryParams.append('deliveryDate', currentFilters.deliveryDate);
      }
      if (currentFilters.urgent) {
        queryParams.append('urgentOnly', 'true');
      }

      const endpoint = `${API_BASE_URL}/loads/user/my-loads?${queryParams}`;
      const headers = getAuthHeaders();

      const response = await fetch(endpoint, {
        method: 'GET',
        headers
      });

      if (!response.ok) {
        let errorMessage = `HTTP ${response.status}`;
        
        try {
          const errorData = await response.json();
          errorMessage = errorData.message || errorMessage;
          console.error('API Error Data:', errorData);
        } catch (parseError) {
          const errorText = await response.text();
          errorMessage = errorText || errorMessage;
          console.error('API Error Text:', errorText);
        }

        // Handle specific error cases
        if (response.status === 401) {
          setError('Authentication failed. Please log in again.');
          authManager.logout();
          return;
        } else if (response.status === 403) {
          setError('Access denied. Make sure you are logged in as a cargo owner.');
          return;
        } else if (response.status === 500) {
          setError('Server error occurred. Please try again in a few moments.');
          return;
        }

        throw new Error(errorMessage);
      }

      const data = await response.json();
      
      if (data.status === 'success') {
        const loadsData = data.data.loads || [];
        setLoads(loadsData);
        
        if (data.data.pagination) {
          setPagination({
            page: data.data.pagination.currentPage,
            limit: data.data.pagination.limit || pagination.limit,
            total: data.data.pagination.totalLoads,
            totalPages: data.data.pagination.totalPages
          });
        }
      } else {
        throw new Error(data.message || 'Failed to fetch loads');
      }
    } catch (err) {
      console.error('Error fetching loads:', err);
      
      // Set user-friendly error messages
      if (err.message.includes('fetch')) {
        setError('Network error. Please check your connection and try again.');
      } else if (err.message.includes('Authentication')) {
        setError('Please log in to view your loads.');
      } else {
        setError(err.message || 'Failed to load data. Please try again.');
      }
      
      setLoads([]);
    } finally {
      setLoading(false);
    }
  }, [filters, sortConfig, pagination.limit, API_BASE_URL]);

  // Create or update load
  const submitLoad = async (e, formDataWithOwner) => {
    e.preventDefault();
    
    try {
      setLoading(true);
      setError('');

      // Validation
      if (!formDataWithOwner.title?.trim()) {
        throw new Error('Load title is required');
      }
      if (!formDataWithOwner.pickupLocation?.trim()) {
        throw new Error('Pickup location is required');
      }
      if (!formDataWithOwner.deliveryLocation?.trim()) {
        throw new Error('Delivery location is required');
      }
      if (!formDataWithOwner.weight || parseFloat(formDataWithOwner.weight) <= 0) {
        throw new Error('Valid weight is required');
      }
      if (!formDataWithOwner.budget || parseFloat(formDataWithOwner.budget) < 100) {
        throw new Error('Budget must be at least KES 100');
      }

      const method = editingLoad ? 'PUT' : 'POST';
      const endpoint = editingLoad 
        ? `${API_BASE_URL}/loads/${editingLoad}`
        : `${API_BASE_URL}/loads`;

      const response = await fetch(endpoint, {
        method,
        headers: getAuthHeaders(),
        body: JSON.stringify(formDataWithOwner)
      });

      if (!response.ok) {
        let errorMessage = 'Failed to save load';
        try {
          const errorData = await response.json();
          errorMessage = errorData.message || errorMessage;
        } catch (parseError) {
          const errorText = await response.text();
          errorMessage = errorText || errorMessage;
        }
        throw new Error(errorMessage);
      }

      const data = await response.json();
      
      if (data.status === 'success') {
        setShowLoadForm(false);
        resetForm();
        setEditingLoad(null);
        // Refresh the loads list
        fetchLoads(pagination.page);
      } else {
        throw new Error(data.message || 'Failed to save load');
      }

    } catch (err) {
      console.error('Error submitting load:', err);
      setError(err.message || 'Failed to save load');
    } finally {
      setLoading(false);
    }
  };

  const updateLoadStatus = async (loadId, newStatus) => {
    try {
      setLoading(true);
      setError('');

      const headers = getAuthHeaders();

      const response = await fetch(`${API_BASE_URL}/loads/${loadId}/status`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ status: newStatus })
      });

      if (!response.ok) {
        // Handle authentication errors
        if (response.status === 401 || response.status === 403) {
          setError('Session expired or not authorized. Please log in again.');
          authManager.logout();
          return;
        }

        let errorMessage = 'Failed to update load status';
        try {
          const errorData = await response.json();
          errorMessage = errorData.message || errorMessage;
        } catch (parseError) {
          const errorText = await response.text();
          errorMessage = errorText || errorMessage;
        }

        throw new Error(errorMessage);
      }

      const data = await response.json();

      if (data.status === 'success') {
        // Update the load in the local state
        setLoads(prevLoads => 
          prevLoads.map(load =>
            load._id === loadId ? { ...load, status: newStatus } : load
          )
        );
      } else {
        throw new Error(data.message || 'Failed to update load status');
      }

    } catch (err) {
      console.error('Error updating load status:', err);
      setError(err.message || 'Failed to update load status');
    } finally {
      setLoading(false);
    }
  };

  const deleteLoad = async (loadId) => {
    try {
      setError('');
      
      const response = await fetch(`${API_BASE_URL}/loads/${loadId}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });

      if (!response.ok) {
        let errorMessage = 'Failed to delete load';
        try {
          const errorData = await response.json();
          errorMessage = errorData.message || errorMessage;
        } catch (parseError) {
          const errorText = await response.text();
          errorMessage = errorText || errorMessage;
        }
        throw new Error(errorMessage);
      }

      const data = await response.json();
      
      if (data.status === 'success') {
        setLoads(loads.filter(load => load._id !== loadId));
        setSelectedLoads(prev => {
          const newSet = new Set(prev);
          newSet.delete(loadId);
          return newSet;
        });
      } else {
        throw new Error(data.message || 'Failed to delete load');
      }
    } catch (err) {
      console.error('Error deleting load:', err);
      setError(err.message || 'Failed to delete load');
    }
  };

  // Test API connection on component mount
  useEffect(() => {
    const testConnection = async () => {
      try {
        const headers = getAuthHeaders();
        
        // First test if we can reach the API at all
        const testResponse = await fetch(`${API_BASE_URL}/loads/subscription-status`, {
          method: 'GET',
          headers
        });
        
        if (testResponse.status === 401) {
          setError('Authentication required. Please log in.');
          return;
        }
        
        if (testResponse.status === 403) {
          setError('Access denied. Please ensure you are logged in as a cargo owner.');
          return;
        }
        
        // If connection test passes, fetch loads and user profile
        fetchLoads();
        fetchUserProfile();
        
      } catch (connectionError) {
        console.error('Connection test failed:', connectionError);
        setError('Unable to connect to server. Please check your internet connection.');
        setLoading(false);
      }
    };

    testConnection();
  }, [fetchLoads, fetchUserProfile]);

  // Refetch when filters or sort changes with debounce
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (!loading) { // Don't trigger if already loading
        fetchLoads(1);
      }
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [filters, sortConfig, fetchLoads, loading]);

  // Utility functions
  const getStatusColor = (status) => {
    const colors = {
      posted: 'bg-blue-100 text-blue-800',
      receiving_bids: 'bg-yellow-100 text-yellow-800',
      driver_assigned: 'bg-purple-100 text-purple-800',
      assigned: 'bg-purple-100 text-purple-800',
      in_transit: 'bg-orange-100 text-orange-800',
      delivered: 'bg-green-100 text-green-800',
      not_available: 'bg-gray-100 text-gray-800',
      cancelled: 'bg-red-100 text-red-800'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const getStatusIcon = (status) => {
    const icons = {
      posted: <Package className="h-3 w-3" />,
      receiving_bids: <Clock className="h-3 w-3" />,
      driver_assigned: <Truck className="h-3 w-3" />,
      assigned: <Truck className="h-3 w-3" />,
      in_transit: <ArrowRight className="h-3 w-3" />,
      delivered: <CheckCircle className="h-3 w-3" />,
      not_available: <XCircle className="h-3 w-3" />,
      cancelled: <Ban className="h-3 w-3" />
    };
    return icons[status] || <Package className="h-3 w-3" />;
  };

  const formatCurrency = (amount) => {
    if (!amount) return 'KES 0';
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      minimumFractionDigits: 0
    }).format(amount);
  };

  const formatDate = (date) => {
    if (!date) return 'N/A';
    try {
      return new Date(date).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (err) {
      return 'Invalid Date';
    }
  };

  // Event handlers
  const handleSort = (key) => {
    setSortConfig({
      key,
      direction: sortConfig.key === key && sortConfig.direction === 'asc' ? 'desc' : 'asc'
    });
  };

  const handlePostLoadClick = async () => {
    setEditingLoad(null);
    resetForm();
    setShowLoadForm(true);
  };

  const handleEditLoad = (load) => {
    setEditingLoad(load._id);
    setLoadForm({
      title: load.title || '',
      description: load.description || '',
      pickupLocation: load.pickupLocation?.address || load.pickupAddress || load.pickupLocation || '',
      deliveryLocation: load.deliveryLocation?.address || load.deliveryAddress || load.deliveryLocation || '',
      pickupAddress: load.pickupAddress || '',
      deliveryAddress: load.deliveryAddress || '',
      weight: load.weight?.toString() || '',
      cargoType: load.cargoType || 'other',
      vehicleType: load.vehicleType || 'small_truck',
      vehicleCapacityRequired: load.vehicleCapacityRequired?.toString() || '',
      budget: load.budget?.toString() || '',
      pickupDate: load.pickupDate ? new Date(load.pickupDate).toISOString().slice(0, 16) : '',
      deliveryDate: load.deliveryDate ? new Date(load.deliveryDate).toISOString().slice(0, 16) : '',
      specialInstructions: load.specialInstructions || '',
      isUrgent: load.isUrgent || load.urgent || false
    });
    setShowLoadForm(true);
  };

  const onRefresh = () => {
    fetchLoads(pagination.page);
  };

  const handleBulkAction = async (action) => {
    if (selectedLoads.size === 0) {
      setError('Please select at least one load.');
      return;
    }

    try {
      setLoading(true);
      setError('');
      const loadIds = Array.from(selectedLoads);

      if (action === 'export') {
        const response = await fetch(`${API_BASE_URL}/loads/export`, {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify({ loadIds })
        });

        if (response.ok) {
          const blob = await response.blob();
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `loads_${new Date().toISOString().split('T')[0]}.xlsx`;
          document.body.appendChild(a);
          a.click();
          window.URL.revokeObjectURL(url);
          document.body.removeChild(a);
        } else {
          throw new Error('Export failed');
        }
      } else if (action === 'archive') {
        const response = await fetch(`${API_BASE_URL}/loads/bulk-archive`, {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify({ loadIds })
        });

        if (response.ok) {
          setLoads(loads.filter(load => !selectedLoads.has(load._id)));
        } else {
          throw new Error('Archive failed');
        }
      }
      
      setSelectedLoads(new Set());
    } catch (error) {
      setError(`Failed to ${action} selected loads. Please try again.`);
    } finally {
      setLoading(false);
    }
  };

  const toggleLoadSelection = (loadId) => {
    const newSelected = new Set(selectedLoads);
    if (newSelected.has(loadId)) {
      newSelected.delete(loadId);
    } else {
      newSelected.add(loadId);
    }
    setSelectedLoads(newSelected);
  };

  const selectAllLoads = () => {
    if (selectedLoads.size === loads.length) {
      setSelectedLoads(new Set());
    } else {
      setSelectedLoads(new Set(loads.map(load => load._id)));
    }
  };

  const handlePageChange = (newPage) => {
    fetchLoads(newPage);
  };

  const handleViewDetails = (loadId) => {
    console.log('Navigate to load details:', loadId);
    // TODO: Implement navigation to load details
  };

  const handleUpdateLoadStatus = async (loadId, newStatus) => {
    if (window.confirm(`Are you sure you want to change the status to "${newStatus.replace('_', ' ')}"?`)) {
      await updateLoadStatus(loadId, newStatus);
    }
  };

  const handleDeleteLoad = async (loadId) => {
    if (window.confirm('Are you sure you want to delete this load? This action cannot be undone.')) {
      await deleteLoad(loadId);
    }
  };

  const handleCloseModal = () => {
    setShowLoadForm(false);
    setEditingLoad(null);
    resetForm();
  };

  return (
    <div className="space-y-6">
      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center">
            <AlertCircle className="h-5 w-5 text-red-600 mr-2" />
            <span className="text-red-800">{error}</span>
            <button
              onClick={() => setError('')}
              className="ml-auto text-red-600 hover:text-red-800"
            >
              <XCircle className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Header Actions */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">My Loads</h2>
          <p className="text-gray-600">Manage and track your freight loads</p>
        </div>
        <button
          onClick={handlePostLoadClick}
          className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Post New Load
        </button>
      </div>

      {/* Filters */}
      <div className="space-y-4">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
              <input
                type="text"
                placeholder="Search loads by title, pickup, or delivery location..."
                value={filters.search}
                onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
          
          <select
            value={filters.status}
            onChange={(e) => setFilters({ ...filters, status: e.target.value })}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">All Status</option>
            <option value="posted">Posted</option>
            <option value="receiving_bids">Receiving Bids</option>
            <option value="driver_assigned">Driver Assigned</option>
            <option value="assigned">Assigned</option>
            <option value="in_transit">In Transit</option>
            <option value="delivered">Delivered</option>
            <option value="not_available">Not Available</option>
            <option value="cancelled">Cancelled</option>
          </select>

          <button
            onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg flex items-center gap-2 transition-colors"
          >
            <Filter className="h-4 w-4" />
            Filters
          </button>

          <button
            onClick={onRefresh}
            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg flex items-center gap-2 transition-colors"
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {/* Advanced Filters */}
        {showAdvancedFilters && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-gray-50 rounded-lg">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Min Budget</label>
              <input
                type="number"
                value={filters.minBudget}
                onChange={(e) => setFilters({ ...filters, minBudget: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="0"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Max Budget</label>
              <input
                type="number"
                value={filters.maxBudget}
                onChange={(e) => setFilters({ ...filters, maxBudget: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="999999"
              />
            </div>
            <div className="flex items-center">
              <input
                type="checkbox"
                id="urgent"
                checked={filters.urgent}
                onChange={(e) => setFilters({ ...filters, urgent: e.target.checked })}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor="urgent" className="ml-2 text-sm font-medium text-gray-700">
                Urgent loads only
              </label>
            </div>
          </div>
        )}
      </div>

      {/* Bulk Actions */}
      {selectedLoads.size > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <span className="text-blue-700 font-medium">
              {selectedLoads.size} load{selectedLoads.size !== 1 ? 's' : ''} selected
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => handleBulkAction('export')}
                className="px-3 py-1 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
              >
                Export
              </button>
              <button
                onClick={() => handleBulkAction('archive')}
                className="px-3 py-1 bg-gray-600 text-white text-sm rounded-lg hover:bg-gray-700 transition-colors"
              >
                Archive
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sort Controls */}
      <div className="flex items-center gap-4 text-sm">
        <span className="text-gray-700 font-medium">Sort by:</span>
        <button
          onClick={() => handleSort('createdAt')}
          className="flex items-center gap-1 text-blue-600 hover:text-blue-700"
        >
          Date Created
          {sortConfig.key === 'createdAt' && (
            sortConfig.direction === 'asc' ? <SortAsc className="h-3 w-3" /> : <SortDesc className="h-3 w-3" />
          )}
        </button>
        <button
          onClick={() => handleSort('budget')}
          className="flex items-center gap-1 text-blue-600 hover:text-blue-700"
        >
          Budget
          {sortConfig.key === 'budget' && (
            sortConfig.direction === 'asc' ? <SortAsc className="h-3 w-3" /> : <SortDesc className="h-3 w-3" />
          )}
        </button>
        <button
          onClick={() => handleSort('pickupDate')}
          className="flex items-center gap-1 text-blue-600 hover:text-blue-700"
        >
          Pickup Date
          {sortConfig.key === 'pickupDate' && (
            sortConfig.direction === 'asc' ? <SortAsc className="h-3 w-3" /> : <SortDesc className="h-3 w-3" />
          )}
        </button>
      </div>

      {/* Results Summary */}
      <div className="flex items-center justify-between">
        <p className="text-gray-600">
          Showing {loads.length > 0 ? ((pagination.page - 1) * pagination.limit) + 1 : 0} to {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} loads
        </p>
        {loads.length > 0 && (
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={selectedLoads.size === loads.length && loads.length > 0}
              onChange={selectAllLoads}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <label className="text-sm text-gray-700">Select all</label>
          </div>
        )}
      </div>

      {/* Loads Table/Grid */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            <span className="ml-2 text-gray-600">Loading loads...</span>
          </div>
        ) : loads.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12">
            <Package className="h-16 w-16 text-gray-300 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No loads found</h3>
            <p className="text-gray-500 mb-6">
              {filters.search || filters.status || filters.minBudget || filters.maxBudget || filters.urgent
                ? 'No loads match your current filters. Try adjusting your search criteria.'
                : 'You haven\'t posted any loads yet. Create your first load to get started.'
              }
            </p>
            <button
              onClick={handlePostLoadClick}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors"
            >
              <Plus className="h-4 w-4" />
              Post Your First Load
            </button>
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left">
                      <input
                        type="checkbox"
                        checked={selectedLoads.size === loads.length && loads.length > 0}
                        onChange={selectAllLoads}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Load Details
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Route
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Budget
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Dates
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {loads.map((load) => (
                    <tr key={load._id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <input
                          type="checkbox"
                          checked={selectedLoads.has(load._id)}
                          onChange={() => toggleLoadSelection(load._id)}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-start space-x-3">
                          <div className="flex-shrink-0">
                            {load.isUrgent || load.urgent ? (
                              <div className="relative">
                                <Package className="h-6 w-6 text-gray-400" />
                                <Zap className="h-3 w-3 text-red-500 absolute -top-1 -right-1" />
                              </div>
                            ) : (
                              <Package className="h-6 w-6 text-gray-400" />
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-gray-900 truncate">
                              {load.title}
                            </p>
                            {load.description && (
                              <p className="text-sm text-gray-500 truncate">
                                {load.description}
                              </p>
                            )}
                            <div className="flex items-center mt-1 text-xs text-gray-500">
                              <span>{load.weight} kg</span>
                              <span className="mx-1">•</span>
                              <span className="capitalize">{load.cargoType?.replace('_', ' ')}</span>
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm">
                          <div className="flex items-center text-gray-900 mb-1">
                            <MapPin className="h-3 w-3 text-green-500 mr-1" />
                            <span className="truncate max-w-32">
                              {load.pickupLocation?.address || load.pickupAddress || load.pickupLocation}
                            </span>
                          </div>
                          <div className="flex items-center text-gray-500">
                            <ArrowRight className="h-3 w-3 mr-1" />
                            <span className="truncate max-w-32">
                              {load.deliveryLocation?.address || load.deliveryAddress || load.deliveryLocation}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm font-medium text-gray-900">
                          {formatCurrency(load.budget)}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(load.status)}`}>
                          {getStatusIcon(load.status)}
                          {load.status?.replace('_', ' ').toUpperCase()}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        <div className="space-y-1">
                          <div className="flex items-center">
                            <Calendar className="h-3 w-3 mr-1" />
                            <span>Pickup: {formatDate(load.pickupDate)}</span>
                          </div>
                          <div className="flex items-center">
                            <Clock className="h-3 w-3 mr-1" />
                            <span>Delivery: {formatDate(load.deliveryDate)}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => handleViewDetails(load._id)}
                            className="text-blue-600 hover:text-blue-700 p-1"
                            title="View Details"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleEditLoad(load)}
                            className="text-gray-600 hover:text-gray-700 p-1"
                            title="Edit Load"
                          >
                            <Edit className="h-4 w-4" />
                          </button>
                          {load.status === 'posted' && (
                            <button
                              onClick={() => handleDeleteLoad(load._id)}
                              className="text-red-600 hover:text-red-700 p-1"
                              title="Delete Load"
                            >
                              <XCircle className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Card View */}
            <div className="lg:hidden space-y-4 p-4">
              {loads.map((load) => (
                <div key={load._id} className="border border-gray-200 rounded-lg p-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-3 flex-1">
                      <input
                        type="checkbox"
                        checked={selectedLoads.has(load._id)}
                        onChange={() => toggleLoadSelection(load._id)}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded mt-1"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2">
                          {load.isUrgent || load.urgent ? (
                            <div className="relative">
                              <Package className="h-5 w-5 text-gray-400" />
                              <Zap className="h-3 w-3 text-red-500 absolute -top-1 -right-1" />
                            </div>
                          ) : (
                            <Package className="h-5 w-5 text-gray-400" />
                          )}
                          <h3 className="text-sm font-medium text-gray-900 truncate">
                            {load.title}
                          </h3>
                        </div>
                        {load.description && (
                          <p className="text-sm text-gray-500 mt-1 truncate">
                            {load.description}
                          </p>
                        )}
                      </div>
                    </div>
                    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(load.status)}`}>
                      {getStatusIcon(load.status)}
                      {load.status?.replace('_', ' ').toUpperCase()}
                    </span>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center text-sm">
                      <MapPin className="h-4 w-4 text-green-500 mr-2" />
                      <span className="text-gray-600 mr-2">From:</span>
                      <span className="text-gray-900 truncate">
                        {load.pickupLocation?.address || load.pickupAddress || load.pickupLocation}
                      </span>
                    </div>
                    <div className="flex items-center text-sm">
                      <ArrowRight className="h-4 w-4 text-blue-500 mr-2" />
                      <span className="text-gray-600 mr-2">To:</span>
                      <span className="text-gray-900 truncate">
                        {load.deliveryLocation?.address || load.deliveryAddress || load.deliveryLocation}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-500">Weight:</span>
                      <span className="ml-1 text-gray-900">{load.weight} kg</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Budget:</span>
                      <span className="ml-1 text-gray-900 font-medium">{formatCurrency(load.budget)}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-2 text-sm">
                    <div className="flex items-center">
                      <Calendar className="h-3 w-3 text-gray-400 mr-1" />
                      <span className="text-gray-500">Pickup:</span>
                      <span className="ml-1 text-gray-900">{formatDate(load.pickupDate)}</span>
                    </div>
                    <div className="flex items-center">
                      <Clock className="h-3 w-3 text-gray-400 mr-1" />
                      <span className="text-gray-500">Delivery:</span>
                      <span className="ml-1 text-gray-900">{formatDate(load.deliveryDate)}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                    <div className="flex items-center space-x-3">
                      <button
                        onClick={() => handleViewDetails(load._id)}
                        className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                      >
                        View Details
                      </button>
                      <button
                        onClick={() => handleEditLoad(load)}
                        className="text-gray-600 hover:text-gray-700 text-sm font-medium"
                      >
                        Edit
                      </button>
                    </div>
                    {load.status === 'posted' && (
                      <button
                        onClick={() => handleDeleteLoad(load._id)}
                        className="text-red-600 hover:text-red-700 text-sm font-medium"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <button
              onClick={() => handlePageChange(pagination.page - 1)}
              disabled={pagination.page === 1}
              className="px-3 py-2 text-sm bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </button>
            
            <div className="flex items-center space-x-1">
              {[...Array(Math.min(5, pagination.totalPages))].map((_, index) => {
                const pageNumber = Math.max(1, pagination.page - 2) + index;
                if (pageNumber > pagination.totalPages) return null;
                
                return (
                  <button
                    key={pageNumber}
                    onClick={() => handlePageChange(pageNumber)}
                    className={`px-3 py-2 text-sm rounded-lg ${
                      pageNumber === pagination.page
                        ? 'bg-blue-600 text-white'
                        : 'bg-white border border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    {pageNumber}
                  </button>
                );
              })}
            </div>

            <button
              onClick={() => handlePageChange(pagination.page + 1)}
              disabled={pagination.page === pagination.totalPages}
              className="px-3 py-2 text-sm bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
            >
              Next
              <ChevronLeft className="h-4 w-4 rotate-180" />
            </button>
          </div>

          <div className="text-sm text-gray-500">
            Page {pagination.page} of {pagination.totalPages}
          </div>
        </div>
      )}

      {/* Load Form Modal */}
      <LoadFormModal
        isOpen={showLoadForm}
        onClose={handleCloseModal}
        onSubmit={submitLoad}
        formData={loadForm}
        setFormData={setLoadForm}
        editingLoad={editingLoad}
        loading={loading}
        error={error}
        user={user}
      />
    </div>
  );
};

export default LoadsTab;