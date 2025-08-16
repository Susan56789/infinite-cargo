import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import UsersTable from './UsersTable';
import DriversTable from './DriversTable';
import CargoOwnersTable from './CargoOwnersTable';
import LoadsTable from './LoadsTable';
import SubscriptionsTable from './SubscriptionsTable';
import AdminHeader from './AdminHeader';
import AddAdminModal from './AddAdminModal';
import { 
  Users, 
  Package, 
  Truck, 
  DollarSign, 
  RefreshCw, 
  TrendingUp,
  Clock,
  CheckCircle,
  AlertCircle,
  Activity,
  MapPin,
  Shield,
  Settings,
  Bell,
  Search,
  Download,
  BarChart3,
  PieChart,
  LineChart
} from 'lucide-react';
import { authManager } from '../../utils/auth';

const API_BASE_URL = 'https://infinite-cargo-api.onrender.com/api';

const AdminDashboard = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('overview');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  
  // Admin and dashboard state
  const [adminData, setAdminData] = useState(null);
  const [dashboardStats, setDashboardStats] = useState({});
  const [activityLogs, setActivityLogs] = useState([]); 
  const [loading, setLoading] = useState(false);
  const [activityLoading, setActivityLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  
  // Add admin modal state
  const [showAddAdmin, setShowAddAdmin] = useState(false);
  const [newAdmin, setNewAdmin] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    role: 'admin',
  });

  // Search and filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [dateRange, setDateRange] = useState('today');

  // Enhanced API helper with better auth handling
  const apiCall = async (endpoint, options = {}) => {
    try {
      // Check if admin is authenticated before making API call
      if (!authManager.isAuthenticated(true)) {
        console.error('Admin not authenticated, redirecting to login');
        navigate('/admin/login');
        throw new Error('Authentication required');
      }

      const authHeader = authManager.getAuthHeader(true);
    
      const config = {
        headers: {
          'Content-Type': 'application/json',
          ...authHeader,
        },
        ...options,
      };

      const response = await fetch(`${API_BASE_URL}${endpoint}`, config);
      const data = await response.json();

      // Handle unauthorized responses
      if (response.status === 401) {
        console.error('API returned 401 Unauthorized, clearing auth and redirecting');
        authManager.clearAuth(true);
        navigate('/admin/login');
        throw new Error('Session expired. Please login again.');
      }

      if (!response.ok) {
        console.error('API error:', response.status, data);
        throw new Error(data.message || `API error: ${response.status}`);
      }

      return data;
    } catch (error) {
      console.error('API call failed:', error);
      throw error;
    }
  };

  // Check authentication on component mount
  useEffect(() => {
    const checkAuth = () => {
      if (!authManager.isAuthenticated(true)) {
        navigate('/admin/login');
        return false;
      }
      return true;
    };

    if (!checkAuth()) {
      return;
    }

    // If authenticated, fetch admin data
    fetchAdmin();
    fetchDashboardStats();
    fetchActivityLogs();
  }, [navigate]);

  // Fetch admin info
  const fetchAdmin = async () => {
    try {
      const response = await apiCall('/admin/me');
      if (response.status === 'success' && response.admin) {
        setAdminData(response.admin);
      } else {
        // Fallback with basic admin info
        const user = authManager.getUser(true);
        setAdminData({ 
          name: user?.name || 'Admin', 
          email: user?.email || '',
          role: user?.role || 'admin' 
        });
      }
    } catch (error) {
      console.error('Failed to fetch admin data:', error);
      // Use stored user data as fallback
      const user = authManager.getUser(true);
      if (user) {
        setAdminData({ 
          name: user.name || 'Admin', 
          email: user.email || '',
          role: user.role || 'admin' 
        });
      }
    }
  };

  // Fetch dashboard stats
  const fetchDashboardStats = async () => {
    try {
      setLoading(true);
      const response = await apiCall('/admin/dashboard-stats');
      if (response.status === 'success' && response.stats) {
        setDashboardStats(response.stats);

    
      } else {
        setDashboardStats({});
      }
    } catch (error) {
      console.error('Failed to fetch dashboard stats:', error);
      setDashboardStats({});
      showError('Failed to load dashboard statistics');
    } finally {
      setLoading(false);
    }
  };

  // Fetch activity logs
  const fetchActivityLogs = async () => {
    try {
      setActivityLoading(true);
      const response = await apiCall('/admin/audit-logs?limit=10');
      if (response.data) {
        setActivityLogs(response.data);
      } else if (response.status === 'success' && response.logs) {
        setActivityLogs(response.logs);
      } else {
        setActivityLogs([]);
      }
    } catch (error) {
      console.error('Failed to fetch activity logs:', error);
      setActivityLogs([]);
    } finally {
      setActivityLoading(false);
    }
  };

  // Function to refresh activity logs
  const refreshLogs = () => {
    fetchActivityLogs();
  };

  // Function to refresh dashboard stats
  const refreshStats = () => {
    fetchDashboardStats();
  };

  // Helper function to safely render data
  const safeRender = (data) => {
    if (data === null || data === undefined) return '';
    if (typeof data === 'string' || typeof data === 'number') return data;
    if (typeof data === 'object') {
      if (data.planName) return data.planName;
      if (data.name) return data.name;
      if (data.title) return data.title;
      return JSON.stringify(data);
    }
    return String(data);
  };

  // Helper function to get user name from various possible structures
  const getUserName = (log) => {
    if (log.user?.name) return log.user.name;
    if (log.userName) return log.userName;
    if (log.adminName) return log.adminName;
    if (log.admin?.name) return log.admin.name;
    if (typeof log.user === 'string') return log.user;
    return 'Unknown User';
  };

  // Helper function to get activity action
  const getActivity = (log) => {
    if (log.action) return safeRender(log.action);
    if (log.activity) return safeRender(log.activity);
    if (log.message) return safeRender(log.message);
    return 'Activity logged';
  };

  // Helper function to get activity details
  const getActivityDetails = (log) => {
    const details = log.details || log.description || log.resource || log.target;
    if (!details) return null;
    
    if (typeof details === 'object') {
      if (details.planName) return `Plan: ${details.planName}`;
      if (details.amount) return `Amount: ${formatCurrency(details.amount)}`;
      if (details.paymentMethod) return `Payment: ${details.paymentMethod}`;
      return Object.entries(details)
        .filter(([key, value]) => value !== null && value !== undefined)
        .map(([key, value]) => `${key}: ${safeRender(value)}`)
        .join(', ');
    }
    
    return safeRender(details);
  };

  // Format timestamp to readable format
  const formatTimestamp = (timestamp) => {
    if (!timestamp) return 'Unknown time';
    
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    
    return date.toLocaleDateString();
  };

  // Get the full date and time for display
  const getFullDateTime = (timestamp) => {
    if (!timestamp) return 'Unknown time';
    const date = new Date(timestamp);
    return date.toLocaleString();
  };

  // Add admin submit
  const handleAddAdminSubmit = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      const response = await apiCall('/admin/register', {
        method: 'POST',
        body: JSON.stringify(newAdmin),
      });
      if (response.status === 'success') {
        showSuccess('Admin created successfully');
        setShowAddAdmin(false);
        setNewAdmin({
          name: '',
          email: '',
          phone: '',
          password: '',
          role: 'admin',
        });
        fetchDashboardStats(); // Refresh stats
      }
    } catch (error) {
      showError(error.message);
    } finally {
      setLoading(false);
    }
  };

  // Utility functions
  const showError = (msg) => {
    setError(msg);
    setTimeout(() => setError(''), 5000);
  };

  const showSuccess = (msg) => {
    setSuccessMessage(msg);
    setTimeout(() => setSuccessMessage(''), 5000);
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES'
    }).format(amount || 0);
  };

  const formatNumber = (num) => {
    return new Intl.NumberFormat('en-KE').format(num || 0);
  };

  const getStatusBadgeColor = (status) => {
    const colors = {
      active: 'bg-green-100 text-green-700 border-green-200',
      pending: 'bg-yellow-100 text-yellow-700 border-yellow-200',
      suspended: 'bg-red-100 text-red-700 border-red-200',
      inactive: 'bg-gray-100 text-gray-700 border-gray-200',
      completed: 'bg-blue-100 text-blue-700 border-blue-200',
      verified: 'bg-green-100 text-green-700 border-green-200',
      rejected: 'bg-red-100 text-red-700 border-red-200',
    };
    return colors[status] || 'bg-gray-100 text-gray-700 border-gray-200';
  };

  const handleLogout = () => {
    authManager.clearAuth(true);
    navigate('/admin/login');
  };

  // Export data functionality
  const exportData = async (type) => {
    try {
      const response = await apiCall(`/admin/export/${type}`);
      // Handle export logic here
      showSuccess(`${type} data exported successfully`);
    } catch (error) {
      showError(`Failed to export ${type} data`);
    }
  };

  // Quick actions
  const quickActions = [
    {
      title: 'Add New Admin',
      icon: Shield,
      action: () => setShowAddAdmin(true),
      color: 'bg-blue-500',
      permission: 'super_admin'
    },
    {
      title: 'View Reports',
      icon: BarChart3,
      action: () => setActiveTab('reports'),
      color: 'bg-green-500'
    },
    {
      title: 'Export Data',
      icon: Download,
      action: () => exportData('users'),
      color: 'bg-purple-500'
    },
    {
      title: 'System Settings',
      icon: Settings,
      action: () => setActiveTab('settings'),
      color: 'bg-orange-500',
      permission: 'systemSettings'
    }
  ];

  // Overview render with enhanced layout
  const renderOverview = () => (
    <div className="space-y-6">
      {/* Error and Success Messages */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center gap-2">
          <AlertCircle className="w-5 h-5" />
          <span>{error}</span>
        </div>
      )}
      {successMessage && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg flex items-center gap-2">
          <CheckCircle className="w-5 h-5" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Quick Stats Header */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold mb-2">Welcome back, {adminData?.name}!</h2>
            <p className="text-blue-100">Here's what's happening with your platform today.</p>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={refreshStats}
              disabled={loading}
              className="bg-white/20 hover:bg-white/30 px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <div className="text-right">
              <div className="text-sm text-blue-100">Total Revenue</div>
              <div className="text-xl font-bold">{formatCurrency(dashboardStats.monthlyRevenue || 0)}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Primary Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {/* Total Loads */}
        <div className="bg-white p-6 border border-gray-200 rounded-xl shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-yellow-100 rounded-lg">
              <Package className="w-6 h-6 text-yellow-600" />
            </div>
            <span className="text-sm text-gray-500 font-medium">Total Loads</span>
          </div>
          <div className="space-y-1">
            <div className="text-2xl font-bold text-gray-900">
              {formatNumber(dashboardStats.totalLoads || 0)}
            </div>
            {dashboardStats.newLoadsThisMonth > 0 && (
              <div className="flex items-center gap-1 text-sm">
                <TrendingUp className="w-3 h-3 text-green-500" />
                <span className="text-green-600">+{dashboardStats.newLoadsThisMonth} this month</span>
              </div>
            )}
            <div className="text-xs text-gray-500">
              {dashboardStats.activeLoads || 0} active
            </div>
          </div>
        </div>

        {/* New Users Today */}
        <div className="bg-white p-6 border border-gray-200 rounded-xl shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Users className="w-6 h-6 text-blue-600" />
            </div>
            <span className="text-sm text-gray-500 font-medium">New Users Today</span>
          </div>
          <div className="space-y-1">
            <div className="text-2xl font-bold text-gray-900">
              {formatNumber(dashboardStats.newUsersToday || 0)}
            </div>
            <div className="text-xs text-gray-500">
              {dashboardStats.newUsersThisWeek || 0} this week
            </div>
            <div className="text-xs text-gray-500">
              {dashboardStats.newUsersThisMonth || 0} this month
            </div>
          </div>
        </div>

        {/* Total Drivers */}
        <div className="bg-white p-6 border border-gray-200 rounded-xl shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-green-100 rounded-lg">
              <Truck className="w-6 h-6 text-green-600" />
            </div>
            <span className="text-sm text-gray-500 font-medium">Total Drivers</span>
          </div>
          <div className="space-y-1">
            <div className="text-2xl font-bold text-gray-900">
              {formatNumber(dashboardStats.totalDrivers || 0)}
            </div>
            <div className="text-xs text-gray-500">
              {dashboardStats.activeDrivers || 0} active
            </div>
            <div className="text-xs text-green-600">
              {dashboardStats.totalDrivers > 0 ? 
                ((dashboardStats.activeDrivers / dashboardStats.totalDrivers) * 100).toFixed(1) : 0}% active rate
            </div>
          </div>
        </div>

        {/* Total Cargo Owners */}
        <div className="bg-white p-6 border border-gray-200 rounded-xl shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Package className="w-6 h-6 text-purple-600" />
            </div>
            <span className="text-sm text-gray-500 font-medium">Cargo Owners</span>
          </div>
          <div className="space-y-1">
            <div className="text-2xl font-bold text-gray-900">
              {formatNumber(dashboardStats.totalCargoOwners || 0)}
            </div>
            <div className="text-xs text-gray-500">
              {dashboardStats.activeCargoOwners || 0} active
            </div>
            <div className="text-xs text-purple-600">
              {dashboardStats.totalCargoOwners > 0 ? 
                ((dashboardStats.activeCargoOwners / dashboardStats.totalCargoOwners) * 100).toFixed(1) : 0}% active rate
            </div>
          </div>
        </div>

        {/* Pending Subscriptions */}
        <div className="bg-white p-6 border border-gray-200 rounded-xl shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-orange-100 rounded-lg">
              <Clock className="w-6 h-6 text-orange-600" />
            </div>
            <span className="text-sm text-gray-500 font-medium">Pending Subs</span>
          </div>
          <div className="space-y-1">
            <div className="text-2xl font-bold text-gray-900">
              {formatNumber(dashboardStats.pendingSubscriptions || 0)}
            </div>
            <div className="text-xs text-orange-600">
              Need approval
            </div>
            {dashboardStats.pendingSubscriptions > 0 && (
              <button 
                onClick={() => setActiveTab('subscriptions')}
                className="text-xs text-blue-600 hover:text-blue-800 underline"
              >
                Review now →
              </button>
            )}
          </div>
        </div>

        {/* Subscriptions This Month */}
        <div className="bg-white p-6 border border-gray-200 rounded-xl shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-indigo-100 rounded-lg">
              <DollarSign className="w-6 h-6 text-indigo-600" />
            </div>
            <span className="text-sm text-gray-500 font-medium">Subs This Month</span>
          </div>
          <div className="space-y-1">
            <div className="text-2xl font-bold text-gray-900">
              {formatNumber(dashboardStats.newSubscriptionsThisMonth || 0)}
            </div>
            <div className="text-xs text-green-600 font-medium">
              {formatCurrency(dashboardStats.monthlyRevenue || 0)}
            </div>
            <div className="text-xs text-gray-500">
              Revenue generated
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      {adminData && (
        <div className="bg-white p-6 border border-gray-200 rounded-xl">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Activity className="w-5 h-5" />
            Quick Actions
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {quickActions.map((action, index) => {
              // Check permissions
              if (action.permission === 'super_admin' && adminData.role !== 'super_admin') return null;
              if (action.permission && !adminData.permissions?.[action.permission]) return null;

              return (
                <button
                  key={index}
                  onClick={action.action}
                  className={`${action.color} text-white p-4 rounded-lg hover:opacity-90 transition-opacity flex items-center gap-3`}
                >
                  <action.icon className="w-5 h-5" />
                  <span className="font-medium">{action.title}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Performance Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* User Growth */}
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-6 rounded-xl border border-blue-200">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-blue-500 rounded-lg">
              <TrendingUp className="w-5 h-5 text-white" />
            </div>
            <h3 className="text-lg font-semibold text-blue-900">User Growth</h3>
          </div>
          <div className="space-y-2">
            <div className="text-2xl font-bold text-blue-900">
              {dashboardStats.userGrowthRate || '0.0'}%
            </div>
            <div className="text-sm text-blue-700">
              {dashboardStats.newUsersThisMonth || 0} new users this month
            </div>
            <div className="text-xs text-blue-600">
              Total: {formatNumber(dashboardStats.totalUsers || 0)} users
            </div>
          </div>
        </div>

        {/* Load Activity */}
        <div className="bg-gradient-to-br from-green-50 to-green-100 p-6 rounded-xl border border-green-200">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-green-500 rounded-lg">
              <Package className="w-5 h-5 text-white" />
            </div>
            <h3 className="text-lg font-semibold text-green-900">Load Activity</h3>
          </div>
          <div className="space-y-2">
            <div className="text-2xl font-bold text-green-900">
              {dashboardStats.activeLoads || 0}
            </div>
            <div className="text-sm text-green-700">
              Active loads in system
            </div>
            <div className="text-xs text-green-600">
              {dashboardStats.loadCompletionRate || '0.0'}% completion rate
            </div>
          </div>
        </div>

        {/* Subscription Revenue */}
        <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-6 rounded-xl border border-purple-200">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-purple-500 rounded-lg">
              <DollarSign className="w-5 h-5 text-white" />
            </div>
            <h3 className="text-lg font-semibold text-purple-900">Revenue</h3>
          </div>
          <div className="space-y-2">
            <div className="text-2xl font-bold text-purple-900">
              {formatCurrency(dashboardStats.monthlyRevenue || 0)}
            </div>
            <div className="text-sm text-purple-700">
              From {dashboardStats.newSubscriptionsThisMonth || 0} subscriptions
            </div>
            <div className="text-xs text-purple-600">
              {dashboardStats.subscriptionRate || '0.0'}% subscription rate
            </div>
          </div>
        </div>
      </div>

      {/* Recent Activity Section */}
      <div className="bg-white p-6 border border-gray-200 rounded-xl">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Activity className="w-5 h-5" />
            Recent Activity
          </h3>
          <div className="flex items-center gap-3">
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              className="text-sm border border-gray-300 rounded-lg px-3 py-1"
            >
              <option value="today">Today</option>
              <option value="week">This Week</option>
              <option value="month">This Month</option>
            </select>
            <button
              onClick={refreshLogs}
              disabled={activityLoading}
              className="flex items-center gap-2 text-blue-600 hover:text-blue-800 disabled:text-gray-400 bg-blue-50 px-3 py-1 rounded-lg text-sm"
            >
              <RefreshCw className={`w-4 h-4 ${activityLoading ? 'animate-spin' : ''}`} />
              {activityLoading ? 'Loading...' : 'Refresh'}
            </button>
          </div>
        </div>
        
        {activityLoading ? (
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            <span className="ml-3 text-gray-600">Loading activities...</span>
          </div>
        ) : activityLogs.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <Activity className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <p>No recent activity found.</p>
            <p className="text-sm">Activities will appear here as they occur.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {activityLogs.map((log, index) => (
              <div key={log.id || log._id || index} className="flex items-start gap-4 p-4 bg-gray-50 rounded-lg border">
                <div className="p-2 bg-white rounded-full border">
                  <Activity className="w-4 h-4 text-gray-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-gray-900">
                      {getUserName(log)}
                    </span>
                    <span className="text-gray-400">•</span>
                    <span className="text-sm text-gray-600">
                      {getActivity(log)}
                    </span>
                  </div>
                  {getActivityDetails(log) && (
                    <p className="text-sm text-gray-500 mb-2">
                      {getActivityDetails(log)}
                    </p>
                  )}
                  <div className="flex items-center gap-4 text-xs text-gray-400">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {formatTimestamp(log.timestamp || log.createdAt || log.date)}
                    </span>
                    {log.ipAddress && (
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {log.ipAddress}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        
        {activityLogs.length > 0 && (
          <div className="mt-6 text-center">
            <button
              onClick={() => setActiveTab('activity')}
              className="text-blue-600 hover:text-blue-800 text-sm font-medium bg-blue-50 px-4 py-2 rounded-lg hover:bg-blue-100 transition-colors"
            >
              View all activity →
            </button>
          </div>
        )}
      </div>
    </div>
  );

  // Enhanced Activity Tab
  const renderActivityTab = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <Activity className="w-6 h-6" />
          System Activity Logs
        </h2>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Search activities..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Activities</option>
            <option value="admin_login">Login Events</option>
            <option value="user_verify">User Verifications</option>
            <option value="user_suspend">User Actions</option>
            <option value="subscription_approve">Subscription Events</option>
          </select>
          <button
            onClick={refreshLogs}
            disabled={activityLoading}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${activityLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {activityLoading ? (
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          <span className="ml-3 text-gray-600">Loading activities...</span>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          {activityLogs.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Activity className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <p>No activity logs found.</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {activityLogs.map((log, index) => (
                <div key={log.id || log._id || index} className="p-6 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-4">
                      <div className="p-2 bg-blue-100 rounded-full">
                        <Activity className="w-4 h-4 text-blue-600" />
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-gray-900">
                            {getUserName(log)}
                          </span>
                          <span className={`px-2 py-1 text-xs rounded-full border ${getStatusBadgeColor(log.action || 'default')}`}>
                            {getActivity(log)}
                          </span>
                        </div>
                        {getActivityDetails(log) && (
                          <p className="text-gray-600">{getActivityDetails(log)}</p>
                        )}
                        <div className="flex items-center gap-4 text-sm text-gray-500">
                          <span className="flex items-center gap-1">
                            <Clock className="w-4 h-4" />
                            {getFullDateTime(log.timestamp || log.createdAt || log.date)}
                          </span>
                          {log.ipAddress && (
                            <span className="flex items-center gap-1">
                              <MapPin className="w-4 h-4" />
                              {log.ipAddress}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );

  // Analytics/Reports Tab
  const renderReportsTab = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <BarChart3 className="w-6 h-6" />
          Analytics & Reports
        </h2>
        <div className="flex items-center gap-3">
          <select className="border border-gray-300 rounded-lg px-3 py-2">
            <option>Last 30 Days</option>
            <option>Last 3 Months</option>
            <option>Last Year</option>
          </select>
          <button
            onClick={() => exportData('analytics')}
            className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            Export Report
          </button>
        </div>
      </div>

      {/* Analytics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-6 border border-gray-200 rounded-xl">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Users className="w-5 h-5 text-blue-600" />
            </div>
            <h3 className="font-semibold">User Analytics</h3>
          </div>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Active Users</span>
              <span className="font-medium">{dashboardStats.activeUsers || 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">New This Month</span>
              <span className="font-medium text-green-600">+{dashboardStats.newUsersThisMonth || 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Growth Rate</span>
              <span className="font-medium">{dashboardStats.userGrowthRate || '0.0'}%</span>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 border border-gray-200 rounded-xl">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-green-100 rounded-lg">
              <Package className="w-5 h-5 text-green-600" />
            </div>
            <h3 className="font-semibold">Load Analytics</h3>
          </div>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Total Loads</span>
              <span className="font-medium">{dashboardStats.totalLoads || 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Active</span>
              <span className="font-medium text-blue-600">{dashboardStats.activeLoads || 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Completion Rate</span>
              <span className="font-medium">{dashboardStats.loadCompletionRate || '0.0'}%</span>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 border border-gray-200 rounded-xl">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-purple-100 rounded-lg">
              <DollarSign className="w-5 h-5 text-purple-600" />
            </div>
            <h3 className="font-semibold">Revenue Analytics</h3>
          </div>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Monthly Revenue</span>
              <span className="font-medium">{formatCurrency(dashboardStats.monthlyRevenue || 0)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">New Subscriptions</span>
              <span className="font-medium text-green-600">+{dashboardStats.newSubscriptionsThisMonth || 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Subscription Rate</span>
              <span className="font-medium">{dashboardStats.subscriptionRate || '0.0'}%</span>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 border border-gray-200 rounded-xl">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-orange-100 rounded-lg">
              <Clock className="w-5 h-5 text-orange-600" />
            </div>
            <h3 className="font-semibold">Pending Items</h3>
          </div>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Pending Subscriptions</span>
              <span className="font-medium text-orange-600">{dashboardStats.pendingSubscriptions || 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Pending Verifications</span>
              <span className="font-medium text-yellow-600">-</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Review Queue</span>
              <span className="font-medium">-</span>
            </div>
          </div>
        </div>
      </div>

      {/* Charts Placeholder */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 border border-gray-200 rounded-xl">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <LineChart className="w-5 h-5" />
            User Growth Trend
          </h3>
          <div className="h-64 flex items-center justify-center bg-gray-50 rounded-lg">
            <div className="text-center text-gray-500">
              <BarChart3 className="w-12 h-12 mx-auto mb-2 text-gray-300" />
              <p>Chart integration coming soon</p>
              <p className="text-sm">User registration trends over time</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 border border-gray-200 rounded-xl">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <PieChart className="w-5 h-5" />
            Revenue Distribution
          </h3>
          <div className="h-64 flex items-center justify-center bg-gray-50 rounded-lg">
            <div className="text-center text-gray-500">
              <PieChart className="w-12 h-12 mx-auto mb-2 text-gray-300" />
              <p>Chart integration coming soon</p>
              <p className="text-sm">Revenue breakdown by subscription type</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  // System Settings Tab
  const renderSettingsTab = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <Settings className="w-6 h-6" />
          System Settings
        </h2>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* General Settings */}
        <div className="bg-white p-6 border border-gray-200 rounded-xl">
          <h3 className="text-lg font-semibold mb-4">General Settings</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Platform Name
              </label>
              <input
                type="text"
                defaultValue="Infinite Cargo"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Contact Email
              </label>
              <input
                type="email"
                defaultValue="admin@infinitecargo.com"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Support Phone
              </label>
              <input
                type="tel"
                defaultValue="+254700000000"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Security Settings */}
        <div className="bg-white p-6 border border-gray-200 rounded-xl">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Shield className="w-5 h-5" />
            Security Settings
          </h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-medium text-gray-700">Two-Factor Authentication</label>
                <p className="text-xs text-gray-500">Require 2FA for all admin accounts</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" className="sr-only peer" />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-medium text-gray-700">Login Notifications</label>
                <p className="text-xs text-gray-500">Email alerts for admin logins</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" className="sr-only peer" defaultChecked />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-medium text-gray-700">Auto-lock Sessions</label>
                <p className="text-xs text-gray-500">Lock inactive admin sessions</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" className="sr-only peer" defaultChecked />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>
          </div>
        </div>

        {/* Notification Settings */}
        <div className="bg-white p-6 border border-gray-200 rounded-xl">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Bell className="w-5 h-5" />
            Notification Settings
          </h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-medium text-gray-700">New User Registrations</label>
                <p className="text-xs text-gray-500">Notify when users register</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" className="sr-only peer" defaultChecked />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-medium text-gray-700">Subscription Requests</label>
                <p className="text-xs text-gray-500">Notify of pending subscriptions</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" className="sr-only peer" defaultChecked />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-medium text-gray-700">System Alerts</label>
                <p className="text-xs text-gray-500">Critical system notifications</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" className="sr-only peer" defaultChecked />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>
          </div>
        </div>

        {/* System Maintenance */}
        <div className="bg-white p-6 border border-gray-200 rounded-xl">
          <h3 className="text-lg font-semibold mb-4">System Maintenance</h3>
          <div className="space-y-4">
            <button className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors">
              Clear System Cache
            </button>
            <button className="w-full bg-green-600 text-white py-2 px-4 rounded-lg hover:bg-green-700 transition-colors">
              Backup Database
            </button>
            <button className="w-full bg-orange-600 text-white py-2 px-4 rounded-lg hover:bg-orange-700 transition-colors">
              Generate System Report
            </button>
            <button className="w-full bg-red-600 text-white py-2 px-4 rounded-lg hover:bg-red-700 transition-colors">
              Emergency Maintenance Mode
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  // Don't render if not authenticated
  if (!authManager.isAuthenticated(true)) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="p-6 max-w-7xl mx-auto">
        {/* Header */}
        {adminData && (
          <AdminHeader
            name={adminData.name}
            role={adminData.role}
            onLogout={handleLogout}
          />
        )}

        {/* Super Admin Actions */}
        {adminData?.role === 'super_admin' && (
          <div className="mb-6 bg-white p-4 border border-gray-200 rounded-xl">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Super Admin Controls</h3>
                <p className="text-sm text-gray-600">Advanced administrative functions</p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setShowAddAdmin(true)}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2 transition-colors"
                >
                  <Shield className="w-4 h-4" />
                  Add Admin
                </button>
                <button
                  onClick={() => setActiveTab('settings')}
                  className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 flex items-center gap-2 transition-colors"
                >
                  <Settings className="w-4 h-4" />
                  Settings
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Loading Overlay */}
        {loading && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white p-6 rounded-xl shadow-lg flex items-center gap-3">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
              <span className="text-gray-700">Loading...</span>
            </div>
          </div>
        )}

        {/* Enhanced Navigation Tabs */}
        <div className="mb-8">
          <div className="border-b border-gray-200 bg-white rounded-t-xl">
            <nav className="flex overflow-x-auto">
              {[
                { key: 'overview', label: 'Overview', icon: BarChart3 },
                { key: 'users', label: 'Users', icon: Users },
                { key: 'drivers', label: 'Drivers', icon: Truck },
                { key: 'cargo-owners', label: 'Cargo Owners', icon: Package },
                { key: 'loads', label: 'Loads', icon: Package },
                { key: 'subscriptions', label: 'Subscriptions', icon: DollarSign },
                { key: 'activity', label: 'Activity', icon: Activity },
                { key: 'reports', label: 'Reports', icon: BarChart3 },
                ...(adminData?.permissions?.systemSettings ? [{ key: 'settings', label: 'Settings', icon: Settings }] : [])
              ].map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.key}
                    onClick={() => {
                      setActiveTab(tab.key);
                      setCurrentPage(1);
                    }}
                    className={`flex items-center gap-2 px-6 py-4 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                      activeTab === tab.key
                        ? 'border-blue-600 text-blue-600 bg-blue-50'
                        : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {tab.label}
                  </button>
                );
              })}
            </nav>
          </div>
        </div>

        {/* Tab Content */}
        <div className="bg-white rounded-b-xl min-h-[600px]">
          {activeTab === 'overview' && renderOverview()}
          
          {activeTab === 'activity' && renderActivityTab()}
          
          {activeTab === 'reports' && renderReportsTab()}
          
          {activeTab === 'settings' && renderSettingsTab()}

          {activeTab === 'users' && (
            <div className="p-6">
              <UsersTable
                apiCall={apiCall}
                showError={showError}
                showSuccess={showSuccess}
                getStatusBadgeColor={getStatusBadgeColor}
                currentPage={currentPage}
                setCurrentPage={setCurrentPage}
                itemsPerPage={itemsPerPage}
              />
            </div>
          )}

          {activeTab === 'drivers' && (
            <div className="p-6">
              <DriversTable
                apiCall={apiCall}
                showError={showError}
                showSuccess={showSuccess}
                getStatusBadgeColor={getStatusBadgeColor}
                currentPage={currentPage}
                setCurrentPage={setCurrentPage}
                itemsPerPage={itemsPerPage}
              />
            </div>
          )}

          {activeTab === 'cargo-owners' && (
            <div className="p-6">
              <CargoOwnersTable
                apiCall={apiCall}
                showError={showError}
                showSuccess={showSuccess}
                getStatusBadgeColor={getStatusBadgeColor}
                currentPage={currentPage}
                setCurrentPage={setCurrentPage}
                itemsPerPage={itemsPerPage}
              />
            </div>
          )}

          {activeTab === 'loads' && (
            <div className="p-6">
              <LoadsTable
                apiCall={apiCall}
                showError={showError}
                showSuccess={showSuccess}
                getStatusBadgeColor={getStatusBadgeColor}
                currentPage={currentPage}
                setCurrentPage={setCurrentPage}
                itemsPerPage={itemsPerPage}
              />
            </div>
          )}

          {activeTab === 'subscriptions' && (
            <div className="p-6">
              <SubscriptionsTable
                apiCall={apiCall}
                showError={showError}
                showSuccess={showSuccess}
                formatCurrency={formatCurrency}
                currentPage={currentPage}
                setCurrentPage={setCurrentPage}
                itemsPerPage={itemsPerPage}
              />
            </div>
          )}
        </div>
        
        {/* ADD ADMIN MODAL */}
        {showAddAdmin && (
          <AddAdminModal
            newAdmin={newAdmin}
            setNewAdmin={setNewAdmin}
            onSubmit={handleAddAdminSubmit}
            onClose={() => setShowAddAdmin(false)}
            loading={loading}
          />
        )}
      </div>
    </div>
  );
};

export default AdminDashboard;