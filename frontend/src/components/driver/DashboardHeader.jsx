import React from 'react';
import { Settings, Loader,RefreshCw } from 'lucide-react';
import NotificationDropdown from './NotificationDropdown';

const DashboardHeader = ({
  user,
  toggleAvailability,
  availabilityUpdating,
  onRefresh,
  refreshing,
  getAuthHeaders,
  error,
  onClearError,
}) => {
  return (
    <div className="bg-white shadow-sm border-b">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        <div className="flex justify-between items-center py-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Welcome back, {user?.name}! 👋
            </h1>
            <p className="text-gray-600">
              Here's what's happening with your transport business today.
            </p>
          </div>
          
          <div className="flex items-center space-x-4">
            {/* Availability Toggle */}
            <div className="flex items-center space-x-3">
              <span className={`text-sm font-medium ${
                user?.driverProfile?.isAvailable ? 'text-green-600' : 'text-gray-500'
              }`}>
                {user?.driverProfile?.isAvailable ? 'Available' : 'Offline'}
              </span>
              <button
                onClick={toggleAvailability}
                disabled={availabilityUpdating}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 ${
                  user?.driverProfile?.isAvailable ? 'bg-green-600' : 'bg-gray-200'
                }`}
                title={`Click to ${user?.driverProfile?.isAvailable ? 'go offline' : 'go online'}`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                  user?.driverProfile?.isAvailable ? 'translate-x-6' : 'translate-x-1'
                }`} />
                {availabilityUpdating && (
                  <Loader className="absolute inset-0 h-3 w-3 m-auto animate-spin text-gray-600" />
                )}
              </button>
            </div>

            {/* Refresh Button */}
            <button
              onClick={onRefresh}
              disabled={refreshing}
              className="p-2 text-gray-600 hover:text-gray-900 transition-colors disabled:opacity-50"
              title="Refresh dashboard"
            >
              <RefreshCw 
                size={20} 
                className={refreshing ? 'animate-spin' : ''} 
              />
            </button>

            {/* Notification Dropdown */}
            <NotificationDropdown
              getAuthHeaders={getAuthHeaders}
              user={user}
            />

            {/* Profile Settings Link */}
            <a
              href="/driver/profile"
              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Settings size={16} className="mr-2" />
              Profile
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardHeader;