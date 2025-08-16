import React, { useState, useEffect } from 'react';
import UsersTable from './UsersTable';
import DriversTable from './DriversTable';
import CargoOwnersTable from './CargoOwnersTable';
import LoadsTable from './LoadsTable';
import SubscriptionsTable from './SubscriptionsTable';
import AdminHeader from './AdminHeader';
import AddAdminModal from './AddAdminModal';
import { Users, Package, Truck, DollarSign, UserPlus } from 'lucide-react';
import { authManager } from '../../utils/auth';

const API_BASE_URL = 'https://infinite-cargo-api.onrender.com/api';

const AdminDashboard = () => {
  const [activeTab, setActiveTab] = useState('overview');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);

  const [adminData, setAdminData] = useState(null);
  const [dashboardStats, setDashboardStats] = useState({});
  const [activityLogs, setActivityLogs] = useState([]); 
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // ADD ADMIN MODAL
  const [showAddAdmin, setShowAddAdmin] = useState(false);
  const [newAdmin, setNewAdmin] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    role: 'admin',
  });

  // API HELPER
  const apiCall = async (endpoint, options = {}) => {
    const token = authManager.getToken(true);
    const config = {
      headers: {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
      },
      ...options,
    };
    const res = await fetch(`${API_BASE_URL}${endpoint}`, config);
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'API error');
    return data;
  };

  // Fetch admin info
  const fetchAdmin = async () => {
    try {
      const res = await apiCall('/admin/me');
      if (res.status === 'success') {
        setAdminData(res.admin);
      }
    } catch {
      // fallback
      setAdminData({ name: 'Admin', role: 'super_admin' });
    }
  };

  // Fetch dashboard stats
  const fetchDashboardStats = async () => {
    try {
      const res = await apiCall('/admin/dashboard-stats');
      if (res.status === 'success') {
        setDashboardStats(res.stats);
      }
    } catch (err) {
      console.error('Failed to fetch dashboard stats:', err);
      setDashboardStats({});
    }
  };

  // Add admin submit
  const handleAddAdminSubmit = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      const res = await apiCall('/admin/register', {
        method: 'POST',
        body: JSON.stringify(newAdmin),
      });
      if (res.status === 'success') {
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
    } catch (err) {
      showError(err.message);
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

  // Fetch stats on load
  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const res = await apiCall('/admin/dashboard-stats');
        if (res.status === 'success') {
          setDashboardStats(res.stats);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    fetchAdmin();
    fetchDashboardStats();
    fetchActivityLogs();
  }, []);

  const fetchActivityLogs = async () => {
    // TEMP: placeholder for last 5 audit logs
    try {
      const res = await apiCall('/admin/audit-logs?limit=5');
      setActivityLogs(res.data || []);
    } catch {
      setActivityLogs([]); // fallback
    }
  };

  // Overview + activity render
  const renderOverview = () => (
  <div className="space-y-6">
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
        <div className="mt2 text-2xl font-bold text-gray-900">
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
              {log.message || '...'}
            </li>
          ))}
        </ul>
      )}
    </div>
  </div>
);



  return (
    <div className="p-6">
      {adminData && (
        <AdminHeader
          name={adminData.name}
          role={adminData.role}
          onLogout={() => {
            authManager.clearAuth(true);
            window.location.href = '/admin/login';
          }}
        />
      )}

      {/* show Add Admin button only for SUPER ADMINS */}
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
