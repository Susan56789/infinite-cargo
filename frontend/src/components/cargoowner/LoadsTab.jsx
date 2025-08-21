import React, { useState, useEffect, useCallback } from 'react';
import { 
  Search, RefreshCw, Package, Eye, Ban, 
  MapPin, ArrowRight, ChevronLeft, Calendar, Clock, 
  Zap, Loader2, Filter, SortAsc, SortDesc, Truck,
  AlertCircle, CheckCircle, XCircle,
  Download, ChevronRight, Trash2, Edit2,
   Pause,  CheckCircle2, 
  X, Save, Settings, MoreVertical
} from 'lucide-react';

import {getAuthHeader, logout, getUser} from '../../utils/auth'; 

const LoadsTab = ({ onNavigateToLoadDetail, onEditLoad, onPostLoad }) => {
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
  
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [error, setError] = useState('');
  const [selectedLoads, setSelectedLoads] = useState(new Set());
  const [loads, setLoads] = useState([]);
  const [user, setUser] = useState(null);
  const [dropdownOpenId, setDropdownOpenId] = useState(null);
  const [showStatusUpdateModal, setShowStatusUpdateModal] = useState(false);
  const [statusUpdateData, setStatusUpdateData] = useState({ loadId: '', newStatus: '', reason: '' });
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

  // Status configuration with icons and colors
  const statusConfig = {
    posted: {
      label: 'Posted',
      icon: <Package className="h-3 w-3" />,
      color: 'bg-blue-100 text-blue-800',
      nextStates: ['receiving_bids', 'not_available', 'cancelled']
    },
     available: {  
    label: 'Available',
    icon: <Package className="h-3 w-3" />,
    color: 'bg-blue-100 text-blue-800',
    nextStates: ['receiving_bids', 'not_available', 'cancelled']
  },
    receiving_bids: {
      label: 'Receiving Bids',
      icon: <Clock className="h-3 w-3" />,
      color: 'bg-yellow-100 text-yellow-800',
      nextStates: ['assigned', 'driver_assigned', 'not_available', 'cancelled']
    },
    assigned: {
      label: 'Assigned',
      icon: <Truck className="h-3 w-3" />,
      color: 'bg-purple-100 text-purple-800',
      nextStates: ['in_transit', 'on_hold', 'cancelled']
    },
    driver_assigned: {
      label: 'Driver Assigned',
      icon: <Truck className="h-3 w-3" />,
      color: 'bg-purple-100 text-purple-800',
      nextStates: ['in_transit', 'on_hold', 'cancelled']
    },
    in_transit: {
      label: 'In Transit',
      icon: <ArrowRight className="h-3 w-3" />,
      color: 'bg-orange-100 text-orange-800',
      nextStates: ['delivered', 'on_hold']
    },
    on_hold: {
      label: 'On Hold',
      icon: <Pause className="h-3 w-3" />,
      color: 'bg-gray-100 text-gray-800',
      nextStates: ['in_transit', 'cancelled']
    },
    delivered: {
      label: 'Delivered',
      icon: <CheckCircle2 className="h-3 w-3" />,
      color: 'bg-green-100 text-green-800',
      nextStates: ['completed']
    },
    completed: {
      label: 'Completed',
      icon: <CheckCircle className="h-3 w-3" />,
      color: 'bg-green-200 text-green-900',
      nextStates: []
    },
    not_available: {
      label: 'Not Available',
      icon: <XCircle className="h-3 w-3" />,
      color: 'bg-gray-100 text-gray-800',
      nextStates: ['posted']
    },
    cancelled: {
      label: 'Cancelled',
      icon: <Ban className="h-3 w-3" />,
      color: 'bg-red-100 text-red-800',
      nextStates: []
    }
  };

  

  const fetchUserProfile = () => {
    const user = getUser();
    
    // Try multiple sources for the display name
    const sources = [
      user?.cargoOwnerProfile?.companyName,
      user?.companyName,
      user?.profile?.companyName,
      user?.businessProfile?.companyName,
      user?.name,
      user?.fullName,
      user?.firstName && user?.lastName ? `${user.firstName} ${user.lastName}` : null,
      user?.email?.split('@')[0]
    ];

    for (const name of sources) {
      if (name && typeof name === 'string' && name.trim().length > 0) {
        setUser({
          displayName: name.trim(),
          ...user
        });
        return;
      }
    }

    setUser({ displayName: 'Anonymous Cargo Owner', ...user });
  };

  // Fixed API endpoint to use the correct route
  const fetchLoads = useCallback(
    async (page = 1, customFilters = null) => {
      try {
        if (page === 1) {
          setInitialLoading(true);
        } else {
          setLoading(true);
        }
        setError('');

        const currentFilters = customFilters || filters;
        const queryParams = new URLSearchParams();

        queryParams.append('page', page.toString());
        queryParams.append('limit', pagination.limit.toString());
        queryParams.append('sortBy', sortConfig.key);
        queryParams.append('sortOrder', sortConfig.direction);

        if (currentFilters.search?.trim()) {
          queryParams.append('search', currentFilters.search.trim());
        }

        if (currentFilters.status) {
          queryParams.append('status', currentFilters.status);
        }

        if (currentFilters.minBudget !== undefined && currentFilters.minBudget !== null && currentFilters.minBudget !== '') {
          queryParams.append('minBudget', String(currentFilters.minBudget));
        }

        if (currentFilters.maxBudget !== undefined && currentFilters.maxBudget !== null && currentFilters.maxBudget !== '') {
          queryParams.append('maxBudget', String(currentFilters.maxBudget));
        }

        if (currentFilters.urgent === true) {
          queryParams.append('urgentOnly', 'true');
        }

        // Use the correct endpoint from the API - user/my-loads
        const endpoint = `${API_BASE_URL}/loads/user/my-loads?${queryParams.toString()}`;
        const headers = getAuthHeaders();

        const response = await fetch(endpoint, { method: 'GET', headers });

        if (!response.ok) {
          if (response.status === 401) {
            setError('Session expired. Please log in again.');
            logout();
            return;
          }
          if (response.status === 403) {
            setError('Access denied. Only cargo owners can view loads.');
            return;
          }

          const errorData = await response.json().catch(() => ({}));
          const errMsg = errorData?.message || `HTTP ${response.status}`;
          throw new Error(errMsg);
        }

        const data = await response.json();
        if (data.status === 'success') {
          const loadsData = data.data?.loads || [];
          setLoads(loadsData);

          if (data.data?.pagination) {
            setPagination({
              page: data.data.pagination.currentPage,
              limit: data.data.pagination.limit || pagination.limit,
              total: data.data.pagination.totalLoads,
              totalPages: data.data.pagination.totalPages
            });
          }
        } else {
          throw new Error(data.message || 'Failed to fetch loads.');
        }
      } catch (err) {
        console.error('Error fetching loads:', err);
        setError(err.message || 'Failed to load data. Please try again.');
        setLoads([]);
      } finally {
        setLoading(false);
        setInitialLoading(false);
      }
    },
    [filters, sortConfig, pagination.limit]
  );

  // Update load status with modal confirmation
  const updateLoadStatus = async () => {
  try {
    setLoading(true);
    setError('');

    // Validate inputs before making request
    if (!statusUpdateData.loadId || !statusUpdateData.newStatus) {
      throw new Error('Load ID and status are required');
    }

    // Get fresh auth headers
    const authHeaders = getAuthHeaders();
    
    // Check if we have valid auth before making the request
    if (!authHeaders.Authorization) {
      throw new Error('Authentication required. Please log in again.');
    }

    console.log('Updating load status:', {
      loadId: statusUpdateData.loadId,
      newStatus: statusUpdateData.newStatus,
      reason: statusUpdateData.reason
    });

    const response = await fetch(`${API_BASE_URL}/loads/${statusUpdateData.loadId}/status`, {
      method: 'PATCH',
      headers: authHeaders,
      body: JSON.stringify({ 
        status: statusUpdateData.newStatus,
        reason: statusUpdateData.reason || `Status changed to ${statusConfig[statusUpdateData.newStatus]?.label || statusUpdateData.newStatus}`
      })
    });

    console.log('Status update response:', response.status, response.statusText);

    // Handle response without automatic logout
    if (!response.ok) {
      let errorMessage = 'Failed to update load status';
      
      if (response.status === 401) {
        errorMessage = 'Session expired. Please refresh the page and log in again.';
        // Don't call logout here - just show the error
        setError(errorMessage);
        return;
      }
      
      if (response.status === 403) {
        errorMessage = 'You don\'t have permission to update this load status.';
        setError(errorMessage);
        return;
      }

      try {
        const errorData = await response.json();
        errorMessage = errorData.message || errorMessage;
      } catch (parseError) {
        console.error('Error parsing error response:', parseError);
        // Use the default error message
      }
      
      throw new Error(errorMessage);
    }

    const data = await response.json();
    console.log('Status update successful:', data);

    if (data.status === 'success') {
      // Update the load in the local state
      setLoads(prevLoads => 
        prevLoads.map(load =>
          load._id === statusUpdateData.loadId ? { 
            ...load, 
            status: statusUpdateData.newStatus,
            updatedAt: new Date().toISOString()
          } : load
        )
      );
      
      // Close modal and reset
      setShowStatusUpdateModal(false);
      setStatusUpdateData({ loadId: '', newStatus: '', reason: '' });
      
      // Optional: Show success message
      console.log(`Load status updated to ${statusUpdateData.newStatus}`);
      
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


  // Delete load
  const deleteLoad = async (loadId) => {
    try {
      setLoading(true);
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
    } finally {
      setLoading(false);
    }
  };

  // Initial data loading
  useEffect(() => {
    const initializeData = async () => {
      await Promise.all([
        fetchUserProfile(),
        fetchLoads(1)
      ]);
    };

    initializeData();
  }, []);

  // Refetch when filters or sort changes with debounce
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (!initialLoading) { 
        fetchLoads(1);
      }
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [filters, sortConfig]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!event.target.closest('.dropdown-container')) {
        setDropdownOpenId(null);
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  // Utility functions
  const getStatusColor = (status) => {
    return statusConfig[status]?.color || 'bg-gray-100 text-gray-800';
  };

  const getStatusIcon = (status) => {
    return statusConfig[status]?.icon || <Package className="h-3 w-3" />;
  };

  const getStatusLabel = (status) => {
    return statusConfig[status]?.label || status?.replace('_', ' ').toUpperCase();
  };

  const getAvailableStatusTransitions = (currentStatus) => {
    return statusConfig[currentStatus]?.nextStates || [];
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

  const canEditLoad = (load) => {
    return ['posted','available', 'receiving_bids', 'not_available'].includes(load.status);
  };

  const canDeleteLoad = (load) => {
    return ['posted','available', 'receiving_bids', 'not_available'].includes(load.status);
  };

  const canChangeStatus = (load) => {
    const availableTransitions = getAvailableStatusTransitions(load.status);
    return availableTransitions.length > 0;
  };

  // Event handlers
  const handleSort = (key) => {
    setSortConfig({
      key,
      direction: sortConfig.key === key && sortConfig.direction === 'asc' ? 'desc' : 'asc'
    });
  };

  const handleEditLoad = (load) => {
  if (!canEditLoad(load)) {
    setError(`Cannot edit load with status: ${getStatusLabel(load.status)}`);
    return;
  }

  // Call the parent's onEditLoad function if provided
  if (onEditLoad) {
    onEditLoad(load._id); // Pass the load ID to the parent
  } else {
    // Fallback behavior if no parent handler
    console.warn('No onEditLoad handler provided');
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
      setError('');
      const loadIds = Array.from(selectedLoads);

      if (action === 'export') {
        const selectedLoadData = loads.filter(load => selectedLoads.has(load._id));
        const csvContent = [
          'Title,Description,Pickup Location,Delivery Location,Weight (kg),Budget (KES),Status,Created Date',
          ...selectedLoadData.map(load => [
            load.title,
            load.description,
            load.pickupLocation?.address || load.pickupLocation,
            load.deliveryLocation?.address || load.deliveryLocation,
            load.weight,
            load.budget,
            getStatusLabel(load.status),
            formatDate(load.createdAt)
          ].map(field => `"${String(field).replace(/"/g, '""')}"`).join(','))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `loads_${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        
      } else if (action === 'cancel') {
        for (const loadId of loadIds) {
          await updateLoadStatusById(loadId, 'cancelled', 'Bulk cancellation');
        }
      }
      
      setSelectedLoads(new Set());
    } catch (error) {
      setError(`Failed to ${action} selected loads. Please try again.`);
    } finally {
      setLoading(false);
    }
  };

  const updateLoadStatusById = async (loadId, newStatus, reason = '') => {
    const response = await fetch(`${API_BASE_URL}/loads/${loadId}/status`, {
      method: 'PATCH',
      headers: getAuthHeaders(),
      body: JSON.stringify({ status: newStatus, reason })
    });

    if (!response.ok) {
      throw new Error('Failed to update status');
    }

    setLoads(prevLoads => 
      prevLoads.map(load =>
        load._id === loadId ? { 
          ...load, 
          status: newStatus,
          updatedAt: new Date().toISOString()
        } : load
      )
    );
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
    if (newPage >= 1 && newPage <= pagination.totalPages && !loading) {
      fetchLoads(newPage);
    }
  };

  const handleViewDetails = (loadId) => {
    if (onNavigateToLoadDetail) {
      onNavigateToLoadDetail(loadId);
    } else {
      window.location.href = `/loads/${loadId}`;
    }
  };

  const handleUpdateLoadStatus = (loadId, newStatus) => {
    setStatusUpdateData({
      loadId,
      newStatus,
      reason: ''
    });
    setShowStatusUpdateModal(true);
    setDropdownOpenId(null);
  };

  const handleDeleteLoad = async (loadId) => {
    if (window.confirm('Are you sure you want to delete this load? This action cannot be undone.')) {
      await deleteLoad(loadId);
    }
  };

  const clearFilters = () => {
    setFilters({
      search: '',
      status: '',
      minBudget: '',
      maxBudget: '',
      pickupDate: '',
      deliveryDate: '',
      urgent: false
    });
  };

  // Improved Status dropdown component with better mobile responsiveness
  const StatusDropdown = ({ load }) => {
    const availableTransitions = getAvailableStatusTransitions(load.status);
    const isOpen = dropdownOpenId === load._id;

    if (availableTransitions.length === 0) {
      return null;
    }

    return (
      <div className="relative dropdown-container">
        <button
          onClick={(e) => {
            e.stopPropagation();
            setDropdownOpenId(isOpen ? null : load._id);
          }}
          className="inline-flex items-center justify-center w-8 h-8 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
          disabled={loading}
          title="Update Status"
        >
          <MoreVertical className="h-4 w-4" />
        </button>
        
        {isOpen && (
          <div className="absolute right-0 top-full mt-1 w-56 bg-white rounded-lg shadow-lg border border-gray-200 z-50 max-h-64 overflow-y-auto">
            <div className="py-1">
              <div className="px-3 py-2 text-xs font-medium text-gray-500 uppercase tracking-wide border-b border-gray-100">
                Change Status
              </div>
              <div className="p-1 space-y-1">
                {availableTransitions.map((status) => (
                  <button
                    key={status}
                    onClick={() => handleUpdateLoadStatus(load._id, status)}
                    className="w-full flex items-center px-3 py-2 text-sm text-left text-gray-700 hover:bg-gray-50 rounded-md transition-colors focus:outline-none focus:bg-gray-50"
                    disabled={loading}
                  >
                    <span className={`inline-flex items-center gap-2 px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(status)} flex-shrink-0`}>
                      {getStatusIcon(status)}
                      {getStatusLabel(status)}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  

  // Separate Status Change Dropdown for loads that only have status changes available
  const StatusChangeDropdown = ({ load }) => {
    const availableTransitions = getAvailableStatusTransitions(load.status);
    const isOpen = dropdownOpenId === `status-${load._id}`;

    if (availableTransitions.length === 0) {
      return null;
    }

    // Show remaining options (after first 3)
    const remainingTransitions = availableTransitions.slice(3);

    return (
      <div className="relative dropdown-container">
        <button
          onClick={(e) => {
            e.stopPropagation();
            setDropdownOpenId(isOpen ? null : `status-${load._id}`);
          }}
          className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium text-gray-600 border border-gray-300 hover:bg-gray-50 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
          disabled={loading}
          title="More status options"
        >
          <Settings className="h-3 w-3" />
          More...
        </button>
        
        {isOpen && (
          <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
            <div className="py-1">
              <div className="px-3 py-2 text-xs font-medium text-gray-500 uppercase tracking-wide border-b border-gray-100">
                More Options
              </div>
              <div className="p-1 space-y-1">
                {remainingTransitions.map((status) => (
                  <button
                    key={status}
                    onClick={() => {
                      handleUpdateLoadStatus(load._id, status);
                      setDropdownOpenId(null);
                    }}
                    className="w-full flex items-center px-3 py-2 text-sm text-left text-gray-700 hover:bg-gray-50 rounded-md transition-colors focus:outline-none focus:bg-gray-50"
                    disabled={loading}
                  >
                    <span className={`inline-flex items-center gap-2 px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(status)} flex-shrink-0`}>
                      {getStatusIcon(status)}
                      {getStatusLabel(status)}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  // Status Update Modal
  const StatusUpdateModal = () => {
    if (!showStatusUpdateModal) return null;

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-lg max-w-md w-full p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Update Load Status</h3>
            <button
              onClick={() => setShowStatusUpdateModal(false)}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          <div className="mb-4">
            <p className="text-sm text-gray-600 mb-2">
              Change status to:
            </p>
            <span className={`inline-flex items-center gap-2 px-3 py-2 rounded-full text-sm font-medium ${getStatusColor(statusUpdateData.newStatus)}`}>
              {getStatusIcon(statusUpdateData.newStatus)}
              {getStatusLabel(statusUpdateData.newStatus)}
            </span>
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Reason (optional)
            </label>
            <textarea
              value={statusUpdateData.reason}
              onChange={(e) => setStatusUpdateData(prev => ({ ...prev, reason: e.target.value }))}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
              placeholder="Enter reason for status change..."
            />
          </div>

          <div className="flex items-center justify-end space-x-4">
            <button
              onClick={() => setShowStatusUpdateModal(false)}
              className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              onClick={updateLoadStatus}
              disabled={loading}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white px-6 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Updating...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  Update Status
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-start">
            <AlertCircle className="h-5 w-5 text-red-600 mr-2 mt-0.5 flex-shrink-0" />
            <span className="text-red-800 flex-1">{error}</span>
            <button
              onClick={() => setError('')}
              className="ml-2 text-red-600 hover:text-red-800 flex-shrink-0"
            >
              <XCircle className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="space-y-2 sm:space-y-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900">My Loads</h2>
          <p className="text-gray-600 text-sm sm:text-base">Manage and track your freight loads</p>
        </div>
      </div>

      {/* Filters */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4 sm:h-5 sm:w-5" />
              <input
                type="text"
                placeholder="Search loads by title, pickup, or delivery location..."
                value={filters.search}
                onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                className="pl-9 sm:pl-10 pr-4 py-2 sm:py-2.5 w-full border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm sm:text-base"
              />
            </div>
          </div>
          
          <div className="flex gap-2 sm:gap-3">
            <select
              value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value })}
              className="px-3 sm:px-4 py-2 sm:py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm sm:text-base min-w-0 flex-1 sm:flex-initial"
            >
              <option value="">All Status</option>
              <option value="posted">Posted</option>
              <option value="receiving_bids">Receiving Bids</option>
              <option value="driver_assigned">Driver Assigned</option>
              <option value="assigned">Assigned</option>
              <option value="in_transit">In Transit</option>
              <option value="on_hold">On Hold</option>
              <option value="delivered">Delivered</option>
              <option value="completed">Completed</option>
              <option value="not_available">Not Available</option>
              <option value="cancelled">Cancelled</option>
            </select>

            <button
              onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
              className={`px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg flex items-center gap-2 transition-colors text-sm sm:text-base whitespace-nowrap ${
                showAdvancedFilters 
                  ? 'bg-blue-100 text-blue-700 border border-blue-200' 
                  : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
              }`}
            >
              <Filter className="h-4 w-4" />
              <span className="hidden sm:inline">Filters</span>
            </button>

            <button
              onClick={onRefresh}
              className="px-3 sm:px-4 py-2 sm:py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg flex items-center gap-2 transition-colors text-sm sm:text-base"
              disabled={loading}
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
          </div>
        </div>

        {/* Advanced Filters */}
        {showAdvancedFilters && (
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Min Budget (KES)</label>
                <input
                  type="number"
                  value={filters.minBudget}
                  onChange={(e) => setFilters({ ...filters, minBudget: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm sm:text-base"
                  placeholder="999999"
                  min="0"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Max Budget (KES)</label>
                <input
                  type="number"
                  value={filters.maxBudget}
                  onChange={(e) => setFilters({ ...filters, maxBudget: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm sm:text-base"
                  placeholder="999999"
                  min="0"
                />
              </div>
              <div className="flex items-center pt-6">
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
            <div className="flex justify-end">
              <button
                onClick={clearFilters}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 transition-colors"
              >
                Clear All Filters
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Bulk Actions */}
      {selectedLoads.size > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 sm:p-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <span className="text-blue-700 font-medium text-sm sm:text-base">
              {selectedLoads.size} load{selectedLoads.size !== 1 ? 's' : ''} selected
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => handleBulkAction('export')}
                className="px-3 py-1.5 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition-colors flex items-center gap-1"
              >
                <Download className="h-3 w-3" />
                Export CSV
              </button>
              <button
                onClick={() => handleBulkAction('cancel')}
                className="px-3 py-1.5 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 transition-colors flex items-center gap-1"
              >
                <Ban className="h-3 w-3" />
                Cancel Selected
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sort Controls */}
      <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-sm">
        <span className="text-gray-700 font-medium">Sort by:</span>
        {[
          { key: 'createdAt', label: 'Date Created' },
          { key: 'budget', label: 'Budget' },
          { key: 'pickupDate', label: 'Pickup Date' },
          { key: 'status', label: 'Status' }
        ].map(({ key, label }) => (
          <button
            key={key}
            onClick={() => handleSort(key)}
            className="flex items-center gap-1 text-blue-600 hover:text-blue-700 transition-colors whitespace-nowrap"
          >
            {label}
            {sortConfig.key === key && (
              sortConfig.direction === 'asc' ? <SortAsc className="h-3 w-3" /> : <SortDesc className="h-3 w-3" />
            )}
          </button>
        ))}
      </div>

      {/* Loads Display */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {initialLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            <span className="ml-2 text-gray-600">Loading your loads...</span>
          </div>
        ) : loads.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-4">
            <Package className="h-16 w-16 text-gray-300 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2 text-center">No loads found</h3>
            <p className="text-gray-500 mb-6 text-center max-w-md text-sm sm:text-base">
              {Object.values(filters).some(filter => filter && filter !== false)
                ? 'No loads match your current filters. Try adjusting your search criteria.'
                : 'You haven\'t posted any loads yet.'
              }
            </p>
            {Object.values(filters).some(filter => filter && filter !== false) && (
              <button
                onClick={clearFilters}
                className="bg-gray-600 hover:bg-gray-700 text-white px-6 py-2 rounded-lg font-medium transition-colors"
              >
                Clear Filters
              </button>
            )}
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
                      Budget & Bids
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
                    <tr key={load._id} className="hover:bg-gray-50 transition-colors">
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
                              <p className="text-sm text-gray-500 truncate max-w-xs">
                                {load.description}
                              </p>
                            )}
                            <div className="flex items-center mt-1 text-xs text-gray-500">
                              <span>{load?.weight} kg</span>
                              <span className="mx-1">•</span>
                              <span className="capitalize">{load?.cargoType?.replace('_', ' ')}</span>
                              <span className="mx-1">•</span>
                              <span className="capitalize">{load?.vehicleType?.replace('_', ' ')}</span>
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm space-y-1">
                          <div className="flex items-center text-gray-900">
                            <MapPin className="h-3 w-3 text-green-500 mr-1 flex-shrink-0" />
                            <span className="truncate max-w-32" title={load.pickupLocation?.address || load.pickupAddress || load.pickupLocation}>
                              {load.pickupLocation?.address || load.pickupAddress || load.pickupLocation}
                            </span>
                          </div>
                          <div className="flex items-center text-gray-500">
                            <ArrowRight className="h-3 w-3 mr-1 flex-shrink-0" />
                            <span className="truncate max-w-32" title={load.deliveryLocation?.address || load.deliveryAddress || load.deliveryLocation}>
                              {load.deliveryLocation?.address || load.deliveryAddress || load.deliveryLocation}
                            </span>
                          </div>
                          {load.distance && (
                            <div className="text-xs text-gray-400">
                              ~{load.distance} km
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm">
                          <div className="font-medium text-gray-900 mb-1">
                            {formatCurrency(load.budget)}
                          </div>
                          <div className="text-xs text-gray-500">
                            {load.bidCount || 0} bid{(load.bidCount || 0) !== 1 ? 's' : ''}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="space-y-1">
                          <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(load.status)}`}>
                            {getStatusIcon(load.status)}
                            {getStatusLabel(load.status)}
                          </span>
                          {load.assignedDriver && (
                            <div className="text-xs text-gray-500">
                              Driver: {load.assignedDriver.name}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        <div className="space-y-1">
                          <div className="flex items-center">
                            <Calendar className="h-3 w-3 mr-1 flex-shrink-0" />
                            <span className="text-xs">Pickup: {formatDate(load.pickupDate)}</span>
                          </div>
                          <div className="flex items-center">
                            <Clock className="h-3 w-3 mr-1 flex-shrink-0" />
                            <span className="text-xs">Delivery: {formatDate(load.deliveryDate)}</span>
                          </div>
                          {load.daysActive !== undefined && (
                            <div className="text-xs text-gray-400">
                              Posted {load.daysActive} day{load.daysActive !== 1 ? 's' : ''} ago
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => handleViewDetails(load._id)}
                            className="text-blue-600 hover:text-blue-700 p-1 hover:bg-blue-50 rounded"
                            title="View Details"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          {canEditLoad(load) && (
                            <button
                              onClick={() => handleEditLoad(load)}
                              className="text-yellow-600 hover:text-yellow-700 p-1 hover:bg-yellow-50 rounded"
                              title="Edit Load"
                            >
                              <Edit2 className="h-4 w-4" />
                            </button>
                          )}
                          {canDeleteLoad(load) && (
                            <button
                              onClick={() => handleDeleteLoad(load._id)}
                              className="text-red-600 hover:text-red-700 p-1 hover:bg-red-50 rounded"
                              title="Delete Load"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                          {canChangeStatus(load) && <StatusDropdown load={load} />}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Card View */}
            <div className="lg:hidden">
              <div className="space-y-3 p-3 sm:p-4">
                {loads.map((load) => (
                  <div key={load._id} className="border border-gray-200 rounded-lg p-4 space-y-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start space-x-3 flex-1 min-w-0">
                        <input
                          type="checkbox"
                          checked={selectedLoads.has(load._id)}
                          onChange={() => toggleLoadSelection(load._id)}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded mt-1 flex-shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2">
                            {load.isUrgent || load.urgent ? (
                              <div className="relative flex-shrink-0">
                                <Package className="h-5 w-5 text-gray-400" />
                                <Zap className="h-3 w-3 text-red-500 absolute -top-1 -right-1" />
                              </div>
                            ) : (
                              <Package className="h-5 w-5 text-gray-400 flex-shrink-0" />
                            )}
                            <h3 className="font-medium text-gray-900 truncate">{load.title}</h3>
                          </div>
                          
                          {load.description && (
                            <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                              {load.description}
                            </p>
                          )}

                          <div className="space-y-2 mb-3">
                            <div className="flex items-center text-sm">
                              <MapPin className="h-4 w-4 text-green-500 mr-2 flex-shrink-0" />
                              <span className="text-gray-900 truncate">
                                {load.pickupLocation?.address || load.pickupAddress || load.pickupLocation}
                              </span>
                            </div>
                            <div className="flex items-center text-sm">
                              <ArrowRight className="h-4 w-4 text-gray-400 mr-2 flex-shrink-0" />
                              <span className="text-gray-600 truncate">
                                {load.deliveryLocation?.address || load.deliveryAddress || load.deliveryLocation}
                              </span>
                            </div>
                          </div>

                          <div className="flex flex-wrap gap-1 text-xs text-gray-500 mb-3">
                            <span className="bg-gray-100 px-2 py-1 rounded">{load.weight} kg</span>
                            <span className="bg-gray-100 px-2 py-1 rounded capitalize">{load.cargoType?.replace('_', ' ')}</span>
                            <span className="bg-gray-100 px-2 py-1 rounded capitalize">{load.vehicleType?.replace('_', ' ')}</span>
                          </div>

                          {/* Status Change Buttons - Prominently displayed */}
                          {canChangeStatus(load) && (
                            <div className="mb-3">
                              <div className="text-xs font-medium text-gray-500 mb-2">Quick Status Change:</div>
                              <div className="flex flex-wrap gap-1">
                                {getAvailableStatusTransitions(load.status).slice(0, 3).map((status) => (
                                  <button
                                    key={status}
                                    onClick={() => handleUpdateLoadStatus(load._id, status)}
                                    className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-colors border ${getStatusColor(status)} hover:opacity-80`}
                                    disabled={loading}
                                  >
                                    {getStatusIcon(status)}
                                    {getStatusLabel(status)}
                                  </button>
                                ))}
                                {getAvailableStatusTransitions(load.status).length > 3 && (
                                  <StatusChangeDropdown load={load} />
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-col items-end space-y-2 flex-shrink-0 ml-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(load.status)}`}>
                          {getStatusIcon(load.status)}
                          <span className="hidden sm:inline">{getStatusLabel(load.status)}</span>
                        </span>
                        <div className="text-sm font-medium text-gray-900">
                          {formatCurrency(load.budget)}
                        </div>
                        <div className="text-xs text-gray-500">
                          {load.bidCount || 0} bid{(load.bidCount || 0) !== 1 ? 's' : ''}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                      <div className="text-xs text-gray-500 space-y-1">
                        <div className="flex items-center">
                          <Calendar className="h-3 w-3 mr-1" />
                          Pickup: {formatDate(load.pickupDate)}
                        </div>
                        <div className="flex items-center">
                          <Clock className="h-3 w-3 mr-1" />
                          Delivery: {formatDate(load.deliveryDate)}
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-1">
                        <button
                          onClick={() => handleViewDetails(load._id)}
                          className="p-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"
                          title="View Details"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        
                        {/* Show ActionsDropdown if there are edit/delete actions, otherwise show StatusChangeDropdown */}
                        {(canEditLoad(load) || canDeleteLoad(load)) ? canChangeStatus(load) : (
                          <StatusChangeDropdown load={load} />
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="bg-white border-t border-gray-200 px-4 py-3 flex items-center justify-between sm:px-6">
          <div className="flex-1 flex justify-between sm:hidden">
            <button
              onClick={() => handlePageChange(pagination.page - 1)}
              disabled={pagination.page <= 1 || loading}
              className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <button
              onClick={() => handlePageChange(pagination.page + 1)}
              disabled={pagination.page >= pagination.totalPages || loading}
              className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
          <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
            <div>
              <p className="text-sm text-gray-700">
                Showing <span className="font-medium">{((pagination.page - 1) * pagination.limit) + 1}</span> to{' '}
                <span className="font-medium">{Math.min(pagination.page * pagination.limit, pagination.total)}</span> of{' '}
                <span className="font-medium">{pagination.total}</span> results
              </p>
            </div>
            <div>
              <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
                <button
                  onClick={() => handlePageChange(pagination.page - 1)}
                  disabled={pagination.page <= 1 || loading}
                  className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                
                {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                  let pageNum;
                  if (pagination.totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (pagination.page <= 3) {
                    pageNum = i + 1;
                  } else if (pagination.page >= pagination.totalPages - 2) {
                    pageNum = pagination.totalPages - 4 + i;
                  } else {
                    pageNum = pagination.page - 2 + i;
                  }
                  
                  return (
                    <button
                      key={pageNum}
                      onClick={() => handlePageChange(pageNum)}
                      disabled={loading}
                      className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                        pageNum === pagination.page
                          ? 'z-10 bg-blue-50 border-blue-500 text-blue-600'
                          : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
                      } disabled:opacity-50 disabled:cursor-not-allowed`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
                
                <button
                  onClick={() => handlePageChange(pagination.page + 1)}
                  disabled={pagination.page >= pagination.totalPages || loading}
                  className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
              </nav>
            </div>
          </div>
        </div>
      )}

      {/* Status Update Modal */}
      <StatusUpdateModal />
    </div>
  );
};

export default LoadsTab;