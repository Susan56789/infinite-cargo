import React from 'react';
import { Link } from 'react-router-dom';
import { 
  MapPin, 
  Package, 
  DollarSign, 
  Eye, 
  ArrowRight, 
  Truck,
  Search 
} from 'lucide-react';

const ActiveJobsSection = ({ 
  activeBookings, 
  formatCurrency, 
  formatDate, 
  getStatusColor 
}) => {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">Active Jobs</h2>
        <Link
          to="/driver/active-jobs"
          className="text-blue-600 hover:text-blue-700 text-sm font-medium flex items-center"
        >
          View All <ArrowRight size={16} className="ml-1" />
        </Link>
      </div>
      <div className="p-6">
        {activeBookings.length > 0 ? (
          <div className="space-y-4">
            {activeBookings.slice(0, 3).map((booking) => (
              <div key={booking._id} className="border border-gray-200 rounded-lg p-4 hover:border-gray-300 transition-colors">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-2">
                      <MapPin size={16} className="text-gray-400" />
                      <span className="text-sm text-gray-600">
                        {booking.pickupLocation || 'Pickup Location'} → {booking.deliveryLocation || 'Delivery Location'}
                      </span>
                    </div>
                    <div className="flex items-center space-x-4 mb-3">
                      <div className="flex items-center space-x-1">
                        <Package size={16} className="text-gray-400" />
                        <span className="text-sm text-gray-600">{booking.cargoType || 'General Cargo'}</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <DollarSign size={16} className="text-gray-400" />
                        <span className="text-sm font-medium text-green-600">
                          {formatCurrency(booking.budget || booking.price)}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(booking.status)}`}>
                        {booking.status.replace('_', ' ').toUpperCase()}
                      </span>
                      <span className="text-xs text-gray-500">
                        {formatDate(booking.pickupDate || booking.createdAt)}
                      </span>
                    </div>
                  </div>
                  <div className="ml-4 flex space-x-2">
                    <Link
                      to={`/driver/job/${booking._id}`}
                      className="inline-flex items-center px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      <Eye size={14} className="mr-1" />
                      View
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <Truck size={48} className="mx-auto text-gray-400 mb-4" />
            <p className="text-gray-600">No active jobs at the moment</p>
            <Link
              to="/search-loads"
              className="inline-flex items-center mt-3 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Search size={16} className="mr-2" />
              Find Available Loads
            </Link>
          </div>
        )}
      </div>
    </div>
  );
};

export default ActiveJobsSection;