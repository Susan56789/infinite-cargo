import React, { useState, useEffect, useCallback } from 'react';
import { 
  Shield, Settings, Search, Edit3, Trash2, 
  Lock, Unlock, CheckCircle, Calendar, Mail, Phone, Clock, X, RefreshCw,
  Package, 
} from 'lucide-react';

import EditAdminModal from './modals/EditAdminModal';
import SuspendAdminModal from './modals/SuspendAdminModal';
import DeleteAdminModal from './modals/DeleteAdminModal';
import EditPricingModal from './modals/EditPricingModal';
import PaymentMethodsModal from './modals/PaymentMethodsModal';

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

// Helper functions
const getAdminInitials = (name) => {
  if (!name) return '?';
  return name.split(' ').map(n => n.charAt(0)).join('').toUpperCase().slice(0, 2);
};

const safeGet = (obj, path, defaultValue = '') => {
  return path.split('.').reduce((acc, key) => acc?.[key], obj) || defaultValue;
};

// AdminTableRow Component - Moved outside and fixed
const AdminTableRow = ({ admin, index, onEdit, onSuspend, onDelete }) => {
  const adminId = admin._id || admin.id;
  
  // Don't render if admin doesn't have a valid ID
  if (!adminId || !/^[0-9a-fA-F]{24}$/.test(adminId)) {
    console.warn('Skipping admin row with invalid ID:', admin);
    return null;
  }

  return (
    <tr key={adminId} className="hover:bg-gray-50">
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
            : admin.role === 'moderator'
            ? 'bg-green-100 text-green-800'
            : 'bg-blue-100 text-blue-800'
        }`}>
          {admin.role === 'super_admin' ? 'Super Admin' : 
           admin.role === 'moderator' ? 'Moderator' : 'Admin'}
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
            onClick={() => onEdit(admin)}
            className="text-blue-600 hover:text-blue-800 p-1"
            title="Edit Admin"
          >
            <Edit3 className="w-4 h-4" />
          </button>
          <button
            onClick={() => onSuspend(admin)}
            className={`${admin.isActive ? 'text-orange-600 hover:text-orange-800' : 'text-green-600 hover:text-green-800'} p-1`}
            title={admin.isActive ? 'Suspend Admin' : 'Activate Admin'}
          >
            {admin.isActive ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
          </button>
          <button
            onClick={() => onDelete(admin)}
            className="text-red-600 hover:text-red-800 p-1"
            title="Delete Admin"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </td>
    </tr>
  );
};

const AdminManagementDashboard = ({ apiCall, showError, showSuccess }) => {
  const [activeTab, setActiveTab] = useState('admins');
  const [admins, setAdmins] = useState([]);
  const [pricingPlans, setPricingPlans] = useState({});
  const [paymentMethods, setPaymentMethods] = useState({});
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
      method: 'GET'
    });
    
    
    if (response?.status === 'success') {
      // Ensure we have valid data
      const adminList = Array.isArray(response.data) ? response.data : [];
      
      // Validate admin IDs
      const validAdmins = adminList.filter(admin => {
        const adminId = admin._id || admin.id;
        if (!adminId) {
          console.warn('Admin found without ID:', admin);
          return false;
        }
        if (!/^[0-9a-fA-F]{24}$/.test(adminId)) {
          console.warn('Admin found with invalid ID format:', adminId);
          return false;
        }
        return true;
      });
      
      if (validAdmins.length !== adminList.length) {
        console.warn(`Filtered ${adminList.length - validAdmins.length} invalid admins`);
      }
      
      setAdmins(validAdmins);
      setTotalPages(response.pagination?.totalPages || 1);
      setCurrentPage(response.pagination?.currentPage || 1);
    } else {
      throw new Error(response?.message || 'Failed to fetch admins');
    }
  } catch (error) {
    console.error('Fetch admins error:', error);
    
    let errorMessage = 'Failed to fetch admins';
    if (error.message.includes('Access denied')) {
      errorMessage = 'You do not have permission to view admin management.';
    } else if (error.message.includes('Network')) {
      errorMessage = 'Network error. Please check your connection and try again.';
    } else {
      errorMessage = error.message || 'An unexpected error occurred while fetching admins.';
    }
    
    showError(errorMessage);
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
        method: 'GET'
      });
      
      if (response?.status === 'success') {
        setPricingPlans(response.data?.plans || {});
      } else {
        throw new Error(response?.message || 'Failed to fetch pricing plans');
      }
    } catch (error) {
      console.error('Fetch pricing plans error:', error);
      showError('Failed to fetch pricing plans: ' + (error.message || 'Unknown error'));
    } finally {
      setLoading(false);
    }
  }, [apiCall, showError]);

  const fetchPaymentMethods = useCallback(async () => {
    try {
      setLoading(true);
      const response = await apiCall('/admin/payment-methods', {
        method: 'GET'
      });
      
      if (response?.status === 'success') {
        setPaymentMethods(response.data?.methods || {});
      } else {
        throw new Error(response?.message || 'Failed to fetch payment methods');
      }
    } catch (error) {
      console.error('Fetch payment methods error:', error);
      showError('Failed to fetch payment methods: ' + (error.message || 'Unknown error'));
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
      fetchPaymentMethods();
    }
  }, [activeTab, currentPage, fetchAdmins, fetchPricingPlans, fetchPaymentMethods]);

  // Search handling with debounce
  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      if (activeTab === 'admins') {
        fetchAdmins(1, searchTerm, statusFilter);
      }
    }, 500);

    return () => clearTimeout(debounceTimer);
  }, [searchTerm, statusFilter, activeTab, fetchAdmins]);

  // Admin management functions
  const handleEditAdmin = async (adminData) => {
  // Enhanced ID validation
  const adminId = selectedAdmin?._id || selectedAdmin?.id;
  
  if (!adminId) {
    showError('No admin selected for editing');
    return;
  }

  // Validate ObjectId format (24 hex characters)
  if (!/^[0-9a-fA-F]{24}$/.test(adminId)) {
    showError('Invalid admin ID format');
    return;
  }

  try {
    setLoading(true);
    
    // Clean the admin data - remove any undefined values
    const cleanAdminData = {};
    Object.keys(adminData).forEach(key => {
      if (adminData[key] !== undefined && adminData[key] !== null && adminData[key] !== '') {
        cleanAdminData[key] = adminData[key];
      }
    });

    const response = await apiCall(`/admin/admins/${adminId}`, {
      method: 'PUT',
      body: JSON.stringify(cleanAdminData)
    });
    
    
    if (response?.status === 'success') {
      showSuccess('Admin updated successfully');
      setShowEditAdmin(false);
      setSelectedAdmin(null);
      // Refresh the admin list
      await fetchAdmins(currentPage, searchTerm, statusFilter);
    } else {
      const errorMessage = response?.message || 'Failed to update admin';
      throw new Error(errorMessage);
    }
  } catch (error) {
    console.error('Update admin error:', error);
    
    // Handle specific error types
    let errorMessage = 'Failed to update admin';
    
    if (error.message.includes('Invalid admin ID format')) {
      errorMessage = 'Invalid admin ID format. Please refresh the page and try again.';
    } else if (error.message.includes('Admin not found')) {
      errorMessage = 'Admin not found. They may have been deleted by another administrator.';
    } else if (error.message.includes('Validation failed')) {
      errorMessage = 'Please check all required fields and try again.';
    } else if (error.message.includes('Access denied')) {
      errorMessage = 'You do not have permission to perform this action.';
    } else if (error.message.includes('already exists')) {
      errorMessage = 'Email or phone number already exists for another admin.';
    } else {
      errorMessage = error.message || 'An unexpected error occurred while updating the admin.';
    }
    
    showError(errorMessage);
  } finally {
    setLoading(false);
  }
};

  const handleSuspendAdmin = async (suspensionData) => {
  const adminId = selectedAdmin?._id || selectedAdmin?.id;
  
  if (!adminId) {
    showError('No admin selected for status update');
    return;
  }

  // Validate ObjectId format
  if (!/^[0-9a-fA-F]{24}$/.test(adminId)) {
    showError('Invalid admin ID format');
    return;
  }

  try {
    setLoading(true);
    
    // Prepare the data according to backend expectations
    const requestData = {
      isActive: suspensionData.isActive !== undefined ? suspensionData.isActive : !selectedAdmin.isActive,
      reason: suspensionData.reason || suspensionData.suspensionReason || ''
    };
    
    
    const response = await apiCall(`/admin/admins/${adminId}/status`, {
      method: 'PATCH',
      body: JSON.stringify(requestData)
    });
    
    
    if (response?.status === 'success') {
      const action = requestData.isActive ? 'activated' : 'suspended';
      showSuccess(`Admin ${action} successfully`);
      setShowSuspendModal(false);
      setSelectedAdmin(null);
      // Refresh the admin list
      await fetchAdmins(currentPage, searchTerm, statusFilter);
    } else {
      const errorMessage = response?.message || 'Failed to update admin status';
      throw new Error(errorMessage);
    }
  } catch (error) {
    console.error('Suspend admin error:', error);
    
    // Handle specific error types
    let errorMessage = 'Failed to update admin status';
    
    if (error.message.includes('Invalid admin ID format')) {
      errorMessage = 'Invalid admin ID format. Please refresh the page and try again.';
    } else if (error.message.includes('Admin not found')) {
      errorMessage = 'Admin not found. They may have been deleted by another administrator.';
    } else if (error.message.includes('Cannot suspend your own account')) {
      errorMessage = 'You cannot suspend your own account.';
    } else if (error.message.includes('Access denied')) {
      errorMessage = 'You do not have permission to perform this action.';
    } else {
      errorMessage = error.message || 'An unexpected error occurred while updating the admin status.';
    }
    
    showError(errorMessage);
  } finally {
    setLoading(false);
  }
};

  const handleDeleteAdmin = async () => {
  const adminId = selectedAdmin?._id || selectedAdmin?.id;
  
  if (!adminId) {
    showError('No admin selected for deletion');
    return;
  }

  // Validate ObjectId format
  if (!/^[0-9a-fA-F]{24}$/.test(adminId)) {
    showError('Invalid admin ID format');
    return;
  }

  try {
    setLoading(true);
    
    const response = await apiCall(`/admin/admins/${adminId}`, {
      method: 'DELETE'
    });
    
    
    if (response?.status === 'success') {
      showSuccess('Admin deleted successfully');
      setShowDeleteModal(false);
      setSelectedAdmin(null);
      // Refresh the admin list
      await fetchAdmins(currentPage, searchTerm, statusFilter);
    } else {
      const errorMessage = response?.message || 'Failed to delete admin';
      throw new Error(errorMessage);
    }
  } catch (error) {
    console.error('Delete admin error:', error);
    
    // Handle specific error types
    let errorMessage = 'Failed to delete admin';
    
    if (error.message.includes('Invalid admin ID format')) {
      errorMessage = 'Invalid admin ID format. Please refresh the page and try again.';
    } else if (error.message.includes('Admin not found')) {
      errorMessage = 'Admin not found. They may have already been deleted.';
    } else if (error.message.includes('Cannot delete your own account')) {
      errorMessage = 'You cannot delete your own account.';
    } else if (error.message.includes('Cannot delete the last')) {
      errorMessage = 'Cannot delete the last super admin account.';
    } else if (error.message.includes('Access denied')) {
      errorMessage = 'You do not have permission to perform this action.';
    } else {
      errorMessage = error.message || 'An unexpected error occurred while deleting the admin.';
    }
    
    showError(errorMessage);
  } finally {
    setLoading(false);
  }
};

  const handleUpdatePricing = async (planId, pricingData) => {
    try {
      setLoading(true);
      const response = await apiCall(`/admin/subscription-plans/${planId}`, {
        method: 'PUT',
        body: JSON.stringify(pricingData)
      });
      
      if (response?.status === 'success') {
        showSuccess('Pricing plan updated successfully');
        setShowEditPricing(false);
        setSelectedPlan(null);
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

  const handleUpdatePaymentMethods = async (methods) => {
    try {
      setLoading(true);
      const response = await apiCall('/admin/payment-methods', {
        method: 'PUT',
        body: JSON.stringify({ methods })
      });
      
      if (response?.status === 'success') {
        showSuccess('Payment methods updated successfully');
        setShowPaymentMethodsModal(false);
        fetchPaymentMethods();
      } else {
        throw new Error(response?.message || 'Failed to update payment methods');
      }
    } catch (error) {
      console.error('Update payment methods error:', error);
      showError('Failed to update payment methods: ' + (error.message || 'Unknown error'));
    } finally {
      setLoading(false);
    }
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
        <button
          onClick={() => fetchAdmins(currentPage, searchTerm, statusFilter)}
          disabled={loading}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
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
                <AdminTableRow
                  key={admin._id || admin.id || `admin-${index}`}
                  admin={admin}
                  index={index}
                  onEdit={(admin) => {
                    setSelectedAdmin(admin);
                    setShowEditAdmin(true);
                  }}
                  onSuspend={(admin) => {
                    setSelectedAdmin(admin);
                    setShowSuspendModal(true);
                  }}
                  onDelete={(admin) => {
                    setSelectedAdmin(admin);
                    setShowDeleteModal(true);
                  }}
                />
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
              disabled={currentPage === 1 || loading}
              className="px-3 py-1 border rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
            >
              Previous
            </button>
            <button
              onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage === totalPages || loading}
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
            onClick={() => {
              fetchPricingPlans();
              fetchPaymentMethods();
            }}
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

      {/* Modals */}
      {showEditAdmin && (
        <EditAdminModal
          admin={selectedAdmin}
          isOpen={showEditAdmin}
          onClose={() => {
            setShowEditAdmin(false);
            setSelectedAdmin(null);
          }}
          onSubmit={handleEditAdmin}
          loading={loading}
        />
      )}

      {showSuspendModal && (
        <SuspendAdminModal
          admin={selectedAdmin}
          isOpen={showSuspendModal}
          onClose={() => {
            setShowSuspendModal(false);
            setSelectedAdmin(null);
          }}
          onSubmit={handleSuspendAdmin}
          loading={loading}
        />
      )}

      {showDeleteModal && (
        <DeleteAdminModal
          admin={selectedAdmin}
          isOpen={showDeleteModal}
          onClose={() => {
            setShowDeleteModal(false);
            setSelectedAdmin(null);
          }}
          onSubmit={handleDeleteAdmin}
          loading={loading}
        />
      )}

      {showEditPricing && (
        <EditPricingModal
          plan={selectedPlan}
          isOpen={showEditPricing}
          onClose={() => {
            setShowEditPricing(false);
            setSelectedPlan(null);
          }}
          onSubmit={handleUpdatePricing}
          loading={loading}
        />
      )}

      {showPaymentMethodsModal && (
        <PaymentMethodsModal
          methods={paymentMethods}
          isOpen={showPaymentMethodsModal}
          onClose={() => setShowPaymentMethodsModal(false)}
          onSubmit={handleUpdatePaymentMethods}
          loading={loading}
        />
      )}
    </div>
  );
};

export default AdminManagementDashboard;