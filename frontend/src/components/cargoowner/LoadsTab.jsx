import React, { useState, useEffect, useCallback } from 'react';
import { 
  Search, RefreshCw, Package, Plus, Eye, Ban, 
  MapPin, ArrowRight, ChevronLeft, Calendar, Clock, 
  Zap, Loader2, Filter, SortAsc, SortDesc, Truck,
  AlertCircle, CheckCircle, XCircle, MoreVertical,
  Download, ChevronRight, Trash2, Edit2, MoreHorizontal,
  Play, Pause, Square, CheckCircle2, AlertTriangle,
  X, Save
} from 'lucide-react';

import {getAuthHeader, logout, getUser} from '../../utils/auth'; 

const LoadsTab = ({ onNavigateToLoadDetail }) => {
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
  const [showLoadForm, setShowLoadForm] = useState(false);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [error, setError] = useState('');
  const [selectedLoads, setSelectedLoads] = useState(new Set());
  const [loads, setLoads] = useState([]);
  const [editingLoad, setEditingLoad] = useState(null);
  const [user, setUser] = useState(null);
  const [subscriptionStatus, setSubscriptionStatus] = useState(null);
  const [dropdownOpenId, setDropdownOpenId] = useState(null);
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
  const [summary, setSummary] = useState({
    totalLoads: 0,
    activeLoads: 0,
    completedLoads: 0,
    totalBudget: 0,
    avgBudget: 0
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
      isUrgent: false,
      user: getUser(),
    });
  };

  // Status configuration with icons and colors
  const statusConfig = {
    posted: {
      label: 'Posted',
      icon: <Package className="h-3 w-3" />,
      color: 'bg-blue-100 text-blue-800',
      nextStates: ['receiving_bids', 'not_available', 'cancelled']
    },
    receiving_bids: {
      label: 'Receiving Bids',
      icon: <Clock className="h-3 w-3" />,
      color: 'bg-yellow-100 text-yellow-800',
      nextStates: ['assigned', 'not_available', 'cancelled']
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

  // Fetch subscription status
  const fetchSubscriptionStatus = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/loads/subscription-status`, {
        method: 'GET',
        headers: getAuthHeaders()
      });

      if (response.ok) {
        const data = await response.json();
        if (data.status === 'success') {
          setSubscriptionStatus(data.data);
        }
      }
    } catch (err) {
      console.error('Error fetching subscription status:', err);
    }
  }, [API_BASE_URL]);

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

        if (
          currentFilters.minBudget !== undefined &&
          currentFilters.minBudget !== null &&
          currentFilters.minBudget !== ''
        ) {
          queryParams.append('minBudget', String(currentFilters.minBudget));
        }

        if (
          currentFilters.maxBudget !== undefined &&
          currentFilters.maxBudget !== null &&
          currentFilters.maxBudget !== ''
        ) {
          queryParams.append('maxBudget', String(currentFilters.maxBudget));
        }

        if (currentFilters.urgent === true) {
          queryParams.append('urgentOnly', 'true');
        }

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
          if (response.status === 500) {
            setError('Server error. Please try again later.');
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

          if (data.data?.summary) {
            setSummary(data.data.summary);
          }

          if (data.fallback) {
            setError(
              'Data loaded successfully, but some features may be limited due to server issues.'
            );
          }
        } else {
          throw new Error(data.message || 'Failed to fetch loads.');
        }
      } catch (err) {
        console.error('Error fetching loads:', err);

        if (err.message.includes('Network') || err.name === 'TypeError') {
          setError('Network error. Please check your connection and try again.');
        } else if (
          err.message.includes('Authentication') ||
          err.message.includes('Session expired')
        ) {
          setError('Please log in to view your loads.');
        } else {
          setError(err.message || 'Failed to load data. Please try again.');
        }

        setLoads([]);
      } finally {
        setLoading(false);
        setInitialLoading(false);
      }
    },
    [filters, sortConfig, pagination.limit, API_BASE_URL]
  );

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
      if (!formDataWithOwner.pickupDate) {
        throw new Error('Pickup date is required');
      }
      if (!formDataWithOwner.deliveryDate) {
        throw new Error('Delivery date is required');
      }
      if (!formDataWithOwner.vehicleCapacityRequired || parseFloat(formDataWithOwner.vehicleCapacityRequired) <= 0) {
        throw new Error('Vehicle capacity is required');
      }

      // Date validation
      const pickupDate = new Date(formDataWithOwner.pickupDate);
      const deliveryDate = new Date(formDataWithOwner.deliveryDate);
      const now = new Date();

      if (pickupDate < now) {
        throw new Error('Pickup date cannot be in the past');
      }

      if (pickupDate >= deliveryDate) {
        throw new Error('Delivery date must be after pickup date');
      }

      const method = editingLoad ? 'PUT' : 'POST';
      const endpoint = editingLoad 
        ? `${API_BASE_URL}/loads/${editingLoad}`
        : `${API_BASE_URL}/loads`;

      console.log('Submitting load:', { method, endpoint, data: formDataWithOwner });

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
          
          if (errorData.errors && Array.isArray(errorData.errors)) {
            const errorMessages = errorData.errors.map(err => err.message || err.msg).join(', ');
            errorMessage = errorMessages;
          }
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
        await fetchLoads(pagination.page);
        // Also refresh subscription status to update usage
        await fetchSubscriptionStatus();
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

  // Update load status
  const updateLoadStatus = async (loadId, newStatus, reason = '') => {
    try {
      setLoading(true);
      setError('');
      setDropdownOpenId(null); // Close dropdown after selection

      const response = await fetch(`${API_BASE_URL}/loads/${loadId}/status`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify({ 
          status: newStatus,
          reason: reason || `Status changed to ${statusConfig[newStatus]?.label || newStatus}`
        })
      });

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          setError('Session expired or not authorized. Please log in again.');
          logout();
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
            load._id === loadId ? { 
              ...load, 
              status: newStatus,
              updatedAt: new Date().toISOString()
            } : load
          )
        );

        // Show success message
        console.log(`Load status updated to ${statusConfig[newStatus]?.label || newStatus}`);
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
        // Remove from local state
        setLoads(loads.filter(load => load._id !== loadId));
        setSelectedLoads(prev => {
          const newSet = new Set(prev);
          newSet.delete(loadId);
          return newSet;
        });
        
        // Update summary
        setSummary(prev => ({
          ...prev,
          totalLoads: prev.totalLoads - 1
        }));
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
        fetchSubscriptionStatus(),
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
    return ['posted', 'receiving_bids'].includes(load.status);
  };

  const canDeleteLoad = (load) => {
    return ['posted', 'receiving_bids', 'not_available'].includes(load.status);
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

  const handlePostLoadClick = () => {
    // Check subscription limits
    if (subscriptionStatus && subscriptionStatus.usage) {
      const { maxLoads, remainingLoads } = subscriptionStatus.usage;
      
      if (maxLoads !== -1 && remainingLoads <= 0) {
        setError(`You've reached your monthly limit of ${maxLoads} loads. Upgrade your plan to post more loads.`);
        return;
      }
    }

    setEditingLoad(null);
    resetForm();
    setShowLoadForm(true);
  };

  const handleEditLoad = (load) => {
    if (!canEditLoad(load)) {
      setError(`Cannot edit load with status: ${getStatusLabel(load.status)}`);
      return;
    }

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
        // Create a simple CSV export
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
        // Bulk cancel selected loads
        const promises = loadIds.map(loadId => 
          updateLoadStatus(loadId, 'cancelled', 'Bulk cancellation')
        );
        await Promise.all(promises);
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
    if (newPage >= 1 && newPage <= pagination.totalPages && !loading) {
      fetchLoads(newPage);
    }
  };

  const handleViewDetails = (loadId) => {
    if (onNavigateToLoadDetail) {
      onNavigateToLoadDetail(loadId);
    } else {
      // Fallback navigation - you might want to use React Router here
      window.location.href = `/loads/${loadId}`;
    }
  };

  const handleUpdateLoadStatus = async (loadId, newStatus) => {
    const confirmMessage = `Are you sure you want to change the status to "${getStatusLabel(newStatus)}"?`;
    
    if (window.confirm(confirmMessage)) {
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
    setError(''); // Clear any form errors
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

  // Status dropdown component
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
          className="p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
          disabled={loading}
        >
          <MoreVertical className="h-4 w-4" />
        </button>
        
        {isOpen && (
          <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
            <div className="py-1">
              <div className="px-3 py-2 text-xs font-medium text-gray-500 uppercase tracking-wide border-b border-gray-100">
                Change Status To
              </div>
              {availableTransitions.map((status) => (
                <button
                  key={status}
                  onClick={() => handleUpdateLoadStatus(load._id, status)}
                  className="flex items-center w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                  disabled={loading}
                >
                  <span className={`inline-flex items-center gap-2 px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(status)}`}>
                    {getStatusIcon(status)}
                    {getStatusLabel(status)}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  // Load Form Modal Component
  const LoadFormModal = ({ isOpen, onClose, onSubmit, formData, setFormData, loading, editing, error, user }) => {
    if (!isOpen) return null;

    const handleSubmit = (e) => {
      const formDataWithOwner = {
        ...formData,
        user: user
      };
      onSubmit(e, formDataWithOwner);
    };

    const handleInputChange = (field, value) => {
      setFormData(prev => ({
        ...prev,
        [field]: value
      }));
    };

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-between p-6 border-b">
            <h2 className="text-xl font-semibold text-gray-900">
              {editing ? 'Edit Load' : 'Post New Load'}
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
              disabled={loading}
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex items-center">
                  <AlertCircle className="h-5 w-5 text-red-600 mr-2" />
                  <span className="text-red-800">{error}</span>
                </div>
              </div>
            )}

            {/* Load Title */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Load Title <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => handleInputChange('title', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Enter a descriptive title for your load"
                required
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => handleInputChange('description', e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Describe your cargo and any special requirements"
              />
            </div>

            {/* Pickup and Delivery Locations */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Pickup Location <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.pickupLocation}
                  onChange={(e) => handleInputChange('pickupLocation', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="e.g., Nairobi, Kenya"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Delivery Location <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.deliveryLocation}
                  onChange={(e) => handleInputChange('deliveryLocation', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="e.g., Mombasa, Kenya"
                  required
                />
              </div>
            </div>

            {/* Weight and Cargo Type */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Weight (kg) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  value={formData.weight}
                  onChange={(e) => handleInputChange('weight', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Enter weight in kg"
                  min="0.1"
                  step="0.1"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Cargo Type
                </label>
                <select
                  value={formData.cargoType}
                  onChange={(e) => handleInputChange('cargoType', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="other">Other</option>
                  <option value="electronics">Electronics</option>
                  <option value="furniture">Furniture</option>
                  <option value="clothing">Clothing</option>
                  <option value="food">Food Items</option>
                  <option value="industrial">Industrial</option>
                  <option value="automotive">Automotive</option>
                  <option value="construction">Construction Materials</option>
                </select>
              </div>
            </div>

            {/* Vehicle Type and Capacity */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Vehicle Type
                </label>
                <select
                  value={formData.vehicleType}
                  onChange={(e) => handleInputChange('vehicleType', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="small_truck">Small Truck (1-3 tons)</option>
                  <option value="medium_truck">Medium Truck (3-8 tons)</option>
                  <option value="large_truck">Large Truck (8+ tons)</option>
                  <option value="van">Van</option>
                  <option value="pickup">Pickup Truck</option>
                  <option value="trailer">Trailer</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Vehicle Capacity Required (tons) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  value={formData.vehicleCapacityRequired}
                  onChange={(e) => handleInputChange('vehicleCapacityRequired', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Minimum capacity needed"
                  min="0.1"
                  step="0.1"
                  required
                />
              </div>
            </div>

            {/* Budget */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Budget (KES) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                value={formData.budget}
                onChange={(e) => handleInputChange('budget', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Enter your budget in Kenyan Shillings"
                min="100"
                required
              />
            </div>

            {/* Pickup and Delivery Dates */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Pickup Date & Time <span className="text-red-500">*</span>
                </label>
                <input
                  type="datetime-local"
                  value={formData.pickupDate}
                  onChange={(e) => handleInputChange('pickupDate', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  min={new Date().toISOString().slice(0, 16)}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Delivery Date & Time <span className="text-red-500">*</span>
                </label>
                <input
                  type="datetime-local"
                  value={formData.deliveryDate}
                  onChange={(e) => handleInputChange('deliveryDate', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  min={formData.pickupDate || new Date().toISOString().slice(0, 16)}
                  required
                />
              </div>
            </div>

            {/* Special Instructions */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Special Instructions
              </label>
              <textarea
                value={formData.specialInstructions}
                onChange={(e) => handleInputChange('specialInstructions', e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Any special handling requirements, access restrictions, or additional notes"
              />
            </div>

            {/* Urgent Checkbox */}
            <div className="flex items-center">
              <input
                type="checkbox"
                id="urgent"
                checked={formData.isUrgent}
                onChange={(e) => handleInputChange('isUrgent', e.target.checked)}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor="urgent" className="ml-2 text-sm text-gray-700">
                This is an urgent delivery
              </label>
            </div>

            {/* Form Actions */}
            <div className="flex items-center justify-end space-x-4 pt-6 border-t">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
                disabled={loading}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {editing ? 'Updating...' : 'Creating...'}
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" />
                    {editing ? 'Update Load' : 'Post Load'}
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
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

      {/* Header with Summary Stats */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">My Loads</h2>
            <p className="text-gray-600">Manage and track your freight loads</p>
          </div>
          <button
            onClick={handlePostLoadClick}
            disabled={loading}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
            Post New Load
          </button>
        </div>

        {/* Summary Cards */}
        {summary && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-lg border border-gray-200">
              <div className="flex items-center">
                <Package className="h-8 w-8 text-blue-600" />
                <div className="ml-3">
                  <p className="text-sm font-medium text-gray-500">Total Loads</p>
                  <p className="text-2xl font-bold text-gray-900">{summary.totalLoads || 0}</p>
                </div>
              </div>
            </div>
            <div className="bg-white p-4 rounded-lg border border-gray-200">
              <div className="flex items-center">
                <Clock className="h-8 w-8 text-yellow-600" />
                <div className="ml-3">
                  <p className="text-sm font-medium text-gray-500">Active Loads</p>
                  <p className="text-2xl font-bold text-gray-900">{summary.activeLoads || 0}</p>
                </div>
              </div>
            </div>
            <div className="bg-white p-4 rounded-lg border border-gray-200">
              <div className="flex items-center">
                <CheckCircle className="h-8 w-8 text-green-600" />
                <div className="ml-3">
                  <p className="text-sm font-medium text-gray-500">Completed</p>
                  <p className="text-2xl font-bold text-gray-900">{summary.completedLoads || 0}</p>
                </div>
              </div>
            </div>
            <div className="bg-white p-4 rounded-lg border border-gray-200">
              <div className="flex items-center">
                <Package className="h-8 w-8 text-purple-600" />
                <div className="ml-3">
                  <p className="text-sm font-medium text-gray-500">Avg Budget</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {formatCurrency(summary.avgBudget || 0)}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Subscription Usage Warning */}
        {subscriptionStatus && subscriptionStatus.usage && subscriptionStatus.usage.maxLoads !== -1 && (
          <div className={`p-4 rounded-lg ${
            subscriptionStatus.usage.remainingLoads <= 0 
              ? 'bg-red-50 border border-red-200' 
              : subscriptionStatus.usage.remainingLoads <= 2
              ? 'bg-yellow-50 border border-yellow-200'
              : 'bg-blue-50 border border-blue-200'
          }`}>
            <div className="flex items-center justify-between">
              <div>
                <p className={`text-sm font-medium ${
                  subscriptionStatus.usage.remainingLoads <= 0 
                    ? 'text-red-800' 
                    : subscriptionStatus.usage.remainingLoads <= 2
                    ? 'text-yellow-800'
                    : 'text-blue-800'
                }`}>
                  Monthly Usage: {subscriptionStatus.usage.loadsThisMonth} / {subscriptionStatus.usage.maxLoads} loads
                </p>
                <p className={`text-xs ${
                  subscriptionStatus.usage.remainingLoads <= 0 
                    ? 'text-red-600' 
                    : subscriptionStatus.usage.remainingLoads <= 2
                    ? 'text-yellow-600'
                    : 'text-blue-600'
                }`}>
                  {subscriptionStatus.usage.remainingLoads > 0 
                    ? `${subscriptionStatus.usage.remainingLoads} loads remaining this month`
                    : 'Monthly limit reached - upgrade to post more loads'
                  }
                </p>
              </div>
              {subscriptionStatus.usage.remainingLoads <= 2 && (
                <button className="text-blue-600 hover:text-blue-700 text-sm font-medium">
                  Upgrade Plan
                </button>
              )}
            </div>
          </div>
        )}
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
            <option value="on_hold">On Hold</option>
            <option value="delivered">Delivered</option>
            <option value="completed">Completed</option>
            <option value="not_available">Not Available</option>
            <option value="cancelled">Cancelled</option>
          </select>

          <button
            onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
            className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-colors ${
              showAdvancedFilters 
                ? 'bg-blue-100 text-blue-700 border border-blue-200' 
                : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
            }`}
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
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Min Budget (KES)</label>
                <input
                  type="number"
                  value={filters.minBudget}
                  onChange={(e) => setFilters({ ...filters, minBudget: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="0"
                  min="0"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Max Budget (KES)</label>
                <input
                  type="number"
                  value={filters.maxBudget}
                  onChange={(e) => setFilters({ ...filters, maxBudget: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <span className="text-blue-700 font-medium">
              {selectedLoads.size} load{selectedLoads.size !== 1 ? 's' : ''} selected
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => handleBulkAction('export')}
                className="px-3 py-1 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition-colors flex items-center gap-1"
              >
                <Download className="h-3 w-3" />
                Export CSV
              </button>
              <button
                onClick={() => handleBulkAction('cancel')}
                className="px-3 py-1 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 transition-colors flex items-center gap-1"
              >
                <Ban className="h-3 w-3" />
                Cancel Selected
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sort Controls */}
      <div className="flex items-center gap-4 text-sm">
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
            className="flex items-center gap-1 text-blue-600 hover:text-blue-700 transition-colors"
          >
            {label}
            {sortConfig.key === key && (
              sortConfig.direction === 'asc' ? <SortAsc className="h-3 w-3" /> : <SortDesc className="h-3 w-3" />
            )}
          </button>
        ))}
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

      {/* Loads Display */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {initialLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            <span className="ml-2 text-gray-600">Loading your loads...</span>
          </div>
        ) : loads.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12">
            <Package className="h-16 w-16 text-gray-300 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No loads found</h3>
            <p className="text-gray-500 mb-6 text-center max-w-md">
              {Object.values(filters).some(filter => filter && filter !== false)
                ? 'No loads match your current filters. Try adjusting your search criteria.'
                : 'You haven\'t posted any loads yet. Create your first load to get started.'
              }
            </p>
            {Object.values(filters).some(filter => filter && filter !== false) ? (
              <button
                onClick={clearFilters}
                className="bg-gray-600 hover:bg-gray-700 text-white px-6 py-2 rounded-lg font-medium transition-colors"
              >
                Clear Filters
              </button>
            ) : (
              <button
                onClick={handlePostLoadClick}
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors"
              >
                <Plus className="h-4 w-4" />
                Post Your First Load
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
                              <span>{load.weight} kg</span>
                              <span className="mx-1">•</span>
                              <span className="capitalize">{load.cargoType?.replace('_', ' ')}</span>
                              <span className="mx-1">•</span>
                              <span className="capitalize">{load.vehicleType?.replace('_', ' ')}</span>
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
                          {load.daysSincePosted !== undefined && (
                            <div className="text-xs text-gray-400">
                              Posted {load.daysSincePosted} day{load.daysSincePosted !== 1 ? 's' : ''} ago
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => handleViewDetails(load._id)}
                            className="text-blue-600 hover:text-blue-700"
                            title="View Details"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          {canEditLoad(load) && (
                            <button
                              onClick={() => handleEditLoad(load)}
                              className="text-yellow-600 hover:text-yellow-700"
                              title="Edit Load"
                            >
                              <Edit2 className="h-4 w-4" />
                            </button>
                          )}
                          {canDeleteLoad(load) && (
                            <button
                              onClick={() => handleDeleteLoad(load._id)}
                              className="text-red-600 hover:text-red-700"
                              title="Delete Load"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                          <StatusDropdown load={load} />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Card View */}
            <div className="lg:hidden">
              <div className="space-y-4 p-4">
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
                          <div className="flex items-center gap-2 mb-2">
                            {load.isUrgent || load.urgent ? (
                              <div className="relative">
                                <Package className="h-5 w-5 text-gray-400" />
                                <Zap className="h-3 w-3 text-red-500 absolute -top-1 -right-1" />
                              </div>
                            ) : (
                              <Package className="h-5 w-5 text-gray-400" />
                            )}
                            <h3 className="font-medium text-gray-900 truncate">{load.title}</h3>
                          </div>
                          
                          {load.description && (
                            <p className="text-sm text-gray-600 mb-2 line-clamp-2">
                              {load.description}
                            </p>
                          )}

                          <div className="space-y-2">
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

                          <div className="flex flex-wrap gap-2 mt-3 text-xs text-gray-500">
                            <span>{load.weight} kg</span>
                            <span>•</span>
                            <span className="capitalize">{load.cargoType?.replace('_', ' ')}</span>
                            <span>•</span>
                            <span className="capitalize">{load.vehicleType?.replace('_', ' ')}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-col items-end space-y-2">
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(load.status)}`}>
                          {getStatusIcon(load.status)}
                          {getStatusLabel(load.status)}
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
                      <div className="text-xs text-gray-500">
                        <div>Pickup: {formatDate(load.pickupDate)}</div>
                        <div>Delivery: {formatDate(load.deliveryDate)}</div>
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => handleViewDetails(load._id)}
                          className="p-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        {canEditLoad(load) && (
                          <button
                            onClick={() => handleEditLoad(load)}
                            className="p-2 text-yellow-600 hover:text-yellow-700 hover:bg-yellow-50 rounded-lg transition-colors"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                        )}
                        {canDeleteLoad(load) && (
                          <button
                            onClick={() => handleDeleteLoad(load._id)}
                            className="p-2 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                        <StatusDropdown load={load} />
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
              className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
            >
              Previous
            </button>
            <button
              onClick={() => handlePageChange(pagination.page + 1)}
              disabled={pagination.page >= pagination.totalPages || loading}
              className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
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
              <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                <button
                  onClick={() => handlePageChange(pagination.page - 1)}
                  disabled={pagination.page <= 1 || loading}
                  className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                >
                  <span className="sr-only">Previous</span>
                  <ChevronLeft className="h-5 w-5" aria-hidden="true" />
                </button>
                
                {/* Page numbers */}
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
                      } disabled:opacity-50`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
                
                <button
                  onClick={() => handlePageChange(pagination.page + 1)}
                  disabled={pagination.page >= pagination.totalPages || loading}
                  className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                >
                  <span className="sr-only">Next</span>
                  <ChevronRight className="h-5 w-5" aria-hidden="true" />
                </button>
              </nav>
            </div>
          </div>
        </div>
      )}

      {/* Load Form Modal */}
      {showLoadForm && (
        <LoadFormModal
          isOpen={showLoadForm}
          onClose={handleCloseModal}
          onSubmit={submitLoad}
          formData={loadForm}
          setFormData={setLoadForm}
          loading={loading}
          editing={!!editingLoad}
          error={error}
          user={user}
          subscriptionStatus={subscriptionStatus}
        />
      )}
    </div>
  );
};

export default LoadsTab;