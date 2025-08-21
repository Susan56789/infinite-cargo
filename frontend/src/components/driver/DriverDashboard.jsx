import React, { useState, useEffect, useCallback } from 'react';
import { AlertCircle, Loader, RefreshCw } from 'lucide-react';

// Import child components
import DashboardHeader from './DashboardHeader';
import StatsGrid from './StatsGrid';
import ActiveJobsSection from './ActiveJobsSection';
import AvailableLoadsSection from './AvailableLoadsSection';
import MyBidsSection from './MyBidsSection';
import SidebarSection from './SidebarSection';

// Import auth utilities
import { authManager, getUser, isAuthenticated, getAuthHeader, getUserType, logout } from '../../utils/auth';

const DriverDashboard = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  
  // Separate loading states for different sections
  const [loadingStates, setLoadingStates] = useState({
    profile: false,
    bookings: false,
    loads: false,
    bids: false,
    stats: false
  });

  const [dashboardData, setDashboardData] = useState({
    activeBookings: [],
    availableLoads: [],
    completedBookings: [],
    myBids: [],
    earnings: {
      thisMonth: 0,
      lastMonth: 0,
      total: 0
    },
    stats: {
      totalJobs: 0,
      activeJobs: 0,
      completedJobs: 0,
      completionRate: 0,
      successRate: 0,
      rating: 0,
      totalBids: 0,
      acceptedBids: 0,
      monthlyEarnings: 0
    }
  });
  
  const [notifications, setNotifications] = useState([]);
  const [availabilityUpdating, setAvailabilityUpdating] = useState(false);


  // Get auth headers using AuthManager
  const getAuthHeaders = useCallback(() => {
    return {
      ...getAuthHeader(),
      'Content-Type': 'application/json'
    };
  }, []);

  // Handle authentication check
  const checkAuth = useCallback(() => {
    if (!isAuthenticated() || getUserType() !== 'driver') {
      window.location.href = '/login';
      return false;
    }
    return true;
  }, []);

  // Handle API errors
  const handleApiError = useCallback(async (response, context = '') => {
    if (response.status === 401) {
      console.log(`Authentication failed in ${context}`);
      handleLogout();
      return true;
    }
    return false;
  }, []);

  // Fetch user profile
  const fetchUserProfile = useCallback(async () => {
    setLoadingStates(prev => ({ ...prev, profile: true }));
    
    try {
      const response = await fetch('https://infinite-cargo-api.onrender.com/api/users/me', {
        headers: getAuthHeaders()
      });

      if (await handleApiError(response, 'fetchUserProfile')) return;

      if (response.ok) {
        const userData = await response.json();
        const userInfo = userData.user || userData.data || userData;
        
        setUser(userInfo);
        authManager.setAuth(
          authManager.getToken(), 
          userInfo, 
          localStorage.getItem('infiniteCargoRememberMe') === 'true'
        );
      } else {
        console.error('Failed to fetch user profile:', response.status);
      }
    } catch (error) {
      console.error('Error fetching user profile:', error);
    } finally {
      setLoadingStates(prev => ({ ...prev, profile: false }));
    }
  }, [getAuthHeaders, handleApiError]);

  // Fetch driver statistics
  const fetchDriverStats = useCallback(async () => {
  setLoadingStates(prev => ({ ...prev, stats: true }));
  
  try {
    const response = await fetch('https://infinite-cargo-api.onrender.com/api/drivers/stats', {
      headers: getAuthHeaders()
    });

    if (await handleApiError(response, 'fetchDriverStats')) return;

    if (response.ok) {
      const statsData = await response.json();
      const stats = statsData.data?.stats || {};
      const earnings = statsData.data?.earnings || {};
      
      setDashboardData(prev => ({
        ...prev,
        stats: {
          totalJobs: stats.totalJobs || 0,
          activeJobs: stats.activeJobs || 0,
          completedJobs: stats.completedJobs || 0,
          completionRate: stats.completionRate || stats.successRate || 0,
          successRate: stats.successRate || stats.completionRate || 0,
          rating: Math.round((stats.rating || stats.averageRating || 0) * 10) / 10,
          totalBids: stats.totalBids || 0,
          acceptedBids: stats.acceptedBids || 0,
          monthlyEarnings: stats.monthlyEarnings || earnings.thisMonth || 0
        },
        earnings: {
          thisMonth: earnings.thisMonth || stats.monthlyEarnings || 0,
          lastMonth: earnings.lastMonth || 0,
          total: earnings.total || stats.totalEarnings || 0
        }
      }));
    } else {
      console.error('Failed to fetch driver stats:', response.status);
    }
  } catch (error) {
    console.error('Error fetching driver stats:', error);
  } finally {
    setLoadingStates(prev => ({ ...prev, stats: false }));
  }
}, [getAuthHeaders, handleApiError]);

  // Fetch driver bookings
  const fetchDriverBookings = useCallback(async () => {
  setLoadingStates(prev => ({ ...prev, bookings: true }));
  
  try {
    const response = await fetch('https://infinite-cargo-api.onrender.com/api/bookings/driver', {
      headers: getAuthHeaders()
    });

    if (await handleApiError(response, 'fetchDriverBookings')) return;

    if (response.ok) {
      const bookingsData = await response.json();
      const bookings = bookingsData.data?.bookings || bookingsData.bookings || [];
      
      setDashboardData(prev => ({
        ...prev,
        activeBookings: bookings
          .filter(booking => 
            ['accepted', 'in_progress', 'driver_assigned', 'assigned', 'picked_up', 'in_transit'].includes(booking.status)
          )
          .slice(0, 10)
          .map(booking => ({
            _id: booking._id,
            title: booking.title || booking.loadTitle || 'Transport Job',
            pickupLocation: booking.pickupLocation || booking.origin || 'Pickup Location',
            deliveryLocation: booking.deliveryLocation || booking.destination || 'Delivery Location',
            cargoType: booking.cargoType || booking.loadType || 'General Cargo',
            budget: booking.totalAmount || booking.agreedAmount || booking.price || 0,
            price: booking.totalAmount || booking.agreedAmount || booking.price || 0,
            status: booking.status,
            pickupDate: booking.pickupDate || booking.scheduledPickupDate || booking.createdAt,
            createdAt: booking.createdAt,
            updatedAt: booking.updatedAt
          })),
        completedBookings: bookings
          .filter(booking => booking.status === 'completed')
          .slice(0, 5)
      }));
    } else {
      console.error('Failed to fetch driver bookings:', response.status);
    }
  } catch (error) {
    console.error('Error fetching driver bookings:', error);
  } finally {
    setLoadingStates(prev => ({ ...prev, bookings: false }));
  }
}, [getAuthHeaders, handleApiError]);

  // Fetch available loads
  const fetchAvailableLoads = useCallback(async () => {
    setLoadingStates(prev => ({ ...prev, loads: true }));
    
    try {
      const userLocation = user?.location || user?.coordinates || '';
      const locationParam = typeof userLocation === 'string' 
        ? userLocation 
        : user?.location || '';

      const response = await fetch(
        `https://infinite-cargo-api.onrender.com/api/loads?limit=20&status=active&location=${encodeURIComponent(locationParam)}`, 
        { headers: getAuthHeaders() }
      );

      if (await handleApiError(response, 'fetchAvailableLoads')) return;

      if (response.ok) {
        const loadsData = await response.json();
        const loads = loadsData.data?.loads || loadsData.loads || [];
        
        setDashboardData(prev => ({
          ...prev,
          availableLoads: loads.slice(0, 10)
        }));
      } else {
        console.error('Failed to fetch available loads:', response.status);
      }
    } catch (error) {
      console.error('Error fetching available loads:', error);
    } finally {
      setLoadingStates(prev => ({ ...prev, loads: false }));
    }
  }, [getAuthHeaders, handleApiError, user?.location, user?.coordinates]);

  // Fetch driver bids
  const fetchDriverBids = useCallback(async () => {
    setLoadingStates(prev => ({ ...prev, bids: true }));
    
    try {
      const response = await fetch('https://infinite-cargo-api.onrender.com/api/bids', {
        headers: getAuthHeaders()
      });

      if (await handleApiError(response, 'fetchDriverBids')) return;

      if (response.ok) {
        const bidsData = await response.json();
        const bids = bidsData.data?.bids || bidsData.bids || [];
        
        setDashboardData(prev => ({
          ...prev,
          myBids: bids.slice(0, 10)
        }));
      } else {
        console.error('Failed to fetch driver bids:', response.status);
      }
    } catch (error) {
      console.error('Error fetching driver bids:', error);
    } finally {
      setLoadingStates(prev => ({ ...prev, bids: false }));
    }
  }, [getAuthHeaders, handleApiError]);

  // Fetch notifications
  const fetchNotifications = useCallback(async () => {
    try {
      const response = await fetch('https://infinite-cargo-api.onrender.com/api/notifications', {
        headers: getAuthHeaders()
      });

      if (await handleApiError(response, 'fetchNotifications')) return;

      if (response.ok) {
        const notifData = await response.json();
        setNotifications(notifData.data?.notifications || notifData.notifications || []);
      } else if (response.status !== 404) {
        console.error('Failed to fetch notifications:', response.status);
      }
    } catch (error) {
      console.log('Notifications not available:', error);
      setNotifications([]);
    }
  }, [getAuthHeaders, handleApiError]);

  // Comprehensive dashboard data fetch using the new dashboard endpoint
 const fetchDashboardData = useCallback(async (showLoader = true) => {
  if (showLoader) {
    setLoading(true);
  } else {
    setRefreshing(true);
  }
  
  setError('');
  
  try {
    // Try the comprehensive dashboard endpoint first
    const dashboardResponse = await fetch('https://infinite-cargo-api.onrender.com/api/drivers/dashboard', {
      headers: getAuthHeaders()
    });

    if (await handleApiError(dashboardResponse, 'fetchDashboardData')) return;

    if (dashboardResponse.ok) {
      const dashboardData = await dashboardResponse.json();
      const data = dashboardData.data;
      
      // Update user info
      if (data.driver) {
        setUser(data.driver);
        authManager.setAuth(
          authManager.getToken(), 
          data.driver, 
          localStorage.getItem('infiniteCargoRememberMe') === 'true'
        );
      }

      // Update dashboard data with proper field mapping
      setDashboardData(prev => ({
        ...prev,
        // Map active bookings with consistent field names
        activeBookings: (data.activeBookings || []).map(booking => ({
          _id: booking._id,
          title: booking.title || booking.loadTitle || 'Transport Job',
          pickupLocation: booking.pickupLocation || booking.origin || 'Pickup Location',
          deliveryLocation: booking.deliveryLocation || booking.destination || 'Delivery Location',
          cargoType: booking.cargoType || booking.loadType || 'General Cargo',
          budget: booking.totalAmount || booking.agreedAmount || booking.price || 0,
          price: booking.totalAmount || booking.agreedAmount || booking.price || 0,
          status: booking.status,
          pickupDate: booking.pickupDate || booking.scheduledPickupDate || booking.createdAt,
          createdAt: booking.createdAt,
          updatedAt: booking.updatedAt
        })),
        
        // Map available loads
        availableLoads: (data.availableLoads || []).map(load => ({
          _id: load._id,
          title: load.title || 'Transport Required',
          pickupLocation: load.pickupLocation || load.origin || 'Pickup Location',
          deliveryLocation: load.deliveryLocation || load.destination || 'Delivery Location',
          cargoType: load.cargoType || load.loadType || 'General Cargo',
          weight: load.weight || load.estimatedWeight || 0,
          estimatedAmount: load.estimatedAmount || load.budget || 0,
          pickupDate: load.pickupDate || load.scheduledPickupDate,
          deliveryDate: load.deliveryDate || load.scheduledDeliveryDate,
          description: load.description,
          urgency: load.urgency || 'normal',
          bidCount: load.bidCount || 0,
          createdAt: load.createdAt
        })),
        
        completedBookings: data.completedBookings || [],
        
        // Map bids data
        myBids: (data.myBids || []).map(bid => ({
          _id: bid._id,
          loadId: bid.loadId,
          bidAmount: bid.bidAmount,
          status: bid.status,
          message: bid.message,
          createdAt: bid.createdAt,
          updatedAt: bid.updatedAt,
          loadTitle: bid.loadInfo?.title || bid.loadTitle || 'Load',
          pickupLocation: bid.loadInfo?.pickupLocation || bid.pickupLocation,
          deliveryLocation: bid.loadInfo?.deliveryLocation || bid.deliveryLocation,
          estimatedAmount: bid.loadInfo?.estimatedAmount || bid.estimatedAmount
        })),
        
        // Update stats with proper mapping
        stats: {
          totalJobs: data.stats?.totalJobs || 0,
          activeJobs: data.stats?.activeJobs || 0,
          completedJobs: data.stats?.completedJobs || 0,
          completionRate: data.stats?.completionRate || data.stats?.successRate || 0,
          successRate: data.stats?.successRate || data.stats?.completionRate || 0,
          rating: data.stats?.rating || data.stats?.averageRating || 0,
          totalBids: data.stats?.totalBids || 0,
          acceptedBids: data.stats?.acceptedBids || 0,
          monthlyEarnings: data.stats?.monthlyEarnings || data.earnings?.thisMonth || 0
        },
        
        // Update earnings
        earnings: {
          thisMonth: data.earnings?.thisMonth || 0,
          lastMonth: data.earnings?.lastMonth || 0,
          total: data.earnings?.total || 0
        }
      }));

      setNotifications(data.notifications || []);

    } else {
      console.log('Dashboard endpoint failed, using individual calls');
      // Fallback to individual API calls
      await Promise.all([
        fetchUserProfile(),
        fetchDriverStats(),
        fetchDriverBookings(),
        fetchAvailableLoads(),
        fetchDriverBids(),
        fetchNotifications()
      ]);
    }

  } catch (error) {
    console.error('Error fetching dashboard data:', error);
    setError('Failed to load dashboard data');
    
    // Try individual calls as fallback
    try {
      await Promise.all([
        fetchUserProfile(),
        fetchDriverStats(),
        fetchDriverBookings(),
        fetchAvailableLoads(),
        fetchDriverBids(),
        fetchNotifications()
      ]);
    } catch (fallbackError) {
      console.error('Fallback fetch also failed:', fallbackError);
      setError('Failed to load dashboard data');
    }
  } finally {
    setLoading(false);
    setRefreshing(false);
  }
}, [
  getAuthHeaders, 
  handleApiError,
  fetchUserProfile,
  fetchDriverStats,
  fetchDriverBookings,
  fetchAvailableLoads,
  fetchDriverBids,
  fetchNotifications
]);

  // Initial load and auth setup
  useEffect(() => {
    if (!checkAuth()) return;

    const userData = getUser();
    if (userData) {
      setUser(userData);
    }
    
    fetchDashboardData();
  }, [checkAuth, fetchDashboardData]);

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

  // Auto-refresh dashboard data every 5 minutes
  useEffect(() => {
    const autoRefreshInterval = setInterval(() => {
      if (isAuthenticated()) {
        fetchDashboardData(false); // Refresh without showing loader
      }
    }, 5 * 60 * 1000); // 5 minutes

    return () => clearInterval(autoRefreshInterval);
  }, [fetchDashboardData]);

  // Toggle driver availability
  const toggleAvailability = async () => {
    if (!user) return;
    
    setAvailabilityUpdating(true);
    try {
      const response = await fetch('https://infinite-cargo-api.onrender.com/api/drivers/availability', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          isAvailable: !user.driverProfile?.isAvailable
        })
      });

      if (await handleApiError(response, 'toggleAvailability')) return;

      if (response.ok) {
        const data = await response.json();
        const updatedUser = {
          ...user,
          driverProfile: {
            ...user.driverProfile,
            isAvailable: data.data.isAvailable
          }
        };
        
        setUser(updatedUser);
        authManager.setAuth(
          authManager.getToken(), 
          updatedUser, 
          localStorage.getItem('infiniteCargoRememberMe') === 'true'
        );
      } else {
        const errorData = await response.json();
        setError(`Failed to update availability: ${errorData.message}`);
      }
    } catch (error) {
      console.error('Error updating availability:', error);
      setError('Failed to update availability');
    } finally {
      setAvailabilityUpdating(false);
    }
  };

  // Place a bid on a load
const placeBid = async (bidData) => {
  try {
    const headers = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...getAuthHeader()  
    };

    const response = await fetch(
      'https://infinite-cargo-api.onrender.com/api/drivers/bid',
      {
        method: 'POST',
        headers,
        body: JSON.stringify(bidData)
      }
    );

    if (response.status === 401 || response.status === 403) {
      setError('Authentication failed. Please login again.');
      handleLogout();
      return false;
    }

    if (!response.ok) {
      const resJSON = await response.json().catch(() => ({}));
      const msg = resJSON.message || 'Failed to place bid';
      setError(msg);
      return false;
    }

    // Bid success
    await fetchDriverBids();
    await fetchAvailableLoads();

    return true;
  } catch (error) {
    console.error('Error placing bid:', error);
    setError('Network error. Please try again.');
    return false;
  }
};


  // Update driver location
  const updateDriverLocation = async (latitude, longitude) => {
    try {
      const response = await fetch('https://infinite-cargo-api.onrender.com/api/drivers/location', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ latitude, longitude })
      });

      if (await handleApiError(response, 'updateDriverLocation')) {
        return { success: false, error: 'Authentication failed' };
      }

      if (response.ok) {
        const result = await response.json();
        
        // Update user location in state
        const updatedUser = {
          ...user,
          coordinates: result.data.coordinates
        };
        
        setUser(updatedUser);
        authManager.setAuth(
          authManager.getToken(), 
          updatedUser, 
          localStorage.getItem('infiniteCargoRememberMe') === 'true'
        );
        
        // Refresh available loads based on new location
        await fetchAvailableLoads();
        return { success: true };
        
      } else {
        const errorData = await response.json();
        return { success: false, error: errorData.message || 'Failed to update location' };
      }
    } catch (error) {
      console.error('Error updating location:', error);
      return { success: false, error: 'Failed to update location' };
    }
  };

  // Handle logout
  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Logout error:', error);
      authManager.clearAuth();
      window.location.href = '/login';
    }
  };

  // Utility functions
  const getStatusColor = (status) => {
    const statusColors = {
      active: 'bg-green-100 text-green-800',
      pending: 'bg-yellow-100 text-yellow-800',
      in_progress: 'bg-blue-100 text-blue-800',
      driver_assigned: 'bg-blue-100 text-blue-800',
      completed: 'bg-gray-100 text-gray-800',
      cancelled: 'bg-red-100 text-red-800',
      submitted: 'bg-blue-100 text-blue-800',
      accepted: 'bg-green-100 text-green-800',
      rejected: 'bg-red-100 text-red-800'
    };
    return statusColors[status] || 'bg-gray-100 text-gray-800';
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
      minimumFractionDigits: 0
    }).format(amount || 0);
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Not specified';
    return new Date(dateString).toLocaleDateString('en-KE', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  // Auto-update location if geolocation is available
  useEffect(() => {
    if (user && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          if (!user.coordinates || 
              Math.abs(user.coordinates.latitude - latitude) > 0.01 || 
              Math.abs(user.coordinates.longitude - longitude) > 0.01) {
            updateDriverLocation(latitude, longitude);
          }
        },
        (error) => {
          console.log('Geolocation error:', error);
        }
      );
    }
  }, [user]);

  // Manual refresh function
  const handleRefresh = () => {
    fetchDashboardData(false);
  };

  // Loading screen
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader className="mx-auto h-12 w-12 text-blue-600 animate-spin" />
          <p className="mt-4 text-gray-600">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  // Error screen
  if (error && !user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto">
          <AlertCircle className="mx-auto h-12 w-12 text-red-600" />
          <h3 className="mt-4 text-lg font-semibold text-gray-900">Something went wrong</h3>
          <p className="mt-2 text-gray-600">{error}</p>
          <button 
            onClick={() => fetchDashboardData()}
            className="mt-4 inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <RefreshCw size={16} className="mr-2" />
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <DashboardHeader 
        user={user}
        toggleAvailability={toggleAvailability}
        availabilityUpdating={availabilityUpdating}
        notifications={notifications}
        onRefresh={handleRefresh}
        refreshing={refreshing}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Error banner */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex">
              <AlertCircle className="h-5 w-5 text-red-400" />
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">Error</h3>
                <p className="mt-1 text-sm text-red-700">{error}</p>
              </div>
              <button
                onClick={() => setError('')}
                className="ml-auto text-red-400 hover:text-red-600"
              >
                ×
              </button>
            </div>
          </div>
        )}

        {/* Stats Grid */}
        <StatsGrid 
          dashboardData={dashboardData} 
          formatCurrency={formatCurrency}
          loading={loadingStates.stats}
        />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-8">
            {/* Active Jobs */}
            <ActiveJobsSection 
              activeBookings={dashboardData.activeBookings}
              formatCurrency={formatCurrency}
              formatDate={formatDate}
              getStatusColor={getStatusColor}
              loading={loadingStates.bookings}
            />

            {/* Available Loads */}
            <AvailableLoadsSection 
              availableLoads={dashboardData.availableLoads}
              onBidPlace={placeBid}
              formatCurrency={formatCurrency}
              formatDate={formatDate}
              loading={loadingStates.loads}
            />

            {/* My Bids */}
            <MyBidsSection 
              myBids={dashboardData.myBids}
              formatCurrency={formatCurrency}
              formatDate={formatDate}
              getStatusColor={getStatusColor}
              loading={loadingStates.bids}
            />
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1">
            <SidebarSection 
              user={user}
              dashboardData={dashboardData}
              formatDate={formatDate}
              formatCurrency={formatCurrency}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default DriverDashboard;