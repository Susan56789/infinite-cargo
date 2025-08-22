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
  Briefcase
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
    return statusTexts[status] || status;
  };

  return (
    <div className="border border-gray-200 rounded-lg p-4 hover:border-gray-300 transition-colors">
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          {/* Load Title */}
          <h4 className="font-medium text-gray-900 mb-2">
            {bid.loadInfo?.title || `${bid.loadInfo?.pickupLocation} → ${bid.loadInfo?.deliveryLocation}`}
          </h4>

          {/* Route */}
          <div className="flex items-center space-x-2 mb-2">
            <MapPin size={16} className="text-gray-400" />
            <span className="text-sm text-gray-600">
              {bid.loadInfo?.pickupLocation} → {bid.loadInfo?.deliveryLocation}
            </span>
          </div>

          {/* Bid Details */}
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div className="flex items-center space-x-1">
              <DollarSign size={16} className="text-gray-400" />
              <span className="text-sm font-medium text-green-600">
                Your Bid: {formatCurrency(bid.bidAmount)}
              </span>
            </div>
            <div className="flex items-center space-x-1">
              <Package size={16} className="text-gray-400" />
              <span className="text-sm text-gray-600">
                Budget: {formatCurrency(bid.loadInfo?.budget)}
              </span>
            </div>
            <div className="flex items-center space-x-1">
              <Calendar size={16} className="text-gray-400" />
              <span className="text-sm text-gray-600">
                Pickup: {formatDate(bid.proposedPickupDate)}
              </span>
            </div>
            <div className="flex items-center space-x-1">
              <Calendar size={16} className="text-gray-400" />
              <span className="text-sm text-gray-600">
                Delivery: {formatDate(bid.proposedDeliveryDate)}
              </span>
            </div>
          </div>

          {/* Message Preview */}
          {bid.message && (
            <div className="mb-3">
              <p className="text-sm text-gray-600 line-clamp-2">
                <span className="font-medium">Your message:</span> {bid.message}
              </p>
            </div>
          )}

          {/* Counter Offer */}
          {bid.status === 'counter_offered' && bid.counterOffer && (
            <div className="mb-3 p-3 bg-orange-50 border border-orange-200 rounded-lg">
              <div className="flex items-center mb-2">
                <AlertCircle className="h-4 w-4 text-orange-600 mr-2" />
                <span className="text-sm font-medium text-orange-800">Counter Offer Received</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-gray-600">Offered Amount:</span>
                  <span className="font-medium text-orange-800 ml-1">
                    {formatCurrency(bid.counterOffer.amount)}
                  </span>
                </div>
                <div>
                  <span className="text-gray-600">New Pickup:</span>
                  <span className="font-medium text-orange-800 ml-1">
                    {formatDate(bid.counterOffer.proposedPickupDate)}
                  </span>
                </div>
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
            <span className="text-xs text-gray-500">
              {formatDate(bid.submittedAt)}
            </span>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex space-x-2">
        {bid.status === 'counter_offered' && (
          <>
            <Link
              to={`/driver/bid/${bid._id}/counter-offer`}
              className="flex-1 inline-flex items-center justify-center px-3 py-2 bg-orange-600 text-white text-sm rounded-lg hover:bg-orange-700 transition-colors"
            >
              <AlertCircle size={14} className="mr-1" />
              Review Counter Offer
            </Link>
          </>
        )}
        
        <Link
          to={`/driver/bid/${bid._id}`}
          className={`${bid.status === 'counter_offered' ? '' : 'flex-1'} inline-flex items-center justify-center px-3 py-2 border border-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-50 transition-colors`}
        >
          <Eye size={14} className="mr-1" />
          View Details
        </Link>
      </div>
    </div>
  );
};

const MyBidsSection = ({ myBids, formatCurrency, formatDate }) => {
  const getRecentBids = () => {
    return myBids
      .sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt))
      .slice(0, 3);
  };

  const getBidsSummary = () => {
    const total = myBids.length;
    const pending = myBids.filter(bid => 
      ['submitted', 'viewed', 'under_review', 'shortlisted'].includes(bid.status)
    ).length;
    const accepted = myBids.filter(bid => bid.status === 'accepted').length;
    const counterOffers = myBids.filter(bid => bid.status === 'counter_offered').length;

    return { total, pending, accepted, counterOffers };
  };

  const summary = getBidsSummary();

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center">
            <Briefcase size={18} className="mr-2" />
            My Bids
          </h2>
        </div>
        
        {/* Bids Summary */}
        <div className="grid grid-cols-4 gap-4 mt-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900">{summary.total}</div>
            <div className="text-xs text-gray-500">Total Bids</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">{summary.pending}</div>
            <div className="text-xs text-gray-500">Pending</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">{summary.accepted}</div>
            <div className="text-xs text-gray-500">Accepted</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-orange-600">{summary.counterOffers}</div>
            <div className="text-xs text-gray-500">Counter Offers</div>
          </div>
        </div>
      </div>

      <div className="p-6">
        {myBids.length > 0 ? (
          <div className="space-y-4">
            {getRecentBids().map((bid) => (
              <BidCard 
                key={bid._id} 
                bid={bid} 
                formatCurrency={formatCurrency}
                formatDate={formatDate}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <Briefcase size={48} className="mx-auto text-gray-400 mb-4" />
            <p className="text-gray-600 mb-2">No bids placed yet</p>
            <p className="text-sm text-gray-500 mb-4">
              Start bidding on available loads to grow your business
            </p>
            <Link
              to="/search-loads"
              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Find Loads to Bid On
            </Link>
          </div>
        )}
      </div>
    </div>
  );
};

export default MyBidsSection;