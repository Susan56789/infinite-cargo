import React from 'react';
import { Link } from 'react-router-dom';
import { 
  MapPin, 
  Package, 
  DollarSign, 
  Eye, 
  ArrowRight, 
  Truck,
  Search,
  Clock,
  AlertTriangle,
  Calendar,
  Loader
} from 'lucide-react';

const ActiveJobsSection = ({ 
  activeBookings = [], 
  formatCurrency, 
  formatDate, 
  getStatusColor,
  loading = false
}) => {
  // Helper function to get urgency indicator
  const getUrgencyIndicator = (booking) => {
    if (booking.isUrgent || booking.urgency === 'urgent') {
      return (
        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
          <AlertTriangle size={12} className="mr-1" />
          Urgent
        </span>
      );
    }
    return null;
  };

  // Helper function to calculate time to pickup
  const getTimeToPickup = (pickupDate) => {
    if (!pickupDate) return null;
    
    const now = new Date();
    const pickup = new Date(pickupDate);
    const diffHours = Math.ceil((pickup - now) / (1000 * 60 * 60));
    
    if (diffHours < 0) {
      return (
        <span className="inline-flex items-center text-xs text-red-600">
          <Clock size={12} className="mr-1" />
          Overdue
        </span>
      );
    } else if (diffHours < 24) {
      return (
        <span className="inline-flex items-center text-xs text-orange-600">
          <Clock size={12} className="mr-1" />
          {diffHours}h
        </span>
      );
    } else {
      const days = Math.ceil(diffHours / 24);
      return (
        <span className="inline-flex items-center text-xs text-gray-600">
          <Calendar size={12} className="mr-1" />
          {days}d
        </span>
      );
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Active Jobs</h2>
        </div>
        <div className="p-6 flex items-center justify-center">
          <Loader className="animate-spin h-8 w-8 text-gray-400" />
          <span className="ml-2 text-gray-600">Loading active jobs...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <h2 className="text-lg font-semibold text-gray-900">Active Jobs</h2>
          {activeBookings.length > 0 && (
            <span className="bg-blue-100 text-blue-800 text-xs font-medium px-2.5 py-0.5 rounded-full">
              {activeBookings.length}
            </span>
          )}
        </div>
        <Link
          to="/driver/active-jobs"
          className="text-blue-600 hover:text-blue-700 text-sm font-medium flex items-center transition-colors"
        >
          View All <ArrowRight size={16} className="ml-1" />
        </Link>
      </div>
      
      <div className="p-6">
        {activeBookings.length > 0 ? (
          <div className="space-y-4">
            {activeBookings.slice(0, 3).map((booking) => (
              <div 
                key={booking._id} 
                className="border border-gray-200 rounded-lg p-4 hover:border-gray-300 hover:shadow-sm transition-all duration-200"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    {/* Title and Urgency */}
                    <div className="flex items-center space-x-2 mb-2">
                      <h3 className="text-sm font-medium text-gray-900 truncate">
                        {booking.title}
                      </h3>
                      {getUrgencyIndicator(booking)}
                    </div>

                    {/* Route */}
                    <div className="flex items-start space-x-2 mb-3">
                      <MapPin size={16} className="text-gray-400 mt-0.5 flex-shrink-0" />
                      <div className="text-sm text-gray-600 min-w-0">
                        <div className="truncate">
                          <span className="font-medium">From:</span> {booking.pickupLocation}
                        </div>
                        <div className="truncate">
                          <span className="font-medium">To:</span> {booking.deliveryLocation}
                        </div>
                      </div>
                    </div>

                    {/* Details Row */}
                    <div className="flex items-center space-x-4 mb-3 flex-wrap gap-y-1">
                      <div className="flex items-center space-x-1">
                        <Package size={14} className="text-gray-400" />
                        <span className="text-xs text-gray-600">{booking.cargoType}</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <DollarSign size={14} className="text-gray-400" />
                        <span className="text-xs font-medium text-green-600">
                          {formatCurrency(booking.budget || booking.price)}
                        </span>
                      </div>
                      {booking.weight && (
                        <div className="text-xs text-gray-600">
                          {booking.weight}kg
                        </div>
                      )}
                    </div>

                    {/* Status and Time Row */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <span 
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            getStatusColor(booking.status)
                          }`}
                        >
                          {booking.status.replace('_', ' ').toUpperCase()}
                        </span>
                        {getTimeToPickup(booking.pickupDate)}
                      </div>
                      <span className="text-xs text-gray-500">
                        Created: {formatDate(booking.createdAt)}
                      </span>
                    </div>

                    {/* Pickup Date if available */}
                    {booking.pickupDate && (
                      <div className="mt-2 text-xs text-gray-600">
                        <span className="font-medium">Pickup:</span> {formatDate(booking.pickupDate)}
                      </div>
                    )}
                  </div>

                  {/* Action Button */}
                  <div className="ml-4 flex-shrink-0">
                    <Link
                      to={`/driver/job/${booking._id}`}
                      className="inline-flex items-center px-3 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                    >
                      <Eye size={14} className="mr-1" />
                      View
                    </Link>
                  </div>
                </div>
              </div>
            ))}

            {/* Show More Button if there are more than 3 jobs */}
            {activeBookings.length > 3 && (
              <div className="pt-4 border-t border-gray-100">
                <Link
                  to="/driver/active-jobs"
                  className="block w-full text-center py-2 px-4 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  View {activeBookings.length - 3} More Active Jobs
                </Link>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-12">
            <Truck size={48} className="mx-auto text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Active Jobs</h3>
            <p className="text-gray-600 mb-6">
              You don't have any active jobs at the moment. Start browsing available loads to find work.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center space-y-3 sm:space-y-0 sm:space-x-3">
              <Link
                to="/search-loads"
                className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              >
                <Search size={16} className="mr-2" />
                Find Available Loads
              </Link>
              <Link
                to="/driver/bids"
                className="inline-flex items-center px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
              >
                View My Bids
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ActiveJobsSection;