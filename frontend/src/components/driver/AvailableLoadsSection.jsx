import React, { useState } from 'react';
import { 
  Search, 
  Package, 
  MapPin, 
  DollarSign, 
  Eye, 
  Plus,
  Calendar,
  Weight,
  X,
  Clock,
  User,
  Loader,
  MessageSquare,
  ExternalLink,
  Truck
} from 'lucide-react';

// BidForm Component 
const BidForm = ({ load, onBidSubmit, onCancel, submitting }) => {
  const [bidData, setBidData] = useState({
    bidAmount: '',
    proposedPickupDate: '',
    proposedDeliveryDate: '',
    message: '',
    vehicleDetails: {
      type: 'medium_truck',
      capacity: 5
    }
  });

  const [errors, setErrors] = useState({});

  const validateForm = () => {
    const newErrors = {};
    
    if (!bidData.bidAmount || parseFloat(bidData.bidAmount) < 1) {
      newErrors.bidAmount = 'Bid amount must be at least 1 KES';
    }
    
    if (load.estimatedAmount && parseFloat(bidData.bidAmount) > parseFloat(load.estimatedAmount) * 2) {
      newErrors.bidAmount = 'Bid amount seems unusually high compared to estimated amount';
    }

    if (bidData.message && bidData.message.length > 500) {
      newErrors.message = 'Message cannot exceed 500 characters';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    // Structure the bid data to match what DriverDashboard.placeBid expects
    const bidPayload = {
      _id: load._id, // This is what placeBid expects for loadId
      bidAmount: parseFloat(bidData.bidAmount),
      proposedPickupDate: bidData.proposedPickupDate || undefined,
      proposedDeliveryDate: bidData.proposedDeliveryDate || undefined,
      message: bidData.message || undefined
    };

    const result = await onBidSubmit(bidPayload);
    
    // Only close form if bid was successful
    if (result !== false) {
      onCancel();
    }
  };

  const handleInputChange = (field, value) => {
    setBidData(prev => ({
      ...prev,
      [field]: value
    }));
    
    if (errors[field]) {
      setErrors(prev => ({
        ...prev,
        [field]: ''
      }));
    }
  };

  return (
    <div className="bg-gray-50 border rounded-lg p-4 mt-4 relative z-10">
      <div className="flex items-center justify-between mb-4">
        <h4 className="font-medium text-gray-900 flex items-center">
          <Plus className="w-4 h-4 mr-2" />
          Place Your Bid
        </h4>
        <button
          onClick={onCancel}
          className="text-gray-400 hover:text-gray-600"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Bid Amount */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            <DollarSign size={16} className="inline mr-1" />
            Bid Amount (KES) *
          </label>
          <input
            type="number"
            value={bidData.bidAmount}
            onChange={(e) => handleInputChange('bidAmount', e.target.value)}
            placeholder={`Estimated: KES ${load.estimatedAmount || 'Not specified'}`}
            className={`w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              errors.bidAmount ? 'border-red-300' : 'border-gray-300'
            }`}
            min="1"
            step="0.01"
          />
          {errors.bidAmount && (
            <p className="mt-1 text-sm text-red-600">{errors.bidAmount}</p>
          )}
        </div>

        {/* Dates */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <Calendar size={16} className="inline mr-1" />
              Proposed Pickup Date
            </label>
            <input
              type="datetime-local"
              value={bidData.proposedPickupDate}
              onChange={(e) => handleInputChange('proposedPickupDate', e.target.value)}
              min={new Date().toISOString().slice(0, 16)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <Calendar size={16} className="inline mr-1" />
              Proposed Delivery Date
            </label>
            <input
              type="datetime-local"
              value={bidData.proposedDeliveryDate}
              onChange={(e) => handleInputChange('proposedDeliveryDate', e.target.value)}
              min={bidData.proposedPickupDate || new Date().toISOString().slice(0, 16)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Message */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            <MessageSquare size={16} className="inline mr-1" />
            Message (Optional)
          </label>
          <textarea
            value={bidData.message}
            onChange={(e) => handleInputChange('message', e.target.value)}
            placeholder="Add a message about your bid..."
            rows={3}
            maxLength={500}
            className={`w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              errors.message ? 'border-red-300' : 'border-gray-300'
            }`}
          />
          <div className="flex justify-between items-center mt-1">
            <p className="text-xs text-gray-500">{bidData.message.length}/500 characters</p>
            {errors.message && (
              <p className="text-xs text-red-600">{errors.message}</p>
            )}
          </div>
        </div>

        {/* Submit Buttons */}
        <div className="flex space-x-3 pt-2">
          <button
            type="submit"
            disabled={submitting}
            className="flex-1 inline-flex items-center justify-center px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {submitting ? (
              <>
                <Loader size={16} className="mr-2 animate-spin" />
                Submitting...
              </>
            ) : (
              <>
                <Plus size={16} className="mr-2" />
                Submit Bid
              </>
            )}
          </button>
          <button
            type="button"
            onClick={onCancel}
            disabled={submitting}
            className="px-4 py-2 border border-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
};

// LoadDetailsModal Component
const LoadDetailsModal = ({ load, onClose, onBidClick, formatCurrency, formatDate }) => {
  const getCargoTypeLabel = (type) => {
    if (!type) return 'N/A';
    return type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Load Details</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-6 h-6" />
          </button>
        </div>
        
        <div className="space-y-4">
          <div>
            <h4 className="font-semibold text-gray-900 text-xl">{load.title || 'Transport Required'}</h4>
            <p className="text-gray-600 mt-1">{load.description || 'No description available'}</p>
          </div>

          {/* Key Details */}
          <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
            <div>
              <label className="block text-sm font-medium text-gray-700">Estimated Amount</label>
              <p className="text-green-600 font-bold text-xl">{formatCurrency(load.estimatedAmount)}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Weight</label>
              <p className="text-gray-900 font-semibold text-lg">{load.weight || 0} kg</p>
            </div>
          </div>

          {/* Route Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-blue-50 rounded-lg">
            <div>
              <label className="block text-sm font-medium text-gray-700">Pickup Location</label>
              <p className="text-gray-900 font-semibold">{load.pickupLocation || 'Not specified'}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Delivery Location</label>
              <p className="text-gray-900 font-semibold">{load.deliveryLocation || 'Not specified'}</p>
            </div>
          </div>

          {/* Status and Priority */}
          <div className="flex flex-wrap gap-2">
            {load.isUrgent && (
              <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-800">
                <Clock className="w-4 h-4 mr-1" />
                Urgent
              </span>
            )}
            <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
              Available
            </span>
          </div>
          
          {/* Details Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Cargo Type</label>
              <p className="text-gray-900">{getCargoTypeLabel(load.cargoType)}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Bids Received</label>
              <p className="text-gray-900">{load.bidCount || 0} bids</p>
            </div>
          </div>

          {/* Date Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {load.pickupDate && (
              <div>
                <label className="block text-sm font-medium text-gray-700">Pickup Date</label>
                <p className="text-gray-900">{formatDate(load.pickupDate)}</p>
              </div>
            )}
            {load.deliveryDate && (
              <div>
                <label className="block text-sm font-medium text-gray-700">Delivery Date</label>
                <p className="text-gray-900">{formatDate(load.deliveryDate)}</p>
              </div>
            )}
          </div>

          {/* Distance and Duration */}
          {(load.distance || load.estimatedDuration) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {load.distance && (
                <div>
                  <label className="block text-sm font-medium text-gray-700">Distance</label>
                  <p className="text-gray-900">{load.distance} km</p>
                </div>
              )}
              {load.estimatedDuration && (
                <div>
                  <label className="block text-sm font-medium text-gray-700">Est. Duration</label>
                  <p className="text-gray-900">{load.estimatedDuration} hours</p>
                </div>
              )}
            </div>
          )}

          {/* Vehicle Requirements */}
          {load.vehicleTypeRequired && load.vehicleTypeRequired.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700">Vehicle Requirements</label>
              <div className="flex flex-wrap gap-2 mt-1">
                {load.vehicleTypeRequired.map((type, index) => (
                  <span key={index} className="inline-flex items-center px-2 py-1 rounded-md text-sm bg-blue-100 text-blue-800">
                    <Truck className="w-4 h-4 mr-1" />
                    {getCargoTypeLabel(type)}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex space-x-3 pt-4 border-t">
            <button
              onClick={() => onBidClick(load)}
              className="flex-1 inline-flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-4 h-4 mr-2" />
              Place Bid
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// Main AvailableLoadsSection Component
const AvailableLoadsSection = ({ 
  availableLoads, 
  onBidPlace, 
  formatCurrency, 
  formatDate, 
  loading, 
  onSearchLoads 
}) => {
  const [selectedLoad, setSelectedLoad] = useState(null);
  const [bidFormLoad, setBidFormLoad] = useState(null);
  const [submittingBid, setSubmittingBid] = useState(false);

  const handleBidSubmit = async (bidData) => {
    setSubmittingBid(true);
    try {
      const result = await onBidPlace(bidData);
      if (result !== false) {
        setBidFormLoad(null);
      }
      return result;
    } finally {
      setSubmittingBid(false);
    }
  };

  const handleViewDetails = (load) => {
    setSelectedLoad(load);
  };

  const handleBidClick = (load) => {
    setBidFormLoad(load);
    setSelectedLoad(null);
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Available Loads</h2>
          <div className="flex items-center justify-center py-8">
            <Loader className="h-8 w-8 text-blue-600 animate-spin" />
            <span className="ml-2 text-gray-600">Loading available loads...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900 flex items-center">
              <Package className="w-6 h-6 mr-2 text-blue-600" />
              Available Loads
            </h2>
            <button
              onClick={onSearchLoads}
              className="inline-flex items-center px-3 py-2 text-sm font-medium text-blue-600 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors"
            >
              <Search className="w-4 h-4 mr-2" />
              Search More
              <ExternalLink className="w-3 h-3 ml-1" />
            </button>
          </div>

          {availableLoads && availableLoads.length > 0 ? (
            <div className="space-y-4">
              {availableLoads.map((load) => (
                <div key={load._id} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-2">
                        <h3 className="text-lg font-semibold text-gray-900">
                          {load.title || 'Transport Required'}
                        </h3>
                        {load.isUrgent && (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                            <Clock className="w-3 h-3 mr-1" />
                            Urgent
                          </span>
                        )}
                        {load.bidCount > 0 && (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                            <User className="w-3 h-3 mr-1" />
                            {load.bidCount} bids
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3">
                        <div className="flex items-center text-gray-600">
                          <MapPin className="w-4 h-4 mr-2 text-green-500" />
                          <span className="text-sm">
                            <strong>From:</strong> {load.pickupLocation || 'Not specified'}
                          </span>
                        </div>
                        <div className="flex items-center text-gray-600">
                          <MapPin className="w-4 h-4 mr-2 text-red-500" />
                          <span className="text-sm">
                            <strong>To:</strong> {load.deliveryLocation || 'Not specified'}
                          </span>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-gray-600">
                        <div className="flex items-center">
                          <Package className="w-4 h-4 mr-1" />
                          {load.cargoType ? load.cargoType.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()) : 'General Cargo'}
                        </div>
                        <div className="flex items-center">
                          <Weight className="w-4 h-4 mr-1" />
                          {load.weight || 0} kg
                        </div>
                        <div className="flex items-center">
                          <DollarSign className="w-4 h-4 mr-1" />
                          {formatCurrency(load.estimatedAmount)}
                        </div>
                        {load.pickupDate && (
                          <div className="flex items-center">
                            <Calendar className="w-4 h-4 mr-1" />
                            {formatDate(load.pickupDate)}
                          </div>
                        )}
                      </div>

                      {load.description && (
                        <p className="text-sm text-gray-600 mt-2 line-clamp-2">
                          {load.description}
                        </p>
                      )}
                    </div>

                    <div className="flex flex-col space-y-2 ml-4">
                      <button
                        onClick={() => handleViewDetails(load)}
                        className="inline-flex items-center px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        <Eye className="w-4 h-4 mr-2" />
                        View
                      </button>
                      <button
                        onClick={() => handleBidClick(load)}
                        className="inline-flex items-center px-3 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-lg hover:bg-blue-700 transition-colors"
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        Bid
                      </button>
                    </div>
                  </div>

                  {bidFormLoad && bidFormLoad._id === load._id && (
                    <BidForm
                      load={load}
                      onBidSubmit={handleBidSubmit}
                      onCancel={() => setBidFormLoad(null)}
                      submitting={submittingBid}
                    />
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <Package className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">No available loads</h3>
              <p className="mt-1 text-sm text-gray-500">
                There are no available loads matching your criteria right now.
              </p>
              <button
                onClick={onSearchLoads}
                className="mt-4 inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Search className="w-4 h-4 mr-2" />
                Search All Loads
                <ExternalLink className="w-3 h-3 ml-1" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Load Details Modal */}
      {selectedLoad && (
        <LoadDetailsModal
          load={selectedLoad}
          onClose={() => setSelectedLoad(null)}
          onBidClick={handleBidClick}
          formatCurrency={formatCurrency}
          formatDate={formatDate}
        />
      )}
    </>
  );
};

export default AvailableLoadsSection;