import React, { useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { 
  Search, 
  Package, 
  MapPin, 
  DollarSign, 
  Eye, 
  Plus,
  Calendar,
  Weight,
  ArrowRight,
  X,
  Clock,
  User,
  TrendingUp,
  CheckCircle,
  Loader,
  Truck,
  MessageSquare,
  AlertCircle
} from 'lucide-react';

// Hook for outside click detection
const useOutsideClick = (ref, callback) => {
  React.useEffect(() => {
    const handleClickOutside = (event) => {
      if (ref.current && !ref.current.contains(event.target)) {
        callback();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [ref, callback]);
};

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
  const formRef = useRef(null);

  // Auto-close on outside click
  useOutsideClick(formRef, onCancel);

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

    await onBidSubmit(bidPayload);
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
    <div ref={formRef} className="bg-gray-50 border rounded-lg p-4 mt-4 relative z-10">
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
  const modalRef = useRef(null);
  
  // Auto-close on outside click
  useOutsideClick(modalRef, onClose);

  const getCargoTypeLabel = (type) => {
    if (!type) return 'N/A';
    return type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  const getVehicleTypeLabel = (type) => {
    if (!type) return 'N/A';
    return type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div ref={modalRef} className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
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
            {load.urgency === 'urgent' && (
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

          {/* Posted By Information */}
          <div className="border-t pt-4">
            <label className="block text-sm font-medium text-gray-700">Posted By</label>
            <div className="flex items-center mt-1">
              <User className="w-4 h-4 mr-2 text-gray-400" />
              <span className="text-gray-900">Cargo Owner</span>
            </div>
            <p className="text-sm text-gray-500 mt-1">Posted {formatDate(load.createdAt)}</p>
          </div>
        </div>

        <div className="flex space-x-3 mt-6 pt-6 border-t">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 text-sm border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Close
          </button>
          <button
            onClick={() => {
              onClose();
              onBidClick(load);
            }}
            className="flex-1 px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            Place Bid
          </button>
        </div>
      </div>
    </div>
  );
};

// LoadCard Component
const LoadCard = ({ load, onBidPlace, formatCurrency, formatDate, isAuthenticated }) => {
  const [showBidForm, setShowBidForm] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleBidSubmit = async (bidData) => {
    setSubmitting(true);
    try {
      const result = await onBidPlace(bidData);
      
      if (result !== false) {
        setShowBidForm(false);
      }
    } catch (error) {
      console.error('Failed to place bid:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const isUrgent = () => {
    return load.urgency === 'urgent' || (load.pickupDate && (() => {
      const pickupDate = new Date(load.pickupDate);
      const today = new Date();
      const diffTime = pickupDate.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return diffDays <= 2;
    })());
  };

  return (
    <>
      <div className="border border-gray-200 rounded-lg p-4 hover:border-gray-300 transition-colors relative">
        {/* Urgent Badge */}
        {isUrgent() && (
          <div className="absolute top-2 right-2">
            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
              <Clock className="w-3 h-3 mr-1" />
              Urgent
            </span>
          </div>
        )}

        <div className="flex items-start justify-between mb-3">
          <div className="flex-1">
            {/* Load Title */}
            <h4 className="font-medium text-gray-900 mb-2">
              {load.title || `${load.cargoType || 'General Cargo'} Transport`}
            </h4>

            {/* Route */}
            <div className="flex items-center space-x-2 mb-2">
              <MapPin size={16} className="text-gray-400 flex-shrink-0" />
              <span className="text-sm text-gray-600 truncate">
                {load.pickupLocation || 'Pickup'} → {load.deliveryLocation || 'Delivery'}
              </span>
            </div>

            {/* Load Details Grid */}
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div className="flex items-center space-x-1">
                <Package size={16} className="text-gray-400 flex-shrink-0" />
                <span className="text-sm text-gray-600 truncate">{load.cargoType || 'General Cargo'}</span>
              </div>
              <div className="flex items-center space-x-1">
                <Weight size={16} className="text-gray-400 flex-shrink-0" />
                <span className="text-sm text-gray-600">
                  {load.weight ? `${load.weight} kg` : 'Weight TBD'}
                </span>
              </div>
              <div className="flex items-center space-x-1">
                <DollarSign size={16} className="text-gray-400 flex-shrink-0" />
                <span className="text-sm font-medium text-green-600">
                  Est: {formatCurrency(load.estimatedAmount)}
                </span>
              </div>
              <div className="flex items-center space-x-1">
                <Calendar size={16} className="text-gray-400 flex-shrink-0" />
                <span className="text-sm text-gray-500">
                  {load.pickupDate ? formatDate(load.pickupDate) : 'ASAP'}
                </span>
              </div>
            </div>

            {/* Load Description */}
            {load.description && (
              <div className="mb-3">
                <p className="text-sm text-gray-600 line-clamp-2">
                  {load.description}
                </p>
              </div>
            )}

            {/* Load Stats */}
            <div className="flex items-center justify-between text-xs text-gray-500">
              <span>Posted {formatDate(load.createdAt)}</span>
              <div className="flex items-center space-x-3">
                <span>{load.bidCount || 0} bids</span>
                <span className="px-2 py-1 rounded-full bg-green-100 text-green-800">
                  Available
                </span>
              </div>
            </div>
          </div>
        </div>

        {!showBidForm ? (
          <div className="flex space-x-2">
            <button
              onClick={() => setShowBidForm(true)}
              className="flex-1 inline-flex items-center justify-center px-3 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus size={14} className="mr-1" />
              Place Bid
            </button>
            <button
              onClick={() => setShowDetailsModal(true)}
              className="inline-flex items-center px-3 py-2 border border-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-50 transition-colors"
            >
              <Eye size={14} className="mr-1" />
              Details
            </button>
          </div>
        ) : (
          <BidForm 
            load={load}
            onBidSubmit={handleBidSubmit}
            onCancel={() => setShowBidForm(false)}
            submitting={submitting}
          />
        )}
      </div>

      {/* Load Details Modal */}
      {showDetailsModal && (
        <LoadDetailsModal 
          load={load}
          onClose={() => setShowDetailsModal(false)}
          onBidClick={() => setShowBidForm(true)}
          formatCurrency={formatCurrency}
          formatDate={formatDate}
        />
      )}
    </>
  );
};

// Main AvailableLoadsSection Component
const AvailableLoadsSection = ({ 
  availableLoads, 
  onBidPlace, 
  formatCurrency, 
  formatDate,
  loading,
  isAuthenticated = true
}) => {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">Available Loads</h2>
        <Link
          to="/search-loads"
          target='_blank'
          className="text-blue-600 hover:text-blue-700 text-sm font-medium flex items-center"
        >
          <Search size={16} className="mr-1" />
          Browse More <ArrowRight size={14} className="ml-1" />
        </Link>
      </div>
      <div className="p-6">
        {loading ? (
          <div className="text-center py-8">
            <Loader className="mx-auto h-8 w-8 text-blue-600 animate-spin mb-4" />
            <p className="text-gray-600">Loading available loads...</p>
          </div>
        ) : availableLoads.length > 0 ? (
          <div className="space-y-6">
            {availableLoads.slice(0, 3).map((load) => (
              <LoadCard 
                key={load._id} 
                load={load} 
                onBidPlace={onBidPlace}
                formatCurrency={formatCurrency}
                formatDate={formatDate}
                isAuthenticated={isAuthenticated}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <Package size={48} className="mx-auto text-gray-400 mb-4" />
            <p className="text-gray-600 mb-2">No available loads in your area</p>
            <p className="text-sm text-gray-500 mb-4">
              Try expanding your search area or check back later
            </p>
            <Link
              to="/search-loads"
              target="_blank"
              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Search size={16} className="mr-2" />
              Search All Loads
            </Link>
          </div>
        )}
      </div>
    </div>
  );
};

export default AvailableLoadsSection;