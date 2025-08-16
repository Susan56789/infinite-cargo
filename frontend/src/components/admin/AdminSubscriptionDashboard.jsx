import React, { useState, useEffect } from 'react';
import { Check, X, Clock, Eye, DollarSign, Users, TrendingUp, Calendar, Phone, Mail, Building, CreditCard, Smartphone, Building2, AlertCircle, CheckCircle2, XCircle } from 'lucide-react';

const AdminSubscriptionDashboard = () => {
  const [subscriptions, setSubscriptions] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState({});
  const [activeTab, setActiveTab] = useState('pending');
  const [selectedSubscription, setSelectedSubscription] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [actionType, setActionType] = useState('');
  const [actionNotes, setActionNotes] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [error, setError] = useState('');
  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    totalSubscriptions: 0
  });

  // API Base URL - adjust based on your setup
  const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

  const tabs = [
    { id: 'pending', label: 'Pending Requests', icon: Clock, color: 'text-yellow-600' },
    { id: 'active', label: 'Active Plans', icon: CheckCircle2, color: 'text-green-600' },
    { id: 'expired', label: 'Expired', icon: XCircle, color: 'text-red-600' },
    { id: 'analytics', label: 'Analytics', icon: TrendingUp, color: 'text-blue-600' }
  ];

  const paymentMethodIcons = {
    mpesa: Smartphone,
    bank_transfer: Building2,
    card: CreditCard
  };

  // Get admin token from storage
  const getAuthToken = () => {
    return localStorage.getItem('adminToken') || sessionStorage.getItem('adminToken');
  };

  // API headers with authentication
  const getAuthHeaders = () => {
    const token = getAuthToken();
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    };
  };

  useEffect(() => {
    fetchSubscriptions();
    if (activeTab === 'analytics') {
      fetchAnalytics();
    }
  }, [activeTab, pagination.currentPage]);

  const fetchSubscriptions = async (page = 1) => {
    setLoading(true);
    setError('');
    
    try {
      const token = getAuthToken();
      if (!token) {
        setError('No authentication token found. Please login again.');
        return;
      }

      const queryParams = new URLSearchParams({
        page: page.toString(),
        limit: '20',
        ...(activeTab !== 'analytics' && { status: activeTab })
      });

      const response = await fetch(`${API_BASE}/subscriptions/admin/pending?${queryParams}`, {
        headers: getAuthHeaders()
      });

      if (!response.ok) {
        if (response.status === 401) {
          setError('Session expired. Please login again.');
          // Optionally redirect to login
          return;
        }
        
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP ${response.status}: Failed to fetch subscriptions`);
      }

      const data = await response.json();
      
      if (data.status === 'success') {
        setSubscriptions(data.data.subscriptions || []);
        setPagination(data.data.pagination || {
          currentPage: 1,
          totalPages: 1,
          totalSubscriptions: 0
        });
      } else {
        throw new Error(data.message || 'Failed to fetch subscriptions');
      }

    } catch (error) {
      console.error('Error fetching subscriptions:', error);
      setError(error.message || 'Failed to fetch subscriptions. Please try again.');
      setSubscriptions([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchAnalytics = async () => {
    try {
      const token = getAuthToken();
      if (!token) {
        setError('No authentication token found.');
        return;
      }

      const response = await fetch(`${API_BASE}/subscriptions/admin/analytics`, {
        headers: getAuthHeaders()
      });

      if (!response.ok) {
        if (response.status === 401) {
          setError('Session expired. Please login again.');
          return;
        }
        
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to fetch analytics');
      }

      const data = await response.json();
      
      if (data.status === 'success') {
        setAnalytics(data.data);
      } else {
        throw new Error(data.message || 'Failed to fetch analytics');
      }

    } catch (error) {
      console.error('Error fetching analytics:', error);
      setError(error.message || 'Failed to fetch analytics');
    }
  };

  const handleAction = (subscription, action) => {
    setSelectedSubscription(subscription);
    setActionType(action);
    setActionNotes('');
    setRejectionReason('');
    setShowModal(true);
  };

  const processAction = async () => {
    if (!selectedSubscription) return;

    const subscriptionId = selectedSubscription._id;
    setProcessing(prev => ({ ...prev, [subscriptionId]: true }));
    setError('');

    try {
      const token = getAuthToken();
      if (!token) {
        setError('No authentication token found.');
        return;
      }

      const endpoint = `${API_BASE}/subscriptions/admin/${subscriptionId}/${actionType}`;
      
      const requestBody = actionType === 'approve' 
        ? { notes: actionNotes }
        : { reason: rejectionReason, notes: actionNotes };

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(requestBody)
      });

      const data = await response.json();

      if (response.ok && data.status === 'success') {
        // Show success message
        const successMessage = actionType === 'approve' 
          ? `Subscription approved successfully!` 
          : `Subscription rejected successfully!`;
        
        // You could use a toast library here instead of alert
        alert(successMessage);
        
        // Refresh subscription list
        await fetchSubscriptions(pagination.currentPage);
        setShowModal(false);
      } else {
        throw new Error(data.message || `Failed to ${actionType} subscription`);
      }

    } catch (error) {
      console.error(`Error ${actionType}ing subscription:`, error);
      setError(error.message || `Failed to ${actionType} subscription. Please try again.`);
    } finally {
      setProcessing(prev => ({ ...prev, [subscriptionId]: false }));
    }
  };

  const handleTabChange = (tabId) => {
    setActiveTab(tabId);
    setPagination(prev => ({ ...prev, currentPage: 1 }));
    setError('');
  };

  const handlePageChange = (newPage) => {
    setPagination(prev => ({ ...prev, currentPage: newPage }));
    fetchSubscriptions(newPage);
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES'
    }).format(amount);
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      pending: { bg: 'bg-yellow-100', text: 'text-yellow-800', label: 'Pending' },
      active: { bg: 'bg-green-100', text: 'text-green-800', label: 'Active' },
      expired: { bg: 'bg-red-100', text: 'text-red-800', label: 'Expired' },
      rejected: { bg: 'bg-gray-100', text: 'text-gray-800', label: 'Rejected' },
      cancelled: { bg: 'bg-gray-100', text: 'text-gray-800', label: 'Cancelled' }
    };

    const config = statusConfig[status] || statusConfig.pending;
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${config.bg} ${config.text}`}>
        {config.label}
      </span>
    );
  };

  const getPaymentMethodLabel = (method) => {
    const labels = {
      mpesa: 'M-Pesa',
      bank_transfer: 'Bank Transfer',
      card: 'Card Payment'
    };
    return labels[method] || method;
  };

  const renderSubscriptionCard = (subscription) => {
    const PaymentIcon = paymentMethodIcons[subscription.paymentMethod] || CreditCard;
    const isProcessing = processing[subscription._id];
    const user = subscription.user;

    return (
      <div key={subscription._id} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex justify-between items-start mb-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
              <Users className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h3 className="font-medium text-gray-900">{user?.name || 'Unknown User'}</h3>
              <p className="text-sm text-gray-500">{user?.email || 'No email'}</p>
              {user?.phone && (
                <p className="text-xs text-gray-400 flex items-center">
                  <Phone className="w-3 h-3 mr-1" />
                  {user.phone}
                </p>
              )}
            </div>
          </div>
          {getStatusBadge(subscription.status)}
        </div>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Plan</p>
            <p className="font-medium text-gray-900">{subscription.planName || subscription.planId}</p>
            {subscription.billingCycle && (
              <p className="text-xs text-gray-500 capitalize">{subscription.billingCycle}</p>
            )}
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Price</p>
            <p className="font-medium text-gray-900">
              {formatCurrency(subscription.price)} 
              <span className="text-xs text-gray-500 ml-1">
                {subscription.currency}
              </span>
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Payment Method</p>
            <div className="flex items-center space-x-2">
              <PaymentIcon className="w-4 h-4 text-gray-400" />
              <span className="text-sm">{getPaymentMethodLabel(subscription.paymentMethod)}</span>
            </div>
            <p className="text-xs text-gray-500">{subscription.paymentStatus}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Duration</p>
            <p className="text-sm text-gray-900">{subscription.duration || 30} days</p>
          </div>
        </div>

        <div className="flex items-center justify-between text-xs text-gray-500 mb-4">
          <span>Requested: {formatDate(subscription.requestedAt || subscription.createdAt)}</span>
          {subscription.expiresAt && (
            <span>Expires: {formatDate(subscription.expiresAt)}</span>
          )}
          {subscription.activatedAt && (
            <span>Activated: {formatDate(subscription.activatedAt)}</span>
          )}
        </div>

        {subscription.status === 'pending' && (
          <div className="flex space-x-2">
            <button
              onClick={() => handleAction(subscription, 'approve')}
              disabled={isProcessing}
              className="flex-1 bg-green-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
            >
              {isProcessing ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <Check className="w-4 h-4" />
              )}
              <span>Approve</span>
            </button>
            <button
              onClick={() => handleAction(subscription, 'reject')}
              disabled={isProcessing}
              className="flex-1 bg-red-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
            >
              <X className="w-4 h-4" />
              <span>Reject</span>
            </button>
          </div>
        )}

        {subscription.adminNotes && (
          <div className="mt-3 p-2 bg-gray-50 rounded text-sm">
            <span className="font-medium">Admin Notes: </span>
            {subscription.adminNotes}
          </div>
        )}

        {subscription.rejectionReason && (
          <div className="mt-3 p-2 bg-red-50 rounded text-sm">
            <span className="font-medium text-red-800">Rejection Reason: </span>
            <span className="text-red-600">{subscription.rejectionReason}</span>
          </div>
        )}
      </div>
    );
  };

  const renderAnalytics = () => {
    if (!analytics) return null;

    const summary = analytics.summary || {};
    const planDistribution = analytics.planDistribution || [];
    const monthlyTrends = analytics.monthlyTrends || [];

    return (
      <div className="space-y-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Subscriptions</p>
                <p className="text-3xl font-bold text-gray-900">{summary.totalSubscriptions || 0}</p>
              </div>
              <Users className="w-8 h-8 text-blue-600" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Active Plans</p>
                <p className="text-3xl font-bold text-gray-900">{summary.activeSubscriptions || 0}</p>
              </div>
              <CheckCircle2 className="w-8 h-8 text-green-600" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Pending Requests</p>
                <p className="text-3xl font-bold text-gray-900">{summary.pendingSubscriptions || 0}</p>
              </div>
              <Clock className="w-8 h-8 text-yellow-600" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Revenue</p>
                <p className="text-3xl font-bold text-gray-900">
                  {formatCurrency(summary.totalRevenue || 0)}
                </p>
                {summary.averagePrice > 0 && (
                  <p className="text-sm text-blue-600">
                    Avg: {formatCurrency(summary.averagePrice)}
                  </p>
                )}
              </div>
              <DollarSign className="w-8 h-8 text-blue-600" />
            </div>
          </div>
        </div>

        {/* Plan Distribution */}
        {planDistribution.length > 0 && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Plan Distribution</h3>
            <div className="space-y-4">
              {planDistribution.map((plan) => (
                <div key={plan.planId} className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-900">{plan.planName}</p>
                    <p className="text-sm text-gray-500">{plan.count} subscriptions</p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium text-gray-900">{formatCurrency(plan.revenue)}</p>
                    <p className="text-xs text-gray-500">Revenue</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Monthly Trends */}
        {monthlyTrends.length > 0 && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Monthly Trends</h3>
            <div className="space-y-3">
              {monthlyTrends.slice(-6).map((trend) => (
                <div key={trend.month} className="flex items-center justify-between">
                  <p className="text-sm font-medium text-gray-900">{trend.month}</p>
                  <div className="flex space-x-4 text-sm">
                    <span className="text-gray-600">{trend.subscriptions} subs</span>
                    <span className="text-green-600">{formatCurrency(trend.revenue)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderPagination = () => {
    if (pagination.totalPages <= 1) return null;

    return (
      <div className="flex items-center justify-between mt-6">
        <div className="text-sm text-gray-700">
          Showing {((pagination.currentPage - 1) * 20) + 1} to {Math.min(pagination.currentPage * 20, pagination.totalSubscriptions)} of {pagination.totalSubscriptions} subscriptions
        </div>
        <div className="flex space-x-2">
          <button
            onClick={() => handlePageChange(pagination.currentPage - 1)}
            disabled={pagination.currentPage === 1}
            className="px-3 py-1 border border-gray-300 rounded-md text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
          >
            Previous
          </button>
          
          {/* Page numbers */}
          {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
            const pageNum = pagination.currentPage <= 3 
              ? i + 1 
              : pagination.currentPage + i - 2;
            
            if (pageNum > pagination.totalPages) return null;
            
            return (
              <button
                key={pageNum}
                onClick={() => handlePageChange(pageNum)}
                className={`px-3 py-1 border rounded-md text-sm ${
                  pageNum === pagination.currentPage
                    ? 'bg-blue-500 text-white border-blue-500'
                    : 'border-gray-300 hover:bg-gray-50'
                }`}
              >
                {pageNum}
              </button>
            );
          })}

          <button
            onClick={() => handlePageChange(pagination.currentPage + 1)}
            disabled={pagination.currentPage === pagination.totalPages}
            className="px-3 py-1 border border-gray-300 rounded-md text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
          >
            Next
          </button>
        </div>
      </div>
    );
  };

  const renderModal = () => {
    if (!showModal || !selectedSubscription) return null;

    const isFormValid = actionType === 'approve' || (actionType === 'reject' && rejectionReason);

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">
                {actionType === 'approve' ? 'Approve' : 'Reject'} Subscription
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mb-4">
              <p className="text-sm text-gray-600 mb-2">
                {actionType === 'approve' 
                  ? `Approve ${selectedSubscription.planName} subscription for ${selectedSubscription.user?.name}?`
                  : `Reject ${selectedSubscription.planName} subscription for ${selectedSubscription.user?.name}?`
                }
              </p>
              <div className="bg-gray-50 p-3 rounded text-sm">
                <p><strong>Plan:</strong> {selectedSubscription.planName}</p>
                <p><strong>Price:</strong> {formatCurrency(selectedSubscription.price)}</p>
                <p><strong>Payment:</strong> {getPaymentMethodLabel(selectedSubscription.paymentMethod)}</p>
              </div>
            </div>

            {actionType === 'reject' && (
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Rejection Reason *
                </label>
                <select
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="">Select reason...</option>
                  <option value="insufficient_payment">Insufficient Payment</option>
                  <option value="invalid_details">Invalid Details</option>
                  <option value="plan_unavailable">Plan Unavailable</option>
                  <option value="payment_verification_failed">Payment Verification Failed</option>
                  <option value="duplicate_request">Duplicate Request</option>
                  <option value="other">Other</option>
                </select>
              </div>
            )}

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Additional Notes
              </label>
              <textarea
                value={actionNotes}
                onChange={(e) => setActionNotes(e.target.value)}
                rows="3"
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Add any additional notes..."
              />
            </div>

            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}

            <div className="flex space-x-3">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 border border-gray-300 text-gray-700 px-4 py-2 rounded-md text-sm font-medium hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={processAction}
                disabled={!isFormValid || processing[selectedSubscription._id]}
                className={`flex-1 px-4 py-2 rounded-md text-sm font-medium text-white disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2 ${
                  actionType === 'approve'
                    ? 'bg-green-600 hover:bg-green-700'
                    : 'bg-red-600 hover:bg-red-700'
                }`}
              >
                {processing[selectedSubscription._id] ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                ) : null}
                <span>{actionType === 'approve' ? 'Approve' : 'Reject'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Subscription Management</h1>
          <p className="text-gray-600 mt-2">Manage and monitor subscription requests and analytics</p>
        </div>

        {/* Error Display */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-md">
            <div className="flex items-center">
              <AlertCircle className="w-5 h-5 text-red-500 mr-2" />
              <p className="text-red-700">{error}</p>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="border-b border-gray-200 mb-6">
          <nav className="-mb-px flex space-x-8">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => handleTabChange(tab.id)}
                  className={`flex items-center space-x-2 py-2 px-1 border-b-2 font-medium text-sm ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${activeTab === tab.id ? tab.color : ''}`} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : (
          <div>
            {activeTab === 'analytics' ? (
              renderAnalytics()
            ) : (
              <div className="space-y-6">
                {subscriptions.length === 0 ? (
                  <div className="text-center py-12">
                    <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No subscriptions found</h3>
                    <p className="text-gray-500">No {activeTab} subscriptions at the moment.</p>
                  </div>
                ) : (
                  <>
                    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                      {subscriptions.map(renderSubscriptionCard)}
                    </div>
                    {renderPagination()}
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {renderModal()}
    </div>
  );
};

export default AdminSubscriptionDashboard;