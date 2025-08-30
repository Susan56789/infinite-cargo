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
  const [successMessage, setSuccessMessage] = useState('');
  
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

  //  Fetch driver statistics with better error handling and data mapping
  const fetchDriverStats = useCallback(async () => {
    setLoadingStates(prev => ({ ...prev, stats: true }));
    
    try {
      const response = await fetch('https://infinite-cargo-api.onrender.com/api/drivers/stats', {
        headers: getAuthHeaders()
      });

      if (await handleApiError(response, 'fetchDriverStats')) return;

      if (response.ok) {
        const result = await response.json();
        
        // Handle both nested and flat response structures
        const statsData = result.data?.stats || result.stats || result.data || {};
        const earningsData = result.data?.earnings || result.earnings || {};
        
        // Map all possible field variations
        const mappedStats = {
          totalJobs: statsData.totalJobs || statsData.total_jobs || 0,
          activeJobs: statsData.activeJobs || statsData.active_jobs || 0,
          completedJobs: statsData.completedJobs || statsData.completed_jobs || 0,
          cancelledJobs: statsData.cancelledJobs || statsData.cancelled_jobs || 0,
          completionRate: statsData.completionRate || statsData.completion_rate || statsData.successRate || statsData.success_rate || 0,
          successRate: statsData.successRate || statsData.success_rate || statsData.completionRate || statsData.completion_rate || 0,
          rating: statsData.rating || statsData.averageRating || statsData.average_rating || 0,
          averageRating: statsData.averageRating || statsData.average_rating || statsData.rating || 0,
          totalBids: statsData.totalBids || statsData.total_bids || 0,
          acceptedBids: statsData.acceptedBids || statsData.accepted_bids || 0,
          pendingBids: statsData.pendingBids || statsData.pending_bids || 0,
          monthlyEarnings: statsData.monthlyEarnings || statsData.monthly_earnings || earningsData.thisMonth || earningsData.this_month || 0,
          totalEarnings: statsData.totalEarnings || statsData.total_earnings || earningsData.total || 0
        };

        const mappedEarnings = {
          thisMonth: earningsData.thisMonth || earningsData.this_month || mappedStats.monthlyEarnings || 0,
          lastMonth: earningsData.lastMonth || earningsData.last_month || 0,
          total: earningsData.total || mappedStats.totalEarnings || 0,
          yearly: earningsData.yearly || earningsData.year || 0
        };

        
        setDashboardData(prev => ({
          ...prev,
          stats: mappedStats,
          earnings: mappedEarnings
        }));
      } else {
        console.error('Failed to fetch driver stats:', response.status, response.statusText);
        
        // Set default stats on error
        setDashboardData(prev => ({
          ...prev,
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
          },
          earnings: {
            thisMonth: 0,
            lastMonth: 0,
            total: 0
          }
        }));
      }
    } catch (error) {
      console.error('Error fetching driver stats:', error);
      // Set default stats on error
      setDashboardData(prev => ({
        ...prev,
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
        },
        earnings: {
          thisMonth: 0,
          lastMonth: 0,
          total: 0
        }
      }));
    } finally {
      setLoadingStates(prev => ({ ...prev, stats: false }));
    }
  }, [getAuthHeaders, handleApiError]);

  //  Fetch active jobs using dedicated endpoint with comprehensive status matching
  const fetchActiveJobs = useCallback(async () => {
    setLoadingStates(prev => ({ ...prev, bookings: true }));
    
    try {
       
      // Use the dedicated active jobs endpoint
      const response = await fetch('https://infinite-cargo-api.onrender.com/api/drivers/active-jobs', {
        headers: getAuthHeaders()
      });

      if (await handleApiError(response, 'fetchActiveJobs')) return;

      if (response.ok) {
        const result = await response.json();
        
        
        const activeJobs = result.data?.activeJobs || result.activeJobs || result.data || [];
        
        // Ensure consistent data structure for frontend
        const formattedJobs = activeJobs.map(job => ({
          _id: job._id,
          bidId: job.bidId,
          loadId: job.loadId,
          title: job.title || job.loadTitle || 'Transport Job',
          pickupLocation: job.pickupLocation || job.origin || 'Pickup Location',
          deliveryLocation: job.deliveryLocation || job.destination || 'Delivery Location',
          cargoType: job.cargoType || job.loadType || 'General Cargo',
          budget: job.budget || job.totalAmount || job.agreedAmount || job.price || 0,
          price: job.price || job.totalAmount || job.agreedAmount || job.budget || 0,
          totalAmount: job.totalAmount || job.agreedAmount || job.price || job.budget || 0,
          status: job.status,
          statusDisplay: job.statusDisplay,
          pickupDate: job.pickupDate || job.scheduledPickupDate,
          deliveryDate: job.deliveryDate || job.scheduledDeliveryDate,
          assignedAt: job.assignedAt || job.acceptedAt || job.createdAt,
          createdAt: job.createdAt,
          updatedAt: job.updatedAt,
          cargoOwnerId: job.cargoOwnerId,
          isUrgent: job.isUrgent,
          priority: job.priority,
          availableActions: job.availableActions || []
        }));


        setDashboardData(prev => ({
          ...prev,
          activeBookings: formattedJobs
        }));
      } else {
        console.error('Failed to fetch active jobs:', response.status, response.statusText);
        
        // Fallback: try the regular bookings endpoint
        await fetchDriverBookingsFallback();
      }
    } catch (error) {
      console.error('Error fetching active jobs:', error);
      
      // Fallback: try the regular bookings endpoint
      await fetchDriverBookingsFallback();
    } finally {
      setLoadingStates(prev => ({ ...prev, bookings: false }));
    }
  }, [getAuthHeaders, handleApiError]);

  // Fallback method using regular bookings endpoint
  const fetchDriverBookingsFallback = useCallback(async () => {
    try {
      const response = await fetch('https://infinite-cargo-api.onrender.com/api/bookings/driver', {
        headers: getAuthHeaders()
      });

      if (await handleApiError(response, 'fetchDriverBookingsFallback')) return;

      if (response.ok) {
        const bookingsData = await response.json();
        const bookings = bookingsData.data?.bookings || bookingsData.bookings || [];
        
        
        // Filter for active statuses - comprehensive list
        const activeStatuses = [
          'assigned', 'accepted', 'driver_assigned',
          'confirmed', 'in_progress', 'started',
          'en_route_pickup', 'en_route_to_pickup', 'going_to_pickup',
          'arrived_pickup', 'at_pickup_location', 'at_pickup',
          'picked_up', 'pickup_completed', 'loading', 'loaded',
          'in_transit', 'on_route', 'en_route_delivery', 'en_route_to_delivery',
          'transporting', 'delivering',
          'arrived_delivery', 'at_delivery_location', 'at_delivery',
          'unloading', 'delivery_in_progress'
        ];
        
        const activeJobs = bookings
          .filter(booking => activeStatuses.includes(booking.status))
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
            updatedAt: booking.updatedAt,
            assignedAt: booking.assignedAt || booking.acceptedAt,
            cargoOwnerId: booking.cargoOwnerId
          }));


        setDashboardData(prev => ({
          ...prev,
          activeBookings: activeJobs,
          completedBookings: bookings
            .filter(booking => booking.status === 'completed')
            .slice(0, 5)
        }));
      }
    } catch (error) {
      console.error('Error in fallback booking fetch:', error);
    }
  }, [getAuthHeaders, handleApiError]);

  //  Fetch available loads with better filtering
  const fetchAvailableLoads = useCallback(async () => {
    setLoadingStates(prev => ({ ...prev, loads: true }));
    
    try {
      // Build query parameters
      const params = new URLSearchParams({
        limit: '20',
        status: 'active'
      });

      // Add location if available
      if (user?.location) {
        params.append('location', user.location);
      } else if (user?.coordinates?.latitude && user?.coordinates?.longitude) {
        params.append('lat', user.coordinates.latitude);
        params.append('lng', user.coordinates.longitude);
        params.append('radius', '50'); // 50km radius
      }

      // Add vehicle type filter
      if (user?.vehicleType) {
        params.append('vehicleType', user.vehicleType);
      }

      const response = await fetch(
        `https://infinite-cargo-api.onrender.com/api/loads?${params.toString()}`, 
        { headers: getAuthHeaders() }
      );

      if (await handleApiError(response, 'fetchAvailableLoads')) return;

      if (response.ok) {
        const loadsData = await response.json();
        const loads = loadsData.data?.loads || loadsData.loads || [];
        
        // Format loads for consistent display
        const formattedLoads = loads.slice(0, 10).map(load => ({
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
          createdAt: load.createdAt,
          cargoOwnerId: load.cargoOwnerId || load.postedBy
        }));
        
        setDashboardData(prev => ({
          ...prev,
          availableLoads: formattedLoads
        }));
      } else {
        console.error('Failed to fetch available loads:', response.status);
      }
    } catch (error) {
      console.error('Error fetching available loads:', error);
    } finally {
      setLoadingStates(prev => ({ ...prev, loads: false }));
    }
  }, [getAuthHeaders, handleApiError, user?.location, user?.coordinates, user?.vehicleType]);

  const fetchDriverBids = useCallback(async () => {
  setLoadingStates(prev => ({ ...prev, bids: true }));
  
  try {
    
    const response = await fetch('https://infinite-cargo-api.onrender.com/api/bids', {
      headers: getAuthHeaders()
    });

    if (await handleApiError(response, 'fetchDriverBids')) return;

    if (response.ok) {
      const bidsData = await response.json();
      
      //  Extract bids exactly like BidsPage does
      let bids = [];
      if (bidsData.data?.bids) {
        bids = bidsData.data.bids;
      } else if (bidsData.bids) {
        bids = bidsData.bids;
      } else if (Array.isArray(bidsData.data)) {
        bids = bidsData.data;
      } else if (Array.isArray(bidsData)) {
        bids = bidsData;
      }

    
      // Format bids to ensure consistent structure (matching BidsPage format)
      const formattedBids = bids.map(bid => ({
        _id: bid._id,
        loadId: bid.loadId,
        bidAmount: bid.bidAmount || 0,
        currency: bid.currency || 'KES',
        status: bid.status,
        message: bid.message,
        coverLetter: bid.coverLetter,
        proposedPickupDate: bid.proposedPickupDate,
        proposedDeliveryDate: bid.proposedDeliveryDate,
        vehicleDetails: bid.vehicleDetails,
        counterOffer: bid.counterOffer,
        createdAt: bid.createdAt,
        updatedAt: bid.updatedAt,
        submittedAt: bid.submittedAt || bid.createdAt,
        viewedAt: bid.viewedAt,
        acceptedAt: bid.acceptedAt,
        expiresAt: bid.expiresAt,
        
        // Load information - handle multiple possible structures
        load: bid.load,
        loadInfo: bid.loadInfo || bid.load,
        loadDetails: bid.loadDetails,
        
        // Fallback load properties if not nested
        loadTitle: bid.loadTitle || bid.load?.title,
        pickupLocation: bid.pickupLocation || bid.load?.pickupLocation || bid.loadInfo?.pickupLocation,
        deliveryLocation: bid.deliveryLocation || bid.load?.deliveryLocation || bid.loadInfo?.deliveryLocation,
        estimatedAmount: bid.estimatedAmount || bid.load?.budget || bid.loadInfo?.budget
      }));
      
      
      
      setDashboardData(prev => ({
        ...prev,
        myBids: formattedBids // This should now match what BidsPage gets
      }));
      
    } else {
      const errorText = await response.text();
      console.error('Failed to fetch driver bids:', response.status, errorText);
      
      // Set empty array instead of leaving undefined
      setDashboardData(prev => ({
        ...prev,
        myBids: []
      }));
    }
  } catch (error) {
    console.error('Error fetching driver bids:', error);
    
    // Set empty array on error
    setDashboardData(prev => ({
      ...prev,
      myBids: []
    }));
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
      console.error('Error fetching notifications:', error);
      setNotifications([]);
    }
  }, [getAuthHeaders, handleApiError]);

const fetchDashboardData = useCallback(async (showLoader = true) => {
  if (showLoader) {
    setLoading(true);
  } else {
    setRefreshing(true);
  }
  
  setError('');
  
  try {
    
    // OPTION 1: Try the comprehensive dashboard endpoint first
    try {
      const dashboardResponse = await fetch('https://infinite-cargo-api.onrender.com/api/drivers/dashboard', {
        headers: getAuthHeaders()
      });

      if (dashboardResponse.ok && !(await handleApiError(dashboardResponse, 'fetchDashboardData'))) {
        const dashboardResult = await dashboardResponse.json();
       
        
        const data = dashboardResult.data;
        
        // Update user info
        if (data.driver) {
          setUser(data.driver);
          authManager.setAuth(
            authManager.getToken(), 
            data.driver, 
            localStorage.getItem('infiniteCargoRememberMe') === 'true'
          );
        }

        //  Better bids extraction from dashboard endpoint
        let myBidsFromDashboard = [];
        if (data.myBids && Array.isArray(data.myBids)) {
          myBidsFromDashboard = data.myBids;
        } else if (data.bids && Array.isArray(data.bids)) {
          myBidsFromDashboard = data.bids;
        }

      

        // Update dashboard data with the comprehensive response
        setDashboardData(prev => ({
          ...prev,
          activeBookings: data.activeBookings || [],
          availableLoads: data.availableLoads || [],
          completedBookings: data.completedBookings || [],
          myBids: myBidsFromDashboard, // Use dashboard bids if available
          stats: {
            totalJobs: data.stats?.totalJobs || 0,
            activeJobs: data.stats?.activeJobs || 0,
            completedJobs: data.stats?.completedJobs || 0,
            completionRate: data.stats?.completionRate || data.stats?.successRate || 0,
            successRate: data.stats?.successRate || data.stats?.completionRate || 0,
            rating: Math.round((data.stats?.rating || data.stats?.averageRating || 0) * 10) / 10,
            totalBids: data.stats?.totalBids || 0,
            acceptedBids: data.stats?.acceptedBids || 0,
            monthlyEarnings: data.stats?.monthlyEarnings || data.earnings?.thisMonth || 0
          },
          earnings: {
            thisMonth: data.earnings?.thisMonth || 0,
            lastMonth: data.earnings?.lastMonth || 0,
            total: data.earnings?.total || 0
          }
        }));

        setNotifications(data.notifications || []);
        
        
        if (myBidsFromDashboard.length === 0) {
          
          await fetchDriverBids();
        }
        
       
        return; 

      } else {
        console.log('[DEBUG] Dashboard endpoint failed or auth error, falling back...');
      }
    } catch (dashboardError) {
      console.log('[DEBUG] Dashboard endpoint error:', dashboardError);
    }

    
    await Promise.all([
      fetchUserProfile(),
      fetchDriverStats(),
      fetchActiveJobs(),
      fetchAvailableLoads(),
      fetchDriverBids(), // Use the fixed bids fetch
      fetchNotifications()
    ]);

  } catch (error) {
    console.error('Error fetching dashboard data:', error);
    setError('Failed to load dashboard data');
  } finally {
    setLoading(false);
    setRefreshing(false);
  }
}, [
  getAuthHeaders, 
  handleApiError,
  fetchUserProfile,
  fetchDriverStats,
  fetchActiveJobs,
  fetchAvailableLoads,
  fetchDriverBids, // Updated dependency
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

  

  // Toggle driver availability
const toggleAvailability = async () => {
  if (!user) return;

  const currentAvailability = user.driverProfile?.isAvailable ?? false;
  const newAvailability = !currentAvailability;

  setAvailabilityUpdating(true);
  setError(''); // Clear previous errors


  try {
    const requestBody = { isAvailable: newAvailability };

    const response = await fetch('https://infinite-cargo-api.onrender.com/api/drivers/availability', {
      method: 'POST',
      headers: {
        ...getAuthHeaders(),
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    // Handle authentication errors first
    if (response.status === 401 || response.status === 403) {
      setError('Authentication failed. Please login again.');
      handleLogout();
      return;
    }

    // Get response text first for better debugging
    const responseText = await response.text();
    
    // Parse response
    let responseData;
    try {
      responseData = responseText ? JSON.parse(responseText) : {};
    } catch (parseError) {
      console.error('Failed to parse response:', parseError);
      setError('Invalid server response');
      return;
    }

    if (!response.ok) {
      // Handle server errors
      const errorMessage = responseData?.message || `Failed to update availability (${response.status})`;
      console.error('Server error:', errorMessage);
      setError(errorMessage);
      return;
    }

    //  Get the actual updated value from the server response
    const serverUpdatedValue = responseData.data?.isAvailable;
    
    if (serverUpdatedValue === undefined || serverUpdatedValue === null) {
      console.error('Server did not return updated availability value');
      setError('Server response missing availability status');
      return;
    }

  

    const updatedUser = {
  ...user,
  driverProfile: {
    ...user.driverProfile,
    isAvailable: serverUpdatedValue,
    lastAvailabilityUpdate: new Date().toISOString()
  }
};

setUser(updatedUser);
    
    // Update authManager storage
    setUser(updatedUser);

// Update authManager storage
authManager.setAuth(
  authManager.getToken(),
  updatedUser,
  localStorage.getItem('infiniteCargoRememberMe') === 'true'
);

// Clear any existing errors on success
setError('');

// Show success message
setSuccessMessage(`You are now ${serverUpdatedValue ? 'available' : 'offline'} for new jobs`);

// Auto-clear success message after 3 seconds
setTimeout(() => {
  setSuccessMessage('');
}, 3000);
   

    // Optional: Refresh dashboard data to ensure consistency
    // fetchDashboardData(false);

  } catch (error) {
    console.error('Network error updating availability:', error);
    setError('Network error. Please check your connection and try again.');
  } finally {
    setAvailabilityUpdating(false);
  }
};

  // Place a bid on a load
  const placeBid = async (bidData) => {
  try {
    // Validate required fields before sending
    if (!bidData._id) {
      setError('Load ID is required');
      return false;
    }

    if (!bidData.bidAmount || bidData.bidAmount < 1) {
      setError('Bid amount must be at least 1');
      return false;
    }

    // Validate MongoDB ObjectId format (24 hex characters)
    const objectIdRegex = /^[0-9a-fA-F]{24}$/;
    if (!objectIdRegex.test(bidData._id)) {
      setError('Invalid load ID format');
      return false;
    }

    // Validate date formats if provided
    if (bidData.proposedPickupDate) {
      const pickupDate = new Date(bidData.proposedPickupDate);
      if (isNaN(pickupDate.getTime())) {
        setError('Invalid proposed pickup date');
        return false;
      }
      // Ensure ISO8601 format
      bidData.proposedPickupDate = pickupDate.toISOString();
    }

    if (bidData.proposedDeliveryDate) {
      const deliveryDate = new Date(bidData.proposedDeliveryDate);
      if (isNaN(deliveryDate.getTime())) {
        setError('Invalid proposed delivery date');
        return false;
      }
      // Ensure ISO8601 format
      bidData.proposedDeliveryDate = deliveryDate.toISOString();
    }

    // Validate message length
    if (bidData.message && bidData.message.length > 500) {
      setError('Message cannot exceed 500 characters');
      return false;
    }

    // Clean the bid data - remove any undefined/null values
    const cleanBidData = {
      loadId: bidData._id,
      bidAmount: parseFloat(bidData.bidAmount),
      ...(bidData.proposedPickupDate && { proposedPickupDate: bidData.proposedPickupDate }),
      ...(bidData.proposedDeliveryDate && { proposedDeliveryDate: bidData.proposedDeliveryDate }),
      ...(bidData.message && { message: bidData.message.trim() })
    };

    

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
        body: JSON.stringify(cleanBidData)
      }
    );

   

    // Handle authentication errors
    if (response.status === 401 || response.status === 403) {
      setError('Authentication failed. Please login again.');
      handleLogout();
      return false;
    }

    // Get response body for debugging
    const responseText = await response.text();
   

    let responseData;
    try {
      responseData = responseText ? JSON.parse(responseText) : {};
    } catch (parseError) {
      console.error('Failed to parse response:', parseError);
      setError('Invalid server response');
      return false;
    }

    if (!response.ok) {
      // Enhanced error handling for 400 errors
      if (response.status === 400) {
        console.error('Validation errors:', responseData.errors);
        
        if (responseData.errors && Array.isArray(responseData.errors)) {
          // Show specific validation errors
          const errorMessages = responseData.errors.map(err => err.msg || err.message).join(', ');
          setError(`Validation failed: ${errorMessages}`);
        } else {
          setError(responseData.message || 'Invalid request data');
        }
      } else {
        const msg = responseData.message || `Failed to place bid (${response.status})`;
        setError(msg);
      }
      return false;
    }

    
    
    // Refresh data and show success message
    await fetchDriverBids();
    await fetchAvailableLoads();
    
    setSuccessMessage('Bid placed successfully!');
    setTimeout(() => {
      setSuccessMessage('');
    }, 3000);

    // Clear any existing errors
    setError('');

    return true;

  } catch (error) {
    console.error('Network error placing bid:', error);
    setError('Network error. Please check your connection and try again.');
    return false;
  }
};

// Helper function to validate bid data before calling placeBid
const validateBidData = (bidData) => {
  const errors = [];

  if (!bidData._id) {
    errors.push('Load ID is required');
  }

  if (!bidData.bidAmount || isNaN(bidData.bidAmount) || bidData.bidAmount < 1) {
    errors.push('Bid amount must be a number greater than 0');
  }

  // Validate ObjectId format
  const objectIdRegex = /^[0-9a-fA-F]{24}$/;
  if (bidData._id && !objectIdRegex.test(bidData._id)) {
    errors.push('Invalid load ID format');
  }

  if (bidData.message && bidData.message.length > 500) {
    errors.push('Message cannot exceed 500 characters');
  }

  return errors;
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
      rejected: 'bg-red-100 text-red-800',
      assigned: 'bg-blue-100 text-blue-800',
      confirmed: 'bg-green-100 text-green-800',
      picked_up: 'bg-purple-100 text-purple-800',
      in_transit: 'bg-indigo-100 text-indigo-800',
      delivered: 'bg-green-100 text-green-800'
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
        getAuthHeaders={getAuthHeaders}
        error={error}
       
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

        {/* Success banner */}
        {successMessage && (
          <div className="mb-6 bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex">
              <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <div className="ml-3">
                <p className="text-sm font-medium text-green-800">{successMessage}</p>
              </div>
              <button
                onClick={() => setSuccessMessage('')}
                className="ml-auto text-green-400 hover:text-green-600"
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