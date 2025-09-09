import React, { useState, useEffect } from 'react';
import { 
  Plus, Crown, BarChart3, Package, Users, PieChart, 
  CheckCircle2, AlertCircle,XCircle, Clock, Loader2
} from 'lucide-react';
import { useNotifications, ToastContainer } from './NotificationUtils';

// Import child components
import DashboardHeader from './DashboardHeader';
import StatsCards from './StatsCards';
import SubscriptionStatusCard from './SubscriptionStatusCard';
import LoadFormModal from './modals/LoadFormModal';
import OverviewTab from './OverviewTab';
import LoadsTab from './LoadsTab';
import BidsTab from './BidsTab';
import SubscriptionTab from './SubscriptionTab';
import AnalyticsTab from './AnalyticsTab';
import ProfileModal from './modals/ProfileModal';
import SubscriptionModal from './modals/SubscriptionModal';
import NotificationAlerts from './NotificationAlerts';
import ConfirmationDialog from './ConfirmationDialog';

import { authManager, getUser, isAuthenticated, getAuthHeader, getUserType, logout } from '../../utils/auth';

const CargoOwnerDashboard = () => {
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [loads, setLoads] = useState([]);
  const [bids, setBids] = useState([]);
  const [stats, setStats] = useState({});
  const [subscription, setSubscription] = useState(null);
  const [subscriptionPlans, setSubscriptionPlans] = useState({});
  const [paymentMethods, setPaymentMethods] = useState([]); // New state for payment methods
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showLoadForm, setShowLoadForm] = useState(false);
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [confirmDialog, setConfirmDialog] = useState({ show: false, message: '', onConfirm: null });
  const [editingLoad, setEditingLoad] = useState(null);

  // Load form state
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
    isUrgent: false,
     user: getUser(),
  });

  // notification hook
  const {
    notifications: liveNotifications,
    markAsRead,
    deleteNotification
  } = useNotifications(user);

  // Profile form state
  const [profileForm, setProfileForm] = useState({
  name: '',
  email: '',
  phone: '',
  alternatePhone: '',
  companyName: '',
  businessType: '',
  website: '',
  address: '',
  city: '',
  country: '',
  description: ''
});

  const [filters, setFilters] = useState({
    status: '',
    dateRange: '',
    search: ''
  });

  const API_BASE_URL = 'https://infinite-cargo-api.onrender.com/api';

  // Get auth headers using AuthManager
  const getAuthHeaders = () => {
    return {
      ...getAuthHeader(),
      'Content-Type': 'application/json'
    };
  };

  useEffect(() => {
  // Check authentication using AuthManager
  if (!isAuthenticated() || getUserType() !== 'cargo_owner') {
    window.location.href = '/login';
    return;
  }

  const userData = getUser();
  setUser(userData);


   setProfileForm({
  name: userData?.name || '',
  email: userData?.email || '',
  phone: userData?.phone || '',
  alternatePhone: userData?.alternatePhone || '',
  companyName: userData?.cargoOwnerProfile?.companyName || '',
  businessType: userData?.cargoOwnerProfile?.businessType || '',
  website: userData?.cargoOwnerProfile?.website || '',
  address: userData?.cargoOwnerProfile?.address || '',
  city: userData?.cargoOwnerProfile?.city || '',
  country: userData?.cargoOwnerProfile?.country || '',
  description: userData?.cargoOwnerProfile?.description || ''
});


    fetchDashboardData();
  }, []);

  // Listen for auth state changes
  useEffect(() => {
    const handleAuthChange = () => {
      if (!isAuthenticated()) {
        window.location.href = '/login';
        return;
      }
      
      const userData = getUser();
      setUser(userData);
    };

    window.addEventListener('authStateChanged', handleAuthChange);
    return () => window.removeEventListener('authStateChanged', handleAuthChange);
  }, []);


  // Check token expiration periodically
  useEffect(() => {
    const checkTokenExpiration = () => {
      if (authManager.isTokenExpiringSoon()) {
        authManager.refreshToken().catch(() => {
          handleLogout();
        });
      }
    };

    checkTokenExpiration();
    const interval = setInterval(checkTokenExpiration, 5 * 60 * 1000);
    
    return () => clearInterval(interval);
  }, []);

  const fetchDashboardData = async () => {
  try {
    setLoading(true);
    setError('');
    
    const authHeaders = getAuthHeaders();
    
    const handleResponse = async (response, fallbackData = null) => {
      if (response.ok) {
        const data = await response.json();
        return data.data || data;
      }

      // For 401 errors, don't automatically logout during data fetching
      if (response.status === 401) {
        console.warn('Authentication failed during data fetch');
        return fallbackData;
      }

      // Forbidden / subscription limit
      if (response.status === 403) {
        console.warn('Access forbidden or subscription limit reached.');
        return fallbackData;
      }

      // For all server errors – throw
      if (response.status >= 500) {
        const errorText = await response.text();
        throw new Error(`Server error: ${response.status} - ${errorText}`);
      }

      // Other non-OK
      try {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Unknown error');
      } catch {
        throw new Error('Unknown error occurred');
      }
    };

    // Fetch subscription status first
    let subscriptionData = null;
    try {
      const subscriptionResponse = await fetch(`${API_BASE_URL}/subscriptions/status`, {
        headers: authHeaders,
        timeout: 10000
      });

      subscriptionData = await handleResponse(subscriptionResponse, null);
      setSubscription(subscriptionData);

    } catch (error) {
      console.warn('Could not fetch subscription status:', error.message);
      // Hard fallback if request fails entirely
      setSubscription({
        planId: 'basic',
        planName: 'Basic Plan',
        status: 'active',
        features: { maxLoads: 3 },
        usage: { loadsThisMonth: 0, maxLoads: 3, remainingLoads: 3 },
        billing: { nextBillingDate: null, amount: 0, currency: 'KES' },
        isActive: true
      });
    }

    // Fetch loads data
    let loadsData = [];
    try {
      const loadsResponse = await fetch(`${API_BASE_URL}/loads/user/my-loads?limit=50`, {
        headers: authHeaders,
        timeout: 10000
      });
      
      if (loadsResponse.status === 403) {
        try {
          const fallbackResponse = await fetch(`${API_BASE_URL}/loads?postedBy=${user?.id}&limit=50`, {
            headers: authHeaders,
            timeout: 10000
          });
          const fallbackData = await handleResponse(fallbackResponse, { loads: [] });
          loadsData = Array.isArray(fallbackData?.loads) ? fallbackData.loads : [];
        } catch (fallbackError) {
          console.warn('Fallback loads endpoint also failed:', fallbackError.message);
          loadsData = [];
        }
      } else {
        const data = await handleResponse(loadsResponse, { loads: [] });
        loadsData = Array.isArray(data?.loads) ? data.loads : [];
      }
    } catch (error) {
      console.warn('Could not fetch loads:', error.message);
      loadsData = [];
    }
    
    setLoads(loadsData);

    // Calculate basic stats
    const validLoads = Array.isArray(loadsData) ? loadsData : [];
    const basicStats = {
      totalLoads: validLoads.length,
      activeLoads: validLoads.filter(load => 
        load && ['posted', 'receiving_bids', 'driver_assigned', 'in_transit'].includes(load.status)
      ).length,
      completedLoads: validLoads.filter(load => load && load.status === 'delivered').length,
      inTransitLoads: validLoads.filter(load => load && load.status === 'in_transit').length,
      averageBidsPerLoad: validLoads.length > 0 
        ? validLoads.reduce((acc, load) => acc + (load?.bidCount || 0), 0) / validLoads.length 
        : 0
    };

    
    try {
      const statsResponse = await fetch(`${API_BASE_URL}/loads/analytics/dashboard`, {
        headers: authHeaders,
        timeout: 10000
      });
      const statsData = await handleResponse(statsResponse, basicStats);
      setStats(statsData || basicStats);
    } catch (error) {
      console.warn('Using basic stats due to analytics fetch error:', error.message);
      setStats(basicStats);
    }

    // Fetch notifications
    try {
      const notificationsResponse = await fetch(`${API_BASE_URL}/notifications`, {
        headers: authHeaders,
        timeout: 8000
      });
      const notificationsData = await handleResponse(notificationsResponse, { notifications: [] });
      const notifications = Array.isArray(notificationsData?.notifications) ? 
                           notificationsData.notifications : [];
      setNotifications(notifications);
    } catch (error) {
      console.warn('Could not fetch notifications:', error.message);
      setNotifications([]);
    }

    
    try {
      const plansResponse = await fetch(`${API_BASE_URL}/subscriptions/plans`, {
        headers: authHeaders,
        timeout: 8000
      });
      
      if (plansResponse.ok) {
        const plansData = await plansResponse.json();
        
        if (plansData.status === 'success' && plansData.data?.plans) {
          setSubscriptionPlans(plansData.data.plans);
        } else {
          console.warn('Invalid plans data structure:', plansData);
          setSubscriptionPlans({});
        }
      } else {
        console.warn('Plans request failed:', plansResponse.status, plansResponse.statusText);
        setSubscriptionPlans({});
      }
    } catch (error) {
      console.warn('Could not fetch subscription plans:', error.message);
      setSubscriptionPlans({});
    }

    
    try {
      const paymentMethodsResponse = await fetch(`${API_BASE_URL}/subscriptions/payment-methods`, {
        headers: authHeaders,
        timeout: 8000
      });
      
      if (paymentMethodsResponse.ok) {
        const paymentMethodsData = await paymentMethodsResponse.json();
        
        if (paymentMethodsData.status === 'success' && paymentMethodsData.data?.paymentMethods) {
          setPaymentMethods(paymentMethodsData.data.paymentMethods);
          
        } else {
          console.warn('Invalid payment methods data structure:', paymentMethodsData);
          setPaymentMethods([]);
        }
      } else {
        console.warn('Payment methods request failed:', paymentMethodsResponse.status, paymentMethodsResponse.statusText);
        setPaymentMethods([]);
      }
    } catch (error) {
      console.warn('Could not fetch payment methods:', error.message);
      setPaymentMethods([]);
    }

  } catch (error) {
    console.error('Error fetching dashboard data:', error);
    if (error.message !== 'Authentication failed') {
      setError('Failed to load dashboard data. Please try refreshing the page.');
    }
  } finally {
    setLoading(false);
  }
};


// Function to trigger notifications when loads are created/updated
const triggerLoadNotifications = async (loadId, action, additionalData = {}) => {
  try {
    
    switch (action) {
      case 'created':
        // Show success toast
        if (window.showToast) {
          window.showToast('Load posted successfully! You\'ll be notified when drivers place bids.', 'success');
        }
        break;
        
      case 'bid_received':
        // This would typically be triggered by the backend when a new bid is placed
        if (window.showToast) {
          window.showToast(`New bid received for your load: ${additionalData.loadTitle}`, 'info');
        }
        break;
        
      case 'status_updated':
        if (window.showToast) {
          window.showToast(`Load status updated to: ${additionalData.newStatus}`, 'info');
        }
        break;
        
      default:
        break;
    }
  } catch (error) {
    console.error('Error triggering notifications:', error);
  }
};

const handleCreateLoad = async (e, formDataWithOwner = null) => {
  e.preventDefault();

  const currentLoadForm = formDataWithOwner || loadForm;

  try {
    
    const authHeaders = getAuthHeaders();
  
    // Basic validation
    if (!currentLoadForm.title || currentLoadForm.title.trim().length < 5) {
      setError('Title must be at least 5 characters long');
      return;
    }

    if (!currentLoadForm.description || currentLoadForm.description.trim().length < 10) {
      setError('Description must be at least 10 characters long');
      return;
    }

    if (!currentLoadForm.pickupLocation || !currentLoadForm.deliveryLocation) {
      setError('Both pickup and delivery locations are required');
      return;
    }

    if (!currentLoadForm.weight || parseFloat(currentLoadForm.weight) <= 0) {
      setError('Weight must be greater than 0');
      return;
    }

    if (!currentLoadForm.vehicleCapacityRequired || parseFloat(currentLoadForm.vehicleCapacityRequired) <= 0) {
      setError('Vehicle capacity must be greater than 0');
      return;
    }

    if (!currentLoadForm.budget || parseFloat(currentLoadForm.budget) < 100) {
      setError('Budget must be at least KES 100');
      return;
    }

    if (!currentLoadForm.pickupDate || !currentLoadForm.deliveryDate) {
      setError('Both pickup and delivery dates are required');
      return;
    }

    // Validate dates
    const pickupDate = new Date(currentLoadForm.pickupDate);
    const deliveryDate = new Date(currentLoadForm.deliveryDate);
    const now = new Date();
    
    if (pickupDate >= deliveryDate) {
      setError('Delivery date must be after pickup date');
      return;
    }

    if (pickupDate < now) {
      setError('Pickup date cannot be in the past');
      return;
    }

    // Check subscription limits for new loads only
    if (subscription && subscription.features?.maxLoads !== -1 && !editingLoad) {
      const thisMonthLoads = loads.filter(l => {
        const loadDate = new Date(l.createdAt);
        return loadDate.getMonth() === now.getMonth() && 
               loadDate.getFullYear() === now.getFullYear();
      }).length;

      if (thisMonthLoads >= subscription.features.maxLoads) {
        setError(`You've reached your monthly limit of ${subscription.features.maxLoads} loads. Please upgrade your plan to post more loads.`);
        return;
      }
    }

   
    const getCargoOwnerName = () => {
    
      const sources = [
        currentLoadForm.cargoOwnerName, 
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
        if (name && typeof name === 'string' && name.trim().length > 0 && name.trim() !== 'Anonymous') {
          return name.trim();
        }
      }

      return 'Anonymous Cargo Owner';
    };

    const cargoOwnerName = getCargoOwnerName();
    
    
    const contactPerson = {
      name: currentLoadForm.contactPerson?.name || user?.name || cargoOwnerName,
      phone: currentLoadForm.contactPerson?.phone || user?.phone || '',
      email: currentLoadForm.contactPerson?.email || user?.email || ''
    };

    
    const payload = {
      
      title: currentLoadForm.title.trim(),
      description: currentLoadForm.description.trim(),
      pickupLocation: currentLoadForm.pickupLocation.trim(),
      deliveryLocation: currentLoadForm.deliveryLocation.trim(),
      pickupAddress: currentLoadForm.pickupAddress?.trim() || '',
      deliveryAddress: currentLoadForm.deliveryAddress?.trim() || '',
      
      // Cargo details
      weight: parseFloat(currentLoadForm.weight),
      cargoType: currentLoadForm.cargoType || 'other',
      vehicleType: currentLoadForm.vehicleType || 'small_truck',
      vehicleCapacityRequired: parseFloat(currentLoadForm.vehicleCapacityRequired),
      budget: parseFloat(currentLoadForm.budget),
      
      // Dates
      pickupDate: pickupDate.toISOString(),
      deliveryDate: deliveryDate.toISOString(),
      
      
      specialInstructions: currentLoadForm.specialInstructions?.trim() || '',
      isUrgent: Boolean(currentLoadForm.isUrgent),
      
     
      cargoOwnerName: cargoOwnerName,
      postedByName: cargoOwnerName,
      contactPerson: contactPerson,
      
      
      paymentTerms: currentLoadForm.paymentTerms || 'on_delivery',
      insuranceRequired: Boolean(currentLoadForm.insuranceRequired),
      
      
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };


    setLoading(true);
    setError('');
    setSuccess('');

    const method = editingLoad ? 'PUT' : 'POST';
    const url = editingLoad
      ? `${API_BASE_URL}/loads/${editingLoad}`
      : `${API_BASE_URL}/loads`;

    const response = await fetch(url, {
      method,
      headers: authHeaders,
      body: JSON.stringify(payload),
    });


    
    if (response.status === 401) {
      console.error('Authentication failed - 401 response');
      handleLogout();
      setError('Authentication failed. Please log in again.');
      return;
    }

 
    let data;
    try {
      const responseText = await response.text();
      
      if (responseText) {
        data = JSON.parse(responseText);
      } else {
        data = {};
      }
    } catch (parseError) {
      console.error('Failed to parse response JSON:', parseError);
      setError('Invalid response from server. Please try again.');
      return;
    }


    if (response.ok) {
      const actionText = editingLoad ? 'updated' : 'created';
      setSuccess(`Load ${actionText} successfully!`);
      
      
      await triggerLoadNotifications(data.data?._id, editingLoad ? 'updated' : 'created', {
        loadTitle: currentLoadForm.title
      });
      
     
      setShowLoadForm(false);
      setEditingLoad(null);
      resetForm();
      
    
      await fetchDashboardData();
      
      
      window.dispatchEvent(new Event('authStateChanged'));
      
    } else {
     
      let errorMessage = 'An unexpected error occurred';
      
      
      if (response.status === 400) {
        if (data.errors && Array.isArray(data.errors)) {
          errorMessage = data.errors.map(err => err.message || err.msg).join(', ');
        } else if (data.message) {
          errorMessage = data.message;
        } else {
          errorMessage = 'Invalid data provided. Please check all fields.';
        }
      } else if (response.status === 403) {
        errorMessage = 'Access denied. You may not have permission to perform this action.';
      } else if (response.status === 404) {
        
        if (data.message && data.message.includes('User not found')) {
          errorMessage = 'User authentication issue. Please log out and log back in.';
          console.error('User not found in database. Auth token may be stale.');
          
        } else {
          errorMessage = editingLoad ? 'Load not found. It may have been deleted.' : 'Service not found.';
        }
      } else if (response.status === 409) {
        errorMessage = 'A conflict occurred. The load may have been modified by another user.';
      } else if (response.status === 422) {
        errorMessage = 'Validation failed. Please check your input data.';
        if (data.errors) {
          const validationErrors = Array.isArray(data.errors) 
            ? data.errors.map(err => err.message || err.msg).join(', ')
            : JSON.stringify(data.errors);
          errorMessage += ` Details: ${validationErrors}`;
        }
      } else if (response.status === 429) {
        errorMessage = 'Too many requests. Please wait a moment and try again.';
      } else if (response.status >= 500) {
        errorMessage = 'Server error occurred. Please try again later.';
      } else {
        errorMessage = data.message || `Failed to ${editingLoad ? 'update' : 'create'} load`;
      }
      
      setError(errorMessage);
      console.error('=== LOAD SUBMISSION ERROR ===');
      console.error('Final error details:', {
        status: response.status,
        statusText: response.statusText,
        data,
        payload,
        errorMessage
      });
    }

  } catch (error) {
    console.error('=== CATCH BLOCK ERROR ===');
    console.error('Error in handleCreateLoad:', error);
    console.error('Error name:', error.name);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    
    // Handle network errors
    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      setError('Network error. Please check your internet connection and try again.');
    } else if (error.name === 'AbortError') {
      setError('Request timed out. Please try again.');
    } else {
      setError(`Failed to ${editingLoad ? 'update' : 'create'} load: ${error.message}`);
    }
  } finally {
    setLoading(false);
  }
};

  const resetForm = () => {
    setLoadForm({
      title: '',
      description: '',
      pickupLocation: '',
      deliveryLocation: '',
      pickupAddress: '',
      deliveryAddress: '',
      weight: '',
      cargoType: 'electronics',
      vehicleType: 'small_truck',
      vehicleCapacityRequired: '',
      budget: '',
      pickupDate: '',
      deliveryDate: '',
      specialInstructions: '',
      isUrgent: false,
    });
  };

  const handleUpdateLoadStatus = async (loadId, newStatus) => {
  const statusMessages = {
    'not_available': 'mark as not available',
    'posted': 'repost',
    'cancelled': 'cancel',
    'receiving_bids': 'set to receiving bids',
    'assigned': 'assign to driver',
    'in_transit': 'mark as in transit',
    'delivered': 'mark as delivered',
    'completed': 'mark as completed'
  };

  setConfirmDialog({
    show: true,
    message: `Are you sure you want to ${statusMessages[newStatus] || 'update'} this load?`,
    onConfirm: async () => {
      try {
        setLoading(true);
        setError('');

        // Get fresh auth headers
        const authHeaders = getAuthHeaders();
        
        if (!authHeaders.Authorization) {
          setError('Authentication required. Please refresh the page and log in again.');
          return;
        }

        const response = await fetch(`${API_BASE_URL}/loads/${loadId}/status`, {
          method: 'PATCH',
          headers: authHeaders,
          body: JSON.stringify({ 
            status: newStatus,
            reason: `Status changed to ${newStatus} via dashboard`
          })
        });

        if (!response.ok) {
          let errorMessage = 'Failed to update load status';
          
          if (response.status === 401) {
            errorMessage = 'Session expired. Please refresh the page and log in again.';
            // Don't logout automatically - let user decide
            setError(errorMessage);
            return;
          }

          if (response.status === 403) {
            errorMessage = 'You don\'t have permission to update this load.';
            setError(errorMessage);
            return;
          }

          try {
            const errorData = await response.json();
            errorMessage = errorData.message || errorMessage;
          } catch (parseError) {
            console.error('Error parsing response:', parseError);
          }

          setError(errorMessage);
          return;
        }

        const data = await response.json();
        
        if (data.status === 'success') {
          setSuccess(`Load ${statusMessages[newStatus] || 'updated'} successfully!`);
          
          // Refresh dashboard data instead of individual fetch
          await fetchDashboardData();
        } else {
          setError(data.message || 'Failed to update load status');
        }

      } catch (error) {
        console.error('Error updating load status:', error);
        setError(`Failed to update load status: ${error.message}`);
      } finally {
        setLoading(false);
        setConfirmDialog({ show: false, message: '', onConfirm: null });
      }
    }
  });
};


  const handleViewDetails = (loadId) => {
    window.location.href = `/loads/${loadId}`;
  };

  const handleEditLoad = (loadId) => {
    const loadToEdit = loads.find(load => load._id === loadId);
    if (loadToEdit) {
      setEditingLoad(loadId);
      setLoadForm({
        title: loadToEdit.title || '',
        description: loadToEdit.description || '',
        pickupLocation: loadToEdit.pickupLocation || '',
        deliveryLocation: loadToEdit.deliveryLocation || '',
        pickupAddress: loadToEdit.pickupAddress || '',
        deliveryAddress: loadToEdit.deliveryAddress || '',
        weight: loadToEdit.weight?.toString() || '',
        cargoType: loadToEdit.cargoType || 'other',
        vehicleType: loadToEdit.vehicleType || 'small_truck',
        vehicleCapacityRequired: loadToEdit.vehicleCapacityRequired?.toString() || '',
        budget: loadToEdit.budget?.toString() || '',
        pickupDate: loadToEdit.pickupDate ? new Date(loadToEdit.pickupDate).toISOString().slice(0, 16) : '',
        deliveryDate: loadToEdit.deliveryDate ? new Date(loadToEdit.deliveryDate).toISOString().slice(0, 16) : '',
        specialInstructions: loadToEdit.specialInstructions || '',
        isUrgent: loadToEdit.isUrgent || false
      });
      setShowLoadForm(true);
    }
  };

  const handleAcceptBid = async (bidId) => {
  try {
    setLoading(true);
    setError('');

    const authHeaders = getAuthHeaders();
    
    if (!authHeaders.Authorization) {
      setError('Authentication required. Please refresh the page and log in again.');
      return;
    }

    if (!bidId) {
      setError('Bid ID is required');
      return;
    }

    // Find the bid in the current bids array for confirmation
    const bidToAccept = bids.find(b => b._id === bidId);
    if (!bidToAccept) {
      setError('Bid not found in current data. Please refresh and try again.');
      return;
    }

    // Show confirmation dialog with bid details
    const confirmMessage = `Are you sure you want to accept this bid?\n\nDriver: ${bidToAccept.driverInfo?.name || 'Unknown'}\nAmount: ${formatCurrency(bidToAccept.bidAmount || 0)}\n\nThis will:\n• Assign the load to this driver\n• Create an active job\n• Reject all other bids\n• Send notifications`;
    
    if (!window.confirm(confirmMessage)) {
      setLoading(false);
      return;
    }

    const response = await fetch(`${API_BASE_URL}/bids/${bidId}/accept`, {
      method: 'POST',
      headers: {
        ...authHeaders,
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      // Add timeout
      signal: AbortSignal.timeout(30000) // 30 second timeout
    });


    // Handle different HTTP status codes
    if (response.status === 401) {
      setError('Session expired. Please refresh the page and log in again.');
      // Don't auto-logout, let user decide
      return;
    }

    if (response.status === 403) {
      setError('You don\'t have permission to accept this bid. Make sure you own this load.');
      return;
    }

    if (response.status === 404) {
      setError('Bid or associated load not found. It may have been removed or already processed.');
      return;
    }

    if (response.status === 400) {
      // Try to get specific error message from server
      try {
        const errorData = await response.json();
        setError(errorData.message || 'Invalid request. The bid may no longer be available for acceptance.');
      } catch (parseError) {
        setError('Invalid request. The bid may no longer be available for acceptance.');
      }
      return;
    }

    if (response.status === 409) {
      setError('This bid has already been processed or the load is no longer available.');
      return;
    }

    // Parse response
    let data;
    try {
      const responseText = await response.text();
      
      if (responseText.trim()) {
        data = JSON.parse(responseText);
      } else {
        // Empty response body but OK status
        data = { status: 'success', message: 'Bid accepted successfully' };
      }
    } catch (parseError) {
      console.error('Error parsing response:', parseError);
      if (response.ok) {
        // If response was OK but parsing failed, treat as success
        data = { status: 'success', message: 'Bid accepted successfully' };
      } else {
        setError(`Server returned invalid response. Status: ${response.status}`);
        return;
      }
    }

    if (!response.ok) {
      // Use server error message if available
      const errorMessage = data?.message || data?.error || `Server error (${response.status}). Please try again.`;
      setError(errorMessage);
      return;
    }

    // Success handling
    const successMessage = data?.message || 'Bid accepted successfully!';
    
    // Show success notification
    if (window.showToast) {
      window.showToast(
        `✅ ${successMessage}\n\n${bidToAccept.driverInfo?.name || 'Driver'} has been assigned to your load "${bidToAccept.loadInfo?.title || bidToAccept.load?.title || 'your load'}".\n\nActive job created and notifications sent.`, 
        'success',
        6000
      );
    } else {
      alert(`✅ ${successMessage}`);
    }
    
    // Refresh all dashboard data to show updated states
    await fetchDashboardData();
    
    // Also refresh bids specifically to ensure UI is updated
    if (activeTab === 'bids') {
      await fetchBids();
    }
    
    // Switch to loads tab to see the updated load status
    if (setActiveTab) {
      setTimeout(() => setActiveTab('loads'), 1000);
    }
    
  } catch (error) {
    console.error('=== DASHBOARD BID ACCEPTANCE ERROR ===');
    console.error('Error details:', error);
    console.error('Error name:', error.name);
    console.error('Error message:', error.message);
    
    let userFriendlyMessage = error.message;
    
    // Handle specific error types
    if (error.name === 'AbortError') {
      userFriendlyMessage = 'Request timed out. Please check your connection and try again.';
    } else if (error.name === 'TypeError' && error.message.includes('fetch')) {
      userFriendlyMessage = 'Network error. Please check your internet connection and try again.';
    } else if (error.message.includes('JSON')) {
      userFriendlyMessage = 'Server communication error. Please try again or contact support if the issue persists.';
    }
    
    setError(`Failed to accept bid: ${userFriendlyMessage}`);
    
  } finally {
    setLoading(false);
  }
};

  const handleRejectBid = async (bidId, reason = null) => {
  try {
    setLoading(true);
    setError('');

    const authHeaders = getAuthHeaders();
    
    if (!authHeaders.Authorization) {
      setError('Authentication required. Please refresh the page and log in again.');
      return;
    }

    if (!bidId) {
      setError('Bid ID is required');
      return;
    }

    // If no reason provided, ask for one
    if (reason === null) {
      const bidToReject = bids.find(b => b._id === bidId);
      reason = window.prompt(
        `Please provide a reason for rejecting ${bidToReject?.driverInfo?.name || 'this'}'s bid (optional):\n\nThis will help improve our platform and provide feedback to the driver.`
      );
      
      if (reason === null) {
        // User cancelled
        setLoading(false);
        return;
      }
    }

    const response = await fetch(`${API_BASE_URL}/bids/${bidId}/reject`, {
      method: 'POST',
      headers: {
        ...authHeaders,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({ 
        reason: reason?.trim() || 'No reason provided' 
      }),
      signal: AbortSignal.timeout(15000) // 15 second timeout
    });

    if (response.status === 401) {
      setError('Session expired. Please refresh the page and log in again.');
      return;
    }

    if (response.status === 403) {
      setError('You don\'t have permission to reject this bid.');
      return;
    }

    if (response.status === 404) {
      setError('Bid not found. It may have been withdrawn or already processed.');
      return;
    }

    // Parse response
    let data;
    try {
      const responseText = await response.text();
      data = responseText ? JSON.parse(responseText) : {};
    } catch (parseError) {
      console.error('Failed to parse reject response:', parseError);
      if (response.ok) {
        data = { status: 'success', message: 'Bid rejected successfully' };
      } else {
        setError(`Server response error. Status: ${response.status}`);
        return;
      }
    }

    if (!response.ok) {
      const errorMessage = data?.message || `Failed to reject bid (${response.status})`;
      setError(errorMessage);
      return;
    }

    // Success
    const bidToReject = bids.find(b => b._id === bidId);
    const successMessage = `Bid from ${bidToReject?.driverInfo?.name || 'driver'} has been rejected${reason ? ` (Reason: ${reason.substring(0, 50)}${reason.length > 50 ? '...' : ''})` : ''}.`;
    
    if (window.showToast) {
      window.showToast(successMessage, 'success');
    } else {
      alert(`✅ ${successMessage}`);
    }

    // Refresh data
    await fetchBids();
    await fetchDashboardData();
    
  } catch (error) {
    console.error('=== BID REJECTION ERROR ===');
    console.error('Error details:', error);
    
    let userFriendlyMessage = error.message;
    
    if (error.name === 'AbortError') {
      userFriendlyMessage = 'Request timed out. Please try again.';
    } else if (error.name === 'TypeError' && error.message.includes('fetch')) {
      userFriendlyMessage = 'Network error. Please check your internet connection and try again.';
    }
    
    setError(`Failed to reject bid: ${userFriendlyMessage}`);
    
  } finally {
    setLoading(false);
  }
};

const handleSubscribe = async (planId, paymentMethodId, paymentDetails = null, billingCycle = 'monthly') => {
  const selectedPlan = subscriptionPlans?.[planId];
  const selectedPaymentMethod = paymentMethods.find(method => method.id === paymentMethodId);

  if (!selectedPlan) {
    setError('Selected plan not found.');
    return;
  }

  if (!selectedPaymentMethod) {
    setError('Selected payment method not found.');
    return;
  }
  
  try {
    setLoading(true);
    setError('');
    
    if (!planId) {
      setError('Plan ID is required');
      return;
    }
    
    if (!paymentMethodId) {
      setError('Payment method is required');
      return;
    }

    // Check if payment method is available now
    if (!selectedPaymentMethod.availableNow) {
      setError(`${selectedPaymentMethod.name} is currently not available. Please try another payment method or try again later.`);
      return;
    }

    // Create properly structured payment details
    let requestPaymentDetails = {
      timestamp: new Date().toISOString()
    };

    // Handle M-Pesa payment method specifically
    if (selectedPaymentMethod.id === 'mpesa') {
      // Payment details must be provided from UI - no prompt fallback
      if (!paymentDetails || !paymentDetails.mpesaCode || !paymentDetails.phoneNumber) {
        setError('M-Pesa transaction code and phone number are required. Please fill in all payment details.');
        return;
      }

      // Validate the M-Pesa code format
      if (!/^[A-Z0-9]{8,12}$/i.test(paymentDetails.mpesaCode)) {
        setError('Invalid M-Pesa transaction code format. Please check and try again.');
        return;
      }

      // Validate phone number format
      const phone = paymentDetails.phoneNumber.replace(/\s/g, '');
      if (!/^(\+?254|0)?[17][0-9]{8}$/.test(phone)) {
        setError('Invalid phone number format. Please use format: 254712345678 or 0712345678');
        return;
      }

      // Use correct field names that match backend validation
      requestPaymentDetails = {
        ...requestPaymentDetails,
        mpesaCode: paymentDetails.mpesaCode.trim().toUpperCase(),
        phoneNumber: paymentDetails.phoneNumber.trim(),
        transactionDate: new Date().toISOString(),
        paymentReference: `SUB-${planId.toUpperCase()}-${Date.now()}`
      };
    } else {
      // Handle other payment methods based on their requirements
      if (selectedPaymentMethod.requiresVerification && !paymentDetails) {
        setError(`${selectedPaymentMethod.name} requires additional verification. Please provide payment details.`);
        return;
      }

      // Add payment method specific details
      requestPaymentDetails = {
        ...requestPaymentDetails,
        paymentMethodDetails: paymentDetails || {},
        paymentReference: `SUB-${planId.toUpperCase()}-${Date.now()}`
      };
    }

    // Calculate plan price based on billing cycle
    const calculatePrice = (basePrice) => {
      switch (billingCycle) {
        case 'quarterly':
          return Math.round(basePrice * 3 * 0.95); // 5% discount
        case 'yearly':
          return Math.round(basePrice * 12 * 0.85); // 15% discount
        default:
          return basePrice;
      }
    };

    const planPrice = calculatePrice(selectedPlan.price);

    // Validate payment amount against method limits
    if (selectedPaymentMethod.minimumAmount && planPrice < selectedPaymentMethod.minimumAmount) {
      setError(`Payment amount is below minimum limit of ${formatCurrency(selectedPaymentMethod.minimumAmount)} for ${selectedPaymentMethod.name}.`);
      return;
    }

    if (selectedPaymentMethod.maximumAmount && planPrice > selectedPaymentMethod.maximumAmount) {
      setError(`Payment amount exceeds maximum limit of ${formatCurrency(selectedPaymentMethod.maximumAmount)} for ${selectedPaymentMethod.name}.`);
      return;
    }

    // Properly structured request payload
    const requestPayload = {
      planId: planId,
      paymentMethod: paymentMethodId,
      paymentDetails: requestPaymentDetails,
      billingCycle: billingCycle,
      amount: planPrice
    };

    const response = await fetch(`${API_BASE_URL}/subscriptions/subscribe`, {
      method: 'POST',
      headers: {
        ...getAuthHeaders(),
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(requestPayload)
    });

    let data;
    try {
      const responseText = await response.text();
      
      if (responseText.trim()) {
        data = JSON.parse(responseText);
      } else {
        data = {};
      }
    } catch (parseError) {
      console.error('Failed to parse response:', parseError);
      setError(`Server returned invalid response. Status: ${response.status}`);
      return;
    }

    if (response.ok) {
      // Update subscription state optimistically
      setSubscription({
        planId: planId,
        planName: selectedPlan.name,
        status: 'pending',
        paymentMethod: paymentMethodId,
        billingCycle: billingCycle,
        price: planPrice,
        requestedAt: new Date().toISOString(),
        hasPendingUpgrade: true,
        pendingSubscription: {
          planName: selectedPlan.name,
          billingCycle: billingCycle,
          createdAt: new Date().toISOString()
        }
      });

      const successMessage = data?.message || `${selectedPlan.name} subscription request submitted successfully!`;
      setSuccess(`${successMessage}\n\nYour request will be reviewed within ${selectedPaymentMethod.processingTimeMinutes ? Math.ceil(selectedPaymentMethod.processingTimeMinutes / 60) : 24}-48 hours. You'll receive a notification once approved.`);
      
      if (window.showToast) {
        window.showToast(
          `Subscription request submitted!\n\n` +
          `Plan: ${selectedPlan.name}\n` +
          `Billing: ${billingCycle}\n` +
          `Amount: ${formatCurrency ? formatCurrency(planPrice) : `KES ${planPrice}`}\n` +
          `Payment: ${selectedPaymentMethod.name}\n` +
          `Processing Fee: ${formatCurrency(selectedPaymentMethod.processingFee || 0)}\n\n` +
          `You'll be notified within ${selectedPaymentMethod.processingTimeMinutes ? Math.ceil(selectedPaymentMethod.processingTimeMinutes / 60) : 24}-48 hours once approved.`,
          'success',
          8000
        );
      }

      // Close modal and refresh data
      setShowSubscriptionModal(false);
      await fetchDashboardData();
      
    } else {
      let errorMessage = 'Failed to submit subscription request';
      
      console.error('Subscription error response:', {
        status: response.status,
        statusText: response.statusText,
        data: data
      });

      if (response.status === 400) {
        if (data.errors && Array.isArray(data.errors)) {
          const validationErrors = data.errors.map(err => err.msg || err.message).join(', ');
          errorMessage = `Validation failed: ${validationErrors}`;
        } else if (data.message) {
          errorMessage = data.message;
        } else {
          errorMessage = 'Invalid subscription request. Please check all fields and try again.';
        }
        
        // More detailed error logging for 400 errors
        console.error('400 Error Details:', {
          validationErrors: data.errors,
          message: data.message,
          receivedPayload: requestPayload
        });
        
      } else if (response.status === 401) {
        errorMessage = 'Authentication failed. Please refresh the page and log in again.';
        setTimeout(() => handleLogout(), 2000);
        setError(errorMessage);
        return;
      } else if (response.status === 403) {
        errorMessage = 'Access denied. Only cargo owners can subscribe to plans.';
      } else if (response.status === 409) {
        if (data.existingRequest) {
          errorMessage = `You already have a pending ${data.existingRequest.planName} subscription request from ${formatDate ? formatDate(data.existingRequest.requestedAt) : 'recently'}. Please wait for approval or contact support.`;
        } else {
          errorMessage = data.message || 'A subscription request already exists. Please wait for approval.';
        }
      } else if (response.status >= 500) {
        errorMessage = 'Server error occurred. Please try again later or contact support if the issue persists.';
      } else {
        errorMessage = data.message || `Subscription request failed (${response.status})`;
      }
      
      setError(errorMessage);
    }

  } catch (error) {
    console.error('=== SUBSCRIPTION ERROR ===');
    console.error('Error details:', {
      name: error.name,
      message: error.message,
      stack: error.stack
    });
    
    let userFriendlyMessage = error.message;
    
    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      userFriendlyMessage = 'Network error. Please check your internet connection and try again.';
    } else if (error.name === 'AbortError') {
      userFriendlyMessage = 'Request timed out. Please try again.';
    } else if (error.message.includes('JSON')) {
      userFriendlyMessage = 'Server communication error. Please try again or contact support.';
    }
    
    setError(`Failed to submit subscription request: ${userFriendlyMessage}`);
    
  } finally {
    setLoading(false);
  }
};

const handleUpdateProfile = async (e) => {
  e.preventDefault();

  try {
    setLoading(true);
    setError('');
    setSuccess('');

    const authHeaders = getAuthHeaders();

    if (!authHeaders.Authorization) {
      setError('Authentication required. Please refresh the page and log in again.');
      return;
    }

    // Validate required fields
    if (!profileForm.name || profileForm.name.trim().length < 2) {
      setError('Name must be at least 2 characters long');
      return;
    }

    if (
      profileForm.phone &&
      !/^[\+]?[\d\s\-\(\)]{10,15}$/.test(profileForm.phone.replace(/\s/g, ''))
    ) {
      setError('Please enter a valid phone number');
      return;
    }

    if (profileForm.website && profileForm.website.trim() && !profileForm.website.startsWith('http')) {
      setError('Website URL must start with http:// or https://');
      return;
    }

    // Build payload with correct nesting
    const updatePayload = {
      phone: profileForm.phone?.trim() || undefined,
      alternatePhone: profileForm.alternatePhone?.trim() || undefined,
      cargoOwnerProfile: {
        companyName: profileForm.companyName?.trim() || undefined,
        businessType: profileForm.businessType || undefined,
        website: profileForm.website?.trim() || undefined,
        address: profileForm.address?.trim() || undefined,
        city: profileForm.city?.trim() || undefined,
        country: profileForm.country?.trim() || undefined,
        description: profileForm.description?.trim() || undefined
      }
    };

    // Clean undefined values inside cargoOwnerProfile
    Object.keys(updatePayload.cargoOwnerProfile).forEach((key) => {
      if (updatePayload.cargoOwnerProfile[key] === undefined) {
        delete updatePayload.cargoOwnerProfile[key];
      }
    });

    // Clean undefined values at root
    Object.keys(updatePayload).forEach((key) => {
      if (updatePayload[key] === undefined) {
        delete updatePayload[key];
      }
    });


    const response = await fetch(`${API_BASE_URL}/cargo-owners/profile`, {
      method: 'PUT',
      headers: {
        ...authHeaders,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(updatePayload)
    });

    if (response.status === 401) {
      setError('Session expired. Please refresh the page and log in again.');
      return;
    }

    if (response.status === 403) {
      setError('Access denied. Only cargo owners can update profiles.');
      return;
    }

    let data;
    try {
      const responseText = await response.text();
      data = responseText ? JSON.parse(responseText) : {};
    } catch (parseError) {
      console.error('Failed to parse profile update response:', parseError);
      if (response.ok) {
        data = { status: 'success', message: 'Profile updated successfully' };
      } else {
        setError(`Server returned invalid response. Status: ${response.status}`);
        return;
      }
    }

    if (response.ok) {
      const updatedUser = {
        ...user,
        ...profileForm,
        cargoOwnerProfile: {
          ...user?.cargoOwnerProfile,
          ...updatePayload.cargoOwnerProfile
        }
      };

      setUser(updatedUser);
      setSuccess('Profile updated successfully!');
      setShowProfileModal(false);

      // Refresh dashboard
      await fetchDashboardData();
    } else {
      let errorMessage = data?.message || 'Failed to update profile';

      if (response.status === 400) {
        if (data.errors && Array.isArray(data.errors)) {
          errorMessage = data.errors.map((err) => err.msg || err.message).join(', ');
        }
      }

      setError(errorMessage);
      console.error('Profile update error:', {
        status: response.status,
        data,
        payload: updatePayload
      });
    }
  } catch (error) {
    console.error('Error updating profile:', error);

    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      setError('Network error. Please check your internet connection and try again.');
    } else {
      setError(`Failed to update profile: ${error.message}`);
    }
  } finally {
    setLoading(false);
  }
};


const handleDeleteProfile = async () => {
  try {
    setLoading(true);
    setError('');
    setSuccess('');

    const authHeaders = getAuthHeaders();
    
    if (!authHeaders.Authorization) {
      setError('Authentication required. Please refresh the page and log in again.');
      return;
    }

    const response = await fetch(`${API_BASE_URL}/cargo-owners/profile`, {
      method: 'DELETE',
      headers: authHeaders
    });

    if (response.status === 401) {
      setError('Session expired. Please refresh the page and log in again.');
      return;
    }

    let data;
    try {
      const responseText = await response.text();
      data = responseText ? JSON.parse(responseText) : {};
    } catch (parseError) {
      console.error('Failed to parse delete response:', parseError);
      if (response.ok) {
        data = { status: 'success', message: 'Account deleted successfully' };
      } else {
        setError(`Server returned invalid response. Status: ${response.status}`);
        return;
      }
    }

    if (response.ok) {
      setSuccess('Account deleted successfully. You will be redirected to the homepage.');
      
      // Clear auth and redirect after a delay
      setTimeout(() => {
        handleLogout();
      }, 2000);
      
    } else {
      let errorMessage = data?.message || 'Failed to delete account';
      
      if (response.status === 400) {
        // Handle specific deletion prevention cases
        if (data.activeLoads) {
          errorMessage = `Cannot delete account. You have ${data.activeLoads} active loads. Please cancel or complete them first.`;
        }
        if (data.subscription) {
          errorMessage = 'Cannot delete account with active subscription. Please cancel your subscription first.';
        }
      }
      
      setError(errorMessage);
      console.error('Account deletion error:', {
        status: response.status,
        data
      });
    }
    
  } catch (error) {
    console.error('Error deleting profile:', error);
    
    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      setError('Network error. Please check your internet connection and try again.');
    } else {
      setError(`Failed to delete account: ${error.message}`);
    }
  } finally {
    setLoading(false);
    setShowProfileModal(false);
  }
};

const handleDeactivateProfile = async (reason = '') => {
  try {
    setLoading(true);
    setError('');
    setSuccess('');

    const authHeaders = getAuthHeaders();
    
    if (!authHeaders.Authorization) {
      setError('Authentication required. Please refresh the page and log in again.');
      return;
    }

    const payload = {
      reason: reason.trim() || 'User requested deactivation'
    };

    const response = await fetch(`${API_BASE_URL}/cargo-owners/profile/deactivate`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify(payload)
    });

    if (response.status === 401) {
      setError('Session expired. Please refresh the page and log in again.');
      return;
    }

    let data;
    try {
      const responseText = await response.text();
      data = responseText ? JSON.parse(responseText) : {};
    } catch (parseError) {
      console.error('Failed to parse deactivate response:', parseError);
      if (response.ok) {
        data = { status: 'success', message: 'Account deactivated successfully' };
      } else {
        setError(`Server returned invalid response. Status: ${response.status}`);
        return;
      }
    }

    if (response.ok) {
      setSuccess('Account deactivated successfully. Contact support to reactivate. You will be logged out in a moment.');
      
      // Update user state to reflect deactivation
      setUser({ ...user, isActive: false, deactivatedAt: new Date().toISOString() });
      
      // Log out after a delay
      setTimeout(() => {
        handleLogout();
      }, 3000);
      
    } else {
      let errorMessage = data?.message || 'Failed to deactivate account';
      
      if (response.status === 400) {
        if (data.activeLoads) {
          errorMessage = `Cannot deactivate account. You have ${data.activeLoads} active loads. Please cancel or complete them first.`;
        }
      }
      
      setError(errorMessage);
      console.error('Account deactivation error:', {
        status: response.status,
        data,
        payload
      });
    }
    
  } catch (error) {
    console.error('Error deactivating profile:', error);
    
    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      setError('Network error. Please check your internet connection and try again.');
    } else {
      setError(`Failed to deactivate account: ${error.message}`);
    }
  } finally {
    setLoading(false);
    setShowProfileModal(false);
  }
};


  const fetchBids = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/bids?limit=50`, {
        headers: getAuthHeaders()
      });

      if (response.status === 401) {
        handleLogout();
        return;
      }

      if (response.ok) {
        const data = await response.json();
        setBids(data.data?.bids || data.bids || []);
      } else {
        const errorData = await response.json();
        console.error('Error fetching bids:', errorData);
        setError(errorData.message || 'Failed to fetch bids');
      }
    } catch (error) {
      console.error('Error fetching bids:', error);
      setError(`Failed to fetch bids: ${error.message}`);
    }
  };

  useEffect(() => {
    if (activeTab === 'bids' && user) {
      fetchBids();
    }
  }, [activeTab, user]);

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Logout error:', error);
      authManager.clearAuth();
      window.location.href = '/login';
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      'posted': 'bg-blue-100 text-blue-800',
      'receiving_bids': 'bg-yellow-100 text-yellow-800',
      'driver_assigned': 'bg-green-100 text-green-800',
      'in_transit': 'bg-purple-100 text-purple-800',
      'delivered': 'bg-green-100 text-green-800',
      'cancelled': 'bg-red-100 text-red-800',
      'not_available': 'bg-gray-100 text-gray-800'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      minimumFractionDigits: 0
    }).format(amount);
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Not specified';
    return new Date(dateString).toLocaleDateString('en-KE', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

const getSubscriptionStatus = (subscription) => {
  if (!subscription) {
    return { status: 'Loading...', color: 'text-gray-600', icon: Package };
  }

  // Check for expired status first
  if (subscription.isExpired || subscription.status?.toLowerCase() === 'expired') {
    return { status: 'Expired - Downgraded to Basic', color: 'text-red-600', icon: AlertCircle };
  }

  // If it's basic plan (free plan)
  if (subscription.planId === 'basic') {
    return { status: 'Basic Plan (Free)', color: 'text-gray-600', icon: Package };
  }

  // Check for active premium plans
  if (subscription.status?.toLowerCase() === 'active' && subscription.planId !== 'basic') {
    return { status: `${subscription.planName || 'Premium'}`, color: 'text-green-600', icon: CheckCircle2 };
  }

  // Check for pending status
  if (subscription.status?.toLowerCase() === 'pending') {
    return { status: `${subscription.planName || 'Upgrade'} (Pending Approval)`, color: 'text-yellow-600', icon: Clock };
  }

  // Check for rejected status
  if (subscription.status?.toLowerCase() === 'rejected') {
    return { status: 'Request Rejected', color: 'text-red-600', icon: XCircle };
  }

  // Default fallback
  return { status: subscription.status || 'Unknown', color: 'text-gray-600', icon: AlertCircle };
};

  const canPostLoads = () => {
  // If no subscription data is loaded yet, allow posting (assume basic plan)
  if (!subscription) {
    return true;
  }

  // If subscription is expired, downgrade to basic plan limits
  if (subscription.isExpired || subscription.status?.toLowerCase() === 'expired') {
    const currentMonthLoads = loads.filter(load => {
      const loadDate = new Date(load.createdAt);
      const now = new Date();
      return loadDate.getMonth() === now.getMonth() && loadDate.getFullYear() === now.getFullYear();
    }).length;
    return currentMonthLoads < 3; // Basic plan limit
  }

  // If subscription is pending, rejected, or inactive, use basic plan limits
  if (['pending', 'rejected', 'inactive'].includes(subscription.status?.toLowerCase())) {
    const currentMonthLoads = loads.filter(load => {
      const loadDate = new Date(load.createdAt);
      const now = new Date();
      return loadDate.getMonth() === now.getMonth() && loadDate.getFullYear() === now.getFullYear();
    }).length;
    return currentMonthLoads < 3; // Basic plan limit
  }

  // If subscription is active (premium plans)
  if (subscription.status?.toLowerCase() === 'active') {
    // Check if it's unlimited plan
    if (subscription.features?.maxLoads === -1 || subscription.usage?.maxLoads === -1) {
      return true; // Unlimited posting
    }

    // For limited plans, check current usage
    const maxLoads = subscription.features?.maxLoads || subscription.usage?.maxLoads || subscription.maxLoads;
    
    if (!maxLoads || maxLoads <= 0) {
      return true; // If no limit specified, allow posting
    }

    const currentMonthLoads = loads.filter(load => {
      const loadDate = new Date(load.createdAt);
      const now = new Date();
      return loadDate.getMonth() === now.getMonth() && loadDate.getFullYear() === now.getFullYear();
    }).length;

    return currentMonthLoads < maxLoads;
  }

  // For basic plan (free tier)
  if (subscription.planId === 'basic') {
    const currentMonthLoads = loads.filter(load => {
      const loadDate = new Date(load.createdAt);
      const now = new Date();
      return loadDate.getMonth() === now.getMonth() && loadDate.getFullYear() === now.getFullYear();
    }).length;
    return currentMonthLoads < 3; // Basic plan limit
  }

  // Default: allow posting if status is unclear
  return true;
};

  const filteredLoads = loads.filter(load => {
    if (filters.status && load.status !== filters.status) return false;
    if (filters.search && !load.title.toLowerCase().includes(filters.search.toLowerCase())) return false;
    return true;
  });

  const handlePostLoad = () => {
    setEditingLoad(null);
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
    setShowLoadForm(true);
  };

  if (loading && !user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="mx-auto h-12 w-12 animate-spin text-blue-600" />
          <p className="mt-4 text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Toast Container for notifications */}
      <ToastContainer />
      {/* Header */}
      <DashboardHeader 
        user={user}
        subscription={subscription}
        notifications={liveNotifications}
        onProfileClick={() => setShowProfileModal(true)}
        onLogout={handleLogout}
        getSubscriptionStatus={getSubscriptionStatus}
        getAuthHeaders={getAuthHeaders}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Page Title & Actions */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
            <p className="text-gray-600">Welcome back, {user?.name}!</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setShowSubscriptionModal(true)}
              className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-all"
            >
              <Crown className="h-5 w-5" />
              Upgrade Plan
            </button>
            <button
              onClick={() => {
                if (!canPostLoads()) {
                  setError('You have reached your monthly load limit. Please upgrade your plan.');
                  return;
                }
                handlePostLoad();
              }}
              disabled={!canPostLoads()}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors"
            >
              <Plus className="h-5 w-5" />
              Post New Load
            </button>
          </div>
        </div>

        {/* Error/Success Messages */}
        <NotificationAlerts 
          error={error}
          success={success}
          setError={setError}
          setSuccess={setSuccess}
        />

        {/* Subscription Status Card */}
        <SubscriptionStatusCard 
          subscription={subscription}
          formatDate={formatDate}
        />

        {/* Stats Cards */}
        <StatsCards 
          stats={stats}
          loads={loads}
        />

        {/* Tabs */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="border-b border-gray-200">
            <nav className="flex">
              {[
                { id: 'overview', name: 'Overview', icon: BarChart3 },
                { id: 'loads', name: 'My Loads', icon: Package },
                { id: 'bids', name: 'Received Bids', icon: Users },
                { id: 'subscription', name: 'Subscription', icon: Crown },
                { id: 'analytics', name: 'Analytics', icon: PieChart }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === tab.id
                      ? 'border-blue-600 text-blue-600 bg-blue-50'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <tab.icon className="h-4 w-4" />
                  {tab.name}
                </button>
              ))}
            </nav>
          </div>

          <div className="p-6">
            {/* Tab Content */}
            {activeTab === 'overview' && (
              <OverviewTab 
                loads={loads}
                canPostLoads={canPostLoads}
                getStatusColor={getStatusColor}
                formatDate={formatDate}
                onPostLoad={handlePostLoad}
                onSetActiveTab={setActiveTab}
                setError={setError}
              />
            )}

            {activeTab === 'loads' && (
              <LoadsTab 
                filters={filters}
                setFilters={setFilters}
                loading={loading}
                filteredLoads={filteredLoads}
                canPostLoads={canPostLoads}
                getStatusColor={getStatusColor}
                formatCurrency={formatCurrency}
                formatDate={formatDate}
                onPostLoad={handlePostLoad}
                onViewDetails={handleViewDetails}
                onEditLoad={handleEditLoad}  
                onUpdateLoadStatus={handleUpdateLoadStatus}
                onRefresh={fetchDashboardData}
                setError={setError}
              />
            )}

            {activeTab === 'bids' && (
              <BidsTab 
                bids={bids}
                loading={loading}
                formatCurrency={formatCurrency}
                formatDate={formatDate}
                onAcceptBid={handleAcceptBid}
                onRejectBid={handleRejectBid}
                onRefresh={fetchBids}
                API_BASE_URL={API_BASE_URL} 
                getAuthHeaders={getAuthHeaders} 
              />
            )}

            {activeTab === 'subscription' && (
              <SubscriptionTab 
                subscription={subscription}
                subscriptionPlans={subscriptionPlans}
                paymentMethods={paymentMethods}
                loading={loading}
                formatCurrency={formatCurrency}
                formatDate={formatDate}
                onSubscribe={handleSubscribe}
              />
            )}

            {activeTab === 'analytics' && (
              <AnalyticsTab 
                loads={loads}
                formatCurrency={formatCurrency}
              />
            )}
          </div>
        </div>
      </div>

      {/* Modals */}
      <LoadFormModal 
        showLoadForm={showLoadForm}
        editingLoad={editingLoad}
        loadForm={loadForm}
        setLoadForm={setLoadForm}
        loading={loading}
        onSubmit={handleCreateLoad}
        onClose={() => {
          setShowLoadForm(false);
          setEditingLoad(null);
        }}
        resetForm={resetForm}
        user={user}
      />

      <ProfileModal 
        showProfileModal={showProfileModal}
        profileForm={profileForm}
        setProfileForm={setProfileForm}
        loading={loading}
        onSubmit={handleUpdateProfile}
        onClose={() => setShowProfileModal(false)}
        onDeleteProfile={handleDeleteProfile}
        onDeactivateProfile={handleDeactivateProfile}
      />

      <SubscriptionModal 
        showSubscriptionModal={showSubscriptionModal}
        subscription={subscription}
        subscriptionPlans={subscriptionPlans}
        paymentMethods={paymentMethods}
        loading={loading}
        formatCurrency={formatCurrency}
        onSubscribe={handleSubscribe}
        onClose={() => setShowSubscriptionModal(false)}
      />

      <ConfirmationDialog 
        confirmDialog={confirmDialog}
        setConfirmDialog={setConfirmDialog}
      />
    </div>
  );
};

export default CargoOwnerDashboard;