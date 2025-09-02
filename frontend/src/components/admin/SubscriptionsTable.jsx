// components/admin/SubscriptionsTable.jsx
import React, { useState, useEffect } from 'react';
import { 
  Eye, CheckCircle, XCircle, RefreshCw,Calendar, 
  DollarSign, User, Phone, Mail, Building, Clock, 
  Plus, Ban, AlertTriangle,Search, Download, MoreVertical, Info
} from "lucide-react";

const SubscriptionsTable = ({
  apiCall,
  showSuccess,
  showError,
  formatCurrency,
  currentPage,
  setCurrentPage,
  itemsPerPage
}) => {
  // State management - Changed default status filter to 'active'
  const [subscriptions, setSubscriptions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState('active'); 
  const [paymentMethodFilter, setPaymentMethodFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState('desc');
  const [totalPages, setTotalPages] = useState(0);
  const [summary, setSummary] = useState({});
  const [selectedSubscription, setSelectedSubscription] = useState(null);

  // Modal states
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showExtendModal, setShowExtendModal] = useState(false);

  // Form states
  const [adjustDays, setAdjustDays] = useState(0);
  const [adjustReason, setAdjustReason] = useState('');
  const [adjustNotes, setAdjustNotes] = useState('');
  const [cancelReason, setCancelReason] = useState('');
  const [cancelCategory, setCancelCategory] = useState('user_request');
  const [cancelNotes, setCancelNotes] = useState('');
  const [refundAmount, setRefundAmount] = useState(0);
  const [extendDays, setExtendDays] = useState(0);
  const [extendReason, setExtendReason] = useState('');
  const [extendType, setExtendType] = useState('goodwill');
  const [extendNotes, setExtendNotes] = useState('');

  // Utility functions
  const formatDate = (date) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('en-KE', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatDateTime = (date) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleString('en-KE');
  };

  const getStatusBadgeColor = (status) => {
    const colors = {
      active: 'bg-green-100 text-green-800 border-green-200',
      pending: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      cancelled: 'bg-red-100 text-red-800 border-red-200',
      rejected: 'bg-red-100 text-red-800 border-red-200',
      expired: 'bg-gray-100 text-gray-800 border-gray-200'
    };
    return colors[status] || 'bg-gray-100 text-gray-800 border-gray-200';
  };

  const getPriorityColor = (subscription) => {
    if (subscription.price > 2000) return 'text-purple-600';
    if (subscription.price > 1000) return 'text-blue-600';
    return 'text-gray-600';
  };

  // Data fetching
  const fetchSubscriptions = async (page = 1) => {
    try {
      setLoading(true);
      let endpoint = `/subscriptions/admin/pending?page=${page}&limit=${itemsPerPage}`;
      
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.append('status', statusFilter);
      if (paymentMethodFilter !== 'all') params.append('paymentMethod', paymentMethodFilter);
      if (searchTerm) params.append('search', searchTerm);
      if (sortBy) params.append('sortBy', sortBy);
      if (sortOrder) params.append('sortOrder', sortOrder);
      
      if (params.toString()) {
        endpoint += `&${params.toString()}`;
      }

      const response = await apiCall(endpoint);
      if (response.status === 'success') {
        setSubscriptions(response.data.subscriptions || []);
        setTotalPages(response.data.pagination?.totalPages || 1);
        setSummary(response.data.summary || {});
      }
    } catch (err) {
      console.error('Failed to fetch subscriptions:', err);
      showError('Error fetching subscriptions');
      setSubscriptions([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchSubscriptionDetails = async (id) => {
    try {
      const response = await apiCall(`/subscriptions/admin/${id}/details`);
      if (response.status === 'success') {
        setSelectedSubscription(response.data.subscription);
        setShowDetailsModal(true);
      }
    } catch (err) {
      showError('Error fetching subscription details');
    }
  };

  // Action handlers
  const handleApprove = async (subId) => {
    if (!window.confirm('Are you sure you want to approve this subscription?')) return;
    
    try {
      setLoading(true);
      const response = await apiCall(`/subscriptions/admin/${subId}/approve`, {
        method: 'POST',
        body: JSON.stringify({ 
          notes: 'Approved via admin dashboard'
        })
      });
      
      if (response.status === 'success') {
        showSuccess('Subscription approved successfully');
        fetchSubscriptions(currentPage);
      }
    } catch (err) {
      console.error('Failed to approve:', err);
      showError('Error approving subscription');
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async (subId) => {
    const reason = prompt('Enter rejection reason:');
    if (!reason) return;

    try {
      setLoading(true);
      const response = await apiCall(`/subscriptions/admin/${subId}/reject`, {
        method: 'POST',
        body: JSON.stringify({
          reason,
          reasonCategory: 'other',
          refundRequired: false,
          notes: 'Rejected via admin dashboard'
        })
      });
      
      if (response.status === 'success') {
        showSuccess('Subscription rejected successfully');
        fetchSubscriptions(currentPage);
      }
    } catch (err) {
      console.error('Failed to reject:', err);
      showError('Error rejecting subscription');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!cancelReason.trim()) {
      showError('Please provide a cancellation reason');
      return;
    }

    try {
      setLoading(true);
      const response = await apiCall(`/subscriptions/admin/${selectedSubscription._id}/cancel`, {
        method: 'POST',
        body: JSON.stringify({
          reason: cancelReason,
          reasonCategory: cancelCategory,
          refundAmount: refundAmount,
          notes: cancelNotes
        })
      });
      
      if (response.status === 'success') {
        showSuccess('Subscription cancelled successfully');
        setShowCancelModal(false);
        resetCancelForm();
        fetchSubscriptions(currentPage);
      }
    } catch (err) {
      console.error('Failed to cancel:', err);
      showError('Error cancelling subscription');
    } finally {
      setLoading(false);
    }
  };

  const handleAdjustDuration = async () => {
    if (adjustDays === 0) {
      showError('Please specify days to add or remove');
      return;
    }
    if (!adjustReason.trim()) {
      showError('Please provide a reason for the adjustment');
      return;
    }

    try {
      setLoading(true);
      const response = await apiCall(`/subscriptions/admin/${selectedSubscription._id}/adjust-duration`, {
        method: 'PUT',
        body: JSON.stringify({
          additionalDays: adjustDays,
          reason: adjustReason,
          notes: adjustNotes
        })
      });
      
      if (response.status === 'success') {
        showSuccess(`Duration adjusted by ${adjustDays} days`);
        setShowAdjustModal(false);
        resetAdjustForm();
        fetchSubscriptions(currentPage);
      }
    } catch (err) {
      console.error('Failed to adjust duration:', err);
      showError('Error adjusting subscription duration');
    } finally {
      setLoading(false);
    }
  };

  const handleExtend = async () => {
    if (extendDays <= 0) {
      showError('Please specify positive number of days to extend');
      return;
    }
    if (!extendReason.trim()) {
      showError('Please provide a reason for the extension');
      return;
    }

    try {
      setLoading(true);
      const response = await apiCall(`/subscriptions/admin/${selectedSubscription._id}/extend`, {
        method: 'POST',
        body: JSON.stringify({
          extensionDays: extendDays,
          reason: extendReason,
          compensationType: extendType,
          notes: extendNotes
        })
      });
      
      if (response.status === 'success') {
        showSuccess(`Subscription extended by ${extendDays} days`);
        setShowExtendModal(false);
        resetExtendForm();
        fetchSubscriptions(currentPage);
      }
    } catch (err) {
      console.error('Failed to extend:', err);
      showError('Error extending subscription');
    } finally {
      setLoading(false);
    }
  };

  // Form reset functions
  const resetAdjustForm = () => {
    setAdjustDays(0);
    setAdjustReason('');
    setAdjustNotes('');
  };

  const resetCancelForm = () => {
    setCancelReason('');
    setCancelCategory('user_request');
    setCancelNotes('');
    setRefundAmount(0);
  };

  const resetExtendForm = () => {
    setExtendDays(0);
    setExtendReason('');
    setExtendType('goodwill');
    setExtendNotes('');
  };

  // Effects
  useEffect(() => {
    fetchSubscriptions(1);
    setCurrentPage(1);
  }, [statusFilter, paymentMethodFilter, sortBy, sortOrder]);

  useEffect(() => {
    fetchSubscriptions(currentPage);
  }, [currentPage]);

  useEffect(() => {
    const delayedSearch = setTimeout(() => {
      if (searchTerm) {
        fetchSubscriptions(1);
        setCurrentPage(1);
      }
    }, 500);

    return () => clearTimeout(delayedSearch);
  }, [searchTerm]);

  // Action Menu Component
  const ActionMenu = ({ subscription, onAction }) => {
    const [showMenu, setShowMenu] = useState(false);
    
    const actions = [];
    
    // Add actions based on subscription status
    actions.push({
      label: 'View Details',
      icon: Eye,
      action: () => {
        setSelectedSubscription(subscription);
        fetchSubscriptionDetails(subscription._id);
      },
      color: 'text-blue-600'
    });

    if (subscription.status === 'pending') {
      actions.push(
        {
          label: 'Approve',
          icon: CheckCircle,
          action: () => handleApprove(subscription._id),
          color: 'text-green-600'
        },
        {
          label: 'Reject',
          icon: XCircle,
          action: () => handleReject(subscription._id),
          color: 'text-red-600'
        }
      );
    }

    if (['active', 'expired'].includes(subscription.status)) {
      actions.push({
        label: 'Extend',
        icon: Plus,
        action: () => {
          setSelectedSubscription(subscription);
          setShowExtendModal(true);
        },
        color: 'text-green-600'
      });
    }

    if (subscription.status === 'active' && subscription.planId !== 'basic') {
      actions.push(
        {
          label: 'Adjust Duration',
          icon: Calendar,
          action: () => {
            setSelectedSubscription(subscription);
            setShowAdjustModal(true);
          },
          color: 'text-blue-600'
        },
        {
          label: 'Cancel',
          icon: Ban,
          action: () => {
            setSelectedSubscription(subscription);
            setShowCancelModal(true);
          },
          color: 'text-red-600'
        }
      );
    }

    return (
      <div className="relative">
        <button
          onClick={() => setShowMenu(!showMenu)}
          className="p-1 hover:bg-gray-100 rounded"
        >
          <MoreVertical className="w-4 h-4" />
        </button>
        
        {showMenu && (
          <div className="absolute right-0 top-8 bg-white border rounded-lg shadow-lg z-10 min-w-40">
            {actions.map((action, index) => (
              <button
                key={index}
                onClick={() => {
                  action.action();
                  setShowMenu(false);
                }}
                className={`w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2 ${action.color}`}
              >
                <action.icon className="w-4 h-4" />
                {action.label}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  };

  // Statistics Cards Component
  const StatisticsCards = ({ summary }) => (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
      <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-lg">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-yellow-600 font-medium">Pending</p>
            <p className="text-2xl font-bold text-yellow-800">{summary.pending || 0}</p>
          </div>
          <Clock className="w-8 h-8 text-yellow-500" />
        </div>
      </div>
      
      <div className="bg-green-50 border border-green-200 p-4 rounded-lg">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-green-600 font-medium">Active</p>
            <p className="text-2xl font-bold text-green-800">{summary.active || 0}</p>
          </div>
          <CheckCircle className="w-8 h-8 text-green-500" />
        </div>
      </div>
      
      <div className="bg-red-50 border border-red-200 p-4 rounded-lg">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-red-600 font-medium">Rejected</p>
            <p className="text-2xl font-bold text-red-800">{summary.rejected || 0}</p>
          </div>
          <XCircle className="w-8 h-8 text-red-500" />
        </div>
      </div>
      
      <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-blue-600 font-medium">Total Revenue</p>
            <p className="text-xl font-bold text-blue-800">{formatCurrency(summary.totalRevenue || 0)}</p>
          </div>
          <DollarSign className="w-8 h-8 text-blue-500" />
        </div>
      </div>
    </div>
  );

  // Main render
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <DollarSign className="w-6 h-6" />
          Subscription Management
        </h2>
        <button
          onClick={() => fetchSubscriptions(currentPage)}
          disabled={loading}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Statistics Cards */}
      <StatisticsCards summary={summary} />

      {/* Filters and Search */}
      <div className="bg-white p-4 border border-gray-200 rounded-lg">
        <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
          <div className="flex flex-col sm:flex-row gap-3 flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by user name, email, or plan..."
                className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 w-full sm:w-64"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="active">Active</option>
              <option value="pending">Pending</option>
              <option value="expired">Expired</option>
              <option value="cancelled">Cancelled</option>
              <option value="rejected">Rejected</option>
              <option value="all">All Status</option>
            </select>

            <select
              value={paymentMethodFilter}
              onChange={(e) => setPaymentMethodFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Payment Methods</option>
              <option value="mpesa">M-Pesa</option>
              <option value="bank_transfer">Bank Transfer</option>
              <option value="card">Card</option>
            </select>
          </div>

          <div className="flex items-center gap-3">
            <select
              value={`${sortBy}-${sortOrder}`}
              onChange={(e) => {
                const [field, order] = e.target.value.split('-');
                setSortBy(field);
                setSortOrder(order);
              }}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="createdAt-desc">Latest First</option>
              <option value="createdAt-asc">Oldest First</option>
              <option value="price-desc">Highest Amount</option>
              <option value="price-asc">Lowest Amount</option>
              <option value="planName-asc">Plan A-Z</option>
            </select>
            
            <button
              onClick={() => {/* Export functionality */}}
              className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              Export
            </button>
          </div>
        </div>
      </div>

      {/* Subscriptions Table */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        {loading ? (
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <span className="ml-3 text-gray-600">Loading subscriptions...</span>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      User Details
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Subscription
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Payment
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status & Timing
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {subscriptions.length === 0 ? (
                    <tr>
                      <td colSpan="5" className="px-6 py-12 text-center">
                        <div className="text-gray-500">
                          <DollarSign className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                          <p className="text-lg font-medium">No subscriptions found</p>
                          <p className="text-sm">Subscriptions will appear here when users make requests.</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    subscriptions.map((subscription) => (
                      <tr key={subscription._id} className="hover:bg-gray-50">
                        {/* User Details */}
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                              <User className="w-5 h-5 text-blue-600" />
                            </div>
                            <div>
                              <div className="font-medium text-gray-900">
                                {subscription.user?.name || 'Unknown User'}
                              </div>
                              <div className="text-sm text-gray-500 flex items-center gap-1">
                                <Mail className="w-3 h-3" />
                                {subscription.user?.email || 'No email'}
                              </div>
                              {subscription.user?.phone && (
                                <div className="text-sm text-gray-500 flex items-center gap-1">
                                  <Phone className="w-3 h-3" />
                                  {subscription.user.phone}
                                </div>
                              )}
                              {subscription.user?.companyName && (
                                <div className="text-sm text-gray-500 flex items-center gap-1">
                                  <Building className="w-3 h-3" />
                                  {subscription.user.companyName}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Subscription Details */}
                        <td className="px-6 py-4">
                          <div>
                            <div className={`font-medium ${getPriorityColor(subscription)}`}>
                              {subscription.planName}
                            </div>
                            <div className="text-sm text-gray-500">
                              {subscription.billingCycle || 'monthly'} • {subscription.duration || 30} days
                            </div>
                            {subscription.features && (
                              <div className="text-xs text-gray-400 mt-1">
                                {subscription.features.slice(0, 2).join(', ')}
                                {subscription.features.length > 2 && '...'}
                              </div>
                            )}
                          </div>
                        </td>

                        {/* Payment Details */}
                        <td className="px-6 py-4">
                          <div>
                            <div className="font-medium text-gray-900">
                              {formatCurrency(subscription.price)}
                            </div>
                            <div className="text-sm text-gray-500 capitalize">
                              {subscription.paymentMethod?.replace('_', ' ')}
                            </div>
                            {subscription.paymentDetails?.mpesaCode && (
                              <div className="text-xs text-gray-400 font-mono">
                                {subscription.paymentDetails.mpesaCode}
                              </div>
                            )}
                            {subscription.paymentSummary?.userPhone && (
                              <div className="text-xs text-gray-400">
                                {subscription.paymentSummary.userPhone}
                              </div>
                            )}
                          </div>
                        </td>

                        {/* Status & Timing */}
                        <td className="px-6 py-4">
                          <div className="space-y-2">
                            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full border ${getStatusBadgeColor(subscription.status)}`}>
                              {subscription.status}
                            </span>
                            <div className="text-xs text-gray-500">
                              <div>Requested: {formatDate(subscription.requestedAt || subscription.createdAt)}</div>
                              {subscription.activatedAt && (
                                <div>Activated: {formatDate(subscription.activatedAt)}</div>
                              )}
                              {subscription.expiresAt && (
                                <div>Expires: {formatDate(subscription.expiresAt)}</div>
                              )}
                              {subscription.requestAge && (
                                <div className="flex items-center gap-1 mt-1">
                                  <Clock className="w-3 h-3" />
                                  {subscription.requestAge}h ago
                                </div>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Actions */}
                        <td className="px-6 py-4 text-right">
                          <ActionMenu subscription={subscription} onAction={fetchSubscriptions} />
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="bg-gray-50 px-6 py-3 border-t border-gray-200">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-gray-700">
                    Showing page {currentPage} of {totalPages}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      disabled={currentPage === 1}
                      onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                      className="px-3 py-1 text-sm border rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
                    >
                      Previous
                    </button>
                    <span className="px-3 py-1 text-sm">
                      {currentPage} / {totalPages}
                    </span>
                    <button
                      disabled={currentPage === totalPages}
                      onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                      className="px-3 py-1 text-sm border rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
                    >
                      Next
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Details Modal - FIXED FOR MOBILE RESPONSIVENESS */}
      {showDetailsModal && selectedSubscription && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
            {/* Modal Header - Fixed */}
            <div className="flex items-center justify-between p-4 sm:p-6 border-b bg-gray-50 flex-shrink-0">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Info className="w-5 h-5" />
                <span className="hidden sm:inline">Subscription Details</span>
                <span className="sm:hidden">Details</span>
              </h3>
              <button
                onClick={() => setShowDetailsModal(false)}
                className="text-gray-500 hover:text-gray-700 p-1 rounded-lg hover:bg-gray-200"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content - Scrollable */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                {/* User Information */}
                <div className="space-y-4">
                  <h4 className="font-medium text-gray-900 border-b pb-2">User Information</h4>
                  <div className="space-y-3">
                    <div className="flex flex-col sm:flex-row sm:justify-between">
                      <span className="text-gray-600 text-sm sm:text-base">Name:</span>
                      <span className="font-medium text-sm sm:text-base">{selectedSubscription.user?.name || 'N/A'}</span>
                    </div>
                    <div className="flex flex-col sm:flex-row sm:justify-between">
                      <span className="text-gray-600 text-sm sm:text-base">Email:</span>
                      <span className="font-medium text-sm sm:text-base break-all">{selectedSubscription.user?.email || 'N/A'}</span>
                    </div>
                    <div className="flex flex-col sm:flex-row sm:justify-between">
                      <span className="text-gray-600 text-sm sm:text-base">Phone:</span>
                      <span className="font-medium text-sm sm:text-base">{selectedSubscription.user?.phone || 'N/A'}</span>
                    </div>
                    <div className="flex flex-col sm:flex-row sm:justify-between">
                      <span className="text-gray-600 text-sm sm:text-base">Company:</span>
                      <span className="font-medium text-sm sm:text-base">{selectedSubscription.user?.companyName || 'N/A'}</span>
                    </div>
                    <div className="flex flex-col sm:flex-row sm:justify-between">
                      <span className="text-gray-600 text-sm sm:text-base">Member Since:</span>
                      <span className="font-medium text-sm sm:text-base">{formatDate(selectedSubscription.user?.createdAt)}</span>
                    </div>
                  </div>
                </div>

                {/* Subscription Information */}
                <div className="space-y-4">
                  <h4 className="font-medium text-gray-900 border-b pb-2">Subscription Information</h4>
                  <div className="space-y-3">
                    <div className="flex flex-col sm:flex-row sm:justify-between">
                      <span className="text-gray-600 text-sm sm:text-base">Plan:</span>
                      <span className="font-medium text-sm sm:text-base">{selectedSubscription.planName}</span>
                    </div>
                    <div className="flex flex-col sm:flex-row sm:justify-between">
                      <span className="text-gray-600 text-sm sm:text-base">Amount:</span>
                      <span className="font-medium text-sm sm:text-base">{formatCurrency(selectedSubscription.price)}</span>
                    </div>
                    <div className="flex flex-col sm:flex-row sm:justify-between">
                      <span className="text-gray-600 text-sm sm:text-base">Status:</span>
                      <span className={`px-2 py-1 text-xs rounded-full ${getStatusBadgeColor(selectedSubscription.status)}`}>
                        {selectedSubscription.status}
                      </span>
                    </div>
                    <div className="flex flex-col sm:flex-row sm:justify-between">
                      <span className="text-gray-600 text-sm sm:text-base">Billing Cycle:</span>
                      <span className="font-medium text-sm sm:text-base capitalize">{selectedSubscription.billingCycle}</span>
                    </div>
                    <div className="flex flex-col sm:flex-row sm:justify-between">
                      <span className="text-gray-600 text-sm sm:text-base">Duration:</span>
                      <span className="font-medium text-sm sm:text-base">{selectedSubscription.duration} days</span>
                    </div>
                    {selectedSubscription.activatedAt && (
                      <div className="flex flex-col sm:flex-row sm:justify-between">
                        <span className="text-gray-600 text-sm sm:text-base">Activated:</span>
                        <span className="font-medium text-sm sm:text-base">{formatDateTime(selectedSubscription.activatedAt)}</span>
                      </div>
                    )}
                    {selectedSubscription.expiresAt && (
                      <div className="flex flex-col sm:flex-row sm:justify-between">
                        <span className="text-gray-600 text-sm sm:text-base">Expires:</span>
                        <span className="font-medium text-sm sm:text-base">{formatDateTime(selectedSubscription.expiresAt)}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Payment Information */}
                <div className="space-y-4">
                  <h4 className="font-medium text-gray-900 border-b pb-2">Payment Information</h4>
                  <div className="space-y-3">
                    <div className="flex flex-col sm:flex-row sm:justify-between">
                      <span className="text-gray-600 text-sm sm:text-base">Payment Method:</span>
                      <span className="font-medium text-sm sm:text-base capitalize">{selectedSubscription.paymentMethod?.replace('_', ' ')}</span>
                    </div>
                    <div className="flex flex-col sm:flex-row sm:justify-between">
                      <span className="text-gray-600 text-sm sm:text-base">Payment Status:</span>
                      <span className={`px-2 py-1 text-xs rounded-full ${getStatusBadgeColor(selectedSubscription.paymentStatus)}`}>
                        {selectedSubscription.paymentStatus}
                      </span>
                    </div>
                    {selectedSubscription.paymentDetails?.mpesaCode && (
                      <div className="flex flex-col sm:flex-row sm:justify-between">
                        <span className="text-gray-600 text-sm sm:text-base">M-Pesa Code:</span>
                        <span className="font-mono text-sm break-all">{selectedSubscription.paymentDetails.mpesaCode}</span>
                      </div>
                    )}
                    {selectedSubscription.paymentDetails?.userInfo?.userPhone && (
                      <div className="flex flex-col sm:flex-row sm:justify-between">
                        <span className="text-gray-600 text-sm sm:text-base">Payment Phone:</span>
                        <span className="font-medium text-sm sm:text-base">{selectedSubscription.paymentDetails.userInfo.userPhone}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Usage Metrics */}
                {selectedSubscription.metrics && (
                  <div className="space-y-4">
                    <h4 className="font-medium text-gray-900 border-b pb-2">Usage Metrics</h4>
                    <div className="space-y-3">
                      <div className="flex flex-col sm:flex-row sm:justify-between">
                        <span className="text-gray-600 text-sm sm:text-base">Days Active:</span>
                        <span className="font-medium text-sm sm:text-base">{selectedSubscription.metrics.daysActive || 0}</span>
                      </div>
                      {selectedSubscription.metrics.daysRemaining !== null && (
                        <div className="flex flex-col sm:flex-row sm:justify-between">
                          <span className="text-gray-600 text-sm sm:text-base">Days Remaining:</span>
                          <span className="font-medium text-sm sm:text-base">{selectedSubscription.metrics.daysRemaining}</span>
                        </div>
                      )}
                      <div className="flex flex-col sm:flex-row sm:justify-between">
                        <span className="text-gray-600 text-sm sm:text-base">Loads This Month:</span>
                        <span className="font-medium text-sm sm:text-base">{selectedSubscription.metrics.monthlyUsage || 0}</span>
                      </div>
                      <div className="flex flex-col sm:flex-row sm:justify-between">
                        <span className="text-gray-600 text-sm sm:text-base">Total Loads:</span>
                        <span className="font-medium text-sm sm:text-base">{selectedSubscription.metrics.totalLoads || 0}</span>
                      </div>
                      <div className="flex flex-col sm:flex-row sm:justify-between">
                        <span className="text-gray-600 text-sm sm:text-base">Utilization Rate:</span>
                        <span className="font-medium text-sm sm:text-base">{selectedSubscription.metrics.utilizationRate || 0}%</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Plan Features */}
              {selectedSubscription.features && (
                <div className="mt-6">
                  <h4 className="font-medium text-gray-900 border-b pb-2 mb-3">Plan Features</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {selectedSubscription.features.map((feature, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                        <span className="text-sm text-gray-700">{feature}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Recent Activity */}
              {selectedSubscription.recentActivity && selectedSubscription.recentActivity.length > 0 && (
                <div className="mt-6">
                  <h4 className="font-medium text-gray-900 border-b pb-2 mb-3">Recent Loads</h4>
                  <div className="space-y-2">
                    {selectedSubscription.recentActivity.slice(0, 5).map((load, index) => (
                      <div key={index} className="flex flex-col sm:flex-row sm:justify-between sm:items-center py-2 px-3 bg-gray-50 rounded gap-2">
                        <span className="text-sm">{load.title || load.description || `Load #${load.loadId}`}</span>
                        <span className="text-xs text-gray-500">{formatDate(load.createdAt)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Adjust Duration Modal - Mobile Responsive */}
      {showAdjustModal && selectedSubscription && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-md max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-4 sm:p-6 border-b bg-gray-50 flex-shrink-0">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Calendar className="w-5 h-5" />
                Adjust Duration
              </h3>
              <button
                onClick={() => setShowAdjustModal(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 sm:p-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Days to Add/Remove
                  </label>
                  <input
                    type="number"
                    value={adjustDays}
                    onChange={(e) => setAdjustDays(parseInt(e.target.value) || 0)}
                    placeholder="Enter positive or negative number"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Positive numbers add days, negative numbers remove days
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Reason for Adjustment *
                  </label>
                  <input
                    type="text"
                    value={adjustReason}
                    onChange={(e) => setAdjustReason(e.target.value)}
                    placeholder="Enter reason for adjustment"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Additional Notes
                  </label>
                  <textarea
                    value={adjustNotes}
                    onChange={(e) => setAdjustNotes(e.target.value)}
                    placeholder="Optional additional notes"
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="flex flex-col sm:flex-row gap-3 pt-4">
                  <button
                    onClick={() => setShowAdjustModal(false)}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleAdjustDuration}
                    disabled={loading || !adjustReason.trim()}
                    className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
                  >
                    {loading ? 'Adjusting...' : 'Adjust Duration'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Subscription Modal - Mobile Responsive */}
      {showCancelModal && selectedSubscription && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-md max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-4 sm:p-6 border-b bg-gray-50 flex-shrink-0">
              <h3 className="text-lg font-semibold flex items-center gap-2 text-red-600">
                <Ban className="w-5 h-5" />
                Cancel Subscription
              </h3>
              <button
                onClick={() => setShowCancelModal(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 sm:p-6">
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-600" />
                  <span className="text-sm text-red-800 font-medium">Warning</span>
                </div>
                <p className="text-sm text-red-700 mt-1">
                  This will immediately cancel the subscription and downgrade the user to the Basic plan.
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Cancellation Category *
                  </label>
                  <select
                    value={cancelCategory}
                    onChange={(e) => setCancelCategory(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="user_request">User Request</option>
                    <option value="payment_failed">Payment Failed</option>
                    <option value="policy_violation">Policy Violation</option>
                    <option value="technical_issue">Technical Issue</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Cancellation Reason *
                  </label>
                  <input
                    type="text"
                    value={cancelReason}
                    onChange={(e) => setCancelReason(e.target.value)}
                    placeholder="Enter reason for cancellation"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Refund Amount (KES)
                  </label>
                  <input
                    type="number"
                    value={refundAmount}
                    onChange={(e) => setRefundAmount(parseFloat(e.target.value) || 0)}
                    placeholder="0"
                    min="0"
                    step="0.01"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Additional Notes
                  </label>
                  <textarea
                    value={cancelNotes}
                    onChange={(e) => setCancelNotes(e.target.value)}
                    placeholder="Optional additional notes"
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="flex flex-col sm:flex-row gap-3 pt-4">
                  <button
                    onClick={() => setShowCancelModal(false)}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCancel}
                    disabled={loading || !cancelReason.trim()}
                    className="flex-1 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 disabled:opacity-50"
                  >
                    {loading ? 'Cancelling...' : 'Cancel Subscription'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Extend Subscription Modal - Mobile Responsive */}
      {showExtendModal && selectedSubscription && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-md max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-4 sm:p-6 border-b bg-gray-50 flex-shrink-0">
              <h3 className="text-lg font-semibold flex items-center gap-2 text-green-600">
                <Plus className="w-5 h-5" />
                Extend Subscription
              </h3>
              <button
                onClick={() => setShowExtendModal(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 sm:p-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Extension Days *
                  </label>
                  <input
                    type="number"
                    value={extendDays}
                    onChange={(e) => setExtendDays(parseInt(e.target.value) || 0)}
                    placeholder="Enter number of days to extend"
                    min="1"
                    max="365"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Extension Type *
                  </label>
                  <select
                    value={extendType}
                    onChange={(e) => setExtendType(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="goodwill">Goodwill Gesture</option>
                    <option value="service_issue">Service Issue Compensation</option>
                    <option value="promotional">Promotional Extension</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Extension Reason *
                  </label>
                  <input
                    type="text"
                    value={extendReason}
                    onChange={(e) => setExtendReason(e.target.value)}
                    placeholder="Enter reason for extension"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Additional Notes
                  </label>
                  <textarea
                    value={extendNotes}
                    onChange={(e) => setExtendNotes(e.target.value)}
                    placeholder="Optional additional notes"
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="flex flex-col sm:flex-row gap-3 pt-4">
                  <button
                    onClick={() => setShowExtendModal(false)}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleExtend}
                    disabled={loading || !extendReason.trim() || extendDays <= 0}
                    className="flex-1 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50"
                  >
                    {loading ? 'Extending...' : 'Extend Subscription'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SubscriptionsTable;