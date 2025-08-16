import React from 'react';
import { Package, Bell, Settings, LogOut } from 'lucide-react';

const DashboardHeader = ({ 
  user, 
  subscription, 
  notifications, 
  onProfileClick, 
  onLogout,
  getSubscriptionStatus 
}) => {
  return (
    <header className="bg-white border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex items-center">
            <Package className="h-8 w-8 text-blue-600" />
            <span className="ml-2 text-xl font-bold text-gray-900">Infinite Cargo</span>
          </div>

          {/* Right side */}
          <div className="flex items-center space-x-4">
            {/* Subscription Status */}
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-gray-50 border">
              {(() => {
                const { status, color, icon: StatusIcon } = getSubscriptionStatus();
                return (
                  <>
                    <StatusIcon className={`h-4 w-4 ${color}`} />
                    <span className={`text-sm font-medium ${color}`}>{status}</span>
                  </>
                );
              })()}
            </div>

            <button className="p-2 text-gray-400 hover:text-gray-500 relative">
              <Bell className="h-5 w-5" />
              {notifications.length > 0 && (
                <span className="absolute top-0 right-0 block h-2 w-2 rounded-full bg-red-400 transform translate-x-1/2 -translate-y-1/2"></span>
              )}
            </button>

            <div className="flex items-center space-x-3">
              <div className="text-right">
                <p className="text-sm font-medium text-gray-900">{user?.name}</p>
                <p className="text-xs text-gray-500">Cargo Owner</p>
              </div>
              <button
                onClick={onProfileClick}
                className="p-2 text-gray-400 hover:text-blue-500 transition-colors"
                title="Profile Settings"
              >
                <Settings className="h-5 w-5" />
              </button>
              <button
                onClick={onLogout}
                className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                title="Logout"
              >
                <LogOut className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};

export default DashboardHeader;