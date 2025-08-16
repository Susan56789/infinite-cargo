import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import UsersTable from './UsersTable';
import DriversTable from './DriversTable';
import CargoOwnersTable from './CargoOwnersTable';
import LoadsTable from './LoadsTable';
import SubscriptionsTable from './SubscriptionsTable';
import AdminHeader from './AdminHeader';
import AddAdminModal from './AddAdminModal';
import { Users, Package, Truck, DollarSign } from 'lucide-react';
import { authManager } from '../../utils/auth';

const API_BASE_URL = 'https://infinite-cargo-api.onrender.com/api';

const AdminDashboard = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('overview');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  
  const [adminData, setAdminData] = useState(null);
  const [dashboardStats, setDashboardStats] = useState({});
  const [activityLogs, setActivityLogs] = useState([]); 
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  
  // Add admin modal
  const [showAddAdmin, setShowAddAdmin] = useState(false);
  const [newAdmin, setNewAdmin] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    role: 'admin',
  });

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
      console.log('Making API call to:', endpoint, 'with auth:', authHeader.Authorization ? 'Present' : 'Missing');

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
        console.log('Admin not authenticated, redirecting to login');
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
        console.log('Admin data fetched:', response.admin);
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
        console.log('Dashboard stats fetched:', response.stats);
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
      const response = await apiCall('/admin/audit-logs?limit=5');
      if (response.data) {
        setActivityLogs(response.data);
      } else {
        setActivityLogs([]);
      }
    } catch (error) {
      console.error('Failed to fetch activity logs:', error);
      setActivityLogs([]);
    }
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
      }
    } catch (error) {
      showError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const showError = (msg) => {
    setError(msg);
    setTimeout(() => setError(''), 4000);
  };

  const showSuccess = (msg) => {
    setSuccessMessage(msg);
    setTimeout(() => setSuccessMessage(''), 4000);
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES'
    }).format(amount || 0);
  };

  const getStatusBadgeColor = (status) => {
    const colors = {
      active: 'bg-green-100 text-green-700',
      pending: 'bg-yellow-100 text-yellow-700',
      suspended: 'bg-red-100 text-red-700',
      inactive: 'bg-gray-100 text-gray-700',
      completed: 'bg-blue-100 text-blue-700',
    };
    return colors[status] || 'bg-gray-100 text-gray-700';
  };

  const handleLogout = () => {
    authManager.clearAuth(true);
    navigate('/admin/login');
  };

  // Overview render
  const renderOverview = () => (
    <div className="space-y-6">
      {/* Error and Success Messages */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}
      {successMessage && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded">
          {successMessage}
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <div className="bg-white p-4 border rounded shadow-sm">
          <div className="flex justify-between items-center">
            <Users className="text-blue-600" />
            <span className="text-gray-500 text-sm">Total Users</span>
          </div>
          <div className="mt-2 text-2xl font-bold text-gray-900">
            {dashboardStats.totalUsers || 0}
          </div>
        </div>

        <div className="bg-white p-4 border rounded shadow-sm">
          <div className="flex justify-between items-center">
            <Truck className="text-green-600" />
            <span className="text-gray-500 text-sm">Total Drivers</span>
          </div>
          <div className="mt-2 text-2xl font-bold text-gray-900">
            {dashboardStats.totalDrivers || 0}
          </div>
        </div>

        <div className="bg-white p-4 border rounded shadow-sm">
          <div className="flex justify-between items-center">
            <Package className="text-purple-600" />
            <span className="text-gray-500 text-sm">Cargo Owners</span>
          </div>
          <div className="mt-2 text-2xl font-bold text-gray-900">
            {dashboardStats.totalCargoOwners || 0}
          </div>
        </div>

        <div className="bg-white p-4 border rounded shadow-sm">
          <div className="flex justify-between items-center">
            <Package className="text-yellow-600" />
            <span className="text-gray-500 text-sm">Total Loads</span>
          </div>
          <div className="mt-2 text-2xl font-bold text-gray-900">
            {dashboardStats.totalLoads || 0}
          </div>
        </div>

        <div className="bg-white p-4 border rounded shadow-sm">
          <div className="flex justify-between items-center">
            <DollarSign className="text-orange-600" />
            <span className="text-gray-500 text-sm">Revenue</span>
          </div>
          <div className="mt-2 text-2xl font-bold text-gray-900">
            {formatCurrency(dashboardStats.totalRevenue || 0)}
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-white p-4 border rounded shadow-sm">
        <h3 className="text-lg font-semibold mb-3">Recent Activity</h3>
        {activityLogs.length === 0 ? (
          <p className="text-gray-500 text-sm">No recent activity found.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {activityLogs.map((log, i) => (
              <li key={i} className="text-gray-700">
                {log.message || log.action || 'Activity logged'}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );

  // Don't render if not authenticated
  if (!authManager.isAuthenticated(true)) {
    return null;
  }

  return (
    <div className="p-6">
      {adminData && (
        <AdminHeader
          name={adminData.name}
          role={adminData.role}
          onLogout={handleLogout}
        />
      )}

      {/* Show Add Admin button only for SUPER ADMINS */}
      {adminData?.role === 'super_admin' && (
        <div className="mb-4">
          <button
            onClick={() => setShowAddAdmin(true)}
            className="px-4 py-2 bg-blue-700 text-white rounded hover:bg-blue-800"
          >
            + Add Admin
          </button>
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-2">Loading...</span>
        </div>
      )}

      {/* Tabs */}
      <div className="mb-6 flex gap-4 border-b">
        {['overview', 'users', 'drivers', 'cargo-owners', 'loads', 'subscriptions'].map((tab) => (
          <button
            key={tab}
            onClick={() => {
              setActiveTab(tab);
              setCurrentPage(1);
            }}
            className={`pb-2 capitalize ${
              activeTab === tab
                ? 'border-b-2 border-blue-600 text-blue-600'
                : 'text-gray-600'
            }`}
          >
            {tab.replace('-', ' ')}
          </button>
        ))}
      </div>

      {/* Content */}
      {activeTab === 'overview' && renderOverview()}

      {activeTab === 'users' && (
        <UsersTable
          apiCall={apiCall}
          showError={showError}
          showSuccess={showSuccess}
          getStatusBadgeColor={getStatusBadgeColor}
          currentPage={currentPage}
          setCurrentPage={setCurrentPage}
          itemsPerPage={itemsPerPage}
        />
      )}

      {activeTab === 'drivers' && (
        <DriversTable
          apiCall={apiCall}
          showError={showError}
          showSuccess={showSuccess}
          getStatusBadgeColor={getStatusBadgeColor}
          currentPage={currentPage}
          setCurrentPage={setCurrentPage}
          itemsPerPage={itemsPerPage}
        />
      )}

      {activeTab === 'cargo-owners' && (
        <CargoOwnersTable
          apiCall={apiCall}
          showError={showError}
          showSuccess={showSuccess}
          getStatusBadgeColor={getStatusBadgeColor}
          currentPage={currentPage}
          setCurrentPage={setCurrentPage}
          itemsPerPage={itemsPerPage}
        />
      )}

      {activeTab === 'loads' && (
        <LoadsTable
          apiCall={apiCall}
          showError={showError}
          showSuccess={showSuccess}
          getStatusBadgeColor={getStatusBadgeColor}
          currentPage={currentPage}
          setCurrentPage={setCurrentPage}
          itemsPerPage={itemsPerPage}
        />
      )}

      {activeTab === 'subscriptions' && (
        <SubscriptionsTable
          apiCall={apiCall}
          showError={showError}
          showSuccess={showSuccess}
          formatCurrency={formatCurrency}
          currentPage={currentPage}
          setCurrentPage={setCurrentPage}
          itemsPerPage={itemsPerPage}
        />
      )}
        
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
  );
};

export default AdminDashboard;