import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import UsersTable from './UsersTable';
import DriversTable from './DriversTable';
import CargoOwnersTable from './CargoOwnersTable';
import LoadsTable from './LoadsTable';
import SubscriptionsTable from './SubscriptionsTable';
import AdminNotifications from './AdminNotifications';
import AdminHeader from './AdminHeader';
import AddAdminModal from './AddAdminModal';
import { 
  Users, Package, Truck, DollarSign, RefreshCw, TrendingUp,
  Clock, CheckCircle, AlertCircle, Activity, MapPin, Shield,
  Settings, Bell, Search, Download, BarChart3, PieChart, LineChart
} from 'lucide-react';
import { authManager, isAuthenticated, getAuthHeader } from '../../utils/auth';

const API_BASE_URL = 'https://infinite-cargo-api.onrender.com/api';
const ITEMS_PER_PAGE = 10;

// Utility functions
const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-KE', {
    style: 'currency',
    currency: 'KES'
  }).format(amount || 0);
};

const formatNumber = (num) => {
  return new Intl.NumberFormat('en-KE').format(num || 0);
};

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

const AdminDashboard = () => {
  const navigate = useNavigate();
  
  // Core state
  const [activeTab, setActiveTab] = useState('overview');
  const [currentPage, setCurrentPage] = useState(1);
  const [adminData, setAdminData] = useState(null);
  const [dashboardStats, setDashboardStats] = useState({});
  const [activityLogs, setActivityLogs] = useState([]);
  const [activityPagination, setActivityPagination] = useState({ currentPage: 1, totalPages: 1, total: 0 });
  
  // Loading states
  const [loading, setLoading] = useState(false);
  const [statsLoading, setStatsLoading] = useState(false);
  const [activityLoading, setActivityLoading] = useState(false);
  
  // Message states
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  
  // Modal and form states
  const [showAddAdmin, setShowAddAdmin] = useState(false);
  const [newAdmin, setNewAdmin] = useState({
    name: '', email: '', phone: '', password: '', role: 'admin',
  });
  
  // Search and filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [dateRange, setDateRange] = useState('today');

  // API call wrapper with auth handling
  const apiCall = useCallback(async (endpoint, options = {}) => {
    try {
      if (!isAuthenticated(true)) {
        navigate('/admin/login');
        throw new Error('Authentication required');
      }

      const authHeader = getAuthHeader(true);
      const config = {
        headers: {
          'Content-Type': 'application/json',
          ...authHeader,
        },
        ...options,
      };

      const response = await fetch(`${API_BASE_URL}${endpoint}`, config);
      const data = await response.json();

      if (response.status === 401) {
        authManager.clearAuth(true);
        navigate('/admin/login');
        throw new Error('Session expired. Please login again.');
      }

      if (!response.ok) {
        throw new Error(data.message || `API error: ${response.status}`);
      }

      return data;
    } catch (error) {
      console.error('API call failed:', error);
      throw error;
    }
  }, [navigate]);

  // Message handlers
  const showError = useCallback((msg) => {
    setError(msg);
    setTimeout(() => setError(''), 5000);
  }, []);

  const showSuccess = useCallback((msg) => {
    setSuccessMessage(msg);
    setTimeout(() => setSuccessMessage(''), 5000);
  }, []);

  // Data fetching functions
  const fetchAdmin = useCallback(async () => {
    try {
      const response = await apiCall('/admin/me');
      if (response.status === 'success' && response.admin) {
        setAdminData(response.admin);
      } else {
        const user = authManager.getUser(true);
        setAdminData({ 
          name: user?.name || 'Admin', 
          email: user?.email || '',
          role: user?.role || 'admin' 
        });
        
      }
    } catch (error) {
      console.error('Failed to fetch admin data:', error);
      const user = authManager.getUser(true);
      if (user) {
        setAdminData({ 
          name: user.name || 'Admin', 
          email: user.email || '',
          role: user.role || 'admin' 
        });
      }
    }
  }, [apiCall]);




  const fetchDashboardStats = useCallback(async () => {
    try {
      setStatsLoading(true);
      const response = await apiCall('/admin/dashboard-stats');
      
      if (response.status === 'success') {
        // Handle the nested data structure from your API
        const statsData = response.data || response.stats || {};
        
        // Flatten the structure for easier access in components
        const flattenedStats = {
          // Load metrics
          totalLoads: statsData.loads?.total || 0,
          activeLoads: statsData.loads?.active || 0,
          newLoadsToday: statsData.loads?.newToday || 0,
          newLoadsThisWeek: statsData.loads?.newThisWeek || 0,
          newLoadsThisMonth: statsData.loads?.newThisMonth || 0,
          completedLoads: statsData.loads?.completed || 0,
          loadCompletionRate: statsData.loads?.completionRate || statsData.kpis?.loadCompletionRate || 0,
          urgentLoads: statsData.loads?.urgent || 0,
          
          // User metrics
          totalUsers: statsData.users?.total || 0,
          activeUsers: statsData.users?.active || 0,
          newUsersToday: statsData.users?.newToday || 0,
          newUsersThisWeek: statsData.users?.newThisWeek || 0,
          newUsersThisMonth: statsData.users?.newThisMonth || 0,
          userGrowthRate: statsData.users?.growthRate || statsData.kpis?.userGrowthRate || 0,
          
          // Driver metrics
          totalDrivers: statsData.users?.drivers?.total || 0,
          activeDrivers: statsData.users?.drivers?.active || 0,
          newDriversToday: statsData.users?.drivers?.newToday || 0,
          newDriversThisWeek: statsData.users?.drivers?.newThisWeek || 0,
          newDriversThisMonth: statsData.users?.drivers?.newThisMonth || 0,
          verifiedDrivers: statsData.users?.drivers?.verified || 0,
          
          // Cargo owner metrics
          totalCargoOwners: statsData.users?.cargoOwners?.total || 0,
          activeCargoOwners: statsData.users?.cargoOwners?.active || 0,
          newCargoOwnersToday: statsData.users?.cargoOwners?.newToday || 0,
          newCargoOwnersThisWeek: statsData.users?.cargoOwners?.newThisWeek || 0,
          newCargoOwnersThisMonth: statsData.users?.cargoOwners?.newThisMonth || 0,
          verifiedCargoOwners: statsData.users?.cargoOwners?.verified || 0,
          
          // Subscription metrics
          totalSubscriptions: statsData.subscriptions?.total || 0,
          activeSubscriptions: statsData.subscriptions?.active || 0,
          pendingSubscriptions: statsData.subscriptions?.pending || 0,
          newSubscriptionsThisMonth: statsData.subscriptions?.newThisMonth || 0,
          subscriptionRate: statsData.subscriptions?.rate || statsData.kpis?.subscriptionRate || 0,
          subscriptionGrowthRate: statsData.subscriptions?.growthRate || 0,
          
          // Revenue metrics
          monthlyRevenue: statsData.revenue?.monthly || 0,
          totalRevenue: statsData.revenue?.total || 0,
          averageRevenuePerSubscription: statsData.revenue?.averagePerSubscription || 0,
          
          // Additional KPIs
          ...statsData.kpis
        };
        
        setDashboardStats(flattenedStats);
      }
    } catch (error) {
      console.error('Failed to fetch dashboard stats:', error);
      showError('Failed to load dashboard statistics');
      
      // Set empty stats on error
      setDashboardStats({
        totalLoads: 0, activeLoads: 0, newLoadsToday: 0, newLoadsThisWeek: 0, newLoadsThisMonth: 0,
        totalUsers: 0, activeUsers: 0, newUsersToday: 0, newUsersThisWeek: 0, newUsersThisMonth: 0,
        totalDrivers: 0, activeDrivers: 0, totalCargoOwners: 0, activeCargoOwners: 0,
        totalSubscriptions: 0, activeSubscriptions: 0, pendingSubscriptions: 0, newSubscriptionsThisMonth: 0,
        monthlyRevenue: 0, totalRevenue: 0, userGrowthRate: 0, subscriptionRate: 0, loadCompletionRate: 0
      });
    } finally {
      setStatsLoading(false);
    }
  }, [apiCall, showError]);

  const fetchActivityLogs = useCallback(async (page = 1) => {
    try {
      setActivityLoading(true);
      const response = await apiCall(`/admin/audit-logs?page=${page}&limit=${ITEMS_PER_PAGE}`);
      
      if (response.status === 'success') {
        if (response.data) {
          setActivityLogs(response.data);
          setActivityPagination({
            currentPage: response.pagination?.currentPage || page,
            totalPages: response.pagination?.totalPages || 1,
            total: response.pagination?.total || response.data.length
          });
        } else if (response.logs) {
          setActivityLogs(response.logs);
          setActivityPagination({
            currentPage: page,
            totalPages: Math.ceil((response.logs.length || 0) / ITEMS_PER_PAGE),
            total: response.logs.length || 0
          });
        }
      }
    } catch (error) {
      console.error('Failed to fetch activity logs:', error);
      setActivityLogs([]);
      setActivityPagination({ currentPage: 1, totalPages: 1, total: 0 });
    } finally {
      setActivityLoading(false);
    }
  }, [apiCall]);

  // Initial data load
  useEffect(() => {
    if (!isAuthenticated(true)) {
      navigate('/admin/login');
      return;
    }

    fetchAdmin();
    fetchDashboardStats();
    fetchActivityLogs();
  }, [navigate, fetchAdmin, fetchDashboardStats, fetchActivityLogs]);

  // Admin creation handler with improved error handling
  const handleAddAdminSubmit = async (e) => {
    e.preventDefault();
    
    // Basic validation
    if (!newAdmin.name || !newAdmin.email || !newAdmin.phone || !newAdmin.password) {
      showError('Please fill in all required fields');
      return;
    }

    if (newAdmin.password.length < 8) {
      showError('Password must be at least 8 characters long');
      return;
    }

    try {
      setLoading(true);
      const response = await apiCall('/admin/register', {
        method: 'POST',
        body: JSON.stringify(newAdmin),
      });
      
      if (response.status === 'success') {
        showSuccess('Admin created successfully');
        setShowAddAdmin(false);
        setNewAdmin({ name: '', email: '', phone: '', password: '', role: 'admin' });
        // Refresh stats after creating new admin
        fetchDashboardStats();
        fetchActivityLogs();
      } else {
        // Handle validation errors from server
        if (response.errors && Array.isArray(response.errors)) {
          const errorMessages = response.errors.map(err => err.message).join(', ');
          showError(errorMessages);
        } else {
          showError(response.message || 'Failed to create admin');
        }
      }
    } catch (error) {
      console.error('Add admin error:', error);
      showError(error.message || 'Failed to create admin');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    authManager.clearAuth(true);
    navigate('/admin/login');
  };

  // Helper functions for activity logs
  const getUserName = (log) => {
    return log.user?.name || log.userName || log.adminName || log.admin?.name || 
           (typeof log.user === 'string' ? log.user : 'Unknown User');
  };

  const getActivity = (log) => {
    return log.action || log.activity || log.message || 'Activity logged';
  };

  const getActivityDetails = (log) => {
    const details = log.details || log.description || log.resource || log.target;
    if (!details) {
      // Try to build details from other fields
      if (log.newAdminEmail) return `New admin: ${log.newAdminEmail} (${log.newAdminRole || 'admin'})`;
      if (log.entityType && log.action) return `${log.action} on ${log.entityType}`;
      return null;
    }
    
    if (typeof details === 'object') {
      if (details.planName) return `Plan: ${details.planName}`;
      if (details.amount) return `Amount: ${formatCurrency(details.amount)}`;
      if (details.paymentMethod) return `Payment: ${details.paymentMethod}`;
      return Object.entries(details)
        .filter(([key, value]) => value !== null && value !== undefined)
        .map(([key, value]) => `${key}: ${value}`)
        .join(', ');
    }
    
    return String(details);
  };

  // Export data function
  const exportData = async (type) => {
    try {
      setLoading(true);
      const response = await apiCall(`/admin/analytics/export?type=${type}&format=json`);
      
      if (response.status === 'success') {
        // Create and download file
        const dataStr = JSON.stringify(response.data || response, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${type}-export-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        
        showSuccess(`${type} data exported successfully`);
      }
    } catch (error) {
      showError(`Failed to export ${type} data: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Stat Card Component
  const StatCard = ({ icon: Icon, title, value, subtitle, extra, trend, percentage, actionButton, color }) => {
    const colorClasses = {
      yellow: 'bg-yellow-100 text-yellow-600',
      blue: 'bg-blue-100 text-blue-600',
      green: 'bg-green-100 text-green-600',
      purple: 'bg-purple-100 text-purple-600',
      orange: 'bg-orange-100 text-orange-600',
      indigo: 'bg-indigo-100 text-indigo-600',
    };

    return (
      <div className="bg-white p-6 border border-gray-200 rounded-xl shadow-sm hover:shadow-md transition-shadow">
        <div className="flex items-center justify-between mb-4">
          <div className={`p-2 rounded-lg ${colorClasses[color]}`}>
            <Icon className="w-6 h-6" />
          </div>
          <span className="text-sm text-gray-500 font-medium">{title}</span>
        </div>
        <div className="space-y-1">
          <div className="text-2xl font-bold text-gray-900">{value}</div>
          {trend && (
            <div className="flex items-center gap-1 text-sm">
              <TrendingUp className="w-3 h-3 text-green-500" />
              <span className="text-green-600">{trend}</span>
            </div>
          )}
          {subtitle && <div className="text-xs text-gray-500">{subtitle}</div>}
          {extra && <div className="text-xs text-gray-500">{extra}</div>}
          {percentage && (
            <div className={`text-xs text-${color}-600`}>{percentage}% active rate</div>
          )}
          {actionButton && (
            <button 
              onClick={actionButton.onClick}
              className="text-xs text-blue-600 hover:text-blue-800 underline"
            >
              {actionButton.text}
            </button>
          )}
        </div>
      </div>
    );
  };

  // Quick Actions Component
  const QuickActions = ({ adminData, onAddAdmin, onChangeTab }) => {
    const actions = [
      {
        title: 'Add New Admin',
        icon: Shield,
        action: onAddAdmin,
        color: 'bg-blue-500',
        permission: 'super_admin'
      },
      {
        title: 'View Reports',
        icon: BarChart3,
        action: () => onChangeTab('reports'),
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
        action: () => onChangeTab('settings'),
        color: 'bg-orange-500',
        permission: 'systemSettings'
      }
    ];

    return (
      <div className="bg-white p-6 border border-gray-200 rounded-xl">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Activity className="w-5 h-5" />
          Quick Actions
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {actions.map((action, index) => {
            if (action.permission === 'super_admin' && adminData?.role !== 'super_admin') return null;
            if (action.permission && !adminData?.permissions?.[action.permission]) return null;

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
    );
  };

  // Performance Summary Component
  const PerformanceSummary = ({ stats }) => (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-6 rounded-xl border border-blue-200">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-blue-500 rounded-lg">
            <TrendingUp className="w-5 h-5 text-white" />
          </div>
          <h3 className="text-lg font-semibold text-blue-900">User Growth</h3>
        </div>
        <div className="space-y-2">
          <div className="text-2xl font-bold text-blue-900">
            {stats.userGrowthRate || '0.0'}%
          </div>
          <div className="text-sm text-blue-700">
            {stats.newUsersThisMonth || 0} new users this month
          </div>
          <div className="text-xs text-blue-600">
            Total: {formatNumber(stats.totalUsers || 0)} users
          </div>
        </div>
      </div>

      <div className="bg-gradient-to-br from-green-50 to-green-100 p-6 rounded-xl border border-green-200">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-green-500 rounded-lg">
            <Package className="w-5 h-5 text-white" />
          </div>
          <h3 className="text-lg font-semibold text-green-900">Load Activity</h3>
        </div>
        <div className="space-y-2">
          <div className="text-2xl font-bold text-green-900">
            {stats.activeLoads || 0}
          </div>
          <div className="text-sm text-green-700">Active loads in system</div>
          <div className="text-xs text-green-600">
            {stats.loadCompletionRate || '0.0'}% completion rate
          </div>
        </div>
      </div>

      <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-6 rounded-xl border border-purple-200">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-purple-500 rounded-lg">
            <DollarSign className="w-5 h-5 text-white" />
          </div>
          <h3 className="text-lg font-semibold text-purple-900">Revenue</h3>
        </div>
        <div className="space-y-2">
          <div className="text-2xl font-bold text-purple-900">
            {formatCurrency(stats.monthlyRevenue || 0)}
          </div>
          <div className="text-sm text-purple-700">
            From {stats.newSubscriptionsThisMonth || 0} subscriptions
          </div>
          <div className="text-xs text-purple-600">
            {stats.subscriptionRate || '0.0'}% subscription rate
          </div>
        </div>
      </div>
    </div>
  );

  // Loading Spinner Component
  const LoadingSpinner = ({ message = "Loading..." }) => (
    <div className="flex justify-center items-center py-12">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      <span className="ml-3 text-gray-600">{message}</span>
    </div>
  );

  // Empty State Component
  const EmptyState = ({ icon: Icon, message, submessage }) => (
    <div className="text-center py-12 text-gray-500">
      <Icon className="w-12 h-12 mx-auto mb-4 text-gray-300" />
      <p>{message}</p>
      {submessage && <p className="text-sm">{submessage}</p>}
    </div>
  );

  // Activity Log Item Component
  const ActivityLogItem = ({ log, getUserName, getActivity, getActivityDetails, formatTimestamp }) => (
    <div className="flex items-start gap-4 p-4 bg-gray-50 rounded-lg border">
      <div className="p-2 bg-white rounded-full border">
        <Activity className="w-4 h-4 text-gray-600" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="font-medium text-gray-900">{getUserName(log)}</span>
          <span className="text-gray-400">•</span>
          <span className="text-sm text-gray-600">{getActivity(log)}</span>
        </div>
        {getActivityDetails(log) && (
          <p className="text-sm text-gray-500 mb-2">{getActivityDetails(log)}</p>
        )}
        <div className="flex items-center gap-4 text-xs text-gray-400">
          <span className="flex items-center gap-1">
            <Clock className="w-4 h-4" />
            {formatTimestamp(log.timestamp || log.createdAt || log.date)}
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
  );

  // Recent Activity Component
  const RecentActivity = ({ logs, loading, onRefresh, onViewAll }) => (
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
            onClick={onRefresh}
            disabled={loading}
            className="flex items-center gap-2 text-blue-600 hover:text-blue-800 disabled:text-gray-400 bg-blue-50 px-3 py-1 rounded-lg text-sm"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            {loading ? 'Loading...' : 'Refresh'}
          </button>
        </div>
      </div>
      
      {loading ? (
        <LoadingSpinner message="Loading activities..." />
      ) : logs.length === 0 ? (
        <EmptyState icon={Activity} message="No recent activity found." submessage="Activities will appear here as they occur." />
      ) : (
        <div className="space-y-4">
          {logs.slice(0, 5).map((log, index) => (
            <ActivityLogItem 
              key={log.id || log._id || index}
              log={log}
              getUserName={getUserName}
              getActivity={getActivity}
              getActivityDetails={getActivityDetails}
              formatTimestamp={formatTimestamp}
            />
          ))}
          {logs.length > 0 && (
            <div className="mt-6 text-center">
              <button
                onClick={onViewAll}
                className="text-blue-600 hover:text-blue-800 text-sm font-medium bg-blue-50 px-4 py-2 rounded-lg hover:bg-blue-100 transition-colors"
              >
                View all activity →
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );

  // Overview section component
  const OverviewSection = () => (
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

      {/* Welcome Header */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold mb-2">Welcome back, {adminData?.name}!</h2>
            <p className="text-blue-100">Here's what's happening with your platform today.</p>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={fetchDashboardStats}
              disabled={statsLoading}
              className="bg-white/20 hover:bg-white/30 px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${statsLoading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <div className="text-right">
              <div className="text-sm text-blue-100">Total Revenue</div>
              <div className="text-xl font-bold">{formatCurrency(dashboardStats.totalRevenue || 0)}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <StatCard
          icon={Package}
          title="Total Loads"
          value={formatNumber(dashboardStats.totalLoads || 0)}
          subtitle={`${dashboardStats.activeLoads || 0} active`}
          trend={dashboardStats.newLoadsThisMonth > 0 ? `+${dashboardStats.newLoadsThisMonth} this month` : null}
          color="yellow"
        />
        
        <StatCard
          icon={Users}
          title="New Users Today"
          value={formatNumber(dashboardStats.newUsersToday || 0)}
          subtitle={`${dashboardStats.newUsersThisWeek || 0} this week`}
          extra={`${dashboardStats.newUsersThisMonth || 0} this month`}
          color="blue"
        />
        
        <StatCard
          icon={Truck}
          title="Total Drivers"
          value={formatNumber(dashboardStats.totalDrivers || 0)}
          subtitle={`${dashboardStats.activeDrivers || 0} active`}
          percentage={dashboardStats.totalDrivers > 0 ? 
            ((dashboardStats.activeDrivers / dashboardStats.totalDrivers) * 100).toFixed(1) : 0}
          color="green"
        />
        
        <StatCard
          icon={Package}
          title="Cargo Owners"
          value={formatNumber(dashboardStats.totalCargoOwners || 0)}
          subtitle={`${dashboardStats.activeCargoOwners || 0} active`}
          percentage={dashboardStats.totalCargoOwners > 0 ? 
            ((dashboardStats.activeCargoOwners / dashboardStats.totalCargoOwners) * 100).toFixed(1) : 0}
          color="purple"
        />
        
        <StatCard
          icon={Clock}
          title="Pending Subs"
          value={formatNumber(dashboardStats.pendingSubscriptions || 0)}
          subtitle="Need approval"
          actionButton={dashboardStats.pendingSubscriptions > 0 ? {
            text: "Review now →",
            onClick: () => setActiveTab('subscriptions')
          } : null}
          color="orange"
        />
        
        <StatCard
          icon={DollarSign}
          title="Subs This Month"
          value={formatNumber(dashboardStats.newSubscriptionsThisMonth || 0)}
          subtitle={formatCurrency(dashboardStats.monthlyRevenue || 0)}
          extra="Revenue generated"
          color="indigo"
        />
      </div>

      {/* Quick Actions */}
      <QuickActions 
        adminData={adminData}
        onAddAdmin={() => setShowAddAdmin(true)}
        onChangeTab={setActiveTab}
      />

      {/* Performance Summary */}
      <PerformanceSummary stats={dashboardStats} />

      {/* Recent Activity */}
      <RecentActivity 
        logs={activityLogs}
        loading={activityLoading}
        onRefresh={() => fetchActivityLogs(1)}
        onViewAll={() => setActiveTab('activity')}
      />
    </div>
  );

  // Activity Tab with Pagination
  const ActivityTab = () => (
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
            onClick={() => fetchActivityLogs(activityPagination.currentPage)}
            disabled={activityLoading}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${activityLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {activityLoading ? (
        <LoadingSpinner />
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          {activityLogs.length === 0 ? (
            <EmptyState icon={Activity} message="No activity logs found." />
          ) : (
            <>
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
                            <span className="font-medium text-gray-900">
                              {getUserName(log)}
                            </span>
                            <span className={`px-2 py-1 text-xs rounded-full border ${getStatusBadgeColor(log.action || 'default')}`}>
                              {getActivity(log)}
                            </span>
                          </div>
                          {getActivityDetails(log) && (
                            <p className="text-sm text-gray-500 mb-2">{getActivityDetails(log)}</p>
                          )}
                          <div className="flex items-center gap-4 text-xs text-gray-400">
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {new Date(log.timestamp || log.createdAt || log.date).toLocaleString()}
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
                    </div>
                  </div>
                ))}
              </div>
              
              {/* Pagination for Activity Logs */}
              {activityPagination.totalPages > 1 && (
                <div className="flex items-center justify-between p-4 bg-gray-50 border-t">
                  <span className="text-sm text-gray-700">
                    Page {activityPagination.currentPage} of {activityPagination.totalPages} ({activityPagination.total} total)
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => fetchActivityLogs(Math.max(1, activityPagination.currentPage - 1))}
                      disabled={activityPagination.currentPage === 1}
                      className="px-3 py-1 border rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
                    >
                      Previous
                    </button>
                    <span className="px-3 py-1 text-sm">
                      Page {activityPagination.currentPage} of {activityPagination.totalPages}
                    </span>
                    <button
                      onClick={() => fetchActivityLogs(Math.min(activityPagination.totalPages, activityPagination.currentPage + 1))}
                      disabled={activityPagination.currentPage === activityPagination.totalPages}
                      className="px-3 py-1 border rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );

  // Analytics Card Component
  const AnalyticsCard = ({ title, icon: Icon, color, data }) => {
    const colorClasses = {
      blue: 'bg-blue-100 text-blue-600',
      green: 'bg-green-100 text-green-600',
      purple: 'bg-purple-100 text-purple-600',
      orange: 'bg-orange-100 text-orange-600',
    };

    return (
      <div className="bg-white p-6 border border-gray-200 rounded-xl">
        <div className="flex items-center gap-3 mb-4">
          <div className={`p-2 rounded-lg ${colorClasses[color]}`}>
            <Icon className="w-5 h-5" />
          </div>
          <h3 className="font-semibold">{title}</h3>
        </div>
        <div className="space-y-3">
          {data.map((item, index) => (
            <div key={index} className="flex justify-between">
              <span className="text-sm text-gray-600">{item.label}</span>
              <span className={`font-medium ${item.highlight ? `text-${item.highlight}-600` : ''}`}>
                {item.value}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  // Chart Placeholder Component
  const ChartPlaceholder = ({ title, icon: Icon, description }) => (
    <div className="bg-white p-6 border border-gray-200 rounded-xl">
      <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
        <Icon className="w-5 h-5" />
        {title}
      </h3>
      <div className="h-64 flex items-center justify-center bg-gray-50 rounded-lg">
        <div className="text-center text-gray-500">
          <BarChart3 className="w-12 h-12 mx-auto mb-2 text-gray-300" />
          <p>Chart integration coming soon</p>
          <p className="text-sm">{description}</p>
        </div>
      </div>
    </div>
  );

  // Reports/Analytics Tab Component
  const ReportsTab = () => (
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

      {/* Analytics Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <AnalyticsCard
          title="User Analytics"
          icon={Users}
          color="blue"
          data={[
            { label: 'Active Users', value: formatNumber(dashboardStats.activeUsers || 0) },
            { label: 'New This Month', value: `+${dashboardStats.newUsersThisMonth || 0}`, highlight: 'green' },
            { label: 'Growth Rate', value: `${dashboardStats.userGrowthRate || '0.0'}%` }
          ]}
        />
        
        <AnalyticsCard
          title="Load Analytics"
          icon={Package}
          color="green"
          data={[
            { label: 'Total Loads', value: formatNumber(dashboardStats.totalLoads || 0) },
            { label: 'Active', value: formatNumber(dashboardStats.activeLoads || 0), highlight: 'blue' },
            { label: 'Completion Rate', value: `${dashboardStats.loadCompletionRate || '0.0'}%` }
          ]}
        />
        
        <AnalyticsCard
          title="Revenue Analytics"
          icon={DollarSign}
          color="purple"
          data={[
            { label: 'Monthly Revenue', value: formatCurrency(dashboardStats.monthlyRevenue || 0) },
            { label: 'New Subscriptions', value: `+${dashboardStats.newSubscriptionsThisMonth || 0}`, highlight: 'green' },
            { label: 'Subscription Rate', value: `${dashboardStats.subscriptionRate || '0.0'}%` }
          ]}
        />
        
        <AnalyticsCard
          title="Pending Items"
          icon={Clock}
          color="orange"
          data={[
            { label: 'Pending Subscriptions', value: formatNumber(dashboardStats.pendingSubscriptions || 0), highlight: 'orange' },
            { label: 'Total Subscriptions', value: formatNumber(dashboardStats.totalSubscriptions || 0) },
            { label: 'Active Subscriptions', value: formatNumber(dashboardStats.activeSubscriptions || 0) }
          ]}
        />
      </div>

      {/* Chart Placeholders */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartPlaceholder
          title="User Growth Trend"
          icon={LineChart}
          description="User registration trends over time"
        />
        <ChartPlaceholder
          title="Revenue Distribution"
          icon={PieChart}
          description="Revenue breakdown by subscription type"
        />
      </div>
    </div>
  );

  // Settings Card Component
  const SettingsCard = ({ title, icon: Icon, fields = [], toggles = [], actions = [] }) => (
    <div className="bg-white p-6 border border-gray-200 rounded-xl">
      <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
        {Icon && <Icon className="w-5 h-5" />}
        {title}
      </h3>
      
      {/* Input Fields */}
      {fields.length > 0 && (
        <div className="space-y-4">
          {fields.map((field, index) => (
            <div key={index}>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {field.label}
              </label>
              <input
                type={field.type}
                defaultValue={field.defaultValue}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          ))}
        </div>
      )}
      
      {/* Toggle Switches */}
      {toggles.length > 0 && (
        <div className="space-y-4">
          {toggles.map((toggle, index) => (
            <div key={index} className="flex items-center justify-between">
              <div>
                <label className="text-sm font-medium text-gray-700">{toggle.label}</label>
                <p className="text-xs text-gray-500">{toggle.description}</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" className="sr-only peer" defaultChecked={toggle.defaultChecked} />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>
          ))}
        </div>
      )}
      
      {/* Action Buttons */}
      {actions.length > 0 && (
        <div className="space-y-4">
          {actions.map((action, index) => (
            <button
              key={index}
              className={`w-full bg-${action.color}-600 text-white py-2 px-4 rounded-lg hover:bg-${action.color}-700 transition-colors`}
            >
              {action.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );

  // Settings Tab Component
  const SettingsTab = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <Settings className="w-6 h-6" />
          System Settings
        </h2>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* General Settings */}
        <SettingsCard
          title="General Settings"
          fields={[
            { label: 'Platform Name', type: 'text', defaultValue: 'Infinite Cargo' },
            { label: 'Contact Email', type: 'email', defaultValue: 'admin@infinitecargo.com' },
            { label: 'Support Phone', type: 'tel', defaultValue: '+254700000000' }
          ]}
        />

        {/* Security Settings */}
        <SettingsCard
          title="Security Settings"
          icon={Shield}
          toggles={[
            { label: 'Two-Factor Authentication', description: 'Require 2FA for all admin accounts', defaultChecked: false },
            { label: 'Login Notifications', description: 'Email alerts for admin logins', defaultChecked: true },
            { label: 'Auto-lock Sessions', description: 'Lock inactive admin sessions', defaultChecked: true }
          ]}
        />

        {/* Notification Settings */}
        <SettingsCard
          title="Notification Settings"
          icon={Bell}
          toggles={[
            { label: 'New User Registrations', description: 'Notify when users register', defaultChecked: true },
            { label: 'Subscription Requests', description: 'Notify of pending subscriptions', defaultChecked: true },
            { label: 'System Alerts', description: 'Critical system notifications', defaultChecked: true }
          ]}
        />

        {/* System Maintenance */}
        <SettingsCard
          title="System Maintenance"
          actions={[
            { label: 'Clear System Cache', color: 'blue' },
            { label: 'Backup Database', color: 'green' },
            { label: 'Generate System Report', color: 'orange' },
            { label: 'Emergency Maintenance Mode', color: 'red' }
          ]}
        />
      </div>
    </div>
  );

  // Navigation tabs configuration
  const navigationTabs = [
    { key: 'overview', label: 'Overview', icon: BarChart3 },
    { key: 'users', label: 'Users', icon: Users },
    { key: 'drivers', label: 'Drivers', icon: Truck },
    { key: 'cargo-owners', label: 'Cargo Owners', icon: Package },
    { key: 'loads', label: 'Loads', icon: Package },
    { key: 'subscriptions', label: 'Subscriptions', icon: DollarSign },
    { key: 'notifications', label: 'Notifications', icon: Bell },
    { key: 'activity', label: 'Activity', icon: Activity },
    { key: 'reports', label: 'Reports', icon: BarChart3 },
    ...(adminData?.role === 'super_admin' || adminData?.permissions?.systemSettings ? 
      [{ key: 'settings', label: 'Settings', icon: Settings }] : [])
  ];

  // Table component props
  const tableProps = {
    apiCall,
    showError,
    showSuccess,
    getStatusBadgeColor,
    currentPage,
    setCurrentPage,
    itemsPerPage: ITEMS_PER_PAGE
  };

  // Don't render if not authenticated
  if (!isAuthenticated(true)) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="p-6 max-w-7xl mx-auto">
        {/* Admin Header */}
        {adminData && (
          <AdminHeader
            name={adminData.name}
            role={adminData.role}
            onLogout={handleLogout}
            apiCall={apiCall}
            onNotificationClick={() => setActiveTab('notifications')}
            isAuthenticated={isAuthenticated(true)}
          />
        )}

        {/* Super Admin Controls */}
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

        {/* Navigation Tabs */}
        <div className="mb-8">
          <div className="border-b border-gray-200 bg-white rounded-t-xl">
            <nav className="flex overflow-x-auto">
              {navigationTabs.map((tab) => {
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
          {activeTab === 'overview' && <OverviewSection />}
          {activeTab === 'activity' && <ActivityTab />}
          {activeTab === 'reports' && <ReportsTab />}
          {activeTab === 'settings' && <SettingsTab />}

          {/* Table Components */}
          {activeTab === 'users' && (
            <div className="p-6">
              <UsersTable {...tableProps} />
            </div>
          )}

          {activeTab === 'drivers' && (
            <div className="p-6">
              <DriversTable {...tableProps} />
            </div>
          )}

          {activeTab === 'cargo-owners' && (
            <div className="p-6">
              <CargoOwnersTable {...tableProps} />
            </div>
          )}

          {activeTab === 'loads' && (
            <div className="p-6">
              <LoadsTable 
              apiCall={apiCall}
              showError={showError}
              showSuccess={showSuccess}
              currentPage={currentPage}
              setCurrentPage={setCurrentPage}
              itemsPerPage={ITEMS_PER_PAGE}
              getStatusBadgeColor={getStatusBadgeColor}
              />
            </div>
          )}

          {activeTab === 'subscriptions' && (
            <div className="p-6">
              <SubscriptionsTable
                apiCall={apiCall}
                showError={showError}
                showSuccess={showSuccess}
                currentPage={currentPage}
                setCurrentPage={setCurrentPage}
                itemsPerPage={ITEMS_PER_PAGE}
                formatCurrency={formatCurrency}
              />
            </div>
          )}

          {activeTab === 'notifications' && (
            <div className="p-6">
              <AdminNotifications
                apiCall={apiCall}
                showError={showError}
                showSuccess={showSuccess}
                adminData={adminData}
              />
            </div>
          )}
        </div>
        
        {/* Add Admin Modal */}
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