import React, { useState } from 'react';
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
  ArrowRight 
} from 'lucide-react';
import BidForm from './BidForm';

const LoadCard = ({ load, onBidPlace, formatCurrency, formatDate,isAuthenticated }) => {
  const [showBidForm, setShowBidForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleBidSubmit = async (bidData) => {
    setSubmitting(true);
    try {
      const result = await onBidPlace(bidData);
      
      if (result.success) {
        setShowBidForm(false);
        // Show success notification
      } else {
        alert(result.error || 'Failed to place bid');
      }
    } catch (error) {
      alert('Failed to place bid. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const isUrgent = () => {
    if (!load.pickupDate) return false;
    const pickupDate = new Date(load.pickupDate);
    const today = new Date();
    const diffTime = pickupDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays <= 2;
  };

  return (
    <div className="border border-gray-200 rounded-lg p-4 hover:border-gray-300 transition-colors relative">
      {/* Urgent Badge */}
      {isUrgent() && (
        <div className="absolute top-2 right-2">
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
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
            <MapPin size={16} className="text-gray-400" />
            <span className="text-sm text-gray-600">
              {load.origin || load.pickupLocation} → {load.destination || load.deliveryLocation}
            </span>
          </div>

          {/* Load Details Grid */}
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div className="flex items-center space-x-1">
              <Package size={16} className="text-gray-400" />
              <span className="text-sm text-gray-600">{load.cargoType || 'General Cargo'}</span>
            </div>
            <div className="flex items-center space-x-1">
              <Weight size={16} className="text-gray-400" />
              <span className="text-sm text-gray-600">
                {load.weight ? `${load.weight} kg` : 'Weight TBD'}
              </span>
            </div>
            <div className="flex items-center space-x-1">
              <DollarSign size={16} className="text-gray-400" />
              <span className="text-sm font-medium text-green-600">
                Budget: {formatCurrency(load.budget || load.maxBudget)}
              </span>
            </div>
            <div className="flex items-center space-x-1">
              <Calendar size={16} className="text-gray-400" />
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
              <span>{load.bidsReceived || 0} bids</span>
              <span className={`px-2 py-1 rounded-full ${
                load.status === 'active' ? 'bg-green-100 text-green-800' : 
                load.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                'bg-gray-100 text-gray-800'
              }`}>
                {load.status || 'active'}
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
          <Link
            to={`/driver/load/${load._id}`}
           
            className="inline-flex items-center px-3 py-2 border border-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-50 transition-colors"
          >
            <Eye size={14} className="mr-1" />
            Details
          </Link>
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
  );
};

const AvailableLoadsSection = ({ 
  availableLoads, 
  onBidPlace, 
  formatCurrency, 
  formatDate 
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
        {availableLoads.length > 0 ? (
          <div className="space-y-6">
            {availableLoads.slice(0, 3).map((load) => (
              <LoadCard 
                key={load._id} 
                load={load} 
                onBidPlace={onBidPlace}
                formatCurrency={formatCurrency}
                formatDate={formatDate}
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