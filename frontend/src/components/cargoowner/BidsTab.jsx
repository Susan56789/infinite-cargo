import React from 'react';
import { 
  RefreshCw, Users, User, DollarSign, Truck, Star, 
  Phone, MapPin, CheckCircle2, XCircle, Loader2, Clock,
  AlertCircle, MessageSquare, Calendar
} from 'lucide-react';

const BidsTab = ({
  bids,
  loading,
  formatCurrency,
  formatDate,
  onAcceptBid,
  onRejectBid,
  onRefresh,
  API_BASE_URL, 
  getAuthHeaders 
}) => {
  
  const handleAcceptBid = async (bid) => {
    const confirmMessage = `Are you sure you want to accept this bid?\n\nDriver: ${bid.driverInfo?.name}\nAmount: ${formatCurrency(bid.bidAmount)}\n\nThis will:\n• Assign the load to this driver\n• Create an active job\n• Reject all other bids\n• Notify the driver`;
    
    if (window.confirm(confirmMessage)) {
      try {
        // Show loading state
        const acceptButton = document.querySelector(`[data-bid-id="${bid._id}"] .accept-btn`);
        if (acceptButton) {
          acceptButton.disabled = true;
          acceptButton.innerHTML = '<span class="animate-spin">⏳</span> Accepting...';
        }

        console.log('=== BID ACCEPTANCE DEBUG ===');
        console.log('Bid ID:', bid._id);
        console.log('Bid data:', bid);
        console.log('API URL:', `${API_BASE_URL}/bids/${bid._id}/accept`);
        
        const authHeaders = getAuthHeaders();
        console.log('Auth headers:', authHeaders);

        // Validate required data before making request
        if (!bid._id) {
          throw new Error('Bid ID is missing');
        }

        if (!authHeaders.Authorization) {
          throw new Error('Authorization token is missing. Please refresh the page and log in again.');
        }

        const response = await fetch(`${API_BASE_URL}/bids/${bid._id}/accept`, {
          method: 'POST',
          headers: {
            ...authHeaders,
            'Accept': 'application/json'
          }
        });

        console.log('Response status:', response.status);
        console.log('Response headers:', Object.fromEntries(response.headers.entries()));

        // Handle different response statuses with specific error messages
        if (response.status === 401) {
          throw new Error('Your session has expired. Please refresh the page and log in again.');
        }

        if (response.status === 403) {
          throw new Error('You don\'t have permission to accept this bid. Make sure you own this load.');
        }

        if (response.status === 404) {
          throw new Error('Bid not found. It may have been withdrawn or already processed.');
        }

        if (response.status === 409) {
          throw new Error('This bid has already been processed or the load is no longer available.');
        }

        // Parse response body for both success and error cases
        let responseData;
        try {
          const responseText = await response.text();
          console.log('Raw response:', responseText);
          
          if (responseText) {
            responseData = JSON.parse(responseText);
          } else {
            responseData = {};
          }
        } catch (parseError) {
          console.error('Failed to parse response:', parseError);
          if (response.ok) {
            // If response was OK but parsing failed, treat as success
            responseData = { status: 'success', message: 'Bid accepted successfully' };
          } else {
            throw new Error(`Server response was not valid JSON. Status: ${response.status}`);
          }
        }

        console.log('Parsed response data:', responseData);

        if (!response.ok) {
          // Use server error message if available, otherwise use status-specific message
          const errorMessage = responseData.message || 
                              responseData.error || 
                              `Failed to accept bid (HTTP ${response.status})`;
          throw new Error(errorMessage);
        }

        // Success handling
        const successMessage = responseData.message || 'Bid accepted successfully!';
        
        if (window.showToast) {
          window.showToast(
            `✅ ${successMessage}\n\n${bid.driverInfo?.name} has been assigned to your load "${bid.loadInfo?.title || bid.load?.title}".\n\nActive job created and driver notified.`, 
            'success',
            5000
          );
        } else {
          alert(`✅ ${successMessage}`);
        }

        // Call the parent's refresh function to update the UI
        if (onRefresh) {
          console.log('Refreshing data after successful bid acceptance...');
          await onRefresh();
        }
        
        // Optionally call the original handler for any additional logic
        if (onAcceptBid) {
          try {
            await onAcceptBid(bid._id);
          } catch (handlerError) {
            console.warn('Parent handler error (non-critical):', handlerError);
          }
        }

      } catch (error) {
        console.error('=== BID ACCEPTANCE ERROR ===');
        console.error('Error details:', error);
        console.error('Error stack:', error.stack);
        
        let userFriendlyMessage = error.message;
        
        // Provide more user-friendly messages for common errors
        if (error.message.includes('fetch')) {
          userFriendlyMessage = 'Network error. Please check your internet connection and try again.';
        } else if (error.message.includes('timeout')) {
          userFriendlyMessage = 'Request timed out. Please try again.';
        } else if (error.message.includes('JSON')) {
          userFriendlyMessage = 'Server response error. Please try again or contact support.';
        }
        
        if (window.showToast) {
          window.showToast(`❌ Failed to accept bid: ${userFriendlyMessage}`, 'error', 8000);
        } else {
          alert(`❌ Failed to accept bid: ${userFriendlyMessage}`);
        }
      } finally {
        // Reset button state
        const acceptButton = document.querySelector(`[data-bid-id="${bid._id}"] .accept-btn`);
        if (acceptButton) {
          acceptButton.disabled = false;
          acceptButton.innerHTML = '<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg> Accept';
        }
      }
    }
  };

  // Enhanced bid rejection handler with better error handling
  const handleRejectBid = async (bid) => {
    const reason = window.prompt(
      `Please provide a reason for rejecting ${bid.driverInfo?.name}'s bid (optional):\n\nThis will help improve our platform and provide feedback to the driver.`
    );
    
    if (reason !== null) { // null means user cancelled
      try {
        // Show loading state
        const rejectButton = document.querySelector(`[data-bid-id="${bid._id}"] .reject-btn`);
        if (rejectButton) {
          rejectButton.disabled = true;
          rejectButton.innerHTML = '<span class="animate-spin">⏳</span> Rejecting...';
        }

        console.log('=== BID REJECTION DEBUG ===');
        console.log('Bid ID:', bid._id);
        console.log('Rejection reason:', reason);
        
        const authHeaders = getAuthHeaders();
        
        if (!authHeaders.Authorization) {
          throw new Error('Authorization token is missing. Please refresh the page and log in again.');
        }

        const response = await fetch(`${API_BASE_URL}/bids/${bid._id}/reject`, {
          method: 'POST',
          headers: {
            ...authHeaders,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify({ reason: reason?.trim() || 'No reason provided' })
        });

        console.log('Reject response status:', response.status);

        if (response.status === 401) {
          throw new Error('Your session has expired. Please refresh the page and log in again.');
        }

        if (response.status === 403) {
          throw new Error('You don\'t have permission to reject this bid.');
        }

        if (response.status === 404) {
          throw new Error('Bid not found. It may have been withdrawn or already processed.');
        }

        // Parse response
        let responseData;
        try {
          const responseText = await response.text();
          console.log('Reject response text:', responseText);
          responseData = responseText ? JSON.parse(responseText) : {};
        } catch (parseError) {
          console.error('Failed to parse reject response:', parseError);
          if (response.ok) {
            responseData = { status: 'success', message: 'Bid rejected successfully' };
          } else {
            throw new Error(`Server response was not valid JSON. Status: ${response.status}`);
          }
        }

        if (!response.ok) {
          throw new Error(responseData.message || `Failed to reject bid (HTTP ${response.status})`);
        }

        // Show success message
        const successMessage = `Bid from ${bid.driverInfo?.name} has been rejected${reason ? ` (Reason: ${reason.substring(0, 50)}${reason.length > 50 ? '...' : ''})` : ''}.`;
        
        if (window.showToast) {
          window.showToast(successMessage, 'success');
        } else {
          alert(`✅ ${successMessage}`);
        }

        // Refresh the bids list
        if (onRefresh) {
          await onRefresh();
        }
        
        // Optionally call the original handler
        if (onRejectBid) {
          try {
            await onRejectBid(bid._id, reason);
          } catch (handlerError) {
            console.warn('Parent rejection handler error (non-critical):', handlerError);
          }
        }

      } catch (error) {
        console.error('=== BID REJECTION ERROR ===');
        console.error('Error details:', error);
        
        let userFriendlyMessage = error.message;
        
        if (error.message.includes('fetch')) {
          userFriendlyMessage = 'Network error. Please check your internet connection and try again.';
        } else if (error.message.includes('timeout')) {
          userFriendlyMessage = 'Request timed out. Please try again.';
        }
        
        if (window.showToast) {
          window.showToast(`❌ Failed to reject bid: ${userFriendlyMessage}`, 'error');
        } else {
          alert(`❌ Failed to reject bid: ${userFriendlyMessage}`);
        }
      } finally {
        // Reset button state
        const rejectButton = document.querySelector(`[data-bid-id="${bid._id}"] .reject-btn`);
        if (rejectButton) {
          rejectButton.disabled = false;
          rejectButton.innerHTML = '<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="6 18L18 6M6 6l12 12"></path></svg> Reject';
        }
      }
    }
  };

  // Calculate time since bid submitted
  const getTimeSinceBid = (createdAt) => {
    if (!createdAt) return 'Unknown';
    
    try {
      const now = new Date();
      const bidTime = new Date(createdAt);
      const diffInHours = Math.floor((now - bidTime) / (1000 * 60 * 60));
      
      if (diffInHours < 1) return 'Just now';
      if (diffInHours < 24) return `${diffInHours}h ago`;
      const diffInDays = Math.floor(diffInHours / 24);
      return `${diffInDays}d ago`;
    } catch (error) {
      console.warn('Error calculating time since bid:', error);
      return 'Unknown';
    }
  };

  // Get priority level based on bid status and timing
  const getBidPriority = (bid) => {
    if (!bid) return 'normal';
    
    if (bid.status === 'counter_offered') return 'high';
    if (bid.status === 'shortlisted') return 'medium';
    
    try {
      const hoursSinceBid = (new Date() - new Date(bid.createdAt)) / (1000 * 60 * 60);
      if (hoursSinceBid > 24) return 'low';
    } catch (error) {
      console.warn('Error calculating bid priority:', error);
    }
    
    return 'normal';
  };

  // Validate bids array
  const validBids = Array.isArray(bids) ? bids.filter(bid => bid && bid._id) : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Received Bids</h3>
          <p className="text-sm text-gray-600 mt-1">
            {validBids.length > 0 ? `${validBids.length} bid${validBids.length !== 1 ? 's' : ''} received` : 'No bids received yet'}
          </p>
        </div>
        <button
          onClick={onRefresh}
          className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg flex items-center gap-2 transition-colors"
          disabled={loading}
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Quick Stats */}
      {validBids.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-blue-50 p-4 rounded-lg">
            <div className="text-2xl font-bold text-blue-600">
              {validBids.filter(b => ['pending', 'submitted'].includes(b.status)).length}
            </div>
            <div className="text-sm text-blue-700">Pending Review</div>
          </div>
          <div className="bg-green-50 p-4 rounded-lg">
            <div className="text-2xl font-bold text-green-600">
              {validBids.filter(b => b.status === 'accepted').length}
            </div>
            <div className="text-sm text-green-700">Accepted</div>
          </div>
          <div className="bg-red-50 p-4 rounded-lg">
            <div className="text-2xl font-bold text-red-600">
              {validBids.filter(b => b.status === 'rejected').length}
            </div>
            <div className="text-sm text-red-700">Rejected</div>
          </div>
          <div className="bg-purple-50 p-4 rounded-lg">
            <div className="text-2xl font-bold text-purple-600">
              {validBids.length > 0 ? 
                formatCurrency(validBids.reduce((sum, bid) => sum + (bid.bidAmount || 0), 0) / validBids.length) : 
                formatCurrency(0)
              }
            </div>
            <div className="text-sm text-purple-700">Avg Bid</div>
          </div>
        </div>
      )}

      <div className="space-y-4">
        {loading ? (
          <div className="text-center py-12">
            <Loader2 className="mx-auto h-8 w-8 animate-spin text-blue-600" />
            <p className="mt-2 text-gray-500">Loading bids...</p>
          </div>
        ) : validBids.length === 0 ? (
          <div className="text-center py-12">
            <Users className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No bids yet</h3>
            <p className="mt-1 text-sm text-gray-500">Bids from drivers will appear here when they're submitted.</p>
            <p className="mt-2 text-xs text-gray-400">Make sure your load is posted and visible to drivers.</p>
          </div>
        ) : (
          // Sort bids by priority and status
          [...validBids]
            .sort((a, b) => {
              // Pending bids first
              if (a.status === 'pending' && b.status !== 'pending') return -1;
              if (a.status !== 'pending' && b.status === 'pending') return 1;
              
              // Then by creation date (newest first)
              try {
                return new Date(b.createdAt) - new Date(a.createdAt);
              } catch (error) {
                console.warn('Error sorting bids by date:', error);
                return 0;
              }
            })
            .map(bid => {
              const priority = getBidPriority(bid);
              const timeSince = getTimeSinceBid(bid.createdAt);
              
              return (
                <div 
                  key={bid._id} 
                  className={`border rounded-lg p-6 transition-all hover:shadow-md ${
                    priority === 'high' ? 'border-red-200 bg-red-50' :
                    priority === 'medium' ? 'border-yellow-200 bg-yellow-50' :
                    'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      {/* Header with Load Title and Status */}
                      <div className="flex items-center gap-3 mb-3">
                        <h4 className="text-lg font-semibold text-gray-900">
                          {bid.load?.title || bid.loadInfo?.title || 'Unknown Load'}
                        </h4>
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                          bid.status === 'pending' || bid.status === 'submitted' ? 'bg-yellow-100 text-yellow-800' :
                          bid.status === 'accepted' ? 'bg-green-100 text-green-800' :
                          bid.status === 'rejected' ? 'bg-red-100 text-red-800' :
                          bid.status === 'shortlisted' ? 'bg-blue-100 text-blue-800' :
                          bid.status === 'counter_offered' ? 'bg-purple-100 text-purple-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {bid.status === 'submitted' ? 'pending' : bid.status}
                        </span>
                        <span className="text-xs text-gray-500 flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {timeSince}
                        </span>
                      </div>

                      {/* Driver Info Row */}
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-gray-400" />
                          <div>
                            <span className="text-sm font-medium text-gray-900">
                              {bid.driverInfo?.name || 'Unknown Driver'}
                            </span>
                            {bid.driverInfo?.isVerified && (
                              <CheckCircle2 className="h-3 w-3 text-green-500 inline ml-1" />
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <DollarSign className="h-4 w-4 text-gray-400" />
                          <span className="text-sm font-semibold text-gray-900">
                            {formatCurrency(bid.bidAmount || 0)}
                          </span>
                          {bid.currency && bid.currency !== 'KES' && (
                            <span className="text-xs text-gray-500">({bid.currency})</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <Truck className="h-4 w-4 text-gray-400" />
                          <span className="text-sm text-gray-600">
                            {bid.vehicleDetails?.type || bid.driverInfo?.vehicleType || 'N/A'}
                            {bid.vehicleDetails?.capacity && (
                              <span className="text-xs text-gray-500 ml-1">
                                ({bid.vehicleDetails.capacity}T)
                              </span>
                            )}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Star className="h-4 w-4 text-yellow-400" />
                          <span className="text-sm text-gray-600">
                            {bid.driverInfo?.rating || 'No rating'} 
                            {bid.driverInfo?.totalTrips && (
                              <span className="text-xs text-gray-500 ml-1">
                                ({bid.driverInfo.totalTrips} trips)
                              </span>
                            )}
                          </span>
                        </div>
                      </div>

                      {/* Contact Info */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        <div className="flex items-center gap-2">
                          <Phone className="h-4 w-4 text-gray-400" />
                          <span className="text-sm text-gray-600">
                            {bid.driverInfo?.phone || 'No phone provided'}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4 text-gray-400" />
                          <span className="text-sm text-gray-600">
                            {bid.driverInfo?.location || 'Location not specified'}
                          </span>
                        </div>
                      </div>

                      {/* Proposed Dates */}
                      {(bid.proposedPickupDate || bid.proposedDeliveryDate) && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                          {bid.proposedPickupDate && (
                            <div className="flex items-center gap-2">
                              <Calendar className="h-4 w-4 text-gray-400" />
                              <div>
                                <span className="text-xs text-gray-500">Proposed Pickup:</span>
                                <span className="text-sm text-gray-700 ml-1">
                                  {formatDate(bid.proposedPickupDate)}
                                </span>
                              </div>
                            </div>
                          )}
                          {bid.proposedDeliveryDate && (
                            <div className="flex items-center gap-2">
                              <Calendar className="h-4 w-4 text-gray-400" />
                              <div>
                                <span className="text-xs text-gray-500">Proposed Delivery:</span>
                                <span className="text-sm text-gray-700 ml-1">
                                  {formatDate(bid.proposedDeliveryDate)}
                                </span>
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Bid Message */}
                      {bid.message && (
                        <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                          <div className="flex items-center gap-2 mb-1">
                            <MessageSquare className="h-4 w-4 text-gray-500" />
                            <span className="text-xs font-medium text-gray-600">Driver's Message:</span>
                          </div>
                          <p className="text-sm text-gray-700">{bid.message}</p>
                        </div>
                      )}

                      {/* Cover Letter */}
                      {bid.coverLetter && (
                        <div className="mb-4 p-3 bg-blue-50 rounded-lg">
                          <div className="flex items-center gap-2 mb-1">
                            <MessageSquare className="h-4 w-4 text-blue-500" />
                            <span className="text-xs font-medium text-blue-600">Cover Letter:</span>
                          </div>
                          <p className="text-sm text-gray-700">{bid.coverLetter}</p>
                        </div>
                      )}

                      {/* Counter Offer Info */}
                      {bid.status === 'counter_offered' && bid.counterOffer && (
                        <div className="mb-4 p-3 bg-purple-50 border border-purple-200 rounded-lg">
                          <div className="flex items-center gap-2 mb-2">
                            <AlertCircle className="h-4 w-4 text-purple-500" />
                            <span className="text-sm font-medium text-purple-700">Counter Offer Pending</span>
                          </div>
                          <div className="text-sm text-purple-600">
                            <p>Amount: {formatCurrency(bid.counterOffer.amount || 0)}</p>
                            {bid.counterOffer.message && (
                              <p className="mt-1">Message: {bid.counterOffer.message}</p>
                            )}
                            <p className="text-xs text-purple-500 mt-1">
                              Sent: {formatDate(bid.counterOffer.createdAt)}
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Additional Services */}
                      {bid.additionalServices && bid.additionalServices.length > 0 && (
                        <div className="mb-4">
                          <h5 className="text-sm font-medium text-gray-700 mb-2">Additional Services:</h5>
                          <div className="flex flex-wrap gap-2">
                            {bid.additionalServices.map((service, index) => (
                              <span key={index} className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                                {service.service || service}
                                {service.cost && <span className="ml-1">+{formatCurrency(service.cost)}</span>}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Terms */}
                      {bid.terms && (
                        <div className="mb-4 text-sm text-gray-600">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                            {bid.terms.paymentMethod && (
                              <div>
                                <span className="font-medium">Payment:</span> {bid.terms.paymentMethod}
                              </div>
                            )}
                            {bid.terms.paymentTiming && (
                              <div>
                                <span className="font-medium">Timing:</span> {bid.terms.paymentTiming.replace(/_/g, ' ')}
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      <div className="flex items-center justify-between">
                        <p className="text-xs text-gray-500">
                          Bid submitted: {formatDate(bid.createdAt)}
                        </p>
                        
                        {/* Pricing Breakdown Button */}
                        {bid.pricingBreakdown && (
                          <button 
                            className="text-xs text-blue-600 hover:text-blue-800"
                            onClick={() => {
                              const breakdown = bid.pricingBreakdown;
                              alert(`Pricing Breakdown:\nBase Fare: ${formatCurrency(breakdown.baseFare || 0)}\nDistance Fare: ${formatCurrency(breakdown.distanceFare || 0)}\nWeight Surcharge: ${formatCurrency(breakdown.weightSurcharge || 0)}\nService Fees: ${formatCurrency(breakdown.serviceFees || 0)}\nTotal: ${formatCurrency(breakdown.totalAmount || bid.bidAmount)}`);
                            }}
                          >
                            View Pricing Breakdown
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Action Buttons */}
                    {(['pending', 'submitted', 'viewed', 'shortlisted'].includes(bid.status)) && (
                      <div className="flex items-center gap-2 ml-4" data-bid-id={bid._id}>
                        <button
                          onClick={() => handleAcceptBid(bid)}
                          className="accept-btn px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-1 shadow-sm"
                        >
                          <CheckCircle2 className="h-4 w-4" />
                          Accept
                        </button>
                        <button
                          onClick={() => handleRejectBid(bid)}
                          className="reject-btn px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-1 shadow-sm"
                        >
                          <XCircle className="h-4 w-4" />
                          Reject
                        </button>
                      </div>
                    )}

                    {/* Status-specific info */}
                    {bid.status === 'accepted' && (
                      <div className="ml-4 text-right">
                        <div className="text-green-600 font-medium text-sm">✓ Accepted</div>
                        <div className="text-xs text-gray-500">
                          {formatDate(bid.acceptedAt || bid.updatedAt)}
                        </div>
                      </div>
                    )}

                    {bid.status === 'rejected' && (
                      <div className="ml-4 text-right">
                        <div className="text-red-600 font-medium text-sm">✗ Rejected</div>
                        <div className="text-xs text-gray-500">
                          {formatDate(bid.rejectedAt || bid.updatedAt)}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
        )}
      </div>
    </div>
  );
};

export default BidsTab;