import React from 'react';
import { Package, Bell, Settings, LogOut, CheckCircle2, AlertCircle, XCircle, Clock } from 'lucide-react';
import NotificationAlerts from './NotificationAlerts';

const DashboardHeader = ({
  user,
  subscription,
  notifications,
  onProfileClick,
  onLogout,
  getAuthHeaders
}) => {
  // Enhanced function to get user display name
  const getUserDisplayName = () => {
    if (!user) return 'Guest User';
    
    // Try multiple sources for the display name
    const sources = [
      user.name,
      user.fullName,
      user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : null,
      user.companyName,
      user.cargoOwnerProfile?.companyName,
      user.profile?.companyName,
      user.email?.split('@')[0]
    ];

    for (const name of sources) {
      if (name && typeof name === 'string' && name.trim().length > 0) {
        return name.trim();
      }
    }

    return 'Cargo Owner';
  };

  // Function to get subscription status (moved from parent component)
  const getSubscriptionStatus = (subscription) => {
    if (!subscription) {
      return { status: 'Loading...', color: 'text-gray-600', icon: Package };
    }

    // Check for expired status first
    if (subscription.isExpired || subscription.status?.toLowerCase() === 'expired') {
      return { status: 'Expired - Downgraded to Basic', color: 'text-red-600', icon: AlertCircle };
    }

    // If it's basic plan (free plan)
    if (subscription.planId === 'basic') {
      return { status: 'Basic Plan (Free)', color: 'text-gray-600', icon: Package };
    }

    // Check for active premium plans
    if (subscription.status?.toLowerCase() === 'active' && subscription.planId !== 'basic') {
      return { status: `${subscription.planName || 'Premium'}`, color: 'text-green-600', icon: CheckCircle2 };
    }

    // Check for pending status
    if (subscription.status?.toLowerCase() === 'pending') {
      return { status: `${subscription.planName || 'Upgrade'} (Pending Approval)`, color: 'text-yellow-600', icon: Clock };
    }

    // Check for rejected status
    if (subscription.status?.toLowerCase() === 'rejected') {
      return { status: 'Request Rejected', color: 'text-red-600', icon: XCircle };
    }

    // Default fallback
    return { status: subscription.status || 'Unknown', color: 'text-gray-600', icon: AlertCircle };
  };

  const displayName = getUserDisplayName();
  const subscriptionStatusData = getSubscriptionStatus(subscription);

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
              <subscriptionStatusData.icon className={`h-4 w-4 ${subscriptionStatusData.color}`} />
              <span className={`text-sm font-medium ${subscriptionStatusData.color}`}>
                {subscriptionStatusData.status}
              </span>
            </div>

            {/* Notifications */}
            <NotificationAlerts
             user={user}
              getAuthHeaders={getAuthHeaders}
            />

            {/* User Info */}
            <div className="flex items-center space-x-3">
              <div className="text-right">
                <p className="text-sm font-medium text-gray-900">{displayName}</p>
                <p className="text-xs text-gray-500">
                  {user?.userType === 'cargo_owner' ? 'Cargo Owner' : 'User'}
                </p>
              </div>
              
              {/* Profile Settings */}
              <button
                onClick={onProfileClick}
                className="p-2 text-gray-400 hover:text-blue-500 transition-colors"
                title="Profile Settings"
              >
                <Settings className="h-5 w-5" />
              </button>
              
              {/* Logout */}
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