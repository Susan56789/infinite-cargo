import React, { useState, useEffect, useCallback } from 'react';
import { 
  Shield, Users, Settings, Search, Plus, Edit3, Trash2, 
  Eye, Lock, Unlock, UserX, UserCheck, AlertCircle, CheckCircle,
  MoreVertical, Calendar, Mail, Phone, Clock, Save, X, RefreshCw,
  Package, TrendingUp, Activity
} from 'lucide-react';

// Utility functions
const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-KE', {
    style: 'currency',
    currency: 'KES'
  }).format(amount || 0);
};

const formatDate = (date) => {
  if (!date) return 'N/A';
  return new Date(date).toLocaleDateString('en-KE', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

const getStatusBadgeColor = (status) => {
  const colors = {
    active: 'bg-green-100 text-green-700 border-green-200',
    suspended: 'bg-red-100 text-red-700 border-red-200',
    pending: 'bg-yellow-100 text-yellow-700 border-yellow-200',
    completed: 'bg-blue-100 text-blue-700 border-blue-200',
    failed: 'bg-red-100 text-red-700 border-red-200',
    refunded: 'bg-orange-100 text-orange-700 border-orange-200'
  };
  return colors[status] || 'bg-gray-100 text-gray-700 border-gray-200';
};

const AdminManagementDashboard = ({ apiCall, showError, showSuccess }) => {
  const [activeTab, setActiveTab] = useState('admins');
  const [admins, setAdmins] = useState([]);
  const [pricingPlans, setPricingPlans] = useState({});
  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  
  // Modal states
  const [showEditAdmin, setShowEditAdmin] = useState(false);
  const [showSuspendModal, setShowSuspendModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showEditPricing, setShowEditPricing] = useState(false);
  const [showPaymentMethodsModal, setShowPaymentMethodsModal] = useState(false);
  
  // Form states
  const [selectedAdmin, setSelectedAdmin] = useState(null);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [suspensionReason, setSuspensionReason] = useState('');
  const [editFormData, setEditFormData] = useState({});
  const [paymentMethods, setPaymentMethods] = useState({
    mpesa: {
      enabled: true,
      displayName: 'M-Pesa',
      description: 'Pay using M-Pesa mobile money',
      details: {
        businessNumber: '174379',
        accountName: 'Infinite Cargo Ltd'
      }
    },
    bank: {
      enabled: true,
      displayName: 'Bank Transfer',
      description: 'Direct bank transfer',
      details: {
        accountNumber: '1234567890',
        bankName: 'KCB Bank',
        accountName: 'Infinite Cargo Limited'
      }
    },
    card: {
      enabled: false,
      displayName: 'Credit/Debit Card',
      description: 'Pay using your card',
      details: {}
    }
  });

  // Fetch functions with proper error handling
  const fetchAdmins = useCallback(async (page = 1, search = '', status = '') => {
    try {
      setLoading(true);
      const queryParams = new URLSearchParams({
        page: page.toString(),
        limit: '10',
        ...(search && { search }),
        ...(status && status !== 'all' && { status })
      });
      
      const response = await apiCall(`/admin/admins?${queryParams}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('adminToken')}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response?.status === 'success') {
        setAdmins(Array.isArray(response.data) ? response.data : []);
        setTotalPages(response.pagination?.totalPages || 1);
        setCurrentPage(response.pagination?.currentPage || 1);
      } else {
        throw new Error(response?.message || 'Failed to fetch admins');
      }
    } catch (error) {
      console.error('Fetch admins error:', error);
      showError('Failed to fetch admins: ' + (error.message || 'Unknown error'));
      setAdmins([]);
      setTotalPages(1);
      setCurrentPage(1);
    } finally {
      setLoading(false);
    }
  }, [apiCall, showError]);

  const fetchPricingPlans = useCallback(async () => {
    try {
      setLoading(true);
      const response = await apiCall('/admin/subscription-plans', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('adminToken')}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response?.status === 'success') {
        setPricingPlans(response.data?.plans || {});
      } else {
        throw new Error(response?.message || 'Failed to fetch pricing plans');
      }
    } catch (error) {
      console.error('Fetch pricing plans error:', error);
      showError('Failed to fetch pricing plans: ' + (error.message || 'Unknown error'));
      setPricingPlans({});
    } finally {
      setLoading(false);
    }
  }, [apiCall, showError]);

  // Load initial data
  useEffect(() => {
    if (activeTab === 'admins') {
      fetchAdmins(currentPage, searchTerm, statusFilter);
    } else if (activeTab === 'pricing') {
      fetchPricingPlans();
    }
  }, [activeTab, currentPage, fetchAdmins, fetchPricingPlans]);

  // Search handling with debounce
  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      if (activeTab === 'admins') {
        fetchAdmins(1, searchTerm, statusFilter);
      }
    }, 500);

    return () => clearTimeout(debounceTimer);
  }, [searchTerm, statusFilter, activeTab, fetchAdmins]);

  // Admin management functions with proper error handling
  const handleEditAdmin = async (adminData) => {
    if (!selectedAdmin?._id) {
      showError('No admin selected');
      return;
    }

    try {
      setLoading(true);
      const response = await apiCall(`/admin/admins/${selectedAdmin._id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('adminToken')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(adminData)
      });
      
      if (response?.status === 'success') {
        showSuccess('Admin updated successfully');
        setShowEditAdmin(false);
        setSelectedAdmin(null);
        setEditFormData({});
        fetchAdmins(currentPage, searchTerm, statusFilter);
      } else {
        throw new Error(response?.message || 'Failed to update admin');
      }
    } catch (error) {
      console.error('Update admin error:', error);
      showError('Failed to update admin: ' + (error.message || 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  const handleSuspendAdmin = async () => {
    if (!selectedAdmin?._id) {
      showError('No admin selected');
      return;
    }

    try {
      setLoading(true);
      const response = await apiCall(`/admin/admins/${selectedAdmin._id}/status`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('adminToken')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          isActive: !selectedAdmin.isActive,
          reason: suspensionReason
        })
      });
      
      if (response?.status === 'success') {
        showSuccess(`Admin ${selectedAdmin.isActive ? 'suspended' : 'activated'} successfully`);
        setShowSuspendModal(false);
        setSelectedAdmin(null);
        setSuspensionReason('');
        fetchAdmins(currentPage, searchTerm, statusFilter);
      } else {
        throw new Error(response?.message || 'Failed to update admin status');
      }
    } catch (error) {
      console.error('Suspend admin error:', error);
      showError('Failed to update admin status: ' + (error.message || 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAdmin = async () => {
    if (!selectedAdmin?._id) {
      showError('No admin selected');
      return;
    }

    try {
      setLoading(true);
      const response = await apiCall(`/admin/admins/${selectedAdmin._id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('adminToken')}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response?.status === 'success') {
        showSuccess('Admin deleted successfully');
        setShowDeleteModal(false);
        setSelectedAdmin(null);
        fetchAdmins(currentPage, searchTerm, statusFilter);
      } else {
        throw new Error(response?.message || 'Failed to delete admin');
      }
    } catch (error) {
      console.error('Delete admin error:', error);
      showError('Failed to delete admin: ' + (error.message || 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  // Pricing management functions
  const handleUpdatePricing = async (planId, pricingData) => {
    if (!planId) {
      showError('No plan selected');
      return;
    }

    try {
      setLoading(true);
      const response = await apiCall(`/admin/subscription-plans/${planId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('adminToken')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(pricingData)
      });
      
      if (response?.status === 'success') {
        showSuccess('Pricing plan updated successfully');
        setShowEditPricing(false);
        setSelectedPlan(null);
        setEditFormData({});
        fetchPricingPlans();
      } else {
        throw new Error(response?.message || 'Failed to update pricing');
      }
    } catch (error) {
      console.error('Update pricing error:', error);
      showError('Failed to update pricing: ' + (error.message || 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  // Payment methods management
  const handleUpdatePaymentMethods = async () => {
    try {
      setLoading(true);
      // This would be an API call to update payment methods
      // For now, we'll simulate success
      showSuccess('Payment methods updated successfully');
      setShowPaymentMethodsModal(false);
    } catch (error) {
      console.error('Update payment methods error:', error);
      showError('Failed to update payment methods: ' + (error.message || 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  // Helper function to get admin initials
  const getAdminInitials = (name) => {
    if (!name) return '?';
    return name.charAt(0).toUpperCase();
  };

  // Helper function to safely get nested properties
  const safeGet = (obj, path, defaultValue = '') => {
    return path.split('.').reduce((acc, key) => acc?.[key], obj) || defaultValue;
  };

  // Component: Admin Table
  const AdminsTable = () => (
    <div className="space-y-6">
      {/* Header with Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <Shield className="w-6 h-6" />
          Admin Management
        </h2>
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Search admins..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
          </select>
        </div>
      </div>

      {/* Admins Table */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        {loading ? (
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            <span className="ml-3 text-gray-600">Loading admins...</span>
          </div>
        ) : admins.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <Shield className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <p>No admins found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Admin</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Role</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Created</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Last Login</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {admins.map((admin, index) => (
                  <tr key={admin._id || admin.id || `admin-${index}`} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-10 w-10">
                          <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                            <span className="text-blue-600 font-medium text-sm">
                              {getAdminInitials(admin.name)}
                            </span>
                          </div>
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">{admin.name || 'Unknown'}</div>
                          <div className="text-sm text-gray-500 flex items-center gap-1">
                            <Mail className="w-3 h-3" />
                            {admin.email || 'No email'}
                          </div>
                          {admin.phone && (
                            <div className="text-sm text-gray-500 flex items-center gap-1">
                              <Phone className="w-3 h-3" />
                              {admin.phone}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        admin.role === 'super_admin' 
                          ? 'bg-purple-100 text-purple-800' 
                          : 'bg-blue-100 text-blue-800'
                      }`}>
                        {admin.role === 'super_admin' ? 'Super Admin' : 'Admin'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                        getStatusBadgeColor(admin.isActive ? 'active' : 'suspended')
                      }`}>
                        {admin.isActive ? 'Active' : 'Suspended'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      <div className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        {formatDate(admin.createdAt)}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      <div className="flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        {formatDate(admin.lastLogin)}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => {
                            setSelectedAdmin(admin);
                            setEditFormData({
                              name: admin.name || '',
                              email: admin.email || '',
                              phone: admin.phone || '',
                              role: admin.role || 'admin',
                              isActive: admin.isActive !== false
                            });
                            setShowEditAdmin(true);
                          }}
                          className="text-blue-600 hover:text-blue-800 p-1"
                          title="Edit Admin"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            setSelectedAdmin(admin);
                            setSuspensionReason('');
                            setShowSuspendModal(true);
                          }}
                          className={`${admin.isActive ? 'text-orange-600 hover:text-orange-800' : 'text-green-600 hover:text-green-800'} p-1`}
                          title={admin.isActive ? 'Suspend Admin' : 'Activate Admin'}
                        >
                          {admin.isActive ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                        </button>
                        <button
                          onClick={() => {
                            setSelectedAdmin(admin);
                            setShowDeleteModal(true);
                          }}
                          className="text-red-600 hover:text-red-800 p-1"
                          title="Delete Admin"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between p-4 bg-gray-50 border-t">
            <span className="text-sm text-gray-700">
              Page {currentPage} of {totalPages}
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1 border rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
              >
                Previous
              </button>
              <button
                onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-1 border rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  // Component: Pricing Management
  const PricingManagement = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <Package className="w-6 h-6" />
          System Configuration
        </h2>
        <div className="flex gap-3">
          <button
            onClick={() => setShowPaymentMethodsModal(true)}
            className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 flex items-center gap-2"
          >
            <Settings className="w-4 h-4" />
            Payment Methods
          </button>
          <button
            onClick={fetchPricingPlans}
            disabled={loading}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {Object.entries(pricingPlans).map(([planId, plan]) => (
          <div key={planId} className="bg-white border border-gray-200 rounded-xl p-6 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">{plan.name || 'Unknown Plan'}</h3>
              <button
                onClick={() => {
                  setSelectedPlan({ id: planId, ...plan });
                  setEditFormData({
                    name: plan.name || '',
                    price: plan.price || 0,
                    duration: plan.duration || 30,
                    description: plan.description || '',
                    features: plan.features || {}
                  });
                  setShowEditPricing(true);
                }}
                className="text-blue-600 hover:text-blue-800 p-1"
                title="Edit Plan"
              >
                <Edit3 className="w-4 h-4" />
              </button>
            </div>
            
            <div className="space-y-3">
              <div className="text-3xl font-bold text-gray-900">
                {formatCurrency(plan.price || 0)}
                <span className="text-sm font-normal text-gray-500">/{plan.duration || 30} days</span>
              </div>
              
              <p className="text-gray-600 text-sm">{plan.description || 'No description available'}</p>
              
              <div className="space-y-2">
                <h4 className="font-medium text-gray-900">Features:</h4>
                <ul className="space-y-1 text-sm text-gray-600">
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    Max Loads: {safeGet(plan, 'features.maxLoads', 0) === -1 ? 'Unlimited' : safeGet(plan, 'features.maxLoads', 0)}
                  </li>
                  <li className="flex items-center gap-2">
                    {safeGet(plan, 'features.prioritySupport', false) ? 
                      <CheckCircle className="w-4 h-4 text-green-500" /> : 
                      <X className="w-4 h-4 text-gray-400" />
                    }
                    Priority Support
                  </li>
                  <li className="flex items-center gap-2">
                    {safeGet(plan, 'features.advancedAnalytics', false) ? 
                      <CheckCircle className="w-4 h-4 text-green-500" /> : 
                      <X className="w-4 h-4 text-gray-400" />
                    }
                    Advanced Analytics
                  </li>
                  <li className="flex items-center gap-2">
                    {safeGet(plan, 'features.bulkOperations', false) ? 
                      <CheckCircle className="w-4 h-4 text-green-500" /> : 
                      <X className="w-4 h-4 text-gray-400" />
                    }
                    Bulk Operations
                  </li>
                  <li className="flex items-center gap-2">
                    {safeGet(plan, 'features.apiAccess', false) ? 
                      <CheckCircle className="w-4 h-4 text-green-500" /> : 
                      <X className="w-4 h-4 text-gray-400" />
                    }
                    API Access
                  </li>
                </ul>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Navigation Tabs */}
      <div className="border-b border-gray-200 bg-white rounded-t-xl">
        <nav className="flex overflow-x-auto">
          {[
            { key: 'admins', label: 'Admin Management', icon: Shield },
            { key: 'pricing', label: 'System Configuration', icon: Settings }
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

      {/* Tab Content */}
      <div className="bg-white rounded-b-xl min-h-[600px] p-6">
        {activeTab === 'admins' && <AdminsTable />}
        {activeTab === 'pricing' && <PricingManagement />}
      </div>

      {/* Edit Admin Modal */}
      {showEditAdmin && selectedAdmin && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Edit3 className="w-5 h-5" />
                Edit Admin: {selectedAdmin.name || 'Unknown'}
              </h3>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleEditAdmin(editFormData);
              }}
              className="p-6 space-y-4"
            >
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Name</label>
                <input
                  type="text"
                  value={editFormData.name || ''}
                  onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                <input
                  type="email"
                  value={editFormData.email || ''}
                  onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Phone</label>
                <input
                  type="tel"
                  value={editFormData.phone || ''}
                  onChange={(e) => setEditFormData({ ...editFormData, phone: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Role</label>
                <select
                  value={editFormData.role || 'admin'}
                  onChange={(e) => setEditFormData({ ...editFormData, role: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="admin">Admin</option>
                  <option value="moderator">Moderator</option>
                  <option value="super_admin">Super Admin</option>
                </select>
              </div>
              
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="isActive"
                  checked={editFormData.isActive !== false}
                  onChange={(e) => setEditFormData({ ...editFormData, isActive: e.target.checked })}
                  className="w-4 h-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="isActive" className="text-sm font-medium text-gray-700">
                  Active Account
                </label>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <Save className="w-4 h-4" />
                  {loading ? 'Saving...' : 'Save Changes'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowEditAdmin(false);
                    setSelectedAdmin(null);
                    setEditFormData({});
                  }}
                  className="flex-1 bg-gray-600 text-white py-2 px-4 rounded-lg hover:bg-gray-700"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Suspend/Activate Admin Modal */}
      {showSuspendModal && selectedAdmin && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                {selectedAdmin.isActive ? (
                  <>
                    <Lock className="w-5 h-5 text-orange-600" />
                    Suspend Admin
                  </>
                ) : (
                  <>
                    <Unlock className="w-5 h-5 text-green-600" />
                    Activate Admin
                  </>
                )}
              </h3>
            </div>
            <div className="p-6">
              <div className="mb-4">
                <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg">
                  <div className="flex-shrink-0 h-10 w-10">
                    <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                      <span className="text-blue-600 font-medium text-sm">
                        {getAdminInitials(selectedAdmin.name)}
                      </span>
                    </div>
                  </div>
                  <div>
                    <div className="font-medium text-gray-900">{selectedAdmin.name || 'Unknown'}</div>
                    <div className="text-sm text-gray-500">{selectedAdmin.email || 'No email'}</div>
                  </div>
                </div>
              </div>

              <p className="text-gray-600 mb-4">
                {selectedAdmin.isActive 
                  ? 'Are you sure you want to suspend this admin? They will lose access to the admin panel.'
                  : 'Are you sure you want to activate this admin? They will regain access to the admin panel.'
                }
              </p>

              {selectedAdmin.isActive && (
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Suspension Reason (Optional)
                  </label>
                  <textarea
                    value={suspensionReason}
                    onChange={(e) => setSuspensionReason(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    rows="3"
                    placeholder="Enter reason for suspension..."
                  />
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={handleSuspendAdmin}
                  disabled={loading}
                  className={`flex-1 ${
                    selectedAdmin.isActive 
                      ? 'bg-orange-600 hover:bg-orange-700' 
                      : 'bg-green-600 hover:bg-green-700'
                  } text-white py-2 px-4 rounded-lg disabled:opacity-50 flex items-center justify-center gap-2`}
                >
                  {selectedAdmin.isActive ? (
                    <>
                      <Lock className="w-4 h-4" />
                      {loading ? 'Suspending...' : 'Suspend Admin'}
                    </>
                  ) : (
                    <>
                      <Unlock className="w-4 h-4" />
                      {loading ? 'Activating...' : 'Activate Admin'}
                    </>
                  )}
                </button>
                <button
                  onClick={() => {
                    setShowSuspendModal(false);
                    setSelectedAdmin(null);
                    setSuspensionReason('');
                  }}
                  className="flex-1 bg-gray-600 text-white py-2 px-4 rounded-lg hover:bg-gray-700"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Admin Modal */}
      {showDeleteModal && selectedAdmin && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold flex items-center gap-2 text-red-600">
                <Trash2 className="w-5 h-5" />
                Delete Admin
              </h3>
            </div>
            <div className="p-6">
              <div className="mb-4">
                <div className="flex items-center gap-3 p-4 bg-red-50 rounded-lg border border-red-200">
                  <div className="flex-shrink-0 h-10 w-10">
                    <div className="h-10 w-10 rounded-full bg-red-100 flex items-center justify-center">
                      <span className="text-red-600 font-medium text-sm">
                        {getAdminInitials(selectedAdmin.name)}
                      </span>
                    </div>
                  </div>
                  <div>
                    <div className="font-medium text-gray-900">{selectedAdmin.name || 'Unknown'}</div>
                    <div className="text-sm text-gray-500">{selectedAdmin.email || 'No email'}</div>
                  </div>
                </div>
              </div>

              <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-red-600" />
                  <span className="font-medium text-red-800">Warning: This action cannot be undone</span>
                </div>
                <p className="text-red-700 text-sm mt-2">
                  Deleting this admin will permanently remove their account and all associated data. 
                  They will lose all access to the admin panel immediately.
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleDeleteAdmin}
                  disabled={loading}
                  className="flex-1 bg-red-600 text-white py-2 px-4 rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <Trash2 className="w-4 h-4" />
                  {loading ? 'Deleting...' : 'Delete Admin'}
                </button>
                <button
                  onClick={() => {
                    setShowDeleteModal(false);
                    setSelectedAdmin(null);
                  }}
                  className="flex-1 bg-gray-600 text-white py-2 px-4 rounded-lg hover:bg-gray-700"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Payment Methods Modal */}
      {showPaymentMethodsModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Settings className="w-5 h-5" />
                Payment Methods Configuration
              </h3>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleUpdatePaymentMethods();
              }}
              className="p-6 space-y-6"
            >
              {Object.entries(paymentMethods).map(([key, method]) => (
                <div key={key} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        id={`enable-${key}`}
                        checked={method.enabled}
                        onChange={(e) => setPaymentMethods(prev => ({
                          ...prev,
                          [key]: { ...prev[key], enabled: e.target.checked }
                        }))}
                        className="w-4 h-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                      <label htmlFor={`enable-${key}`} className="text-lg font-medium text-gray-900">
                        {method.displayName}
                      </label>
                    </div>
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      method.enabled 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {method.enabled ? 'Enabled' : 'Disabled'}
                    </span>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Display Name
                      </label>
                      <input
                        type="text"
                        value={method.displayName}
                        onChange={(e) => setPaymentMethods(prev => ({
                          ...prev,
                          [key]: { ...prev[key], displayName: e.target.value }
                        }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        disabled={!method.enabled}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Description
                      </label>
                      <input
                        type="text"
                        value={method.description}
                        onChange={(e) => setPaymentMethods(prev => ({
                          ...prev,
                          [key]: { ...prev[key], description: e.target.value }
                        }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        disabled={!method.enabled}
                      />
                    </div>

                    {/* Method-specific details */}
                    {key === 'mpesa' && (
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Business Number
                          </label>
                          <input
                            type="text"
                            value={method.details.businessNumber || ''}
                            onChange={(e) => setPaymentMethods(prev => ({
                              ...prev,
                              [key]: { 
                                ...prev[key], 
                                details: { ...prev[key].details, businessNumber: e.target.value }
                              }
                            }))}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            disabled={!method.enabled}
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Account Name
                          </label>
                          <input
                            type="text"
                            value={method.details.accountName || ''}
                            onChange={(e) => setPaymentMethods(prev => ({
                              ...prev,
                              [key]: { 
                                ...prev[key], 
                                details: { ...prev[key].details, accountName: e.target.value }
                              }
                            }))}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            disabled={!method.enabled}
                          />
                        </div>
                      </div>
                    )}

                    {key === 'bank' && (
                      <div className="grid grid-cols-1 gap-3">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Bank Name
                          </label>
                          <input
                            type="text"
                            value={method.details.bankName || ''}
                            onChange={(e) => setPaymentMethods(prev => ({
                              ...prev,
                              [key]: { 
                                ...prev[key], 
                                details: { ...prev[key].details, bankName: e.target.value }
                              }
                            }))}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            disabled={!method.enabled}
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Account Number
                            </label>
                            <input
                              type="text"
                              value={method.details.accountNumber || ''}
                              onChange={(e) => setPaymentMethods(prev => ({
                                ...prev,
                                [key]: { 
                                  ...prev[key], 
                                  details: { ...prev[key].details, accountNumber: e.target.value }
                                }
                              }))}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                              disabled={!method.enabled}
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Account Name
                            </label>
                            <input
                              type="text"
                              value={method.details.accountName || ''}
                              onChange={(e) => setPaymentMethods(prev => ({
                                ...prev,
                                [key]: { 
                                  ...prev[key], 
                                  details: { ...prev[key].details, accountName: e.target.value }
                                }
                              }))}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                              disabled={!method.enabled}
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}

              <div className="flex gap-3 pt-4 border-t">
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <Save className="w-4 h-4" />
                  {loading ? 'Saving...' : 'Save Payment Methods'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowPaymentMethodsModal(false)}
                  className="flex-1 bg-gray-600 text-white py-2 px-4 rounded-lg hover:bg-gray-700"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Pricing Modal */}
      {showEditPricing && selectedPlan && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Package className="w-5 h-5" />
                Edit Pricing Plan: {selectedPlan.name || 'Unknown'}
              </h3>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleUpdatePricing(selectedPlan.id, editFormData);
              }}
              className="p-6 space-y-4"
            >
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Plan Name</label>
                <input
                  type="text"
                  value={editFormData.name || ''}
                  onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Price (KES)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={editFormData.price || 0}
                  onChange={(e) => setEditFormData({ ...editFormData, price: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Duration (Days)</label>
                <input
                  type="number"
                  min="1"
                  value={editFormData.duration || 30}
                  onChange={(e) => setEditFormData({ ...editFormData, duration: parseInt(e.target.value) || 30 })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                <textarea
                  value={editFormData.description || ''}
                  onChange={(e) => setEditFormData({ ...editFormData, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows="3"
                  required
                />
              </div>

              <div className="border-t pt-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Features</label>
                
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Max Loads</label>
                    <input
                      type="number"
                      min="-1"
                      value={safeGet(editFormData, 'features.maxLoads', 0)}
                      onChange={(e) => setEditFormData({
                        ...editFormData,
                        features: { ...editFormData.features, maxLoads: parseInt(e.target.value) || 0 }
                      })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="-1 for unlimited"
                    />
                  </div>
                  
                  {['prioritySupport', 'advancedAnalytics', 'bulkOperations', 'apiAccess', 'dedicatedManager'].map(feature => (
                    <div key={feature} className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        id={feature}
                        checked={safeGet(editFormData, `features.${feature}`, false)}
                        onChange={(e) => setEditFormData({
                          ...editFormData,
                          features: { ...editFormData.features, [feature]: e.target.checked }
                        })}
                        className="w-4 h-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                      <label htmlFor={feature} className="text-sm font-medium text-gray-700">
                        {feature.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                      </label>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <Save className="w-4 h-4" />
                  {loading ? 'Saving...' : 'Update Plan'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowEditPricing(false);
                    setSelectedPlan(null);
                    setEditFormData({});
                  }}
                  className="flex-1 bg-gray-600 text-white py-2 px-4 rounded-lg hover:bg-gray-700"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminManagementDashboard;