import React, { useState } from 'react';
import { 
  Loader, 
  DollarSign, 
  Calendar, 
  MessageSquare, 
  X, 
  Plus, 
  Weight 
} from 'lucide-react';

const BidForm = ({ load, onBidSubmit, onCancel, submitting }) => {
  const [bidData, setBidData] = useState({
    bidAmount: '',
    proposedPickupDate: '',
    proposedDeliveryDate: '',
    message: '',
    coverLetter: '',
    vehicleDetails: {
      type: 'medium_truck',
      capacity: 5
    },
    additionalServices: [],
    terms: {
      paymentMethod: 'cash',
      paymentTiming: 'on_delivery'
    },
    currency: 'KES'
  });

  const [errors, setErrors] = useState({});

  const validateForm = () => {
    const newErrors = {};
    
    // Bid amount validation (must be at least 1 KES)
    if (!bidData.bidAmount || parseFloat(bidData.bidAmount) < 1) {
      newErrors.bidAmount = 'Bid amount must be at least 1 KES';
    }
    
    // Check if bid amount is reasonable compared to budget
    if (load.budget && parseFloat(bidData.bidAmount) > parseFloat(load.budget) * 2) {
      newErrors.bidAmount = 'Bid amount seems unusually high compared to budget';
    }
    
    // Proposed pickup date validation (ISO 8601 format required)
    if (!bidData.proposedPickupDate) {
      newErrors.proposedPickupDate = 'Valid proposed pickup date is required';
    } else {
      const pickupDate = new Date(bidData.proposedPickupDate);
      if (isNaN(pickupDate.getTime())) {
        newErrors.proposedPickupDate = 'Invalid pickup date format';
      } else if (pickupDate < new Date()) {
        newErrors.proposedPickupDate = 'Pickup date cannot be in the past';
      }
    }
    
    // Proposed delivery date validation (ISO 8601 format required)
    if (!bidData.proposedDeliveryDate) {
      newErrors.proposedDeliveryDate = 'Valid proposed delivery date is required';
    } else {
      const deliveryDate = new Date(bidData.proposedDeliveryDate);
      const pickupDate = new Date(bidData.proposedPickupDate);
      
      if (isNaN(deliveryDate.getTime())) {
        newErrors.proposedDeliveryDate = 'Invalid delivery date format';
      } else if (bidData.proposedPickupDate && deliveryDate <= pickupDate) {
        newErrors.proposedDeliveryDate = 'Proposed delivery date must be after pickup date';
      }
    }

    // Message length validation (max 1000 characters)
    if (bidData.message && bidData.message.length > 1000) {
      newErrors.message = 'Message cannot exceed 1000 characters';
    }

    // Cover letter length validation (max 2000 characters)
    if (bidData.coverLetter && bidData.coverLetter.length > 2000) {
      newErrors.coverLetter = 'Cover letter cannot exceed 2000 characters';
    }

    // Vehicle type validation
    const validVehicleTypes = [
      'pickup', 'van', 'small_truck', 'medium_truck', 'large_truck', 
      'heavy_truck', 'trailer', 'refrigerated_truck', 'flatbed', 'container_truck'
    ];
    if (!validVehicleTypes.includes(bidData.vehicleDetails.type)) {
      newErrors.vehicleType = 'Invalid vehicle type selected';
    }

    // Vehicle capacity validation (min 0.1 tonnes)
    if (!bidData.vehicleDetails.capacity || parseFloat(bidData.vehicleDetails.capacity) < 0.1) {
      newErrors.vehicleCapacity = 'Vehicle capacity must be at least 0.1 tonnes';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    const bidPayload = {
      load: load._id,
      bidAmount: parseFloat(bidData.bidAmount),
      currency: bidData.currency,
      proposedPickupDate: bidData.proposedPickupDate,
      proposedDeliveryDate: bidData.proposedDeliveryDate,
      message: bidData.message || undefined,
      coverLetter: bidData.coverLetter || undefined,
      vehicleDetails: {
        type: bidData.vehicleDetails.type,
        capacity: parseFloat(bidData.vehicleDetails.capacity)
      },
      additionalServices: bidData.additionalServices,
      pricingBreakdown: {
        baseFare: parseFloat(bidData.bidAmount),
        totalAmount: parseFloat(bidData.bidAmount)
      },
      terms: bidData.terms
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

  const handleVehicleDetailsChange = (field, value) => {
    setBidData(prev => ({
      ...prev,
      vehicleDetails: {
        ...prev.vehicleDetails,
        [field]: value
      }
    }));
  };

  const handleTermsChange = (field, value) => {
    setBidData(prev => ({
      ...prev,
      terms: {
        ...prev.terms,
        [field]: value
      }
    }));
  };

  return (
    <div className="bg-gray-50 border rounded-lg p-4 mt-4">
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
            placeholder={`Budget: KES ${load.budget || 'Not specified'}`}
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
              Pickup Date *
            </label>
            <input
              type="datetime-local"
              value={bidData.proposedPickupDate}
              onChange={(e) => handleInputChange('proposedPickupDate', e.target.value)}
              min={new Date().toISOString().slice(0, 16)}
              className={`w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.proposedPickupDate ? 'border-red-300' : 'border-gray-300'
              }`}
            />
            {errors.proposedPickupDate && (
              <p className="mt-1 text-sm text-red-600">{errors.proposedPickupDate}</p>
            )}
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <Calendar size={16} className="inline mr-1" />
              Delivery Date *
            </label>
            <input
              type="datetime-local"
              value={bidData.proposedDeliveryDate}
              onChange={(e) => handleInputChange('proposedDeliveryDate', e.target.value)}
              min={bidData.proposedPickupDate || new Date().toISOString().slice(0, 16)}
              className={`w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.proposedDeliveryDate ? 'border-red-300' : 'border-gray-300'
              }`}
            />
            {errors.proposedDeliveryDate && (
              <p className="mt-1 text-sm text-red-600">{errors.proposedDeliveryDate}</p>
            )}
          </div>
        </div>

        {/* Vehicle Details */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Vehicle Type *
            </label>
            <select
              value={bidData.vehicleDetails.type}
              onChange={(e) => handleVehicleDetailsChange('type', e.target.value)}
              className={`w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.vehicleType ? 'border-red-300' : 'border-gray-300'
              }`}
            >
              <option value="pickup">Pickup Truck</option>
              <option value="van">Van</option>
              <option value="small_truck">Small Truck</option>
              <option value="medium_truck">Medium Truck</option>
              <option value="large_truck">Large Truck</option>
              <option value="heavy_truck">Heavy Truck</option>
              <option value="trailer">Trailer</option>
              <option value="refrigerated_truck">Refrigerated Truck</option>
              <option value="flatbed">Flatbed</option>
              <option value="container_truck">Container Truck</option>
            </select>
            {errors.vehicleType && (
              <p className="mt-1 text-sm text-red-600">{errors.vehicleType}</p>
            )}
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Capacity (tonnes) *
            </label>
            <input
              type="number"
              value={bidData.vehicleDetails.capacity}
              onChange={(e) => handleVehicleDetailsChange('capacity', parseFloat(e.target.value) || '')}
              className={`w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.vehicleCapacity ? 'border-red-300' : 'border-gray-300'
              }`}
              min="0.1"
              step="0.1"
              placeholder="e.g. 5.0"
            />
            {errors.vehicleCapacity && (
              <p className="mt-1 text-sm text-red-600">{errors.vehicleCapacity}</p>
            )}
          </div>
        </div>

        {/* Message */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            <MessageSquare size={16} className="inline mr-1" />
            Brief Message (Optional)
          </label>
          <textarea
            value={bidData.message}
            onChange={(e) => handleInputChange('message', e.target.value)}
            placeholder="Add a brief message about your bid..."
            rows={2}
            maxLength={1000}
            className={`w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              errors.message ? 'border-red-300' : 'border-gray-300'
            }`}
          />
          <div className="flex justify-between items-center mt-1">
            <p className="text-xs text-gray-500">{bidData.message.length}/1000 characters</p>
            {errors.message && (
              <p className="text-xs text-red-600">{errors.message}</p>
            )}
          </div>
        </div>

        {/* Cover Letter */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Cover Letter (Optional)
          </label>
          <textarea
            value={bidData.coverLetter}
            onChange={(e) => handleInputChange('coverLetter', e.target.value)}
            placeholder="Tell the cargo owner why you're the best choice for this job..."
            rows={3}
            maxLength={2000}
            className={`w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              errors.coverLetter ? 'border-red-300' : 'border-gray-300'
            }`}
          />
          <div className="flex justify-between items-center mt-1">
            <p className="text-xs text-gray-500">{bidData.coverLetter.length}/2000 characters</p>
            {errors.coverLetter && (
              <p className="text-xs text-red-600">{errors.coverLetter}</p>
            )}
          </div>
        </div>

        {/* Terms */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Payment Method
            </label>
            <select
              value={bidData.terms.paymentMethod}
              onChange={(e) => handleTermsChange('paymentMethod', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="cash">Cash</option>
              <option value="bank_transfer">Bank Transfer</option>
              <option value="mobile_money">Mobile Money</option>
              <option value="cheque">Cheque</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Payment Timing
            </label>
            <select
              value={bidData.terms.paymentTiming}
              onChange={(e) => handleTermsChange('paymentTiming', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="on_pickup">On Pickup</option>
              <option value="on_delivery">On Delivery</option>
              <option value="advance">50% Advance</option>
              <option value="weekly">Weekly</option>
            </select>
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

export default BidForm;