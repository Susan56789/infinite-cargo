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

  
  const openSearchLoads = useCallback(() => {
    const token = authManager.getToken();
    const userData = getUser();
    
    if (!token || !userData) {
      setError('Authentication required to search loads');
      return;
    }

    // Option 1: Use URL parameters (less secure but works across domains)
    const searchParams = new URLSearchParams({
      token: encodeURIComponent(token),
      userType: userData.userType,
      userId: userData._id || userData.id,
      timestamp: Date.now().toString()
    });
    
    const searchUrl = `/search-loads?${searchParams.toString()}`;
    
    // Option 2: Store in sessionStorage for the new tab
    try {
      // Create a temporary key for this session
      const tempKey = `tempAuth_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const authData = {
        token,
        user: userData,
        timestamp: Date.now(),
        tempKey
      };
      
      sessionStorage.setItem(tempKey, JSON.stringify(authData));
      
      // Open new tab with auth key
      const finalUrl = `/search-loads?authKey=${tempKey}`;
      window.open(finalUrl, '_blank');
      
      // Clean up temp auth after 30 seconds
      setTimeout(() => {
        sessionStorage.removeItem(tempKey);
      }, 30000);
      
    } catch (error) {
      console.error('Error opening search loads:', error);
      // Fallback to simple navigation
      window.open('/search-loads', '_blank');
    }
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

  // Fetch driver statistics with better error handling and data mapping
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

  // Fetch active jobs using dedicated endpoint with comprehensive status matching
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

        // Format bids for consistent display
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
          
          // Load information 
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
          myBids: formattedBids 
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

 
  const fetchAvailableLoads = useCallback(async () => {
  setLoadingStates(prev => ({ ...prev, loads: true }));
  
  try {
    
    const params = new URLSearchParams({
      limit: '5', 
      status: 'available',
      page: '1',
      sortBy: 'createdAt',
      sortOrder: 'desc' 
    });

    const currentUser = getUser(); 
    
    // Add location preference if available 
    if (currentUser?.location) {
      params.append('preferredLocation', currentUser.location);
    } else if (currentUser?.coordinates?.latitude && currentUser?.coordinates?.longitude) {
      params.append('lat', currentUser.coordinates.latitude.toString());
      params.append('lng', currentUser.coordinates.longitude.toString());
      params.append('radius', '100'); 
    }

    const response = await fetch(
      `https://infinite-cargo-api.onrender.com/api/loads?${params.toString()}`, 
      { headers: getAuthHeaders() }
    );

    if (await handleApiError(response, 'fetchAvailableLoads')) return;

    if (response.ok) {
      const loadsData = await response.json();
      let loads = [];

      // Handle different response structures
      if (loadsData.data?.loads) {
        loads = loadsData.data.loads;
      } else if (loadsData.loads) {
        loads = loadsData.loads;
      } else if (Array.isArray(loadsData.data)) {
        loads = loadsData.data;
      } else if (Array.isArray(loadsData)) {
        loads = loadsData;
      }

      // Filter for truly available loads
      const now = new Date();
      const availableLoads = loads.filter(load => {
        // Check if load is in available state
        const availableStatuses = ['available', 'posted', 'receiving_bids', 'active'];
        if (!availableStatuses.includes(load.status)) {
          return false;
        }

        // Check if pickup date hasn't passed
        if (load.pickupDate) {
          const pickupDate = new Date(load.pickupDate);
          if (pickupDate < now) {
            return false;
          }
        }

        return true;
      });

      // Format loads for consistent display
      const formattedLoads = availableLoads
        .map(load => ({
          _id: load._id,
          title: load.title || 'Transport Required',
          pickupLocation: load.pickupLocation || load.origin || 'Pickup Location',
          deliveryLocation: load.deliveryLocation || load.destination || 'Delivery Location',
          cargoType: load.cargoType || load.loadType || 'General Cargo',
          weight: load.weight || load.estimatedWeight || 0,
          estimatedAmount: load.estimatedAmount || load.budget || 0,
          budget: load.budget || load.estimatedAmount || 0,
          pickupDate: load.pickupDate || load.scheduledPickupDate,
          deliveryDate: load.deliveryDate || load.scheduledDeliveryDate,
          description: load.description || '',
          urgency: load.urgency || 'normal',
          bidCount: load.bidCount || 0,
          createdAt: load.createdAt,
          updatedAt: load.updatedAt,
          cargoOwnerId: load.cargoOwnerId || load.postedBy,
          requirements: load.requirements || {},
          distance: load.distance || 0,
          estimatedDuration: load.estimatedDuration || 0,
          vehicleTypeRequired: load.vehicleTypeRequired || [],
          maxBidAmount: load.maxBidAmount || 0,
          minBidAmount: load.minBidAmount || 0,
          bidDeadline: load.bidDeadline,
          status: load.status,
          isUrgent: load.urgency === 'urgent' || load.isUrgent || (load.pickupDate && (() => {
            const pickupDate = new Date(load.pickupDate);
            const today = new Date();
            const diffTime = pickupDate.getTime() - today.getTime();
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            return diffDays <= 2;
          })()),
          
          hasUserBid: dashboardData.myBids?.some(bid => 
            (bid.loadId === load._id || bid.load === load._id) && 
            ['pending', 'submitted', 'accepted', 'under_review'].includes(bid.status)
          ) || false
        }))
        .slice(0, 5); 
    
      setDashboardData(prev => ({
        ...prev,
        availableLoads: formattedLoads
      }));

    } else {
      console.error('Failed to fetch available loads:', response.status, response.statusText);
      
      // Try fallback endpoint
      try {
        const fallbackResponse = await fetch(
          'https://infinite-cargo-api.onrender.com/api/loads/recent?limit=5', 
          { headers: getAuthHeaders() }
        );
        
        if (fallbackResponse.ok) {
          const fallbackData = await fallbackResponse.json();
          const fallbackLoads = fallbackData.data?.loads || fallbackData.loads || [];
          
          setDashboardData(prev => ({
            ...prev,
            availableLoads: fallbackLoads.slice(0, 5)
          }));
          
        } else {
          setDashboardData(prev => ({
            ...prev,
            availableLoads: []
          }));
        }
      } catch (fallbackError) {
        console.error('Fallback fetch also failed:', fallbackError);
        setDashboardData(prev => ({
          ...prev,
          availableLoads: []
        }));
      }
    }
  } catch (error) {
    console.error('Error fetching available loads:', error);
    setDashboardData(prev => ({
      ...prev,
      availableLoads: []
    }));
  } finally {
    setLoadingStates(prev => ({ ...prev, loads: false }));
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

  // Fetch all dashboard data 
 const fetchDashboardData = useCallback(async (showLoader = true) => {
  if (showLoader) {
    setLoading(true);
  } else {
    setRefreshing(true);
  }
  
  setError('');
  
  try {
    // Try the main dashboard endpoint first
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

        let myBidsFromDashboard = [];
        if (data.myBids && Array.isArray(data.myBids)) {
          myBidsFromDashboard = data.myBids;
        } else if (data.bids && Array.isArray(data.bids)) {
          myBidsFromDashboard = data.bids;
        }

        // Set dashboard data from the main endpoint
        setDashboardData(prev => ({
          ...prev,
          activeBookings: data.activeBookings || [],
          completedBookings: data.completedBookings || [],
          myBids: myBidsFromDashboard,
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
        
        // Always fetch available loads separately to ensure fresh data
        await fetchAvailableLoads();
        
        // If no bids from dashboard, fetch them separately
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

    // Fallback to individual endpoints
    const individualPromises = [
      fetchUserProfile(),
      fetchDriverStats(),
      fetchActiveJobs(),
      fetchDriverBids(),
      fetchNotifications()
    ];

    // Execute individual fetches in parallel
    await Promise.all(individualPromises);

    // Always fetch available loads last (after bids are loaded)
    await fetchAvailableLoads();

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
    setError(''); 

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

      
      if (response.status === 401 || response.status === 403) {
        setError('Authentication failed. Please login again.');
        handleLogout();
        return;
      }

      
      const responseText = await response.text();
      
      
      let responseData;
      try {
        responseData = responseText ? JSON.parse(responseText) : {};
      } catch (parseError) {
        console.error('Failed to parse response:', parseError);
        setError('Invalid server response');
        return;
      }

      if (!response.ok) {
       
        const errorMessage = responseData?.message || `Failed to update availability (${response.status})`;
        console.error('Server error:', errorMessage);
        setError(errorMessage);
        return;
      }

      
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
      
      
      authManager.setAuth(
        authManager.getToken(),
        updatedUser,
        localStorage.getItem('infiniteCargoRememberMe') === 'true'
      );

      
      setError('');

      setSuccessMessage(`You are now ${serverUpdatedValue ? 'available' : 'offline'} for new jobs`);

      
      setTimeout(() => {
        setSuccessMessage('');
      }, 3000);

    } catch (error) {
      console.error('Network error updating availability:', error);
      setError('Network error. Please check your connection and try again.');
    } finally {
      setAvailabilityUpdating(false);
    }
  };


  const placeBid = async (bidData) => {
  try {
    // Validate required fields
    if (!bidData.loadId) {
      setError('Load ID is required');
      return false;
    }

    if (!bidData.bidAmount || bidData.bidAmount < 1) {
      setError('Bid amount must be at least 1');
      return false;
    }

    // Validate loadId format
    const objectIdRegex = /^[0-9a-fA-F]{24}$/;
    if (!objectIdRegex.test(bidData.loadId)) {
      setError('Invalid load ID format');
      return false;
    }

    // Validate dates if provided
    if (bidData.proposedPickupDate) {
      const pickupDate = new Date(bidData.proposedPickupDate);
      if (isNaN(pickupDate.getTime())) {
        setError('Invalid proposed pickup date');
        return false;
      }
    }

    if (bidData.proposedDeliveryDate) {
      const deliveryDate = new Date(bidData.proposedDeliveryDate);
      if (isNaN(deliveryDate.getTime())) {
        setError('Invalid proposed delivery date');
        return false;
      }
    }

    // Validate message length
    if (bidData.message && bidData.message.length > 500) {
      setError('Message cannot exceed 500 characters');
      return false;
    }

    
    const cleanBidData = {
      load: bidData.loadId, 
      bidAmount: parseFloat(bidData.bidAmount),
      currency: bidData.currency || 'KES',
      ...(bidData.proposedPickupDate && { proposedPickupDate: bidData.proposedPickupDate }),
      ...(bidData.proposedDeliveryDate && { proposedDeliveryDate: bidData.proposedDeliveryDate }),
      ...(bidData.message && { message: bidData.message.trim() }),
      ...(bidData.coverLetter && { coverLetter: bidData.coverLetter.trim() }),
      ...(bidData.vehicleDetails && { 
        vehicleDetails: {
          type: bidData.vehicleDetails.type || 'medium_truck',
          capacity: parseFloat(bidData.vehicleDetails.capacity) || 5
        }
      }),
      
      ...(bidData.additionalServices && { additionalServices: bidData.additionalServices }),
      ...(bidData.terms && { terms: bidData.terms }),
      ...(bidData.pricingBreakdown && { pricingBreakdown: bidData.pricingBreakdown })
    };

  

    const headers = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...getAuthHeader()
    };

    const response = await fetch(
      'https://infinite-cargo-api.onrender.com/api/bids',
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

    // Parse response
    const responseText = await response.text();
    let responseData;
    try {
      responseData = responseText ? JSON.parse(responseText) : {};
    } catch (parseError) {
      console.error('Failed to parse response:', parseError);
      console.error('Raw response:', responseText);
      setError('Invalid server response');
      return false;
    }

    if (!response.ok) {
      
      console.error('API Error Response:', responseData);
      
      if (response.status === 400) {
        if (responseData.errors && Array.isArray(responseData.errors)) {
          // Show specific validation errors
          const errorMessages = responseData.errors.map(err => {
            if (typeof err === 'string') return err;
            return err.msg || err.message || err.error || 'Validation error';
          }).join(', ');
          setError(`Validation failed: ${errorMessages}`);
        } else if (responseData.message) {
          if (responseData.message.includes('already')) {
            setError('You already have a bid on this load.');
          } else if (responseData.message.includes('validation')) {
            setError('Please check your bid details and try again.');
          } else if (responseData.message.includes('required')) {
            setError('Missing required fields. Please check all inputs.');
          } else {
            setError(responseData.message);
          }
        } else {
          setError('Invalid request data. Please check all required fields.');
        }
      } else if (response.status === 404) {
        setError('Load not found or no longer available.');
      } else if (response.status === 429) {
        setError('Too many requests. Please wait and try again.');
      } else {
        const msg = responseData.message || `Failed to place bid (${response.status})`;
        setError(msg);
      }
      return false;
    }

    // Success handling
    if (responseData.status === 'success' || response.ok) {
      // Refresh data to show the new bid
      await Promise.all([
        fetchDriverBids(),
        fetchAvailableLoads()
      ]);
      
      setSuccessMessage('Bid placed successfully!');
      setTimeout(() => {
        setSuccessMessage('');
      }, 3000);

      // Clear any existing errors
      setError('');
      return true;
    } else {
      const errorMsg = responseData.message || 'Unexpected response from server';
      setError(errorMsg);
      return false;
    }

  } catch (error) {
    console.error('Network error placing bid:', error);
    let errorMsg = 'Network error. Please check your connection and try again.';
    
    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      errorMsg = 'Network connection failed. Please check your internet and try again.';
    } else if (error.message.includes('timeout')) {
      errorMsg = 'Request timed out. Please try again.';
    }
    
    setError(errorMsg);
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

            {/* Available Loads*/}
            <AvailableLoadsSection 
              availableLoads={dashboardData.availableLoads}
              onBidPlace={placeBid}
              formatCurrency={formatCurrency}
              formatDate={formatDate}
              loading={loadingStates.loads}
              onSearchLoads={openSearchLoads}
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