import React, { useState, useEffect, useCallback, useRef } from 'react';
import {  Package, Eye, Ban, 
  MapPin, ArrowRight, ChevronLeft,  
  Zap, Loader2, SortAsc, SortDesc, Truck, CheckCircle, XCircle,
  Download, ChevronRight, Trash2, Edit2,
  Pause, CheckCircle2, 
  X, Clock, Filter, Menu, Settings, 
} from 'lucide-react';

import { getAuthHeader, logout, getUser } from '../../utils/auth';
import StatusUpdateModal from './modals/StatusUpdateModal';
import EditLoadModal from './modals/EditLoadModal';


const LoadsTab = ({ onNavigateToLoadDetail, onEditLoad, onPostLoad }) => {
  // State management
  const [filters, setFilters] = useState({
    search: '',
    status: 'all',
    urgent: false
  });
  
  const [sortConfig, setSortConfig] = useState({
    key: 'createdAt',
    direction: 'desc'
  });
  
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedLoads, setSelectedLoads] = useState(new Set());
  const [loads, setLoads] = useState([]);
  const [user, setUser] = useState(null);
  const [showStatusUpdateModal, setShowStatusUpdateModal] = useState(false);
  const [statusUpdateData, setStatusUpdateData] = useState({ loadId: '', newStatus: '', reason: '' });
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0
  });

  // Mobile state
  const [showFilters, setShowFilters] = useState(false);
  const [showMobileSort, setShowMobileSort] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  // Edit Load Modal State
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingLoad, setEditingLoad] = useState(null);
  const [editFormData, setEditFormData] = useState({
    title: '',
    description: '',
    cargoType: '',
    weight: '',
    pickupLocation: '',
    deliveryLocation: '',
    pickupDate: '',
    deliveryDate: '',
    budget: '',
    vehicleType: '',
    specialRequirements: '',
    isUrgent: false,
    contactPhone: '',
    contactEmail: ''
  });
  const [editFormErrors, setEditFormErrors] = useState({});
  const [isEditSubmitting, setIsEditSubmitting] = useState(false);

  // Action menu state
  const [activeActionMenu, setActiveActionMenu] = useState(null);

  // Prevent excessive re-renders
  const lastFetchRef = useRef(null);
  const fetchTimeoutRef = useRef(null);

  // API Configuration
  const API_BASE_URL = 'https://infinite-cargo-api.onrender.com/api';
  
  const getAuthHeaders = () => {
    const authHeader = getAuthHeader();
    return {
      ...authHeader,
      'Content-Type': 'application/json'
    };
  };

  const getActualLoadStatus = (load) => {
    const now = new Date();
    
    // Check if load should be expired
    const isExpired = (
      (load.biddingEndDate && new Date(load.biddingEndDate) < now) ||
      (load.pickupDate && new Date(load.pickupDate) < now && ['posted', 'available', 'receiving_bids'].includes(load.status))
    );
    
    if (isExpired && ['posted', 'available', 'receiving_bids'].includes(load.status)) {
      return 'expired';
    }
    
    return load.status;
  };

  // Update your loads mapping in the component
  const normalizedLoads = loads.map(load => {
    const actualStatus = getActualLoadStatus(load);
    
    return {
      ...load,
      status: actualStatus,
      originalStatus: load.status, 
      title: load.title || 'Untitled Load',
      budget: load.budget || 0,
      createdAt: load.createdAt || new Date().toISOString(),
      bidCount: load.bidCount || 0,
      isActive: actualStatus === 'expired' ? false : (load.isActive !== undefined ? load.isActive : true),
      weight: load.weight || 0,
      cargoType: load.cargoType || 'other',
      vehicleType: load.vehicleType || 'any',
      isExpired: actualStatus === 'expired'
    };
  });

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (!mobile) {
        setShowFilters(false);
        setShowMobileSort(false);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Status configuration
  const statusConfig = {
    posted: {
      label: 'Posted',
      icon: <Package className="h-3 w-3" />,
      color: 'bg-blue-100 text-blue-800 border-blue-200',
      nextStates: ['available', 'receiving_bids', 'not_available', 'cancelled']
    },
    available: {  
      label: 'Available',
      icon: <Package className="h-3 w-3" />,
      color: 'bg-green-100 text-green-800 border-green-200',
      nextStates: ['receiving_bids', 'assigned', 'driver_assigned', 'not_available', 'cancelled']
    },
    receiving_bids: {
      label: 'Receiving Bids',
      icon: <Clock className="h-3 w-3" />,
      color: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      nextStates: ['assigned', 'driver_assigned', 'not_available', 'cancelled']
    },
    assigned: {
      label: 'Assigned',
      icon: <Truck className="h-3 w-3" />,
      color: 'bg-purple-100 text-purple-800 border-purple-200',
      nextStates: ['in_transit', 'on_hold', 'cancelled', 'receiving_bids']
    },
    driver_assigned: {
      label: 'Driver Assigned',
      icon: <Truck className="h-3 w-3" />,
      color: 'bg-purple-100 text-purple-800 border-purple-200',
      nextStates: ['in_transit', 'on_hold', 'cancelled', 'receiving_bids']
    },
    in_transit: {
      label: 'In Transit',
      icon: <ArrowRight className="h-3 w-3" />,
      color: 'bg-orange-100 text-orange-800 border-orange-200',
      nextStates: ['delivered', 'on_hold']
    },
    on_hold: {
      label: 'On Hold',
      icon: <Pause className="h-3 w-3" />,
      color: 'bg-gray-100 text-gray-800 border-gray-200',
      nextStates: ['in_transit', 'cancelled', 'receiving_bids']
    },
    delivered: {
      label: 'Delivered',
      icon: <CheckCircle2 className="h-3 w-3" />,
      color: 'bg-green-100 text-green-800 border-green-200',
      nextStates: ['completed']
    },
    completed: {
      label: 'Completed',
      icon: <CheckCircle className="h-3 w-3" />,
      color: 'bg-green-200 text-green-900 border-green-300',
      nextStates: []
    },
    not_available: {
      label: 'Not Available',
      icon: <XCircle className="h-3 w-3" />,
      color: 'bg-gray-100 text-gray-800 border-gray-200',
      nextStates: ['posted', 'available', 'receiving_bids']
    },
    expired: {
      label: 'Expired',
      icon: <Clock className="h-3 w-3" />,
      color: 'bg-orange-100 text-orange-800 border-orange-200',
      nextStates: ['available', 'posted']
    },
    cancelled: {
      label: 'Cancelled',
      icon: <Ban className="h-3 w-3" />,
      color: 'bg-red-100 text-red-800 border-red-200',
      nextStates: ['posted', 'available']
    }
  };

  // Dropdown options for form fields
  const cargoTypeOptions = [
    { value: 'general_cargo', label: 'General Cargo' },
    { value: 'food_beverage', label: 'Food & Beverage' },
    { value: 'electronics', label: 'Electronics' },
    { value: 'clothing_textile', label: 'Clothing & Textile' },
    { value: 'construction_materials', label: 'Construction Materials' },
    { value: 'furniture', label: 'Furniture' },
    { value: 'automotive_parts', label: 'Automotive Parts' },
    { value: 'machinery', label: 'Machinery' },
    { value: 'chemicals', label: 'Chemicals' },
    { value: 'pharmaceuticals', label: 'Pharmaceuticals' },
    { value: 'hazardous_materials', label: 'Hazardous Materials' },
    { value: 'livestock', label: 'Livestock' },
    { value: 'documents', label: 'Documents' },
    { value: 'other', label: 'Other' }
  ];

  const vehicleTypeOptions = [
    { value: 'pickup', label: 'Pickup' },
    { value: 'van', label: 'Van' },
    { value: 'truck_small', label: 'Small Truck' },
    { value: 'truck_medium', label: 'Medium Truck' },
    { value: 'truck_large', label: 'Large Truck' },
    { value: 'container_truck', label: 'Container Truck' },
    { value: 'flatbed', label: 'Flatbed' },
    { value: 'refrigerated_truck', label: 'Refrigerated' },
    { value: 'trailer', label: 'Trailer' },
    { value: 'any', label: 'Any Vehicle Type' }
  ];

  const fetchUserProfile = () => {
    const user = getUser();
    
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

  // Improved fetch loads function with better debouncing
  const fetchLoads = useCallback(async (page = 1, customFilters = null, force = false) => {
    const requestKey = JSON.stringify({
      page,
      filters: customFilters || filters,
      sortConfig,
      limit: pagination.limit
    });

    if (lastFetchRef.current === requestKey && !force) {
      return;
    }

    if (fetchTimeoutRef.current) {
      clearTimeout(fetchTimeoutRef.current);
    }

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

      if (currentFilters.status && currentFilters.status !== 'all' && currentFilters.status.trim()) {
        queryParams.append('status', currentFilters.status.trim());
      }

      if (currentFilters.urgent === true) {
        queryParams.append('urgentOnly', 'true');
      }

      const endpoint = `${API_BASE_URL}/loads/user/my-loads?${queryParams.toString()}`;
      
      const headers = getAuthHeaders();
      const response = await fetch(endpoint, { 
        method: 'GET', 
        headers,
        credentials: 'include'
      });

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

        let errorMessage = `Request failed with status ${response.status}`;
        try {
          const errorData = await response.json();
          errorMessage = errorData?.message || errorData?.error || errorMessage;
        } catch (parseError) {
          console.error('Error parsing error response:', parseError);
        }
        
        throw new Error(errorMessage);
      }

      const data = await response.json();

      if (data.status === 'success') {
        const loadsData = data.data?.loads || [];
        
        const normalizedLoads = loadsData.map(load => ({
          ...load,
          status: load.status || 'posted',
          title: load.title || 'Untitled Load',
          budget: load.budget || 0,
          createdAt: load.createdAt || new Date().toISOString(),
          bidCount: load.bidCount || 0,
          isActive: load.isActive !== undefined ? load.isActive : true,
          weight: load.weight || 0,
          cargoType: load.cargoType || 'other',
          vehicleType: load.vehicleType || 'any'
        }));

        setLoads(normalizedLoads);

        if (data.data?.pagination) {
          setPagination({
            page: data.data.pagination.currentPage || page,
            limit: data.data.pagination.limit || pagination.limit,
            total: data.data.pagination.totalLoads || 0,
            totalPages: data.data.pagination.totalPages || 1
          });
        }

        lastFetchRef.current = requestKey;

      } else {
        throw new Error(data.message || 'Failed to fetch loads.');
      }
    } catch (err) {
      console.error('Error fetching loads:', err);
      const errorMessage = err.message || 'Failed to load data. Please try again.';
      setError(errorMessage);
      
      if (!err.message?.includes('Session expired')) {
        // Keep existing loads visible with error message
      } else {
        setLoads([]);
        setPagination({
          page: 1,
          limit: 10,
          total: 0,
          totalPages: 0
        });
      }
    } finally {
      setLoading(false);
      setInitialLoading(false);
    }
  }, [filters, sortConfig, pagination.limit]);

  //  Update load status function with better error handling
  const updateLoadStatus = async () => {
  try {
    setLoading(true);
    setError('');

    if (!statusUpdateData.loadId || !statusUpdateData.newStatus) {
      throw new Error('Load ID and new status are required');
    }

    const currentLoad = loads.find(load => load._id === statusUpdateData.loadId);
    if (!currentLoad) {
      throw new Error('Load not found');
    }

    if (currentLoad.status === statusUpdateData.newStatus) {
      throw new Error('Load is already in this status');
    }

    const authHeaders = getAuthHeaders();
    if (!authHeaders.Authorization && !authHeaders['x-auth-token']) {
      throw new Error('Authentication required. Please log in again.');
    }

    const requestBody = {
      status: statusUpdateData.newStatus,
      reason: statusUpdateData.reason || `Status changed to ${statusUpdateData.newStatus}`
    };

    
    const response = await fetch(`${API_BASE_URL}/loads/${statusUpdateData.loadId}/status`, {
      method: 'PATCH',
      headers: authHeaders,
      credentials: 'include',
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      let errorMessage = 'Failed to update load status';
      
      try {
        const errorData = await response.json();
        console.error('Status update error details:', errorData);
        
        if (response.status === 401) {
          errorMessage = 'Session expired. Please refresh the page and log in again.';
          logout();
          return;
        } else if (response.status === 403) {
          errorMessage = 'You don\'t have permission to update this load status.';
        } else if (response.status === 400) {
          errorMessage = errorData.message || 'Invalid status update request';
          if (errorData.errors) {
            console.error('Validation errors:', errorData.errors);
          }
        } else if (response.status === 404) {
          errorMessage = 'Load not found';
        } else {
          errorMessage = errorData.message || errorMessage;
        }
      } catch (parseError) {
        console.error('Error parsing response:', parseError);
        errorMessage = `HTTP ${response.status}: ${response.statusText}`;
      }
      
      throw new Error(errorMessage);
    }

    const data = await response.json();


    if (data.status === 'success') {
      // Update the loads state immediately
      setLoads(prevLoads => 
        prevLoads.map(load => {
          if (load._id === statusUpdateData.loadId) {
            const updatedLoad = { 
              ...load, 
              status: statusUpdateData.newStatus,
              updatedAt: new Date().toISOString(),
              isActive: ['posted', 'available', 'receiving_bids', 'assigned', 'driver_assigned', 'in_transit'].includes(statusUpdateData.newStatus)
            };

            // Include additional data from response if available
            if (data.data?.load) {
              Object.assign(updatedLoad, data.data.load);
            }

          
            return updatedLoad;
          }
          return load;
        })
      );
      
      // Close modal and reset state
      setShowStatusUpdateModal(false);
      setStatusUpdateData({ loadId: '', newStatus: '', reason: '' });
      
      
      
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


  // Update load function
  const updateLoad = async (loadId, updateData) => {
    if (!loadId) {
      setError('Load ID is required');
      return false;
    }

    try {
      setIsEditSubmitting(true);
      setError('');
      
      const authHeaders = getAuthHeaders();
      if (!authHeaders.Authorization && !authHeaders['x-auth-token']) {
        throw new Error('Authentication required. Please log in again.');
      }

      const response = await fetch(`${API_BASE_URL}/loads/${loadId}`, {
        method: 'PUT',
        headers: authHeaders,
        credentials: 'include',
        body: JSON.stringify(updateData)
      });

      if (!response.ok) {
        let errorMessage = 'Failed to update load';
        
        try {
          const errorData = await response.json();
          if (response.status === 401) {
            errorMessage = 'Session expired. Please log in again.';
            logout();
            return false;
          } else if (response.status === 403) {
            errorMessage = 'You don\'t have permission to update this load.';
          } else if (response.status === 400) {
            if (errorData.errors && Array.isArray(errorData.errors)) {
              errorMessage = errorData.errors.map(err => err.message || err.msg).join(', ');
            } else {
              errorMessage = errorData.message || 'Invalid update data.';
            }
          } else if (response.status === 404) {
            errorMessage = 'Load not found.';
          } else {
            errorMessage = errorData.message || errorMessage;
          }
        } catch (parseError) {
          errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        }
        
        throw new Error(errorMessage);
      }

      const data = await response.json();
      if (data.status === 'success' && data.data?.load) {
        setLoads(prevLoads => 
          prevLoads.map(load => 
            load._id === loadId ? { ...load, ...data.data.load } : load
          )
        );
        
        return true;
      } else {
        throw new Error(data.message || 'Failed to update load');
      }
      
    } catch (err) {
      console.error('Error updating load:', err);
      setError(err.message || 'Failed to update load');
      return false;
    } finally {
      setIsEditSubmitting(false);
    }
  };

  // Edit Load Modal Functions
  const openEditModal = (load) => {
    setEditingLoad(load);
    setEditFormData({
      title: load.title || '',
      description: load.description || '',
      cargoType: load.cargoType || '',
      weight: load.weight ? String(load.weight) : '',
      pickupLocation: load.pickupLocation?.address || load.pickupLocation || '',
      deliveryLocation: load.deliveryLocation?.address || load.deliveryLocation || '',
      pickupDate: load.pickupDate ? new Date(load.pickupDate).toISOString().slice(0, 16) : '',
      deliveryDate: load.deliveryDate ? new Date(load.deliveryDate).toISOString().slice(0, 16) : '',
      budget: load.budget ? String(load.budget) : '',
      vehicleType: load.vehicleType || '',
      specialRequirements: load.specialRequirements || '',
      isUrgent: load.isUrgent || load.urgent || false,
      contactPhone: load.contactPhone || '',
      contactEmail: load.contactEmail || ''
    });
    setEditFormErrors({});
    setShowEditModal(true);
  };

  const closeEditModal = () => {
    setShowEditModal(false);
    setEditingLoad(null);
    setEditFormData({
      title: '',
      description: '',
      cargoType: '',
      weight: '',
      pickupLocation: '',
      deliveryLocation: '',
      pickupDate: '',
      deliveryDate: '',
      budget: '',
      vehicleType: '',
      specialRequirements: '',
      isUrgent: false,
      contactPhone: '',
      contactEmail: ''
    });
    setEditFormErrors({});
  };

  const validateEditForm = () => {
    const errors = {};

    if (!editFormData.title?.trim()) {
      errors.title = 'Load title is required';
    }

    if (!editFormData.cargoType) {
      errors.cargoType = 'Cargo type is required';
    }

    if (!editFormData.weight || isNaN(parseFloat(editFormData.weight)) || parseFloat(editFormData.weight) <= 0) {
      errors.weight = 'Weight must be a positive number';
    }

    if (!editFormData.pickupLocation?.trim()) {
      errors.pickupLocation = 'Pickup location is required';
    }

    if (!editFormData.deliveryLocation?.trim()) {
      errors.deliveryLocation = 'Delivery location is required';
    }

    if (!editFormData.pickupDate) {
      errors.pickupDate = 'Pickup date is required';
    }

    if (!editFormData.deliveryDate) {
      errors.deliveryDate = 'Delivery date is required';
    } else if (editFormData.pickupDate && new Date(editFormData.deliveryDate) <= new Date(editFormData.pickupDate)) {
      errors.deliveryDate = 'Delivery date must be after pickup date';
    }

    if (!editFormData.budget || isNaN(parseFloat(editFormData.budget)) || parseFloat(editFormData.budget) <= 0) {
      errors.budget = 'Budget must be a positive number';
    }

    if (!editFormData.vehicleType) {
      errors.vehicleType = 'Vehicle type is required';
    }

    return errors;
  };

  const handleEditFormChange = (field, value) => {
    setEditFormData(prev => ({ ...prev, [field]: value }));
    
    if (editFormErrors[field]) {
      setEditFormErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const handleEditFormSubmit = async (e) => {
    e.preventDefault();
    
    const errors = validateEditForm();
    if (Object.keys(errors).length > 0) {
      setEditFormErrors(errors);
      return;
    }

    if (!editingLoad) {
      setError('No load selected for editing');
      return;
    }

    const updateData = {
      title: editFormData.title.trim(),
      description: editFormData.description.trim(),
      cargoType: editFormData.cargoType,
      weight: parseFloat(editFormData.weight),
      pickupLocation: editFormData.pickupLocation.trim(),
      deliveryLocation: editFormData.deliveryLocation.trim(),
      pickupDate: new Date(editFormData.pickupDate).toISOString(),
      deliveryDate: new Date(editFormData.deliveryDate).toISOString(),
      budget: parseFloat(editFormData.budget),
      vehicleType: editFormData.vehicleType,
      specialRequirements: editFormData.specialRequirements.trim(),
      isUrgent: editFormData.isUrgent,
      contactPhone: editFormData.contactPhone.trim(),
      contactEmail: editFormData.contactEmail.trim()
    };

    const success = await updateLoad(editingLoad._id, updateData);
    
    if (success) {
      closeEditModal();
    }
  };

  // Initial data loading
  useEffect(() => {
    fetchUserProfile();
    fetchLoads(1, null, true);
  }, []);

  // Better debounced filter/sort effect
  useEffect(() => {
    if (initialLoading) return;

    if (fetchTimeoutRef.current) {
      clearTimeout(fetchTimeoutRef.current);
    }

    fetchTimeoutRef.current = setTimeout(() => {
      fetchLoads(1, null, true);
    }, 500);

    return () => {
      if (fetchTimeoutRef.current) {
        clearTimeout(fetchTimeoutRef.current);
      }
    };
  }, [filters, sortConfig]);

  // Close action menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!event.target.closest('.action-menu-container')) {
        setActiveActionMenu(null);
      }
      if (!event.target.closest('.mobile-filter-container')) {
        setShowFilters(false);
      }
      if (!event.target.closest('.mobile-sort-container')) {
        setShowMobileSort(false);
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  // Cleanup effect
  useEffect(() => {
    return () => {
      if (fetchTimeoutRef.current) {
        clearTimeout(fetchTimeoutRef.current);
      }
    };
  }, []);

  // Utility functions
  const getStatusColor = (status) => {
    return statusConfig[status]?.color || 'bg-gray-100 text-gray-800 border-gray-200';
  };

  const getStatusIcon = (status) => {
    return statusConfig[status]?.icon || <Package className="h-3 w-3" />;
  };

  const getStatusLabel = (status) => {
    return statusConfig[status]?.label || status?.replace(/_/g, ' ').toUpperCase();
  };

  const getAvailableStatusTransitions = (currentStatus) => {
  const transitions = statusConfig[currentStatus]?.nextStates || [];
  return transitions;
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

  // Permission functions
  const canEditLoad = (load) => {
    const editableStatuses = ['posted','expired', 'available', 'receiving_bids', 'assigned', 'driver_assigned'];
    return editableStatuses.includes(load.status);
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
    openEditModal(load);
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
      fetchLoads(newPage, null, true);
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
  
  
  const load = loads.find(l => l._id === loadId);
  if (!load) {
    setError('Load not found');
    return;
  }

  const availableTransitions = getAvailableStatusTransitions(load.status);
  if (!availableTransitions.includes(newStatus)) {
    setError(`Cannot change status from ${getStatusLabel(load.status)} to ${getStatusLabel(newStatus)}`);
    return;
  }

  setStatusUpdateData({
    loadId,
    newStatus,
    reason: ''
  });
  setShowStatusUpdateModal(true);
  setActiveActionMenu(null);
};


  const clearFilters = () => {
    setFilters({
      search: '',
      status: 'all',
      urgent: false
    });
  };

  // Main component render
  if (initialLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-blue-600" />
          <p className="text-gray-600">Loading your loads...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 md:p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex-1">
            <h1 className="text-xl md:text-2xl font-bold text-gray-900">My Loads</h1>
            <p className="text-gray-600 text-sm md:text-base mt-1">
              Manage your cargo shipments and track their status
            </p>
          </div>
          
          {/* Mobile Action Buttons */}
          <div className="flex items-center gap-2 md:gap-3">
            {/* Mobile Filter Button */}
            {isMobile && (
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="flex items-center gap-2 px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors"
              >
                <Filter className="h-4 w-4" />
                Filter
              </button>
            )}
            
            {/* Mobile Sort Button */}
            {isMobile && (
              <button
                onClick={() => setShowMobileSort(!showMobileSort)}
                className="flex items-center gap-2 px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors"
              >
                <Menu className="h-4 w-4" />
                Sort
              </button>
            )}
            
            {/* Post Load Button */}
            {onPostLoad && (
              <button
                onClick={onPostLoad}
                className="flex items-center gap-2 px-3 md:px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg font-medium transition-colors"
              >
                <Package className="h-4 w-4" />
                <span className="hidden sm:inline">Post Load</span>
                <span className="sm:hidden">Post</span>
              </button>
            )}
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-3 flex items-start justify-between">
            <p className="text-red-800 text-sm">{error}</p>
            <button
              onClick={() => setError('')}
              className="ml-2 text-red-600 hover:text-red-800"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      {/* Simple Filters - Desktop Only */}
      {!isMobile && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 md:p-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <input
                type="text"
                placeholder="Search loads..."
                value={filters.search}
                onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            
            <div>
              <select
                value={filters.status}
                onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">All Status</option>
                <option value="posted">Posted</option>
                <option value="available">Available</option>
                <option value="receiving_bids">Receiving Bids</option>
                <option value="assigned">Assigned</option>
                <option value="in_transit">In Transit</option>
                <option value="delivered">Delivered</option>
                <option value="completed">Completed</option>
              </select>
            </div>
            
            <div className="flex items-center gap-4">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={filters.urgent}
                  onChange={(e) => setFilters(prev => ({ ...prev, urgent: e.target.checked }))}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="ml-2 text-sm text-gray-700">Urgent Only</span>
              </label>
              
              {(filters.search || filters.status !== 'all' || filters.urgent) && (
                <button
                  onClick={clearFilters}
                  className="px-3 py-2 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  Clear
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Mobile Filters Overlay */}
      {isMobile && showFilters && (
        <div className="mobile-filter-container bg-white rounded-lg shadow-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Filter Loads</h3>
            <button
              onClick={() => setShowFilters(false)}
              className="text-gray-500 hover:text-gray-700"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
              <input
                type="text"
                placeholder="Search loads..."
                value={filters.search}
                onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select
                value={filters.status}
                onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">All Status</option>
                <option value="posted">Posted</option>
                <option value="available">Available</option>
                <option value="receiving_bids">Receiving Bids</option>
                <option value="assigned">Assigned</option>
                <option value="in_transit">In Transit</option>
                <option value="delivered">Delivered</option>
                <option value="completed">Completed</option>
              </select>
            </div>
            
            <div>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={filters.urgent}
                  onChange={(e) => setFilters(prev => ({ ...prev, urgent: e.target.checked }))}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="ml-2 text-sm text-gray-700">Show urgent loads only</span>
              </label>
            </div>
            
            <div className="flex gap-3 pt-2">
              <button
                onClick={clearFilters}
                className="flex-1 px-4 py-2 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 border border-gray-300 rounded-lg transition-colors"
              >
                Clear
              </button>
              <button
                onClick={() => setShowFilters(false)}
                className="flex-1 px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mobile Sort Overlay */}
      {isMobile && showMobileSort && (
        <div className="mobile-sort-container bg-white rounded-lg shadow-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Sort By</h3>
            <button
              onClick={() => setShowMobileSort(false)}
              className="text-gray-500 hover:text-gray-700"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          
          <div className="space-y-2">
            {[
              { key: 'createdAt', label: 'Date Created' },
              { key: 'budget', label: 'Budget' },
              { key: 'status', label: 'Status' },
              { key: 'pickupDate', label: 'Pickup Date' }
            ].map((option) => (
             <button
                key={option.key}
                onClick={() => {
                  handleSort(option.key);
                  setShowMobileSort(false);
                }}
                className={`flex items-center justify-between w-full p-3 text-left hover:bg-gray-50 rounded-lg transition-colors ${
                  sortConfig.key === option.key ? 'bg-blue-50 text-blue-700' : 'text-gray-700'
                }`}
              >
                <span>{option.label}</span>
                {sortConfig.key === option.key && (
                  sortConfig.direction === 'asc' ? 
                  <SortAsc className="h-4 w-4" /> : 
                  <SortDesc className="h-4 w-4" />
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Bulk Actions Bar */}
      {selectedLoads.size > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="text-sm text-blue-800">
              {selectedLoads.size} load{selectedLoads.size > 1 ? 's' : ''} selected
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => handleBulkAction('export')}
                disabled={loading}
                className="flex items-center gap-2 px-3 py-1 text-sm bg-white hover:bg-gray-50 text-gray-700 border border-gray-300 rounded-lg transition-colors disabled:opacity-50"
              >
                <Download className="h-4 w-4" />
                Export CSV
              </button>
              <button
                onClick={() => handleBulkAction('cancel')}
                disabled={loading}
                className="flex items-center gap-2 px-3 py-1 text-sm bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors disabled:opacity-50"
              >
                <Ban className="h-4 w-4" />
                Cancel Selected
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Loads List/Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        {normalizedLoads.length === 0 ? (
          <div className="p-8 text-center">
            <div className="mx-auto w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mb-4">
              <Package className="h-12 w-12 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Loads Found</h3>
            <p className="text-gray-600 mb-4">
              {(filters.search || filters.status !== 'all' || filters.urgent) 
                ? 'Try adjusting your filters to see more results.'
                : 'Get started by posting your first load.'
              }
            </p>
            {onPostLoad && (
              <button
                onClick={onPostLoad}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
              >
                <Package className="h-4 w-4" />
                Post Your First Load
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="w-12 px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedLoads.size === normalizedLoads.length && normalizedLoads.length > 0}
                        onChange={selectAllLoads}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                    </th>
                    <th 
                      className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort('title')}
                    >
                      <div className="flex items-center gap-1">
                        Load Details
                        {sortConfig.key === 'title' && (
                          sortConfig.direction === 'asc' ? 
                          <SortAsc className="h-3 w-3" /> : 
                          <SortDesc className="h-3 w-3" />
                        )}
                      </div>
                    </th>
                    <th 
                      className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort('status')}
                    >
                      <div className="flex items-center gap-1">
                        Status
                        {sortConfig.key === 'status' && (
                          sortConfig.direction === 'asc' ? 
                          <SortAsc className="h-3 w-3" /> : 
                          <SortDesc className="h-3 w-3" />
                        )}
                      </div>
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Route
                    </th>
                    <th 
                      className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort('budget')}
                    >
                      <div className="flex items-center gap-1">
                        Budget
                        {sortConfig.key === 'budget' && (
                          sortConfig.direction === 'asc' ? 
                          <SortAsc className="h-3 w-3" /> : 
                          <SortDesc className="h-3 w-3" />
                        )}
                      </div>
                    </th>
                    <th 
                      className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort('createdAt')}
                    >
                      <div className="flex items-center gap-1">
                        Created
                        {sortConfig.key === 'createdAt' && (
                          sortConfig.direction === 'asc' ? 
                          <SortAsc className="h-3 w-3" /> : 
                          <SortDesc className="h-3 w-3" />
                        )}
                      </div>
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {normalizedLoads.map((load) => (
                    <tr 
                      key={load._id} 
                      className={`hover:bg-gray-50 transition-colors ${
                        selectedLoads.has(load._id) ? 'bg-blue-50' : ''
                      }`}
                    >
                      <td className="px-4 py-4">
                        <input
                          type="checkbox"
                          checked={selectedLoads.has(load._id)}
                          onChange={() => toggleLoadSelection(load._id)}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-start gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start gap-2">
                              <h3 className="text-sm font-medium text-gray-900 truncate">
                                {load.title}
                              </h3>
                              {load.isUrgent && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
                                  <Zap className="h-3 w-3 mr-1" />
                                  Urgent
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-gray-500 mt-1">
                              {load.cargoType?.replace(/_/g, ' ')} • {load.weight}kg
                            </p>
                            <p className="text-xs text-gray-600 mt-1 line-clamp-2">
                              {load.description}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(load.status)}`}>
                          {getStatusIcon(load.status)}
                          {getStatusLabel(load.status)}
                        </span>
                        {load.bidCount > 0 && (
                          <p className="text-xs text-gray-500 mt-1">
                            {load.bidCount} bid{load.bidCount !== 1 ? 's' : ''}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-4">
                        <div className="text-xs text-gray-900">
                          <div className="flex items-center gap-1 mb-1">
                            <MapPin className="h-3 w-3 text-green-600" />
                            <span className="truncate max-w-[120px]">
                              {load.pickupLocation?.address || load.pickupLocation}
                            </span>
                          </div>
                          <div className="flex items-center gap-1">
                            <MapPin className="h-3 w-3 text-red-600" />
                            <span className="truncate max-w-[120px]">
                              {load.deliveryLocation?.address || load.deliveryLocation}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="text-sm font-medium text-gray-900">
                          {formatCurrency(load.budget)}
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="text-xs text-gray-500">
                          {formatDate(load.createdAt)}
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleViewDetails(load._id)}
                            className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
                            title="View Details"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          
                          {canEditLoad(load) && (
                            <button
                              onClick={() => handleEditLoad(load)}
                              className="p-1 text-gray-400 hover:text-green-600 transition-colors"
                              title="Edit Load"
                            >
                              <Edit2 className="h-4 w-4" />
                            </button>
                          )}

                          {(canChangeStatus(load)) && (
                            <div className="action-menu-container relative">
                              <button
                                onClick={() => setActiveActionMenu(activeActionMenu === load._id ? null : load._id)}
                                className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
                                title="More Actions"
                              >
                                <Settings className="h-4 w-4" />
                              </button>

                             {activeActionMenu === load._id && (
  <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-10">
    {canChangeStatus(load) && getAvailableStatusTransitions(load.status).length > 0 && (
      <>
        {getAvailableStatusTransitions(load.status).map((status) => (
          <button
            key={status}
            onClick={() => {
             
              handleUpdateLoadStatus(load._id, status);
            }}
            className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
          >
            {getStatusIcon(status)}
            Change to {getStatusLabel(status)}
          </button>
        ))}
       
      </>
    )}
    
    
  </div>
)}
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Card View */}
            <div className="md:hidden divide-y divide-gray-200">
              {normalizedLoads.map((load) => (
                <div 
                  key={load._id} 
                  className={`p-4 ${selectedLoads.has(load._id) ? 'bg-blue-50' : ''}`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        checked={selectedLoads.has(load._id)}
                        onChange={() => toggleLoadSelection(load._id)}
                        className="mt-1 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start gap-2 mb-1">
                          <h3 className="text-sm font-medium text-gray-900">
                            {load.title}
                          </h3>
                          {load.isUrgent && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
                              <Zap className="h-3 w-3 mr-1" />
                              Urgent
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 mb-2">
                          {load.cargoType?.replace(/_/g, ' ')} • {load.weight}kg
                        </p>
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(load.status)}`}>
                          {getStatusIcon(load.status)}
                          {getStatusLabel(load.status)}
                        </span>
                      </div>
                    </div>
                    
                    <div className="action-menu-container relative ml-2">
                      <button
                        onClick={() => setActiveActionMenu(activeActionMenu === load._id ? null : load._id)}
                        className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
                      >
                        <Settings className="h-4 w-4" />
                      </button>

                      {activeActionMenu === load._id && (
                        <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-10">
                          <button
                            onClick={() => handleViewDetails(load._id)}
                            className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                          >
                            <Eye className="h-4 w-4" />
                            View Details
                          </button>
                          
                          {canEditLoad(load) && (
                            <button
                              onClick={() => handleEditLoad(load)}
                              className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                            >
                              <Edit2 className="h-4 w-4" />
                              Edit Load
                            </button>
                          )}

                          {canChangeStatus(load) && getAvailableStatusTransitions(load.status).map((status) => (
                            <button
                              key={status}
                              onClick={() => handleUpdateLoadStatus(load._id, status)}
                              className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                            >
                              {getStatusIcon(status)}
                              Change to {getStatusLabel(status)}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2 text-xs text-gray-600">
                    <div className="flex items-start gap-1">
                      <MapPin className="h-3 w-3 text-green-600 mt-0.5 flex-shrink-0" />
                      <span>From: {load.pickupLocation?.address || load.pickupLocation}</span>
                    </div>
                    <div className="flex items-start gap-1">
                      <MapPin className="h-3 w-3 text-red-600 mt-0.5 flex-shrink-0" />
                      <span>To: {load.deliveryLocation?.address || load.deliveryLocation}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
                    <div className="text-sm font-medium text-gray-900">
                      {formatCurrency(load.budget)}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-gray-500">
                      {load.bidCount > 0 && (
                        <span>{load.bidCount} bid{load.bidCount !== 1 ? 's' : ''}</span>
                      )}
                      <span>{formatDate(load.createdAt)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination */}
            {pagination.totalPages > 1 && (
              <div className="px-4 py-4 border-t border-gray-200">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-gray-700">
                    Showing {((pagination.page - 1) * pagination.limit) + 1} to{' '}
                    {Math.min(pagination.page * pagination.limit, pagination.total)} of{' '}
                    {pagination.total} results
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handlePageChange(pagination.page - 1)}
                      disabled={pagination.page === 1 || loading}
                      className="p-2 text-gray-400 hover:text-gray-600 disabled:cursor-not-allowed disabled:hover:text-gray-400"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    
                    <div className="flex items-center gap-1">
                      {[...Array(Math.min(5, pagination.totalPages))].map((_, index) => {
                        let pageNum;
                        if (pagination.totalPages <= 5) {
                          pageNum = index + 1;
                        } else if (pagination.page <= 3) {
                          pageNum = index + 1;
                        } else if (pagination.page >= pagination.totalPages - 2) {
                          pageNum = pagination.totalPages - 4 + index;
                        } else {
                          pageNum = pagination.page - 2 + index;
                        }

                        return (
                          <button
                            key={pageNum}
                            onClick={() => handlePageChange(pageNum)}
                            disabled={loading}
                            className={`px-3 py-1 text-sm rounded-md ${
                              pageNum === pagination.page
                                ? 'bg-blue-600 text-white'
                                : 'text-gray-700 hover:bg-gray-100 disabled:hover:bg-transparent'
                            } disabled:cursor-not-allowed`}
                          >
                            {pageNum}
                          </button>
                        );
                      })}
                    </div>
                    
                    <button
                      onClick={() => handlePageChange(pagination.page + 1)}
                      disabled={pagination.page === pagination.totalPages || loading}
                      className="p-2 text-gray-400 hover:text-gray-600 disabled:cursor-not-allowed disabled:hover:text-gray-400"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Loading Overlay */}
      {loading && (
        <div className="fixed inset-0 bg-black bg-opacity-25 flex items-center justify-center z-40">
          <div className="bg-white rounded-lg p-6 flex items-center gap-3">
            <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
            <span className="text-gray-700">Processing...</span>
          </div>
        </div>
      )}

      {/* Status Update Modal */}
      <StatusUpdateModal
  isOpen={showStatusUpdateModal}
  onClose={() => {
    setShowStatusUpdateModal(false);
    setStatusUpdateData({ loadId: '', newStatus: '', reason: '' });
  }}
  onConfirm={updateLoadStatus}
  statusUpdateData={statusUpdateData}
  setStatusUpdateData={setStatusUpdateData}
  statusConfig={statusConfig}
  loading={loading}
/>

      {/* Edit Load Modal */}
      <EditLoadModal
        show={showEditModal}
        onClose={closeEditModal}
        onSubmit={handleEditFormSubmit}
        editFormData={editFormData}
        onFormChange={handleEditFormChange}
        editFormErrors={editFormErrors}
        isSubmitting={isEditSubmitting}
        cargoTypeOptions={cargoTypeOptions}
        vehicleTypeOptions={vehicleTypeOptions}
      />
    </div>
  );
};

export default LoadsTab;