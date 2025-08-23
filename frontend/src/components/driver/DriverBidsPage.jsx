import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  ArrowLeft,
  DollarSign, 
  Calendar, 
  MapPin, 
  Package,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Briefcase,
  Filter,
  Search,
  Loader,
  RefreshCw,
  FileText,
  MessageCircle,
  Eye,
  Truck,
  Weight
} from 'lucide-react';
import { getAuthHeader, isAuthenticated, getUser } from '../../utils/auth';

const BidCard = ({ bid, formatCurrency, formatDate, onAcceptCounterOffer, onDeclineCounterOffer, onWithdraw }) => {
  const [loading, setLoading] = useState(false);

  const getStatusIcon = (status) => {
    switch (status) {
      case 'accepted':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'rejected':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'counter_offered':
        return <AlertCircle className="h-4 w-4 text-orange-500" />;
      case 'shortlisted':
        return <CheckCircle className="h-4 w-4 text-blue-500" />;
      case 'withdrawn':
        return <XCircle className="h-4 w-4 text-gray-500" />;
      case 'viewed':
        return <Eye className="h-4 w-4 text-indigo-500" />;
      case 'under_review':
        return <Clock className="h-4 w-4 text-purple-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusColor = (status) => {
    const statusColors = {
      submitted: 'bg-blue-100 text-blue-800',
      viewed: 'bg-indigo-100 text-indigo-800',
      under_review: 'bg-purple-100 text-purple-800',
      shortlisted: 'bg-emerald-100 text-emerald-800',
      accepted: 'bg-green-100 text-green-800',
      rejected: 'bg-red-100 text-red-800',
      withdrawn: 'bg-gray-100 text-gray-800',
      counter_offered: 'bg-orange-100 text-orange-800',
      expired: 'bg-yellow-100 text-yellow-800'
    };
    return statusColors[status] || 'bg-gray-100 text-gray-800';
  };

  const getStatusText = (status) => {
    const statusTexts = {
      submitted: 'Submitted',
      viewed: 'Viewed',
      under_review: 'Under Review',
      shortlisted: 'Shortlisted',
      accepted: 'Accepted',
      rejected: 'Rejected',
      withdrawn: 'Withdrawn',
      counter_offered: 'Counter Offered',
      expired: 'Expired'
    };
    return statusTexts[status] || status.replace('_', ' ').toUpperCase();
  };

  const handleCounterOfferResponse = async (action) => {
    setLoading(true);
    try {
      if (action === 'accept') {
        await onAcceptCounterOffer(bid._id);
      } else {
        await onDeclineCounterOffer(bid._id);
      }
    } catch (error) {
      console.error('Counter offer response error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleWithdraw = async () => {
    if (window.confirm('Are you sure you want to withdraw this bid? This action cannot be undone.')) {
      setLoading(true);
      try {
        await onWithdraw(bid._id);
      } catch (error) {
        console.error('Withdraw bid error:', error);
      } finally {
        setLoading(false);
      }
    }
  };

  const canWithdraw = ['submitted', 'viewed', 'under_review', 'shortlisted'].includes(bid.status);

  return (
    <div className="border border-gray-200 rounded-lg p-6 hover:border-gray-300 transition-colors">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <h4 className="font-semibold text-lg text-gray-900 mb-2">
            {bid.load?.title || bid.loadInfo?.title || 'Transport Job'}
          </h4>
          
          {/* Route */}
          <div className="flex items-center space-x-2 mb-3">
            <MapPin size={16} className="text-gray-400" />
            <span className="text-sm text-gray-600">
              {bid.load?.pickupLocation || bid.loadInfo?.pickupLocation} → {bid.load?.deliveryLocation || bid.loadInfo?.deliveryLocation}
            </span>
          </div>
        </div>

        {/* Status Badge */}
        <div className="flex items-center space-x-2">
          {getStatusIcon(bid.status)}
          <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(bid.status)}`}>
            {getStatusText(bid.status)}
          </span>
        </div>
      </div>

      {/* Bid Details Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
        <div className="flex items-center space-x-2">
          <DollarSign size={16} className="text-green-600" />
          <div>
            <span className="text-xs text-gray-500 block">Your Bid</span>
            <span className="text-sm font-semibold text-green-600">
              {formatCurrency(bid.bidAmount, bid.currency)}
            </span>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <Package size={16} className="text-blue-600" />
          <div>
            <span className="text-xs text-gray-500 block">Load Budget</span>
            <span className="text-sm font-medium text-gray-900">
              {formatCurrency(bid.load?.budget || bid.loadInfo?.budget)}
            </span>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <Calendar size={16} className="text-purple-600" />
          <div>
            <span className="text-xs text-gray-500 block">Pickup Date</span>
            <span className="text-sm font-medium text-gray-900">
              {formatDate(bid.proposedPickupDate)}
            </span>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <Calendar size={16} className="text-orange-600" />
          <div>
            <span className="text-xs text-gray-500 block">Delivery Date</span>
            <span className="text-sm font-medium text-gray-900">
              {formatDate(bid.proposedDeliveryDate)}
            </span>
          </div>
        </div>

        {(bid.load?.weight || bid.loadInfo?.weight) && (
          <div className="flex items-center space-x-2">
            <Weight size={16} className="text-gray-600" />
            <div>
              <span className="text-xs text-gray-500 block">Weight</span>
              <span className="text-sm font-medium text-gray-900">
                {bid.load?.weight || bid.loadInfo?.weight}
              </span>
            </div>
          </div>
        )}

        <div className="flex items-center space-x-2">
          <Clock size={16} className="text-gray-400" />
          <div>
            <span className="text-xs text-gray-500 block">Submitted</span>
            <span className="text-sm font-medium text-gray-900">
              {formatDate(bid.submittedAt || bid.createdAt)}
            </span>
          </div>
        </div>
      </div>

      {/* Vehicle Details */}
      {bid.vehicleDetails && (
        <div className="mb-4 p-3 bg-gray-50 rounded-lg">
          <div className="flex items-center mb-2">
            <Truck size={16} className="text-gray-600 mr-2" />
            <span className="text-sm font-medium text-gray-700">Vehicle Details</span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-sm">
            {bid.vehicleDetails.type && (
              <div>
                <span className="text-gray-500">Type:</span>
                <span className="ml-1 font-medium">{bid.vehicleDetails.type.replace('_', ' ')}</span>
              </div>
            )}
            {bid.vehicleDetails.capacity && (
              <div>
                <span className="text-gray-500">Capacity:</span>
                <span className="ml-1 font-medium">{bid.vehicleDetails.capacity} tonnes</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Message Preview */}
      {bid.message && (
        <div className="mb-4 p-3 bg-blue-50 rounded-lg">
          <div className="flex items-start">
            <MessageCircle size={16} className="text-blue-600 mr-2 mt-0.5 flex-shrink-0" />
            <div>
              <span className="text-sm font-medium text-blue-800 block mb-1">Your Message:</span>
              <p className="text-sm text-blue-700 line-clamp-3">{bid.message}</p>
            </div>
          </div>
        </div>
      )}

      {/* Cover Letter Preview */}
      {bid.coverLetter && (
        <div className="mb-4 p-3 bg-green-50 rounded-lg">
          <div className="flex items-start">
            <FileText size={16} className="text-green-600 mr-2 mt-0.5 flex-shrink-0" />
            <div>
              <span className="text-sm font-medium text-green-800 block mb-1">Cover Letter:</span>
              <p className="text-sm text-green-700 line-clamp-2">{bid.coverLetter}</p>
            </div>
          </div>
        </div>
      )}

      {/* Counter Offer */}
      {bid.status === 'counter_offered' && bid.counterOffer && (
        <div className="mb-4 p-4 bg-orange-50 border border-orange-200 rounded-lg">
          <div className="flex items-center mb-3">
            <AlertCircle className="h-5 w-5 text-orange-600 mr-2" />
            <span className="text-sm font-semibold text-orange-800">Counter Offer Received</span>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
            <div className="flex items-center space-x-2">
              <DollarSign size={16} className="text-orange-600" />
              <div>
                <span className="text-xs text-orange-600 block">Counter Amount</span>
                <span className="font-semibold text-orange-800">
                  {formatCurrency(bid.counterOffer.amount, bid.currency)}
                </span>
              </div>
            </div>
            
            {bid.counterOffer.proposedPickupDate && (
              <div className="flex items-center space-x-2">
                <Calendar size={16} className="text-orange-600" />
                <div>
                  <span className="text-xs text-orange-600 block">New Pickup Date</span>
                  <span className="font-medium text-orange-800">
                    {formatDate(bid.counterOffer.proposedPickupDate)}
                  </span>
                </div>
              </div>
            )}
          </div>

          {bid.counterOffer.message && (
            <div className="mb-4">
              <p className="text-sm text-orange-700">
                <span className="font-medium">Message:</span> {bid.counterOffer.message}
              </p>
            </div>
          )}
          
          {/* Counter Offer Actions */}
          <div className="flex space-x-3">
            <button
              onClick={() => handleCounterOfferResponse('accept')}
              disabled={loading}
              className="flex-1 px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? <Loader size={16} className="animate-spin mx-auto" /> : 'Accept Offer'}
            </button>
            <button
              onClick={() => handleCounterOfferResponse('decline')}
              disabled={loading}
              className="flex-1 px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? <Loader size={16} className="animate-spin mx-auto" /> : 'Decline'}
            </button>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between pt-4 border-t border-gray-100">
        <div className="flex items-center space-x-4 text-xs text-gray-500">
          {bid.viewedAt && (
            <span className="flex items-center">
              <Eye size={12} className="mr-1" />
              Viewed {formatDate(bid.viewedAt)}
            </span>
          )}
          {bid.expiresAt && (
            <span className="flex items-center">
              <Clock size={12} className="mr-1" />
              Expires {formatDate(bid.expiresAt)}
            </span>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex space-x-2">
          {canWithdraw && (
            <button
              onClick={handleWithdraw}
              disabled={loading}
              className="px-3 py-1.5 text-xs font-medium text-red-600 border border-red-300 rounded hover:bg-red-50 transition-colors disabled:opacity-50"
            >
              Withdraw
            </button>
          )}
          
          <Link
            to={`/bids/${bid._id}`}
            className="px-3 py-1.5 text-xs font-medium text-blue-600 border border-blue-300 rounded hover:bg-blue-50 transition-colors"
          >
            View Details
          </Link>
        </div>
      </div>
    </div>
  );
};

const DriverBidsPage = () => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [bids, setBids] = useState([]);
  const [filteredBids, setFilteredBids] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    totalBids: 0,
    hasNextPage: false,
    hasPrevPage: false
  });

  const statusOptions = [
    { value: 'all', label: 'All Bids' },
    { value: 'submitted', label: 'Submitted' },
    { value: 'viewed', label: 'Viewed' },
    { value: 'under_review', label: 'Under Review' },
    { value: 'shortlisted', label: 'Shortlisted' },
    { value: 'accepted', label: 'Accepted' },
    { value: 'rejected', label: 'Rejected' },
    { value: 'counter_offered', label: 'Counter Offered' },
    { value: 'withdrawn', label: 'Withdrawn' },
    { value: 'expired', label: 'Expired' }
  ];

  useEffect(() => {
    // Check authentication
    if (!isAuthenticated()) {
      setError('You must be logged in to view bids');
      setLoading(false);
      setTimeout(() => {
        window.location.href = '/login';
      }, 2000);
      return;
    }

    const currentUser = getUser();
    if (currentUser?.userType !== 'driver') {
      setError('Only drivers can access this page');
      setLoading(false);
      return;
    }

    fetchBids();
  }, [statusFilter]);

  useEffect(() => {
    // Filter bids when search term changes
    let filtered = bids;

    // Apply search filter
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(bid => {
        const loadTitle = (bid.load?.title || bid.loadInfo?.title || '').toLowerCase();
        const pickupLocation = (bid.load?.pickupLocation || bid.loadInfo?.pickupLocation || '').toLowerCase();
        const deliveryLocation = (bid.load?.deliveryLocation || bid.loadInfo?.deliveryLocation || '').toLowerCase();
        const message = (bid.message || '').toLowerCase();
        const cargoType = (bid.load?.cargoType || '').toLowerCase();
        
        return loadTitle.includes(search) || 
               pickupLocation.includes(search) || 
               deliveryLocation.includes(search) ||
               message.includes(search) ||
               cargoType.includes(search);
      });
    }

    setFilteredBids(filtered);
  }, [bids, searchTerm]);

  const fetchBids = async (isRefresh = false, page = 1) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else if (page === 1) {
        setLoading(true);
      }

      if (!isAuthenticated()) {
        setError('Authentication required');
        return;
      }

      // Build query parameters
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20'
      });

      if (statusFilter !== 'all') {
        params.append('status', statusFilter);
      }

      const response = await fetch(`https://infinite-cargo-api.onrender.com/api/bids?${params}`, {
        headers: {
          ...getAuthHeader(),
          'Content-Type': 'application/json'
        }
      });

      if (response.status === 401 || response.status === 403) {
        setError('Authentication failed. Please login again.');
        setTimeout(() => {
          window.location.href = '/login';
        }, 2000);
        return;
      }

      if (response.ok) {
        const data = await response.json();
        setBids(data.data?.bids || []);
        setPagination(data.data?.pagination || {
          currentPage: 1,
          totalPages: 1,
          totalBids: 0,
          hasNextPage: false,
          hasPrevPage: false
        });
        setError('');
      } else {
        const errorData = await response.json().catch(() => ({}));
        setError(errorData.message || `Failed to load bids (${response.status})`);
      }
    } catch (error) {
      console.error('Error fetching bids:', error);
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        setError('Network error: Unable to connect to server');
      } else {
        setError('Network error loading bids');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleAcceptCounterOffer = async (bidId) => {
    try {
      const response = await fetch(`https://infinite-cargo-api.onrender.com/api/bids/${bidId}/accept-counter`, {
        method: 'POST',
        headers: {
          ...getAuthHeader(),
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        fetchBids();
        alert('Counter offer accepted successfully!');
      } else {
        const errorData = await response.json().catch(() => ({}));
        alert(errorData.message || 'Failed to accept counter offer');
      }
    } catch (error) {
      console.error('Accept counter offer error:', error);
      alert('Network error accepting counter offer');
    }
  };

  const handleDeclineCounterOffer = async (bidId, reason = '') => {
    try {
      const response = await fetch(`https://infinite-cargo-api.onrender.com/api/bids/${bidId}/decline-counter`, {
        method: 'POST',
        headers: {
          ...getAuthHeader(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ reason })
      });

      if (response.ok) {
        fetchBids();
        alert('Counter offer declined');
      } else {
        const errorData = await response.json().catch(() => ({}));
        alert(errorData.message || 'Failed to decline counter offer');
      }
    } catch (error) {
      console.error('Decline counter offer error:', error);
      alert('Network error declining counter offer');
    }
  };

  const handleWithdraw = async (bidId) => {
    try {
      const response = await fetch(`https://infinite-cargo-api.onrender.com/api/bids/${bidId}/withdraw`, {
        method: 'POST',
        headers: {
          ...getAuthHeader(),
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        fetchBids();
        alert('Bid withdrawn successfully');
      } else {
        const errorData = await response.json().catch(() => ({}));
        alert(errorData.message || 'Failed to withdraw bid');
      }
    } catch (error) {
      console.error('Withdraw bid error:', error);
      alert('Network error withdrawing bid');
    }
  };

  const handleRefresh = () => {
    fetchBids(true);
  };

  const getBidsSummary = () => {
    const total = bids.length;
    const pending = bids.filter(bid => 
      ['submitted', 'viewed', 'under_review', 'shortlisted'].includes(bid.status)
    ).length;
    const accepted = bids.filter(bid => bid.status === 'accepted').length;
    const counterOffers = bids.filter(bid => bid.status === 'counter_offered').length;

    return { total, pending, accepted, counterOffers };
  };

  const formatCurrency = (amount, currency = 'KES') => {
    if (!amount) return `${currency} 0`;
    
    if (currency === 'KES') {
      return new Intl.NumberFormat('en-KE', {
        style: 'currency',
        currency: 'KES',
        minimumFractionDigits: 0
      }).format(amount);
    }
    
    return `${currency} ${new Intl.NumberFormat().format(amount)}`;
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Not set';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const summary = getBidsSummary();

  // Show authentication error if user is not authenticated
  if (!isAuthenticated() && !loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center bg-white rounded-lg shadow-sm p-8 max-w-md">
          <XCircle className="mx-auto h-16 w-16 text-red-500 mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Authentication Required</h2>
          <p className="text-gray-600 mb-4">You must be logged in to view your bids.</p>
          <button
            onClick={() => window.location.href = '/login'}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader className="mx-auto h-12 w-12 text-blue-600 animate-spin" />
          <p className="mt-4 text-gray-600">Loading your bids...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <button
                onClick={() => window.history.back()}
                className="mr-4 p-2 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <ArrowLeft size={20} className="text-gray-600" />
              </button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 flex items-center">
                  <Briefcase size={24} className="mr-3" />
                  My Bids
                </h1>
                <p className="text-sm text-gray-600 mt-1">Track all your submitted bids and their status</p>
              </div>
            </div>
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              <RefreshCw size={16} className={`mr-2 ${refreshing ? 'animate-spin' : ''}`} />
              {refreshing ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Error Message */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex">
              <XCircle className="h-5 w-5 text-red-400" />
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">Error</h3>
                <p className="mt-1 text-sm text-red-700">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-600">Total Bids</p>
                <p className="text-2xl font-bold text-gray-900">{pagination.totalBids}</p>
              </div>
              <FileText className="h-8 w-8 text-gray-400" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-600">Pending Review</p>
                <p className="text-2xl font-bold text-blue-600">{summary.pending}</p>
              </div>
              <Clock className="h-8 w-8 text-blue-400" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-600">Accepted</p>
                <p className="text-2xl font-bold text-green-600">{summary.accepted}</p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-400" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-600">Counter Offers</p>
                <p className="text-2xl font-bold text-orange-600">{summary.counterOffers}</p>
              </div>
              <AlertCircle className="h-8 w-8 text-orange-400" />
            </div>
          </div>
        </div>

        {/* Filters and Search */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
                <input
                  type="text"
                  placeholder="Search bids by location, title, cargo type, or message..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
            
            <div className="sm:w-48">
              <div className="relative">
                <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none bg-white"
                >
                  {statusOptions.map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Results Count */}
          <div className="mt-4 pt-4 border-t border-gray-100">
            <p className="text-sm text-gray-600">
              Showing {filteredBids.length} of {pagination.totalBids} bids
              {searchTerm && (
                <span> matching "{searchTerm}"</span>
              )}
              {statusFilter !== 'all' && (
                <span> with status "{statusOptions.find(opt => opt.value === statusFilter)?.label}"</span>
              )}
            </p>
          </div>
        </div>

        {/* Bids List */}
        {filteredBids.length > 0 ? (
          <div className="space-y-6">
            {filteredBids.map(bid => (
              <BidCard
                key={bid._id}
                bid={bid}
                formatCurrency={formatCurrency}
                formatDate={formatDate}
                onAcceptCounterOffer={handleAcceptCounterOffer}
                onDeclineCounterOffer={handleDeclineCounterOffer}
                onWithdraw={handleWithdraw}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
              {searchTerm || statusFilter !== 'all' ? (
                <>
                  <Search className="mx-auto h-16 w-16 text-gray-400 mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No bids found</h3>
                  <p className="text-gray-600 mb-4">
                    No bids match your current filters. Try adjusting your search criteria.
                  </p>
                  <div className="space-x-3">
                    <button
                      onClick={() => setSearchTerm('')}
                      className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      Clear Search
                    </button>
                    <button
                      onClick={() => setStatusFilter('all')}
                      className="px-4 py-2 text-sm bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                    >
                      Show All Bids
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <Briefcase className="mx-auto h-16 w-16 text-gray-400 mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No bids yet</h3>
                  <p className="text-gray-600 mb-4">
                    You haven't submitted any bids yet. Start browsing available loads to place your first bid.
                  </p>
                  <Link
                    to="/loads"
                    className="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    <Package className="mr-2" size={16} />
                    Browse Loads
                  </Link>
                </>
              )}
            </div>
          </div>
        )}

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="mt-8 flex items-center justify-between">
            <div className="flex-1 flex justify-between sm:hidden">
              <button
                onClick={() => fetchBids(false, pagination.currentPage - 1)}
                disabled={!pagination.hasPrevPage}
                className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <button
                onClick={() => fetchBids(false, pagination.currentPage + 1)}
                disabled={!pagination.hasNextPage}
                className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
            
            <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
              <div>
                <p className="text-sm text-gray-700">
                  Showing page <span className="font-medium">{pagination.currentPage}</span> of{' '}
                  <span className="font-medium">{pagination.totalPages}</span>
                </p>
              </div>
              <div>
                <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
                  <button
                    onClick={() => fetchBids(false, pagination.currentPage - 1)}
                    disabled={!pagination.hasPrevPage}
                    className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ArrowLeft className="h-5 w-5" />
                  </button>
                  
                  {/* Page Numbers */}
                  {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                    const page = i + 1;
                    return (
                      <button
                        key={page}
                        onClick={() => fetchBids(false, page)}
                        className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                          page === pagination.currentPage
                            ? 'z-10 bg-blue-50 border-blue-500 text-blue-600'
                            : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
                        }`}
                      >
                        {page}
                      </button>
                    );
                  })}
                  
                  <button
                    onClick={() => fetchBids(false, pagination.currentPage + 1)}
                    disabled={!pagination.hasNextPage}
                    className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ArrowLeft className="h-5 w-5 transform rotate-180" />
                  </button>
                </nav>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DriverBidsPage