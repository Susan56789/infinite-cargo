import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  Truck, 
  Package, 
  DollarSign, 
  MapPin, 
  Clock, 
  TrendingUp, 
  AlertCircle,  
  Eye,
  Calendar,
  Phone,
  Mail,
  Settings,
  Bell,
  Search,
  Plus,
  Star,
  ArrowRight,
  Loader,
  RefreshCw,
  User,
} from 'lucide-react';

// Import your auth utilities
import { authManager, getUser, isAuthenticated, getAuthHeader, getUserType, logout } from '../../utils/auth';

const DriverDashboard = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
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
      completionRate: 95,
      rating: 4.8,
      totalBids: 0,
      acceptedBids: 0
    }
  });
  const [notifications, setNotifications] = useState([]);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [availabilityUpdating, setAvailabilityUpdating] = useState(false);

  const navigate = useNavigate();

  // Get auth headers using AuthManager
  const getAuthHeaders = () => {
    return {
      ...getAuthHeader(),
      'Content-Type': 'application/json'
    };
  };

  useEffect(() => {
    // Check authentication using AuthManager
    if (!isAuthenticated() || getUserType() !== 'driver') {
      // Redirect to login if not authenticated or not a driver
      window.location.href = '/login';
      return;
    }

    const userData = getUser();
    setUser(userData);
    fetchDashboardData();
  }, [navigate]);

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
        // Try to refresh token
        authManager.refreshToken().catch(() => {
          // If refresh fails, logout
          handleLogout();
        });
      }
    };

    // Check immediately and then every 5 minutes
    checkTokenExpiration();
    const interval = setInterval(checkTokenExpiration, 5 * 60 * 1000);
    
    return () => clearInterval(interval);
  }, []);

  const fetchDashboardData = async () => {
    setLoading(true);
    setError('');
    
    try {
      const headers = getAuthHeaders();

      // Fetch user profile
      const userResponse = await fetch('https://infinite-cargo-api.onrender.com/api/users/me', { headers });
      if (userResponse.status === 401) {
        // Token expired or invalid
        handleLogout();
        return;
      }
      if (userResponse.ok) {
        const userData = await userResponse.json();
        const userInfo = userData.user || userData;
        setUser(userInfo);
        // Update auth manager with fresh user data
        authManager.setAuth(authManager.getToken(), userInfo, localStorage.getItem('infiniteCargoRememberMe') === 'true');
      }

      // Fetch available loads
      const loadsResponse = await fetch('https://infinite-cargo-api.onrender.com/api/loads?limit=10', { headers });
      if (loadsResponse.status === 401) {
        handleLogout();
        return;
      }
      if (loadsResponse.ok) {
        const loadsData = await loadsResponse.json();
        const loads = loadsData.data?.loads || loadsData.loads || [];
        
        setDashboardData(prev => ({
          ...prev,
          availableLoads: loads.slice(0, 5)
        }));
      }

      // Fetch driver bookings
      const bookingsResponse = await fetch('https://infinite-cargo-api.onrender.com/api/bookings/driver', { headers });
      if (bookingsResponse.status === 401) {
        handleLogout();
        return;
      }
      if (bookingsResponse.ok) {
        const bookingsData = await bookingsResponse.json();
        const bookings = bookingsData.data?.bookings || bookingsData.bookings || [];
        
        setDashboardData(prev => ({
          ...prev,
          activeBookings: bookings.filter(booking => 
            ['accepted', 'in_progress', 'driver_assigned'].includes(booking.status)
          ),
          completedBookings: bookings.filter(booking => 
            booking.status === 'completed'
          )
        }));
      }

      // Fetch driver bids
      const bidsResponse = await fetch('https://infinite-cargo-api.onrender.com/api/bids/my-bids', { headers });
      if (bidsResponse.status === 401) {
        handleLogout();
        return;
      }
      if (bidsResponse.ok) {
        const bidsData = await bidsResponse.json();
        const bids = bidsData.data?.bids || bidsData.bids || [];
        
        setDashboardData(prev => ({
          ...prev,
          myBids: bids.slice(0, 5),
          stats: {
            ...prev.stats,
            totalBids: bids.length,
            acceptedBids: bids.filter(bid => bid.status === 'accepted').length
          }
        }));
      }

      // Fetch driver statistics
      const statsResponse = await fetch('https://infinite-cargo-api.onrender.com/api/drivers/stats', { headers });
      if (statsResponse.status === 401) {
        handleLogout();
        return;
      }
      if (statsResponse.ok) {
        const statsData = await statsResponse.json();
        const stats = statsData.data?.stats || {};
        
        setDashboardData(prev => ({
          ...prev,
          stats: {
            ...prev.stats,
            ...stats,
            completionRate: stats.successRate || 95,
            rating: stats.averageRating || 4.8
          },
          earnings: {
            thisMonth: stats.monthlyEarnings || 0,
            lastMonth: 0,
            total: stats.totalEarnings || 0
          }
        }));
      }

    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      setError('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

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

      if (response.status === 401) {
        // Token expired or invalid
        handleLogout();
        return;
      }

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
        
        // Update auth manager with updated user data
        authManager.setAuth(authManager.getToken(), updatedUser, localStorage.getItem('infiniteCargoRememberMe') === 'true');
      }
    } catch (error) {
      console.error('Error updating availability:', error);
    } finally {
      setAvailabilityUpdating(false);
    }
  };

  const placeBid = async (loadId, bidAmount, proposedDeliveryDate, bidMessage) => {
    try {
      const response = await fetch('https://infinite-cargo-api.onrender.com/api/bids', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          loadId,
          bidAmount: parseFloat(bidAmount),
          proposedDeliveryDate,
          message: bidMessage,
          estimatedDuration: '2-3 days'
        })
      });

      if (response.status === 401) {
        // Token expired or invalid
        handleLogout();
        return { success: false, error: 'Authentication failed' };
      }

      if (response.ok) {
        // Refresh dashboard data
        fetchDashboardData();
        return { success: true };
      } else {
        const errorData = await response.json();
        return { success: false, error: errorData.message };
      }
    } catch (error) {
      console.error('Error placing bid:', error);
      return { success: false, error: 'Failed to place bid' };
    }
  };

  const handleLogout = async () => {
    try {
      // Use AuthManager's logout method
      await logout();
    } catch (error) {
      console.error('Logout error:', error);
      // Fallback: clear auth and redirect manually
      authManager.clearAuth();
      window.location.href = '/login';
    }
  };

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
    return new Date(dateString).toLocaleDateString('en-KE', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  const calculateSuccessRate = () => {
    if (dashboardData.stats.totalBids === 0) return 0;
    return Math.round((dashboardData.stats.acceptedBids / dashboardData.stats.totalBids) * 100);
  };

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

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto">
          <AlertCircle className="mx-auto h-12 w-12 text-red-600" />
          <h3 className="mt-4 text-lg font-semibold text-gray-900">Something went wrong</h3>
          <p className="mt-2 text-gray-600">{error}</p>
          <button 
            onClick={fetchDashboardData}
            className="mt-4 inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <RefreshCw size={16} className="mr-2" />
            Try Again
          </button>
        </div>
      </div>
    );
  }

  // Rest of your component JSX would go here...
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Welcome back, {user?.name}! 👋
              </h1>
              <p className="text-gray-600">
                Here's what's happening with your transport business today.
              </p>
            </div>
            <div className="flex items-center space-x-4">
              {/* Availability Toggle */}
              <div className="flex items-center space-x-3">
                <span className={`text-sm font-medium ${user?.driverProfile?.isAvailable ? 'text-green-600' : 'text-gray-500'}`}>
                  {user?.driverProfile?.isAvailable ? 'Available' : 'Offline'}
                </span>
                <button
                  onClick={toggleAvailability}
                  disabled={availabilityUpdating}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                    user?.driverProfile?.isAvailable ? 'bg-green-600' : 'bg-gray-200'
                  }`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                    user?.driverProfile?.isAvailable ? 'translate-x-6' : 'translate-x-1'
                  }`} />
                  {availabilityUpdating && (
                    <Loader className="absolute inset-0 h-4 w-4 m-auto animate-spin text-gray-400" />
                  )}
                </button>
              </div>
              
              <button className="relative p-2 text-gray-600 hover:text-gray-900 transition-colors">
                <Bell size={20} />
                <span className="absolute top-0 right-0 h-5 w-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                  3
                </span>
              </button>
              
              <Link
                to="/driver/profile"
                className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Settings size={16} className="mr-2" />
                Settings
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <div className="p-3 bg-blue-100 rounded-lg">
                  <Truck className="h-6 w-6 text-blue-600" />
                </div>
                <div className="ml-4">
                  <h3 className="text-2xl font-bold text-gray-900">
                    {dashboardData.activeBookings.length}
                  </h3>
                  <p className="text-sm text-gray-600">Active Jobs</p>
                </div>
              </div>
              <div className="flex items-center text-green-600 text-sm">
                <TrendingUp size={16} className="mr-1" />
                <span>+2 this week</span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <div className="p-3 bg-green-100 rounded-lg">
                  <DollarSign className="h-6 w-6 text-green-600" />
                </div>
                <div className="ml-4">
                  <h3 className="text-2xl font-bold text-gray-900">
                    {formatCurrency(dashboardData.earnings.thisMonth)}
                  </h3>
                  <p className="text-sm text-gray-600">This Month</p>
                </div>
              </div>
              <div className="flex items-center text-green-600 text-sm">
                <TrendingUp size={16} className="mr-1" />
                <span>+15%</span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <div className="p-3 bg-purple-100 rounded-lg">
                  <Package className="h-6 w-6 text-purple-600" />
                </div>
                <div className="ml-4">
                  <h3 className="text-2xl font-bold text-gray-900">
                    {dashboardData.completedBookings.length}
                  </h3>
                  <p className="text-sm text-gray-600">Completed Jobs</p>
                </div>
              </div>
              <div className="flex items-center text-gray-500 text-sm">
                <Clock size={16} className="mr-1" />
                <span>This month</span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <div className="p-3 bg-yellow-100 rounded-lg">
                  <Star className="h-6 w-6 text-yellow-600" />
                </div>
                <div className="ml-4">
                  <h3 className="text-2xl font-bold text-gray-900">
                    {dashboardData.stats.rating}/5
                  </h3>
                  <p className="text-sm text-gray-600">Rating</p>
                </div>
              </div>
              <div className="flex items-center text-green-600 text-sm">
                <TrendingUp size={16} className="mr-1" />
                <span>Excellent</span>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-8">
            {/* Active Jobs */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
              <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900">Active Jobs</h2>
                <Link
                  to="/driver/active-jobs"
                  className="text-blue-600 hover:text-blue-700 text-sm font-medium flex items-center"
                >
                  View All <ArrowRight size={16} className="ml-1" />
                </Link>
              </div>
              <div className="p-6">
                {dashboardData.activeBookings.length > 0 ? (
                  <div className="space-y-4">
                    {dashboardData.activeBookings.slice(0, 3).map((booking) => (
                      <div key={booking._id} className="border border-gray-200 rounded-lg p-4 hover:border-gray-300 transition-colors">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center space-x-2 mb-2">
                              <MapPin size={16} className="text-gray-400" />
                              <span className="text-sm text-gray-600">
                                {booking.pickupLocation || 'Pickup Location'} → {booking.deliveryLocation || 'Delivery Location'}
                              </span>
                            </div>
                            <div className="flex items-center space-x-4 mb-3">
                              <div className="flex items-center space-x-1">
                                <Package size={16} className="text-gray-400" />
                                <span className="text-sm text-gray-600">{booking.cargoType || 'General Cargo'}</span>
                              </div>
                              <div className="flex items-center space-x-1">
                                <DollarSign size={16} className="text-gray-400" />
                                <span className="text-sm font-medium text-green-600">
                                  {formatCurrency(booking.budget || booking.price)}
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(booking.status)}`}>
                                {booking.status.replace('_', ' ').toUpperCase()}
                              </span>
                              <span className="text-xs text-gray-500">
                                {formatDate(booking.pickupDate || booking.createdAt)}
                              </span>
                            </div>
                          </div>
                          <div className="ml-4 flex space-x-2">
                            <Link
                              to={`/driver/job/${booking._id}`}
                              className="inline-flex items-center px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
                            >
                              <Eye size={14} className="mr-1" />
                              View
                            </Link>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Truck size={48} className="mx-auto text-gray-400 mb-4" />
                    <p className="text-gray-600">No active jobs at the moment</p>
                    <Link
                      to="/search-loads"
                      className="inline-flex items-center mt-3 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      <Search size={16} className="mr-2" />
                      Find Available Loads
                    </Link>
                  </div>
                )}
              </div>
            </div>

            {/* Available Loads */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
              <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900">Available Loads</h2>
                <Link
                  to="/search-loads"
                  className="text-blue-600 hover:text-blue-700 text-sm font-medium flex items-center"
                >
                  <Search size={16} className="mr-1" />
                  Browse More
                </Link>
              </div>
              <div className="p-6">
                {dashboardData.availableLoads.length > 0 ? (
                  <div className="space-y-4">
                    {dashboardData.availableLoads.slice(0, 3).map((load) => (
                      <LoadCard 
                        key={load._id} 
                        load={load} 
                        onBidPlace={placeBid}
                        formatCurrency={formatCurrency}
                        formatDate={formatDate}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Package size={48} className="mx-auto text-gray-400 mb-4" />
                    <p className="text-gray-600">No available loads in your area</p>
                    <Link
                      to="/search-loads"
                      className="inline-flex items-center mt-3 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      Expand Search Area
                    </Link>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Quick Actions */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
              <div className="grid grid-cols-2 gap-3">
                <Link
                  to="/search-loads"
                  className="flex flex-col items-center p-4 border border-gray-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 transition-colors group"
                >
                  <Search className="h-8 w-8 text-gray-600 group-hover:text-blue-600 mb-2" />
                  <span className="text-sm font-medium text-gray-700 group-hover:text-blue-600">Search Loads</span>
                </Link>
                
                <Link
                  to="/driver/profile"
                  className="flex flex-col items-center p-4 border border-gray-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 transition-colors group"
                >
                  <User className="h-8 w-8 text-gray-600 group-hover:text-blue-600 mb-2" />
                  <span className="text-sm font-medium text-gray-700 group-hover:text-blue-600">Update Profile</span>
                </Link>
                
                <Link
                  to="/driver/earnings"
                  className="flex flex-col items-center p-4 border border-gray-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 transition-colors group"
                >
                  <DollarSign className="h-8 w-8 text-gray-600 group-hover:text-blue-600 mb-2" />
                  <span className="text-sm font-medium text-gray-700 group-hover:text-blue-600">View Earnings</span>
                </Link>
                
                <Link
                  to="/driver/vehicles"
                  className="flex flex-col items-center p-4 border border-gray-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 transition-colors group"
                >
                  <Truck className="h-8 w-8 text-gray-600 group-hover:text-blue-600 mb-2" />
                  <span className="text-sm font-medium text-gray-700 group-hover:text-blue-600">My Vehicles</span>
                </Link>
              </div>
            </div>

            {/* Performance Summary */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Performance</h3>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Success Rate</span>
                  <span className="text-sm font-medium text-green-600">{calculateSuccessRate()}%</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Total Bids</span>
                  <span className="text-sm font-medium">{dashboardData.stats.totalBids}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Accepted Bids</span>
                  <span className="text-sm font-medium text-green-600">{dashboardData.stats.acceptedBids}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Average Rating</span>
                  <div className="flex items-center">
                    <Star className="h-4 w-4 text-yellow-400 mr-1" />
                    <span className="text-sm font-medium">{dashboardData.stats.rating}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Profile Summary */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Profile Summary</h3>
              <div className="space-y-3">
                <div className="flex items-center text-sm">
                  <Mail className="h-4 w-4 text-gray-400 mr-3" />
                  <span className="text-gray-600">{user?.email}</span>
                </div>
                <div className="flex items-center text-sm">
                  <Phone className="h-4 w-4 text-gray-400 mr-3" />
                  <span className="text-gray-600">{user?.phone}</span>
                </div>
                <div className="flex items-center text-sm">
                  <MapPin className="h-4 w-4 text-gray-400 mr-3" />
                  <span className="text-gray-600">{user?.location}</span>
                </div>
                <div className="flex items-center text-sm">
                  <Calendar className="h-4 w-4 text-gray-400 mr-3" />
                  <span className="text-gray-600">Joined {formatDate(user?.createdAt)}</span>
                </div>
              </div>
              <Link
                to="/driver/profile"
                className="w-full mt-4 inline-flex items-center justify-center px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors"
              >
                Edit Profile
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// LoadCard Component for displaying available loads
const LoadCard = ({ load, onBidPlace, formatCurrency, formatDate }) => {
  const [showBidForm, setShowBidForm] = useState(false);
  const [bidAmount, setBidAmount] = useState('');
  const [bidMessage, setBidMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleBidSubmit = async (e) => {
    e.preventDefault();
    if (!bidAmount || parseFloat(bidAmount) <= 0) return;

    setSubmitting(true);
    const proposedDate = new Date();
    proposedDate.setDate(proposedDate.getDate() + 2); // 2 days from now

    const result = await onBidPlace(load._id, bidAmount, proposedDate.toISOString(), bidMessage);
    
    if (result.success) {
      setShowBidForm(false);
      setBidAmount('');
      setBidMessage('');
    } else {
      alert(result.error || 'Failed to place bid');
    }
    
    setSubmitting(false);
    };

  return (
    <div className="border border-gray-200 rounded-lg p-4 hover:border-gray-300 transition-colors">
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <div className="flex items-center space-x-2 mb-2">
            <MapPin size={16} className="text-gray-400" />
            <span className="text-sm text-gray-600">
              {load.origin || load.pickupLocation} → {load.destination || load.deliveryLocation}
            </span>
          </div>
          <div className="flex items-center space-x-4 mb-2">
            <div className="flex items-center space-x-1">
              <Package size={16} className="text-gray-400" />
              <span className="text-sm text-gray-600">{load.cargoType || 'General Cargo'}</span>
            </div>
            <div className="flex items-center space-x-1">
              <DollarSign size={16} className="text-gray-400" />
              <span className="text-sm font-medium text-green-600">
                {formatCurrency(load.budget || load.maxBudget)}
              </span>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500">
              Pickup: {formatDate(load.pickupDate || load.createdAt)}
            </span>
            <span className="text-xs text-gray-500">
              {load.weight ? `${load.weight} kg` : 'Weight not specified'}
            </span>
          </div>
        </div>
      </div>

      {!showBidForm ? (
        <div className="flex space-x-2">
          <button
            onClick={() => setShowBidForm(true)}
            className="flex-1 inline-flex items-center justify-center px-3 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus size={14} className="mr-1" />
            Place Bid
          </button>
          <Link
            to={`/driver/load/${load._id}`}
            className="inline-flex items-center px-3 py-2 border border-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-50 transition-colors"
          >
            <Eye size={14} className="mr-1" />
            Details
          </Link>
        </div>
      ) : (
        <form onSubmit={handleBidSubmit} className="space-y-3 mt-3 p-3 bg-gray-50 rounded-lg">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Your Bid Amount (KES)
            </label>
            <input
              type="number"
              value={bidAmount}
              onChange={(e) => setBidAmount(e.target.value)}
              placeholder="Enter your bid"
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
              min="1"
              step="0.01"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Message (Optional)
            </label>
            <textarea
              value={bidMessage}
              onChange={(e) => setBidMessage(e.target.value)}
              placeholder="Add a message to your bid..."
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div className="flex space-x-2">
            <button
              type="submit"
              disabled={submitting || !bidAmount}
              className="flex-1 inline-flex items-center justify-center px-3 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {submitting ? (
                <>
                  <Loader size={14} className="mr-1 animate-spin" />
                  Submitting...
                </>
              ) : (
                'Submit Bid'
              )}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowBidForm(false);
                setBidAmount('');
                setBidMessage('');
              }}
              className="px-3 py-2 border border-gray-300 text-gray-700 text-sm rounded-md hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
};

export default DriverDashboard;