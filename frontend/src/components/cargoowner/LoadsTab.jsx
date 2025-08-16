import React, { useState,useEffect, useCallback } from 'react';
import { 
  Search, RefreshCw, Package, Plus, Eye, Edit, Ban, 
  MapPin, ArrowRight, DollarSign, Calendar, Clock, 
  Zap, Loader2, Filter, SortAsc, SortDesc, Truck,
  AlertCircle, CheckCircle, XCircle} from 'lucide-react';

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
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [error, setError] = useState('');
  const [selectedLoads, setSelectedLoads] = useState(new Set());
  const [loads, setLoads] = useState([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0
  });

  // API Configuration
  const API_BASE_URL = 'https://infinite-cargo-api.onrender.com/api';
  const getAuthHeaders = () => ({
    'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
    'Content-Type': 'application/json'
  });

  // API Functions
  const fetchLoads = useCallback(async (page = 1, customFilters = null) => {
    try {
      setLoading(true);
      setError('');
      
      const currentFilters = customFilters || filters;
      const queryParams = new URLSearchParams({
        page: page.toString(),
        limit: pagination.limit.toString(),
        sort: `${sortConfig.key}:${sortConfig.direction}`,
        ...(currentFilters.search && { search: currentFilters.search }),
        ...(currentFilters.status && { status: currentFilters.status }),
        ...(currentFilters.minBudget && { minBudget: currentFilters.minBudget }),
        ...(currentFilters.maxBudget && { maxBudget: currentFilters.maxBudget }),
        ...(currentFilters.pickupDate && { pickupDate: currentFilters.pickupDate }),
        ...(currentFilters.deliveryDate && { deliveryDate: currentFilters.deliveryDate }),
        ...(currentFilters.urgent && { urgent: 'true' })
      });

      const response = await fetch(`${API_BASE_URL}/loads?${queryParams}`, {
        method: 'GET',
        headers: getAuthHeaders()
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.success) {
        setLoads(data.data.loads);
        setPagination({
          page: data.data.pagination.page,
          limit: data.data.pagination.limit,
          total: data.data.pagination.total,
          totalPages: data.data.pagination.totalPages
        });
      } else {
        throw new Error(data.message || 'Failed to fetch loads');
      }
    } catch (err) {
      console.error('Error fetching loads:', err);
      setError(err.message || 'Failed to load data. Please try again.');
      setLoads([]);
    } finally {
      setLoading(false);
    }
  }, [filters, sortConfig, pagination.limit, API_BASE_URL]);

  const updateLoadStatus = async (loadId, newStatus) => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/api/loads/${loadId}/status`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify({ status: newStatus })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.success) {
        // Update local state
        setLoads(loads.map(load => 
          load._id === loadId ? { ...load, status: newStatus } : load
        ));
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
      const response = await fetch(`${API_BASE_URL}/api/loads/${loadId}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.success) {
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

  const checkUserLimits = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/users/limits`, {
        method: 'GET',
        headers: getAuthHeaders()
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data.data;
    } catch (err) {
      console.error('Error checking user limits:', err);
      return { canPostLoads: true, remainingLoads: 0 };
    }
  };

  // Initial data fetch
  useEffect(() => {
    fetchLoads();
  }, []);

  // Refetch when filters or sort changes
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      fetchLoads(1);
    }, 500); // Debounce search

    return () => clearTimeout(timeoutId);
  }, [filters, sortConfig]);

  // Utility functions
  const getStatusColor = (status) => {
    const colors = {
      posted: 'bg-blue-100 text-blue-800',
      receiving_bids: 'bg-yellow-100 text-yellow-800',
      driver_assigned: 'bg-purple-100 text-purple-800',
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
      in_transit: <ArrowRight className="h-3 w-3" />,
      delivered: <CheckCircle className="h-3 w-3" />,
      not_available: <XCircle className="h-3 w-3" />,
      cancelled: <Ban className="h-3 w-3" />
    };
    return icons[status] || <Package className="h-3 w-3" />;
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'KES',
      minimumFractionDigits: 0
    }).format(amount);
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const canPostLoads = async () => {
    try {
      const limits = await checkUserLimits();
      return limits.canPostLoads;
    } catch (error) {
      console.error('Error checking limits:', error);
      return false;
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
    try {
      const canPost = await canPostLoads();
      if (!canPost) {
        setError('You have reached your monthly load limit. Please upgrade your plan.');
        return;
      }
      // Navigate to post load form or open modal
      window.location.href = '/dashboard/post-load';
    } catch (error) {
      setError('Unable to verify posting limits. Please try again.');
    }
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
      const loadIds = Array.from(selectedLoads);

      if (action === 'export') {
        const response = await fetch(`${API_BASE_URL}/api/loads/export`, {
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
        const response = await fetch(`${API_BASE_URL}/api/loads/bulk-archive`, {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify({ loadIds })
        });

        if (response.ok) {
          // Remove archived loads from the current view
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
    window.location.href = `/dashboard/loads/${loadId}`;
  };

  const handleEditLoad = (loadId) => {
    window.location.href = `/dashboard/loads/${loadId}/edit`;
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

  return (
    <div className="space-y-6">
      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
          <AlertCircle className="h-5 w-5 text-red-500" />
          <p className="text-red-700">{error}</p>
          <button
            onClick={() => setError('')}
            className="ml-auto text-red-500 hover:text-red-700"
          >
            <XCircle className="h-4 w-4" />
          </button>
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
          Showing {((pagination.page - 1) * pagination.limit) + 1} to {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} loads
        </p>
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={selectedLoads.size === loads.length && loads.length > 0}
            onChange={selectAllLoads}
            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
          />
          <label className="text-sm text-gray-700">Select all</label>
        </div>
      </div>

     {/* Loads Table/Grid */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            <span className="ml-2 text-gray-600">Loading loads...</span>
          </div>
        ) : loads.length === 0 ? (
          <div className="text-center py-12">
            <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No loads found</h3>
            <p className="text-gray-600 mb-4">
              {filters.search || filters.status ? 'No loads match your current filters.' : 'You haven\'t posted any loads yet.'}
            </p>
            {!filters.search && !filters.status && (
              <button
                onClick={handlePostLoadClick}
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium"
              >
                Post Your First Load
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    <input
                      type="checkbox"
                      checked={selectedLoads.size === loads.length}
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
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Budget
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
                    <td className="px-6 py-4 whitespace-nowrap">
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
                          <div className="h-10 w-10 rounded-lg bg-blue-100 flex items-center justify-center">
                            <Package className="h-5 w-5 text-blue-600" />
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {load.title}
                            {load.urgent && (
                              <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                <Zap className="h-3 w-3 mr-1" />
                                Urgent
                              </span>
                            )}
                          </p>
                          <p className="text-sm text-gray-500">
                            {load.cargoType} • {load.weight} kg
                          </p>
                          <p className="text-xs text-gray-400">
                            Posted {formatDate(load.createdAt)}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="space-y-1">
                        <div className="flex items-center text-sm">
                          <MapPin className="h-4 w-4 text-green-500 mr-1" />
                          <span className="text-gray-900 truncate max-w-32">
                            {load.pickupLocation?.address || load.pickupAddress}
                          </span>
                        </div>
                        <ArrowRight className="h-4 w-4 text-gray-400 mx-1" />
                        <div className="flex items-center text-sm">
                          <MapPin className="h-4 w-4 text-red-500 mr-1" />
                          <span className="text-gray-900 truncate max-w-32">
                            {load.deliveryLocation?.address || load.deliveryAddress}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(load.status)}`}>
                          {getStatusIcon(load.status)}
                          <span className="ml-1 capitalize">{load.status.replace('_', ' ')}</span>
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <DollarSign className="h-4 w-4 text-gray-400 mr-1" />
                        <span className="text-sm font-medium text-gray-900">
                          {formatCurrency(load.budget)}
                        </span>
                      </div>
                      {load.bidsCount > 0 && (
                        <p className="text-xs text-gray-500">
                          {load.bidsCount} bid{load.bidsCount !== 1 ? 's' : ''}
                        </p>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="space-y-1 text-sm">
                        <div className="flex items-center text-gray-600">
                          <Calendar className="h-4 w-4 mr-1" />
                          <span>Pickup: {formatDate(load.pickupDate)}</span>
                        </div>
                        <div className="flex items-center text-gray-600">
                          <Calendar className="h-4 w-4 mr-1" />
                          <span>Delivery: {formatDate(load.deliveryDate)}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => handleViewDetails(load._id)}
                          className="text-blue-600 hover:text-blue-900"
                          title="View Details"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleEditLoad(load._id)}
                          className="text-gray-600 hover:text-gray-900"
                          title="Edit Load"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        
                        {/* Status Update Dropdown */}
                        <select
                          value={load.status}
                          onChange={(e) => handleUpdateLoadStatus(load._id, e.target.value)}
                          className="text-xs border-gray-300 rounded px-2 py-1"
                          title="Update Status"
                        >
                          <option value="posted">Posted</option>
                          <option value="receiving_bids">Receiving Bids</option>
                          <option value="driver_assigned">Driver Assigned</option>
                          <option value="in_transit">In Transit</option>
                          <option value="delivered">Delivered</option>
                          <option value="not_available">Not Available</option>
                          <option value="cancelled">Cancelled</option>
                        </select>
                        
                        <button
                          onClick={() => handleDeleteLoad(load._id)}
                          className="text-red-600 hover:text-red-900"
                          title="Delete Load"
                        >
                          <Ban className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6 rounded-lg shadow">
          <div className="flex-1 flex justify-between items-center">
            <div>
              <p className="text-sm text-gray-700">
                Page <span className="font-medium">{pagination.page}</span> of{' '}
                <span className="font-medium">{pagination.totalPages}</span>
              </p>
            </div>
            <div className="flex space-x-2">
              <button
                onClick={() => handlePageChange(pagination.page - 1)}
                disabled={pagination.page === 1}
                className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              
              {/* Page Numbers */}
              {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                const page = Math.max(1, Math.min(pagination.totalPages - 4, pagination.page - 2)) + i;
                return (
                  <button
                    key={page}
                    onClick={() => handlePageChange(page)}
                    className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium rounded-md ${
                      page === pagination.page
                        ? 'bg-blue-600 border-blue-600 text-white'
                        : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    {page}
                  </button>
                );
              })}
              
              <button
                onClick={() => handlePageChange(pagination.page + 1)}
                disabled={pagination.page === pagination.totalPages}
                className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LoadsTab; 