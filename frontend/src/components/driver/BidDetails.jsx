import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { 
  ArrowLeft, 
  DollarSign,  
  MapPin, 
  Package,
  Eye,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  MessageCircle,
  FileText,
  Truck,
  Weight,
  User,
  Phone,
  Mail,
  Star,
  Edit3,
  Send,
  Loader,
  RefreshCw,
  ExternalLink
} from 'lucide-react';

// Import auth utilities
import { getAuthHeader, isAuthenticated, getUserType } from '../../utils/auth';

const BidDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  // State management
  const [bid, setBid] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  
  // Counter offer response state
  const [showCounterResponse, setShowCounterResponse] = useState(false);
  const [counterResponse, setCounterResponse] = useState({
    action: '', // 'accept' or 'decline'
    message: ''
  });

  // Message state
  const [showMessageForm, setShowMessageForm] = useState(false);
  const [newMessage, setNewMessage] = useState('');

  // Get auth headers
  const getAuthHeaders = useCallback(() => {
    return {
      ...getAuthHeader(),
      'Content-Type': 'application/json'
    };
  }, []);

  // Check authentication
  useEffect(() => {
    if (!isAuthenticated() || getUserType() !== 'driver') {
      navigate('/login');
      return;
    }
  }, [navigate]);

  // Fetch bid details
  const fetchBidDetails = useCallback(async () => {
  setLoading(true);
  setError('');

  try {
    const response = await fetch(`https://infinite-cargo-api.onrender.com/api/bids/${id}`, {
      headers: getAuthHeaders()
    });

    if (response.status === 401) {
      navigate('/login');
      return;
    }

    if (response.status === 403) {
      const errorData = await response.json().catch(() => ({}));
      setError(errorData.message || 'Not authorized to view this bid');
      return;
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      setError(errorData.message || 'Failed to load bid details');
      return;
    }

    const result = await response.json();
    const bidData = result.data?.bid || result.bid || result.data || result;

    const enhancedBid = {
      ...bidData,
      load: bidData.load || bidData.loadInfo || bidData.loadDetails || {},
      bidAmount: bidData.bidAmount || 0,
      currency: bidData.currency || 'KES',
      status: bidData.status || 'submitted'
    };

    setBid(enhancedBid);

    if (bidData.status === 'counter_offered' && bidData.counterOffer) {
      setShowCounterResponse(true);
    }

  } catch (error) {
    setError('Failed to load bid details. Please try again.');
  } finally {
    setLoading(false);
  }
}, [id, getAuthHeaders, navigate]);
  // Load bid details on mount
  useEffect(() => {
    if (id) {
      fetchBidDetails();
    }
  }, [id, fetchBidDetails]);

  // Handle counter offer response
  const handleCounterOfferResponse = async (action) => {
    if (!bid?.counterOffer) return;

    setActionLoading(true);
    
    try {
      const response = await fetch(`https://infinite-cargo-api.onrender.com/api/bids/${id}/counter-offer-response`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          action, // 'accept' or 'decline'
          message: counterResponse.message
        })
      });

      if (response.ok) {
        // Refresh bid data
        await fetchBidDetails();
        setShowCounterResponse(false);
        setCounterResponse({ action: '', message: '' });
      } else {
        const errorData = await response.json().catch(() => ({}));
        setError(errorData.message || `Failed to ${action} counter offer`);
      }
    } catch (error) {
      console.error(`Error ${action}ing counter offer:`, error);
      setError(`Failed to ${action} counter offer. Please try again.`);
    } finally {
      setActionLoading(false);
    }
  };

  // Send message to cargo owner
  const sendMessage = async () => {
    if (!newMessage.trim() || !bid) return;

    setActionLoading(true);
    
    try {
      const response = await fetch(`https://infinite-cargo-api.onrender.com/api/bids/${id}/message`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          message: newMessage.trim()
        })
      });

      if (response.ok) {
        setNewMessage('');
        setShowMessageForm(false);
        // Refresh bid data to show the new message
        await fetchBidDetails();
      } else {
        const errorData = await response.json().catch(() => ({}));
        setError(errorData.message || 'Failed to send message');
      }
    } catch (error) {
      console.error('Error sending message:', error);
      setError('Failed to send message. Please try again.');
    } finally {
      setActionLoading(false);
    }
  };

  // Withdraw bid
  const withdrawBid = async () => {
    if (!window.confirm('Are you sure you want to withdraw this bid? This action cannot be undone.')) {
      return;
    }

    setActionLoading(true);
    
    try {
      const response = await fetch(`https://infinite-cargo-api.onrender.com/api/bids/${id}/withdraw`, {
        method: 'POST',
        headers: getAuthHeaders()
      });

      if (response.ok) {
        await fetchBidDetails();
      } else {
        const errorData = await response.json().catch(() => ({}));
        setError(errorData.message || 'Failed to withdraw bid');
      }
    } catch (error) {
      console.error('Error withdrawing bid:', error);
      setError('Failed to withdraw bid. Please try again.');
    } finally {
      setActionLoading(false);
    }
  };

  // Utility functions
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
    if (!dateString) return 'Not specified';
    
    try {
      return new Date(dateString).toLocaleDateString('en-KE', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (error) {
      return 'Invalid date';
    }
  };

  const formatDateShort = (dateString) => {
    if (!dateString) return 'Not specified';
    
    try {
      return new Date(dateString).toLocaleDateString('en-KE', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      });
    } catch (error) {
      return 'Invalid date';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'accepted':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'rejected':
        return <XCircle className="h-5 w-5 text-red-500" />;
      case 'counter_offered':
        return <AlertCircle className="h-5 w-5 text-orange-500" />;
      case 'shortlisted':
        return <CheckCircle className="h-5 w-5 text-blue-500" />;
      case 'withdrawn':
        return <XCircle className="h-5 w-5 text-gray-500" />;
      case 'viewed':
        return <Eye className="h-5 w-5 text-indigo-500" />;
      case 'under_review':
        return <Clock className="h-5 w-5 text-purple-500" />;
      default:
        return <Clock className="h-5 w-5 text-gray-500" />;
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

  // Get load information with fallbacks
  const getLoadInfo = () => {
    if (!bid) return {};
    
    const loadInfo = bid.load || bid.loadInfo || bid.loadDetails || {};
    
    return {
      title: loadInfo.title || bid.loadTitle || `${loadInfo.pickupLocation || bid.pickupLocation || 'Unknown'} → ${loadInfo.deliveryLocation || bid.deliveryLocation || 'Unknown'}`,
      pickupLocation: loadInfo.pickupLocation || bid.pickupLocation || loadInfo.origin || 'Unknown Location',
      deliveryLocation: loadInfo.deliveryLocation || bid.deliveryLocation || loadInfo.destination || 'Unknown Location',
      budget: loadInfo.budget || loadInfo.estimatedAmount || bid.estimatedAmount || loadInfo.price || 0,
      weight: loadInfo.weight || bid.weight || loadInfo.estimatedWeight,
      currency: loadInfo.currency || bid.currency || 'KES',
      description: loadInfo.description || bid.description,
      cargoType: loadInfo.cargoType || loadInfo.loadType || 'General Cargo',
      urgency: loadInfo.urgency || 'normal',
      cargoOwner: loadInfo.cargoOwner || bid.cargoOwner
    };
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader className="mx-auto h-12 w-12 text-blue-600 animate-spin" />
          <p className="mt-4 text-gray-600">Loading bid details...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error && !bid) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto">
          <AlertCircle className="mx-auto h-12 w-12 text-red-600" />
          <h3 className="mt-4 text-lg font-semibold text-gray-900">Error Loading Bid</h3>
          <p className="mt-2 text-gray-600">{error}</p>
          <div className="mt-4 space-x-3">
            <button 
              onClick={fetchBidDetails}
              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <RefreshCw size={16} className="mr-2" />
              Try Again
            </button>
            <Link
              to="/driver/bids"
              className="inline-flex items-center px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <ArrowLeft size={16} className="mr-2" />
              Back to Bids
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!bid) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">Bid not found</p>
          <Link
            to="/driver/bids"
            className="mt-4 inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <ArrowLeft size={16} className="mr-2" />
            Back to Bids
          </Link>
        </div>
      </div>
    );
  }

  const loadInfo = getLoadInfo();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Link
                to="/driver/bids"
                className="inline-flex items-center text-gray-600 hover:text-gray-900 transition-colors"
              >
                <ArrowLeft size={20} className="mr-2" />
                Back to My Bids
              </Link>
              <div className="h-6 w-px bg-gray-300"></div>
              <h1 className="text-xl font-semibold text-gray-900">Bid Details</h1>
            </div>
            
            <div className="flex items-center space-x-2">
              {getStatusIcon(bid.status)}
              <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(bid.status)}`}>
                {getStatusText(bid.status)}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Error banner */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex">
              <AlertCircle className="h-5 w-5 text-red-400" />
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">Error</h3>
                <p className="mt-1 text-sm text-red-700">{error}</p>
              </div>
              <button
                onClick={() => setError('')}
                className="ml-auto text-red-400 hover:text-red-600"
              >
                ×
              </button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Load Information */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900 flex items-center">
                  <Package size={18} className="mr-2" />
                  Load Information
                </h2>
              </div>
              
              <div className="p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">
                  {loadInfo.title}
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                  <div className="flex items-center space-x-2">
                    <MapPin size={16} className="text-green-600" />
                    <div>
                      <span className="text-sm text-gray-500">Pickup</span>
                      <p className="font-medium text-gray-900">{loadInfo.pickupLocation}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <MapPin size={16} className="text-red-600" />
                    <div>
                      <span className="text-sm text-gray-500">Delivery</span>
                      <p className="font-medium text-gray-900">{loadInfo.deliveryLocation}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <Package size={16} className="text-blue-600" />
                    <div>
                      <span className="text-sm text-gray-500">Cargo Type</span>
                      <p className="font-medium text-gray-900">{loadInfo.cargoType}</p>
                    </div>
                  </div>
                  
                  {loadInfo.weight && (
                    <div className="flex items-center space-x-2">
                      <Weight size={16} className="text-purple-600" />
                      <div>
                        <span className="text-sm text-gray-500">Weight</span>
                        <p className="font-medium text-gray-900">{loadInfo.weight}</p>
                      </div>
                    </div>
                  )}
                  
                  <div className="flex items-center space-x-2">
                    <DollarSign size={16} className="text-green-600" />
                    <div>
                      <span className="text-sm text-gray-500">Budget</span>
                      <p className="font-medium text-gray-900">
                        {formatCurrency(loadInfo.budget, loadInfo.currency)}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <Clock size={16} className="text-orange-600" />
                    <div>
                      <span className="text-sm text-gray-500">Urgency</span>
                      <p className="font-medium text-gray-900 capitalize">{loadInfo.urgency}</p>
                    </div>
                  </div>
                </div>
                
                {loadInfo.description && (
                  <div>
                    <h4 className="text-sm font-medium text-gray-500 mb-2">Description</h4>
                    <p className="text-gray-700">{loadInfo.description}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Bid Information */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900 flex items-center">
                  <DollarSign size={18} className="mr-2" />
                  Your Bid
                </h2>
              </div>
              
              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                  <div>
                    <span className="text-sm text-gray-500">Bid Amount</span>
                    <p className="text-2xl font-bold text-green-600">
                      {formatCurrency(bid.bidAmount, bid.currency)}
                    </p>
                  </div>
                  
                  <div>
                    <span className="text-sm text-gray-500">Status</span>
                    <div className="flex items-center space-x-2 mt-1">
                      {getStatusIcon(bid.status)}
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(bid.status)}`}>
                        {getStatusText(bid.status)}
                      </span>
                    </div>
                  </div>
                  
                  <div>
                    <span className="text-sm text-gray-500">Proposed Pickup</span>
                    <p className="font-medium text-gray-900">
                      {formatDateShort(bid.proposedPickupDate)}
                    </p>
                  </div>
                  
                  <div>
                    <span className="text-sm text-gray-500">Proposed Delivery</span>
                    <p className="font-medium text-gray-900">
                      {formatDateShort(bid.proposedDeliveryDate)}
                    </p>
                  </div>
                </div>

                {/* Vehicle Details */}
                {bid.vehicleDetails && (
                  <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                    <h4 className="text-sm font-medium text-gray-700 mb-2 flex items-center">
                      <Truck size={14} className="mr-1" />
                      Vehicle Details
                    </h4>
                    <div className="text-sm text-gray-600">
                      {bid.vehicleDetails.type && (
                        <span className="block">Type: {bid.vehicleDetails.type.replace('_', ' ')}</span>
                      )}
                      {bid.vehicleDetails.capacity && (
                        <span className="block">Capacity: {bid.vehicleDetails.capacity} tonnes</span>
                      )}
                      {bid.vehicleDetails.model && (
                        <span className="block">Model: {bid.vehicleDetails.model}</span>
                      )}
                    </div>
                  </div>
                )}
                
                {/* Bid Message */}
                {bid.message && (
                  <div className="mb-6 p-4 bg-blue-50 rounded-lg">
                    <h4 className="text-sm font-medium text-blue-800 mb-2 flex items-center">
                      <MessageCircle size={14} className="mr-1" />
                      Your Message
                    </h4>
                    <p className="text-sm text-blue-700">{bid.message}</p>
                  </div>
                )}

                {/* Cover Letter */}
                {bid.coverLetter && (
                  <div className="mb-6 p-4 bg-green-50 rounded-lg">
                    <h4 className="text-sm font-medium text-green-800 mb-2 flex items-center">
                      <FileText size={14} className="mr-1" />
                      Cover Letter
                    </h4>
                    <p className="text-sm text-green-700">{bid.coverLetter}</p>
                  </div>
                )}

                {/* Timestamps */}
                <div className="text-sm text-gray-500 space-y-1">
                  <p>Submitted: {formatDate(bid.submittedAt || bid.createdAt)}</p>
                  {bid.viewedAt && (
                    <p>Viewed: {formatDate(bid.viewedAt)}</p>
                  )}
                  {bid.updatedAt && bid.updatedAt !== bid.createdAt && (
                    <p>Last Updated: {formatDate(bid.updatedAt)}</p>
                  )}
                  {bid.expiresAt && (
                    <p>Expires: {formatDate(bid.expiresAt)}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Counter Offer Section */}
            {bid.status === 'counter_offered' && bid.counterOffer && (
              <div className="bg-white rounded-lg shadow-sm border border-orange-200">
                <div className="px-6 py-4 border-b border-orange-200 bg-orange-50">
                  <h2 className="text-lg font-semibold text-orange-900 flex items-center">
                    <AlertCircle size={18} className="mr-2" />
                    Counter Offer Received
                  </h2>
                </div>
                
                <div className="p-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                    <div>
                      <span className="text-sm text-gray-500">Offered Amount</span>
                      <p className="text-2xl font-bold text-orange-600">
                        {formatCurrency(bid.counterOffer.amount, bid.currency)}
                      </p>
                      <p className="text-sm text-gray-500">
                        Original: {formatCurrency(bid.bidAmount, bid.currency)}
                      </p>
                    </div>
                    
                    {bid.counterOffer.proposedPickupDate && (
                      <div>
                        <span className="text-sm text-gray-500">New Pickup Date</span>
                        <p className="font-medium text-gray-900">
                          {formatDateShort(bid.counterOffer.proposedPickupDate)}
                        </p>
                      </div>
                    )}
                  </div>
                  
                  {bid.counterOffer.message && (
                    <div className="mb-6 p-4 bg-orange-50 rounded-lg">
                      <h4 className="text-sm font-medium text-orange-800 mb-2">Message from Cargo Owner</h4>
                      <p className="text-sm text-orange-700">{bid.counterOffer.message}</p>
                    </div>
                  )}

                  {showCounterResponse && (
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Response Message (Optional)
                        </label>
                        <textarea
                          value={counterResponse.message}
                          onChange={(e) => setCounterResponse(prev => ({...prev, message: e.target.value}))}
                          placeholder="Add a message with your response..."
                          rows={3}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                      
                      <div className="flex space-x-3">
                        <button
                          onClick={() => handleCounterOfferResponse('accept')}
                          disabled={actionLoading}
                          className="flex-1 inline-flex items-center justify-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          {actionLoading ? (
                            <Loader size={16} className="animate-spin mr-2" />
                          ) : (
                            <CheckCircle size={16} className="mr-2" />
                          )}
                          Accept Counter Offer
                        </button>
                        
                        <button
                          onClick={() => handleCounterOfferResponse('decline')}
                          disabled={actionLoading}
                          className="flex-1 inline-flex items-center justify-center px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          {actionLoading ? (
                            <Loader size={16} className="animate-spin mr-2" />
                          ) : (
                            <XCircle size={16} className="mr-2" />
                          )}
                          Decline Counter Offer
                        </button>
                      </div>
                      
                      <button
                        onClick={() => setShowCounterResponse(false)}
                        className="w-full text-sm text-gray-600 hover:text-gray-800 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Messages/Communication */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
              <div className="px-6 py-4 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-gray-900 flex items-center">
                    <MessageCircle size={18} className="mr-2" />
                    Communication
                  </h2>
                  <button
                    onClick={() => setShowMessageForm(!showMessageForm)}
                    className="text-sm text-blue-600 hover:text-blue-700 flex items-center"
                  >
                    <Edit3 size={14} className="mr-1" />
                    Send Message
                  </button>
                </div>
              </div>
              
              <div className="p-6">
                {showMessageForm && (
                  <div className="mb-6 p-4 bg-blue-50 rounded-lg">
                    <label className="block text-sm font-medium text-blue-800 mb-2">
                      Send Message to Cargo Owner
                    </label>
                    <textarea
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      placeholder="Type your message here..."
                      rows={4}
                      className="w-full border border-blue-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                    <div className="mt-3 flex space-x-3">
                      <button
                        onClick={sendMessage}
                        disabled={!newMessage.trim() || actionLoading}
                        className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        {actionLoading ? (
                          <Loader size={16} className="animate-spin mr-2" />
                        ) : (
                          <Send size={16} className="mr-2" />
                        )}
                        Send Message
                      </button>
                      <button
                        onClick={() => {
                          setShowMessageForm(false);
                          setNewMessage('');
                        }}
                        className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {/* Message History */}
                {bid.messages && bid.messages.length > 0 ? (
                  <div className="space-y-4">
                    {bid.messages.map((message, index) => (
                      <div
                        key={index}
                        className={`p-4 rounded-lg ${
                          message.sender === 'driver' 
                            ? 'bg-blue-50 border-l-4 border-blue-400' 
                            : 'bg-gray-50 border-l-4 border-gray-400'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium text-gray-900">
                            {message.sender === 'driver' ? 'You' : 'Cargo Owner'}
                          </span>
                          <span className="text-xs text-gray-500">
                            {formatDate(message.createdAt)}
                          </span>
                        </div>
                        <p className="text-gray-700">{message.content}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 text-center py-8">
                    No messages yet. Start a conversation with the cargo owner.
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1 space-y-6">
            {/* Cargo Owner Info */}
            {loadInfo.cargoOwner && (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                    <User size={18} className="mr-2" />
                    Cargo Owner
                  </h3>
                </div>
                
                <div className="p-6">
                  <div className="text-center mb-4">
                    <div className="w-16 h-16 bg-gray-200 rounded-full mx-auto mb-3 flex items-center justify-center">
                      <User size={24} className="text-gray-500" />
                    </div>
                    <h4 className="font-medium text-gray-900">
                      {loadInfo.cargoOwner.name || loadInfo.cargoOwner.companyName || 'Cargo Owner'}
                    </h4>
                    {loadInfo.cargoOwner.companyName && loadInfo.cargoOwner.name !== loadInfo.cargoOwner.companyName && (
                      <p className="text-sm text-gray-500">{loadInfo.cargoOwner.name}</p>
                    )}
                  </div>

                  {/* Contact Info */}
                  {(loadInfo.cargoOwner.email || loadInfo.cargoOwner.phone) && (
                    <div className="space-y-2 mb-4">
                      {loadInfo.cargoOwner.email && (
                        <div className="flex items-center space-x-2 text-sm text-gray-600">
                          <Mail size={14} />
                          <span>{loadInfo.cargoOwner.email}</span>
                        </div>
                      )}
                      {loadInfo.cargoOwner.phone && (
                        <div className="flex items-center space-x-2 text-sm text-gray-600">
                          <Phone size={14} />
                          <span>{loadInfo.cargoOwner.phone}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Rating */}
                  {loadInfo.cargoOwner.rating && (
                    <div className="flex items-center space-x-1 mb-4">
                      <Star size={16} className="text-yellow-500 fill-current" />
                      <span className="text-sm font-medium text-gray-900">
                        {loadInfo.cargoOwner.rating.toFixed(1)}
                      </span>
                      <span className="text-sm text-gray-500">
                        ({loadInfo.cargoOwner.reviewCount || 0} reviews)
                      </span>
                    </div>
                  )}

                  {/* Member Since */}
                  {loadInfo.cargoOwner.memberSince && (
                    <p className="text-sm text-gray-500">
                      Member since {formatDateShort(loadInfo.cargoOwner.memberSince)}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Quick Actions */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900">Actions</h3>
              </div>
              
              <div className="p-6 space-y-3">
                {/* View Load Details */}
                {bid.loadId && (
                  <Link
                    to={`/loads/${bid.loadId}`}
                    className="w-full inline-flex items-center justify-center px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <ExternalLink size={16} className="mr-2" />
                    View Full Load Details
                  </Link>
                )}

                {/* Send Message */}
                {!showMessageForm && (
                  <button
                    onClick={() => setShowMessageForm(true)}
                    className="w-full inline-flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    <MessageCircle size={16} className="mr-2" />
                    Send Message
                  </button>
                )}

                {/* Counter Offer Response */}
                {bid.status === 'counter_offered' && !showCounterResponse && (
                  <button
                    onClick={() => setShowCounterResponse(true)}
                    className="w-full inline-flex items-center justify-center px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
                  >
                    <AlertCircle size={16} className="mr-2" />
                    Respond to Counter Offer
                  </button>
                )}

                {/* Withdraw Bid */}
                {['submitted', 'viewed', 'under_review'].includes(bid.status) && (
                  <button
                    onClick={withdrawBid}
                    disabled={actionLoading}
                    className="w-full inline-flex items-center justify-center px-4 py-2 border border-red-300 text-red-700 rounded-lg hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {actionLoading ? (
                      <Loader size={16} className="animate-spin mr-2" />
                    ) : (
                      <XCircle size={16} className="mr-2" />
                    )}
                    Withdraw Bid
                  </button>
                )}

                {/* Refresh */}
                <button
                  onClick={fetchBidDetails}
                  disabled={loading}
                  className="w-full inline-flex items-center justify-center px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <RefreshCw size={16} className={`mr-2 ${loading ? 'animate-spin' : ''}`} />
                  Refresh
                </button>
              </div>
            </div>

            {/* Bid Timeline */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900">Timeline</h3>
              </div>
              
              <div className="p-6">
                <div className="space-y-4">
                  {/* Submitted */}
                  <div className="flex items-start space-x-3">
                    <div className="flex-shrink-0 w-2 h-2 bg-blue-600 rounded-full mt-2"></div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">Bid Submitted</p>
                      <p className="text-xs text-gray-500">
                        {formatDate(bid.submittedAt || bid.createdAt)}
                      </p>
                    </div>
                  </div>

                  {/* Viewed */}
                  {bid.viewedAt && (
                    <div className="flex items-start space-x-3">
                      <div className="flex-shrink-0 w-2 h-2 bg-indigo-600 rounded-full mt-2"></div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">Viewed by Cargo Owner</p>
                        <p className="text-xs text-gray-500">{formatDate(bid.viewedAt)}</p>
                      </div>
                    </div>
                  )}

                  {/* Status Updates */}
                  {bid.status === 'under_review' && (
                    <div className="flex items-start space-x-3">
                      <div className="flex-shrink-0 w-2 h-2 bg-purple-600 rounded-full mt-2"></div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">Under Review</p>
                        <p className="text-xs text-gray-500">Being evaluated by cargo owner</p>
                      </div>
                    </div>
                  )}

                  {bid.status === 'shortlisted' && (
                    <div className="flex items-start space-x-3">
                      <div className="flex-shrink-0 w-2 h-2 bg-emerald-600 rounded-full mt-2"></div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">Shortlisted</p>
                        <p className="text-xs text-gray-500">Selected as a potential candidate</p>
                      </div>
                    </div>
                  )}

                  {bid.status === 'counter_offered' && (
                    <div className="flex items-start space-x-3">
                      <div className="flex-shrink-0 w-2 h-2 bg-orange-600 rounded-full mt-2"></div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">Counter Offer Received</p>
                        <p className="text-xs text-gray-500">
                          {formatCurrency(bid.counterOffer?.amount, bid.currency)}
                        </p>
                      </div>
                    </div>
                  )}

                  {bid.status === 'accepted' && (
                    <div className="flex items-start space-x-3">
                      <div className="flex-shrink-0 w-2 h-2 bg-green-600 rounded-full mt-2"></div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">Bid Accepted</p>
                        <p className="text-xs text-gray-500">
                          {bid.acceptedAt ? formatDate(bid.acceptedAt) : 'Congratulations!'}
                        </p>
                      </div>
                    </div>
                  )}

                  {bid.status === 'rejected' && (
                    <div className="flex items-start space-x-3">
                      <div className="flex-shrink-0 w-2 h-2 bg-red-600 rounded-full mt-2"></div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">Bid Rejected</p>
                        <p className="text-xs text-gray-500">Better luck next time</p>
                      </div>
                    </div>
                  )}

                  {bid.status === 'withdrawn' && (
                    <div className="flex items-start space-x-3">
                      <div className="flex-shrink-0 w-2 h-2 bg-gray-600 rounded-full mt-2"></div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">Bid Withdrawn</p>
                        <p className="text-xs text-gray-500">Withdrawn by you</p>
                      </div>
                    </div>
                  )}

                  {/* Expiration */}
                  {bid.expiresAt && new Date(bid.expiresAt) > new Date() && (
                    <div className="flex items-start space-x-3">
                      <div className="flex-shrink-0 w-2 h-2 bg-yellow-600 rounded-full mt-2"></div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">Expires</p>
                        <p className="text-xs text-gray-500">{formatDate(bid.expiresAt)}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Bid Statistics */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900">Bid Stats</h3>
              </div>
              
              <div className="p-6 space-y-3">
                {loadInfo.budget && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Budget</span>
                    <span className="text-sm font-medium text-gray-900">
                      {formatCurrency(loadInfo.budget, bid.currency)}
                    </span>
                  </div>
                )}
                
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Your Bid</span>
                  <span className="text-sm font-medium text-green-600">
                    {formatCurrency(bid.bidAmount, bid.currency)}
                  </span>
                </div>

                {bid.counterOffer && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Counter Offer</span>
                    <span className="text-sm font-medium text-orange-600">
                      {formatCurrency(bid.counterOffer.amount, bid.currency)}
                    </span>
                  </div>
                )}

                {loadInfo.budget && (
                  <div className="pt-3 border-t border-gray-200">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Difference</span>
                      <span className={`text-sm font-medium ${
                        bid.bidAmount <= loadInfo.budget ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {bid.bidAmount <= loadInfo.budget ? '-' : '+'}
                        {formatCurrency(Math.abs(bid.bidAmount - loadInfo.budget), bid.currency)}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BidDetails;