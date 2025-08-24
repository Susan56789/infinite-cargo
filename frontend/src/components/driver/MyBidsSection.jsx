import React from 'react';
import { Link } from 'react-router-dom';
import { 
  ArrowRight, 
  DollarSign, 
  Calendar, 
  MapPin, 
  Package,
  Eye,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Briefcase,
  MessageCircle,
  FileText,
  Truck,
  Weight
} from 'lucide-react';

const BidCard = ({ bid, formatCurrency, formatDate }) => {
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

  // FIXED: Comprehensive load info extraction with fallbacks
  const getLoadInfo = (bidData) => {
    // Try multiple possible data structures
    const loadInfo = bidData.load || bidData.loadInfo || bidData.loadDetails || {};
    
    return {
      title: loadInfo.title || bidData.loadTitle || `${loadInfo.pickupLocation || bidData.pickupLocation || 'Unknown'} → ${loadInfo.deliveryLocation || bidData.deliveryLocation || 'Unknown'}`,
      pickupLocation: loadInfo.pickupLocation || bidData.pickupLocation || loadInfo.origin || 'Unknown Location',
      deliveryLocation: loadInfo.deliveryLocation || bidData.deliveryLocation || loadInfo.destination || 'Unknown Location',
      budget: loadInfo.budget || loadInfo.estimatedAmount || bidData.estimatedAmount || loadInfo.price || 0,
      weight: loadInfo.weight || bidData.weight || loadInfo.estimatedWeight,
      currency: loadInfo.currency || bidData.currency || 'KES'
    };
  };

  const loadInfo = getLoadInfo(bid);

  return (
    <div className="border border-gray-200 rounded-lg p-4 hover:border-gray-300 transition-colors">
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          {/* Load Title */}
          <h4 className="font-medium text-gray-900 mb-2">
            {loadInfo.title}
          </h4>

          {/* Route */}
          <div className="flex items-center space-x-2 mb-2">
            <MapPin size={16} className="text-gray-400" />
            <span className="text-sm text-gray-600">
              {loadInfo.pickupLocation} → {loadInfo.deliveryLocation}
            </span>
          </div>

          {/* Bid Details Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3">
            <div className="flex items-center space-x-1">
              <DollarSign size={16} className="text-green-600" />
              <span className="text-sm">
                <span className="text-gray-500">Your Bid:</span>
                <span className="font-semibold text-green-600 ml-1">
                  {formatCurrency(bid.bidAmount, loadInfo.currency)}
                </span>
              </span>
            </div>
            
            <div className="flex items-center space-x-1">
              <Package size={16} className="text-blue-600" />
              <span className="text-sm">
                <span className="text-gray-500">Budget:</span>
                <span className="font-medium text-gray-900 ml-1">
                  {formatCurrency(loadInfo.budget, loadInfo.currency)}
                </span>
              </span>
            </div>
            
            <div className="flex items-center space-x-1">
              <Calendar size={16} className="text-purple-600" />
              <span className="text-sm">
                <span className="text-gray-500">Pickup:</span>
                <span className="font-medium text-gray-900 ml-1">
                  {formatDate(bid.proposedPickupDate)}
                </span>
              </span>
            </div>
            
            <div className="flex items-center space-x-1">
              <Calendar size={16} className="text-orange-600" />
              <span className="text-sm">
                <span className="text-gray-500">Delivery:</span>
                <span className="font-medium text-gray-900 ml-1">
                  {formatDate(bid.proposedDeliveryDate)}
                </span>
              </span>
            </div>
          </div>

          {/* Vehicle Details */}
          {bid.vehicleDetails && (
            <div className="mb-3 p-2 bg-gray-50 rounded-lg">
              <div className="flex items-center space-x-2 text-sm">
                <Truck size={14} className="text-gray-600" />
                <span className="text-gray-600">
                  {bid.vehicleDetails.type && (
                    <span className="font-medium">
                      {bid.vehicleDetails.type.replace('_', ' ')}
                    </span>
                  )}
                  {bid.vehicleDetails.capacity && (
                    <span className="ml-2">
                      • {bid.vehicleDetails.capacity} tonnes
                    </span>
                  )}
                </span>
              </div>
            </div>
          )}

          {/* Weight Info */}
          {loadInfo.weight && (
            <div className="mb-3">
              <div className="flex items-center space-x-1">
                <Weight size={14} className="text-gray-500" />
                <span className="text-sm text-gray-600">
                  Weight: <span className="font-medium">{loadInfo.weight}</span>
                </span>
              </div>
            </div>
          )}

          {/* Message Preview */}
          {bid.message && (
            <div className="mb-3 p-2 bg-blue-50 rounded-lg">
              <div className="flex items-start space-x-2">
                <MessageCircle size={14} className="text-blue-600 mt-0.5 flex-shrink-0" />
                <div>
                  <span className="text-xs font-medium text-blue-800 block">Your message:</span>
                  <p className="text-sm text-blue-700 line-clamp-2">{bid.message}</p>
                </div>
              </div>
            </div>
          )}

          {/* Cover Letter Preview */}
          {bid.coverLetter && (
            <div className="mb-3 p-2 bg-green-50 rounded-lg">
              <div className="flex items-start space-x-2">
                <FileText size={14} className="text-green-600 mt-0.5 flex-shrink-0" />
                <div>
                  <span className="text-xs font-medium text-green-800 block">Cover letter:</span>
                  <p className="text-sm text-green-700 line-clamp-2">{bid.coverLetter}</p>
                </div>
              </div>
            </div>
          )}

          {/* Counter Offer */}
          {bid.status === 'counter_offered' && bid.counterOffer && (
            <div className="mb-3 p-3 bg-orange-50 border border-orange-200 rounded-lg">
              <div className="flex items-center mb-2">
                <AlertCircle className="h-4 w-4 text-orange-600 mr-2" />
                <span className="text-sm font-medium text-orange-800">Counter Offer Received</span>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm mb-2">
                <div>
                  <span className="text-orange-600">Offered Amount:</span>
                  <span className="font-semibold text-orange-800 ml-1">
                    {formatCurrency(bid.counterOffer.amount, loadInfo.currency)}
                  </span>
                </div>
                
                {bid.counterOffer.proposedPickupDate && (
                  <div>
                    <span className="text-orange-600">New Pickup:</span>
                    <span className="font-medium text-orange-800 ml-1">
                      {formatDate(bid.counterOffer.proposedPickupDate)}
                    </span>
                  </div>
                )}
              </div>
              
              {bid.counterOffer.message && (
                <div className="mt-2">
                  <p className="text-sm text-orange-700">
                    <span className="font-medium">Message:</span> {bid.counterOffer.message}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Status and Date */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              {getStatusIcon(bid.status)}
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(bid.status)}`}>
                {getStatusText(bid.status)}
              </span>
            </div>
            <div className="text-right">
              <div className="text-xs text-gray-500">
                Submitted: {formatDate(bid.submittedAt || bid.createdAt)}
              </div>
              {bid.viewedAt && (
                <div className="text-xs text-indigo-600">
                  Viewed: {formatDate(bid.viewedAt)}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex space-x-2 mt-4">
        {bid.status === 'counter_offered' && (
          <Link
            to={`/bids/${bid._id}`}
            className="flex-1 inline-flex items-center justify-center px-3 py-2 bg-orange-600 text-white text-sm rounded-lg hover:bg-orange-700 transition-colors"
          >
            <AlertCircle size={14} className="mr-1" />
            Review Counter Offer
          </Link>
        )}
        
        <a
          href={`/bids/${bid._id}`}
          className={`${bid.status === 'counter_offered' ? '' : 'flex-1'} inline-flex items-center justify-center px-3 py-2 border border-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-50 transition-colors`}
        >
          <Eye size={14} className="mr-1" />
          View Details
        </a>
      </div>
    </div>
  );
};

const MyBidsSection = ({ myBids = [], formatCurrency, formatDate, loading = false, error = null }) => {
  
  const validBids = React.useMemo(() => {
    
    if (!myBids) {
     
      return [];
    }

    if (Array.isArray(myBids)) {
     
      return myBids;
    }

    // Handle case where myBids might be an object with a nested array
    if (typeof myBids === 'object') {
      
      if (myBids.bids && Array.isArray(myBids.bids)) {
        return myBids.bids;
      }
      
      if (myBids.data && Array.isArray(myBids.data)) {
        return myBids.data;
      }

      // Check for other possible nested structures
      if (myBids.myBids && Array.isArray(myBids.myBids)) {
        return myBids.myBids;
      }

    }

    console.warn('[MyBidsSection] ❌ Invalid myBids format:', typeof myBids, myBids);
    return [];
  }, [myBids]);

  const getRecentBids = () => {
    return validBids
      .sort((a, b) => new Date(b.submittedAt || b.createdAt) - new Date(a.submittedAt || a.createdAt))
      .slice(0, 3);
  };

  // FIXED: More comprehensive bid statistics calculation
  const getBidsSummary = () => {
    if (validBids.length === 0) {
      return { total: 0, pending: 0, accepted: 0, counterOffers: 0 };
    }

    const total = validBids.length;
    
    // Define pending statuses more comprehensively
    const pendingStatuses = ['submitted', 'viewed', 'under_review', 'shortlisted'];
    const pending = validBids.filter(bid => {
      const status = bid.status;
      const isPending = pendingStatuses.includes(status);
      return isPending;
    }).length;
    
    const accepted = validBids.filter(bid => bid.status === 'accepted').length;
    const counterOffers = validBids.filter(bid => bid.status === 'counter_offered').length;

    const stats = { total, pending, accepted, counterOffers };
    

    return stats;
  };

  const summary = getBidsSummary();
  const recentBids = getRecentBids();

  // FIXED: Default formatCurrency and formatDate functions if not provided
  const safeFormatCurrency = React.useCallback((amount, currency = 'KES') => {
    if (formatCurrency) {
      return formatCurrency(amount, currency);
    }
    
    // Default currency formatting
    if (!amount) return `${currency} 0`;
    
    if (currency === 'KES') {
      return new Intl.NumberFormat('en-KE', {
        style: 'currency',
        currency: 'KES',
        minimumFractionDigits: 0
      }).format(amount);
    }
    
    return `${currency} ${new Intl.NumberFormat().format(amount)}`;
  }, [formatCurrency]);

  const safeFormatDate = React.useCallback((dateString) => {
    if (formatDate) {
      return formatDate(dateString);
    }
    
    // Default date formatting
    if (!dateString) return 'Not specified';
    
    try {
      return new Date(dateString).toLocaleDateString('en-KE', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      });
    } catch (error) {
      console.warn('[MyBidsSection] Invalid date:', dateString);
      return 'Invalid date';
    }
  }, [formatDate]);

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center">
            <Briefcase size={18} className="mr-2" />
            My Bids
          </h2>
          
          {summary.total > 3 && (
            <Link
              to="/driver/bids"
              className="text-sm text-blue-600 hover:text-blue-700 flex items-center"
            >
              View All
              <ArrowRight size={14} className="ml-1" />
            </Link>
          )}
        </div>
        
        {/* FIXED: Summary stats with better styling and error handling */}
        <div className="grid grid-cols-4 gap-4 mt-4">
          <div className="text-center p-3 bg-gray-50 rounded-lg">
            <div className="text-2xl font-bold text-gray-900">{summary.total}</div>
            <div className="text-xs text-gray-500">Total Bids</div>
          </div>
          <div className="text-center p-3 bg-blue-50 rounded-lg">
            <div className="text-2xl font-bold text-blue-600">{summary.pending}</div>
            <div className="text-xs text-gray-500">Pending</div>
          </div>
          <div className="text-center p-3 bg-green-50 rounded-lg">
            <div className="text-2xl font-bold text-green-600">{summary.accepted}</div>
            <div className="text-xs text-gray-500">Accepted</div>
          </div>
          <div className="text-center p-3 bg-orange-50 rounded-lg">
            <div className="text-2xl font-bold text-orange-600">{summary.counterOffers}</div>
            <div className="text-xs text-gray-500">Counter Offers</div>
          </div>
        </div>
      </div>

      <div className="p-6">
        {loading && (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="text-gray-600 mt-2">Loading your bids...</p>
          </div>
        )}

        {error && (
          <div className="text-center py-8">
            <XCircle size={48} className="mx-auto text-red-400 mb-4" />
            <p className="text-red-600 mb-2">Error loading bids</p>
            <p className="text-sm text-gray-500">{error}</p>
          </div>
        )}

        {!loading && !error && recentBids.length > 0 && (
          <div className="space-y-4">
            {recentBids.map((bid) => (
              <BidCard 
                key={bid._id || bid.id} 
                bid={bid} 
                formatCurrency={safeFormatCurrency}
                formatDate={safeFormatDate}
              />
            ))}
            
            {summary.total > 3 && (
              <div className="text-center pt-4 border-t border-gray-100">
                <a
                  href="/driver/bids"
                  className="inline-flex items-center px-4 py-2 text-sm text-blue-600 hover:text-blue-700 font-medium"
                >
                  View All {summary.total} Bids
                  <ArrowRight size={16} className="ml-1" />
                </a>
              </div>
            )}
          </div>
        )}

        {!loading && !error && recentBids.length === 0 && (
          <div className="text-center py-8">
            <Briefcase size={48} className="mx-auto text-gray-400 mb-4" />
            <p className="text-gray-600 mb-2">No bids placed yet</p>
            <p className="text-sm text-gray-500 mb-4">
              Start bidding on available loads to grow your business
            </p>
            <a
              href="/search-loads"
              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Package size={16} className="mr-2" />
              Find Loads to Bid On
            </a>
          </div>
        )}
      </div>
    </div>
  );
};

export default MyBidsSection;