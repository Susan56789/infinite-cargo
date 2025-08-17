import React, { useState } from 'react';
import { Loader, DollarSign, Calendar, MessageSquare } from 'lucide-react';

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
    }
  });

  const [errors, setErrors] = useState({});

  const validateForm = () => {
    const newErrors = {};
    
    if (!bidData.bidAmount || parseFloat(bidData.bidAmount) <= 0) {
      newErrors.bidAmount = 'Please enter a valid bid amount';
    }
    
    if (!bidData.proposedPickupDate) {
      newErrors.proposedPickupDate = 'Please select a pickup date';
    }
    
    if (!bidData.proposedDeliveryDate) {
      newErrors.proposedDeliveryDate = 'Please select a delivery date';
    }
    
    if (bidData.proposedPickupDate && bidData.proposedDeliveryDate) {
      if (new Date(bidData.proposedDeliveryDate) <= new Date(bidData.proposedPickupDate)) {
        newErrors.proposedDeliveryDate = 'Delivery date must be after pickup date';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    const bidPayload = {
      load: load._id,
      ...bidData,
      pricingBreakdown: {
        baseFare: parseFloat(bidData.bidAmount),
        totalAmount: parseFloat(bidData.bidAmount)
      }
    };

    await onBidSubmit(bidPayload);
  };

  const handleInputChange = (field, value) => {
    setBidData(prev => ({
      ...prev,
      [field]: value
    }));
    
    // Clear error when user starts typing
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

  return (
    <form onSubmit={handleSubmit} className="space-y-4 p-4 bg-gray-50 rounded-lg border">
      <h4 className="font-medium text-gray-900">Place Your Bid</h4>
      
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
      <div className="grid grid-cols-2 gap-4">
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
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Vehicle Type
          </label>
          <select
            value={bidData.vehicleDetails.type}
            onChange={(e) => handleVehicleDetailsChange('type', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Capacity (tonnes)
          </label>
          <input
            type="number"
            value={bidData.vehicleDetails.capacity}
            onChange={(e) => handleVehicleDetailsChange('capacity', parseFloat(e.target.value))}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            min="0.1"
            step="0.1"
          />
        </div>
      </div>

      {/* Message */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          <MessageSquare size={16} className="inline mr-1" />
          Brief Message
        </label>
        <textarea
          value={bidData.message}
          onChange={(e) => handleInputChange('message', e.target.value)}
          placeholder="Add a brief message about your bid..."
          rows={2}
          maxLength={1000}
          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <p className="text-xs text-gray-500 mt-1">{bidData.message.length}/1000 characters</p>
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
          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <p className="text-xs text-gray-500 mt-1">{bidData.coverLetter.length}/2000 characters</p>
      </div>

      {/* Terms */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Payment Method
          </label>
          <select
            value={bidData.terms.paymentMethod}
            onChange={(e) => setBidData(prev => ({
              ...prev,
              terms: { ...prev.terms, paymentMethod: e.target.value }
            }))}
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
            onChange={(e) => setBidData(prev => ({
              ...prev,
              terms: { ...prev.terms, paymentTiming: e.target.value }
            }))}
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
      <div className="flex space-x-3 pt-4">
        <button
          type="submit"
          disabled={submitting}
          className="flex-1 inline-flex items-center justify-center px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {submitting ? (
            <>
              <Loader size={16} className="mr-2 animate-spin" />
              Submitting Bid...
            </>
          ) : (
            'Submit Bid'
          )}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 border border-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-50 transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  );
};

export default BidForm;