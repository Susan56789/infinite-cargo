import React, { useState, useEffect } from 'react';
import { 
  Plus, Crown, BarChart3, Package, Users, PieChart, 
  CheckCircle2, AlertTriangle, Clock, Loader2
} from 'lucide-react';

// Import child components
import DashboardHeader from './DashboardHeader';
import StatsCards from './StatsCards';
import SubscriptionStatusCard from './SubscriptionStatusCard';
import LoadFormModal from './LoadFormModal';
import OverviewTab from './OverviewTab';
import LoadsTab from './LoadsTab';
import BidsTab from './BidsTab';
import SubscriptionTab from './SubscriptionTab';
import AnalyticsTab from './AnalyticsTab';
import ProfileModal from './ProfileModal';
import SubscriptionModal from './SubscriptionModal';
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
    isUrgent: false
  });

  // Profile form state
  const [profileForm, setProfileForm] = useState({
    name: '',
    email: '',
    phone: '',
    companyName: '',
    location: '',
    businessType: '',
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
      companyName: userData?.companyName || '',
      location: userData?.location || '',
      businessType: userData?.businessType || '',
      description: userData?.description || ''
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
        } else if (response.status === 401) {
          handleLogout();
          throw new Error('Authentication failed');
        } else if (response.status === 403) {
          console.warn('Subscription limits reached for this endpoint');
          return fallbackData;
        } else if (response.status === 500) {
          console.error('Server error occurred');
          return fallbackData;
        } else if (response.status === 503) {
          console.error('Service temporarily unavailable');
          return fallbackData;
        } else {
          try {
            const errorData = await response.json();
            console.warn(`API Error ${response.status}:`, errorData.message || 'Unknown error');
          } catch (jsonError) {
            console.warn(`API Error ${response.status}: Unable to parse error response`);
          }
          return fallbackData;
        }
      };

      // Fetch subscription status first
      let subscriptionData = null;
      try {
  const subscriptionResponse = await fetch(`${API_BASE_URL}/subscriptions/status`, {
    headers: authHeaders,
    timeout: 10000
  });
  
  subscriptionData = await handleResponse(subscriptionResponse, {
    plan: 'basic',
    planName: 'Basic Plan',
    remainingLoads: 3,
    features: { maxLoads: 3 },
    usage: { loadsThisMonth: 0, maxLoads: 3, remainingLoads: 3 },
    billing: { nextBillingDate: null, amount: 0, currency: 'KES' },
    status: 'inactive',
    isActive: false
  });
  
  if (subscriptionData) {
    setSubscription(subscriptionData);
  }
} catch (error) {
  console.warn('Could not fetch subscription status:', error.message);
  // Try alternative endpoint
  try {
    const altResponse = await fetch(`${API_BASE_URL}/cargo-owners/subscription`, {
      headers: authHeaders,
      timeout: 10000
    });
    
    subscriptionData = await handleResponse(altResponse, {
      plan: 'basic',
      planName: 'Basic Plan',
      remainingLoads: 3,
      features: { maxLoads: 3 },
      usage: { loadsThisMonth: 0, maxLoads: 3, remainingLoads: 3 },
      billing: { nextBillingDate: null, amount: 0, currency: 'KES' },
      status: 'inactive',
      isActive: false
    });
    
    if (subscriptionData) {
      setSubscription(subscriptionData);
    }
  } catch (altError) {
    console.warn('Alternative subscription endpoint also failed:', altError.message);
    setSubscription({
      plan: 'basic',
      planName: 'Basic Plan',
      remainingLoads: 3,
      features: { maxLoads: 3 },
      usage: { loadsThisMonth: 0, maxLoads: 3, remainingLoads: 3 },
      billing: { nextBillingDate: null, amount: 0, currency: 'KES' },
      status: 'inactive',
      isActive: false
    });
  }
}

      // Fetch loads data
      let loadsData = [];
      try {
        const loadsResponse = await fetch(`${API_BASE_URL}/loads/user/my-loads?limit=50`, {
          headers: authHeaders,
          timeout: 10000
        });
        
        if (loadsResponse.status === 403) {
          console.log('Using fallback loads endpoint due to subscription limits');
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

      // Try to fetch enhanced analytics
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

      // Fetch subscription plans
      try {
        const plansResponse = await fetch(`${API_BASE_URL}/subscriptions/plans`, {
          headers: authHeaders,
          timeout: 8000
        });
        const plansData = await handleResponse(plansResponse, { plans: {} });
        setSubscriptionPlans(plansData?.plans || {});
      } catch (error) {
        console.warn('Could not fetch subscription plans:', error.message);
        setSubscriptionPlans({});
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

  const handleCreateLoad = async (e) => {
    e.preventDefault();

    if (!loadForm.title || loadForm.title.trim().length < 5) {
      setError('Title must be at least 5 characters long');
      return;
    }

    if (!loadForm.description || loadForm.description.trim().length < 10) {
      setError('Description must be at least 10 characters long');
      return;
    }

    if (subscription && subscription.features?.maxLoads !== -1 && !editingLoad) {
      const now = new Date();
      const thisMonthLoads = loads.filter(l => {
        const d = new Date(l.createdAt);
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      }).length;

      if (thisMonthLoads >= subscription.features.maxLoads) {
        setError(`You've reached your monthly limit of ${subscription.features.maxLoads} loads.`);
        return;
      }
    }

    const payload = {
      ...loadForm,
      weight: parseFloat(loadForm.weight),
      vehicleCapacityRequired: parseFloat(loadForm.vehicleCapacityRequired),
      budget: parseFloat(loadForm.budget),
      pickupDate: new Date(loadForm.pickupDate).toISOString(),
      deliveryDate: new Date(loadForm.deliveryDate).toISOString(),
    };

    try {
      setLoading(true);
      setError('');

      const method = editingLoad ? 'PUT' : 'POST';
      const url = editingLoad
        ? `${API_BASE_URL}/loads/${editingLoad}`
        : `${API_BASE_URL}/loads`;

      const response = await fetch(url, {
        method,
        headers: getAuthHeaders(),
        body: JSON.stringify(payload),
      });

      if (response.status === 401) {
        handleLogout();
        return;
      }

      const data = await response.json();

      if (response.ok) {
        setSuccess(`Load ${editingLoad ? 'updated' : 'created'} successfully!`);
        setShowLoadForm(false);
        setEditingLoad(null);
        resetForm();
        await fetchDashboardData();
        window.dispatchEvent(new Event('authStateChanged'));
      } else {
        if (data.errors && Array.isArray(data.errors)) {
          const firstError = data.errors[0]?.message || '';
          setError(firstError);
        } else {
          setError(data.message || `Failed to ${editingLoad ? 'update' : 'create'} load`);
        }
      }

    } catch (error) {
      console.error('Error submitting load:', error);
      setError(`Failed to ${editingLoad ? 'update' : 'create'} load: ${error.message}`);

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
      'cancelled': 'cancel'
    };

    setConfirmDialog({
      show: true,
      message: `Are you sure you want to ${statusMessages[newStatus] || 'update'} this load?`,
      onConfirm: async () => {
        try {
          const response = await fetch(`${API_BASE_URL}/loads/${loadId}/status`, {
            method: 'PATCH',
            headers: getAuthHeaders(),
            body: JSON.stringify({ status: newStatus })
          });

          if (response.status === 401) {
            handleLogout();
            return;
          }

          if (response.ok) {
            setSuccess(`Load ${statusMessages[newStatus]} successfully!`);
            await fetchDashboardData();
          } else {
            const data = await response.json();
            setError(data.message || 'Failed to update load status');
          }
        } catch (error) {
          console.error('Error updating load status:', error);
          setError(`Failed to update load status: ${error.message}`);
        }
        setConfirmDialog({ show: false, message: '', onConfirm: null });
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
      const response = await fetch(`${API_BASE_URL}/bids/${bidId}/accept`, {
        method: 'POST',
        headers: getAuthHeaders()
      });

      if (response.status === 401) {
        handleLogout();
        return;
      }

      if (response.ok) {
        setSuccess('Bid accepted successfully!');
        await fetchDashboardData();
      } else {
        const data = await response.json();
        setError(data.message || 'Failed to accept bid');
      }
    } catch (error) {
      console.error('Error accepting bid:', error);
      setError(`Failed to accept bid: ${error.message}`);
    }
  };

  const handleRejectBid = async (bidId) => {
    try {
      const response = await fetch(`${API_BASE_URL}/bids/${bidId}/reject`, {
        method: 'POST',
        headers: getAuthHeaders()
      });

      if (response.status === 401) {
        handleLogout();
        return;
      }

      if (response.ok) {
        setSuccess('Bid rejected successfully!');
        await fetchDashboardData();
      } else {
        const data = await response.json();
        setError(data.message || 'Failed to reject bid');
      }
    } catch (error) {
      console.error('Error rejecting bid:', error);
      setError(`Failed to reject bid: ${error.message}`);
    }
  };

  const handleSubscribe = async (planId, paymentMethod) => {
    try {
      setLoading(true);
      setError('');
      
      if (!planId) {
        setError('Plan ID is required');
        return;
      }
      
      if (!paymentMethod) {
        setError('Payment method is required');
        return;
      }

      const requestPayload = {
        planId: planId,
        paymentMethod: paymentMethod,
        paymentDetails: {
          timestamp: new Date().toISOString(),
          ...(paymentMethod === 'mpesa' && user?.phone && { phoneNumber: user.phone })
        },
        billingCycle: 'monthly'
      };

      const response = await fetch(`${API_BASE_URL}/subscriptions/subscribe`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(requestPayload)
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess(data.message || 'Subscription request created successfully!');
        setShowSubscriptionModal(false);
        await fetchDashboardData();
        
        if (data.data?.paymentInstructions) {
          console.log('Payment instructions:', data.data.paymentInstructions);
        }
        
      } else {
        if (response.status === 400) {
          setError(data.message || 'Invalid subscription request. Please check your details.');
          if (data.errors) {
            console.error('Validation errors:', data.errors);
            const errorMessages = data.errors.map(err => err.msg).join(', ');
            setError(`Validation failed: ${errorMessages}`);
          }
        } else if (response.status === 401) {
          handleLogout();
          return;
        } else if (response.status === 403) {
          setError('Access denied. Only cargo owners can subscribe to plans.');
        } else {
          setError(data.message || 'Failed to create subscription request');
        }
      }
    } catch (error) {
      console.error('Error subscribing:', error);
      setError(`Failed to subscribe: ${error.message || 'Network error occurred'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/cargo-owners/profile`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(profileForm)
      });

      if (response.status === 401) {
        handleLogout();
        return;
      }

      const data = await response.json();

      if (response.ok) {
        setUser({ ...user, ...profileForm });
        setSuccess('Profile updated successfully!');
        setShowProfileModal(false);
      } else {
        setError(data.message || 'Failed to update profile');
      }
    } catch (error) {
      console.error('Error updating profile:', error);
      setError(`Failed to update profile: ${error.message}`);
    } finally {
      setLoading(false);
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

  const getSubscriptionStatus = () => {
    if (!subscription) {
      return { status: 'basic', color: 'text-gray-600', icon: Package };
    }

    if (subscription.status === 'active') {
      return { 
        status: subscription.planName || 'Active', 
        color: 'text-green-600', 
        icon: CheckCircle2 
      };
    }

    if (subscription.status === 'pending') {
      return { 
        status: 'Pending Approval', 
        color: 'text-yellow-600', 
        icon: Clock 
      };
    }

    return { 
      status: subscription.status || 'Unknown', 
      color: 'text-red-600', 
      icon: AlertTriangle 
    };
  };

  const canPostLoads = () => {
    if (!subscription || subscription.status !== 'active') {
      return subscription?.planId === 'basic';
    }

    if (subscription.features?.maxLoads === -1) return true;

    const currentMonthLoads = loads.filter(load => {
      const loadDate = new Date(load.createdAt);
      const now = new Date();
      return loadDate.getMonth() === now.getMonth() && loadDate.getFullYear() === now.getFullYear();
    }).length;

    return currentMonthLoads < subscription.features.maxLoads;
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
      {/* Header */}
      <DashboardHeader 
        user={user}
        subscription={subscription}
        notifications={notifications}
        onProfileClick={() => setShowProfileModal(true)}
        onLogout={handleLogout}
        getSubscriptionStatus={getSubscriptionStatus}
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
              />
            )}

            {activeTab === 'subscription' && (
              <SubscriptionTab 
                subscription={subscription}
                subscriptionPlans={subscriptionPlans}
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
      />

      <ProfileModal 
        showProfileModal={showProfileModal}
        profileForm={profileForm}
        setProfileForm={setProfileForm}
        loading={loading}
        onSubmit={handleUpdateProfile}
        onClose={() => setShowProfileModal(false)}
      />

      <SubscriptionModal 
        showSubscriptionModal={showSubscriptionModal}
        subscription={subscription}
        subscriptionPlans={subscriptionPlans}
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