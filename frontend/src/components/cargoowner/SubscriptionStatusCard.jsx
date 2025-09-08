import React from 'react';
import { Crown, TrendingUp, Calendar, AlertCircle, BarChart3, Zap, CheckCircle2, Clock, XCircle } from 'lucide-react';

const SubscriptionStatusCard = ({ subscription, formatDate }) => {
  
  // Safe helper to get subscription data with defaults
  const getSubscriptionData = () => {
    if (!subscription) {
      return {
        planId: 'basic',
        planName: 'Basic Plan',
        status: 'loading',
        price: 0,
        usage: { loadsThisMonth: 0, maxLoads: 3, remainingLoads: 3, usagePercentage: 0 },
        isExpired: false,
        expiresAt: null,
        hasPendingUpgrade: false,
        pendingSubscription: null
      };
    }

    return {
      planId: subscription.planId || 'basic',
      planName: subscription.planName || subscription.planId?.charAt(0).toUpperCase() + subscription.planId?.slice(1) + ' Plan' || 'Basic Plan',
      status: subscription.status || 'active',
      price: subscription.price || 0,
      isExpired: subscription.isExpired || false,
      expiresAt: subscription.expiresAt || null,
      hasPendingUpgrade: subscription.hasPendingUpgrade || false,
      pendingSubscription: subscription.pendingSubscription || null,
      usage: {
        loadsThisMonth: subscription.usage?.loadsThisMonth || 0,
        maxLoads: subscription.usage?.maxLoads || subscription.maxLoads || 3,
        remainingLoads: subscription.usage?.remainingLoads ?? 
                       (subscription.usage?.maxLoads ? Math.max(0, subscription.usage.maxLoads - (subscription.usage.loadsThisMonth || 0)) : 3),
        usagePercentage: subscription.usage?.usagePercentage || 
                        (subscription.usage?.maxLoads && subscription.usage?.maxLoads > 0 ? 
                         Math.min(100, ((subscription.usage.loadsThisMonth || 0) / subscription.usage.maxLoads) * 100) : 0)
      }
    };
  };

  const subscriptionData = getSubscriptionData();
  const isUnlimited = subscriptionData.usage.maxLoads === -1;

  // Loading state
  if (subscriptionData.status === 'loading') {
    return (
      <div className="mb-8 bg-gradient-to-r from-gray-50 to-gray-100 border border-gray-200 rounded-xl p-6">
        <div className="flex items-center gap-2">
          <AlertCircle className="h-5 w-5 text-gray-500 animate-pulse" />
          <p className="text-gray-600">Loading subscription information...</p>
        </div>
      </div>
    );
  }

  // Determine status badge
  const getStatusBadge = () => {
    if (subscriptionData.isExpired || subscriptionData.status === 'expired') {
      return { style: 'bg-red-100 text-red-800 border-red-200', text: 'Expired', icon: XCircle };
    } else if (subscriptionData.status === 'active' && subscriptionData.planId !== 'basic') {
      return { style: 'bg-green-100 text-green-800 border-green-200', text: 'Active', icon: CheckCircle2 };
    } else if (subscriptionData.status === 'pending') {
      return { style: 'bg-yellow-100 text-yellow-800 border-yellow-200', text: 'Pending', icon: Clock };
    } else if (subscriptionData.status === 'rejected') {
      return { style: 'bg-red-100 text-red-800 border-red-200', text: 'Rejected', icon: XCircle };
    } else {
      return { style: 'bg-blue-100 text-blue-800 border-blue-200', text: 'Free', icon: Crown };
    }
  };

  const statusBadge = getStatusBadge();

  // Get expiry information
  const getExpiryInfo = () => {
    if (!subscriptionData.expiresAt || subscriptionData.planId === 'basic') {
      return null;
    }

    try {
      const expiryDate = new Date(subscriptionData.expiresAt);
      const now = new Date();
      const daysUntilExpiry = Math.ceil((expiryDate - now) / (1000 * 60 * 60 * 24));

      if (daysUntilExpiry <= 0) {
        return { text: 'Expired', urgent: true };
      } else if (daysUntilExpiry <= 7) {
        return { text: `Expires in ${daysUntilExpiry} day${daysUntilExpiry === 1 ? '' : 's'}`, urgent: true };
      } else if (daysUntilExpiry <= 30) {
        return { text: `Expires in ${daysUntilExpiry} days`, urgent: false };
      } else {
        return { 
          text: `Expires ${formatDate ? formatDate(subscriptionData.expiresAt) : expiryDate.toLocaleDateString()}`, 
          urgent: false 
        };
      }
    } catch (error) {
      console.error('Error parsing expiry date:', error);
      return { text: 'Invalid expiry date', urgent: false };
    }
  };

  const expiryInfo = getExpiryInfo();

  return (
    <div className="mb-8">
      {/* Current Subscription Status */}
      <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl p-6 border border-blue-200">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-full p-3">
              <Crown className="h-6 w-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">{subscriptionData.planName}</h2>
              <div className="flex items-center gap-2 mt-1">
                <span className={`px-3 py-1 text-sm font-medium rounded-full border ${statusBadge.style}`}>
                  <statusBadge.icon className="inline h-4 w-4 mr-1" />
                  {statusBadge.text}
                </span>
                {subscriptionData.price > 0 && (
                  <span className="text-sm text-gray-600">
                    KES {subscriptionData.price.toLocaleString()}/month
                  </span>
                )}
              </div>
            </div>
          </div>
          
          <div className="text-right">
            {expiryInfo && (
              <div className={`flex items-center gap-1 text-sm ${
                expiryInfo.urgent ? 'text-red-600' : 'text-gray-500'
              }`}>
                <Calendar className="h-4 w-4" />
                <span>{expiryInfo.text}</span>
              </div>
            )}
          </div>
        </div>

        {/* Usage Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white rounded-lg p-4 border border-gray-200">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="h-5 w-5 text-blue-600" />
              <span className="font-medium text-gray-900">This Month</span>
            </div>
            <div className="text-2xl font-bold text-blue-600">
              {subscriptionData.usage.loadsThisMonth}
            </div>
            <div className="text-sm text-gray-600">loads posted</div>
          </div>
          
          <div className="bg-white rounded-lg p-4 border border-gray-200">
            <div className="flex items-center gap-2 mb-2">
              <BarChart3 className="h-5 w-5 text-green-600" />
              <span className="font-medium text-gray-900">Remaining</span>
            </div>
            <div className="text-2xl font-bold text-green-600">
              {isUnlimited ? '∞' : subscriptionData.usage.remainingLoads}
            </div>
            <div className="text-sm text-gray-600">loads available</div>
          </div>
          
          <div className="bg-white rounded-lg p-4 border border-gray-200">
            <div className="flex items-center gap-2 mb-2">
              <Zap className="h-5 w-5 text-purple-600" />
              <span className="font-medium text-gray-900">Usage</span>
            </div>
            <div className="text-2xl font-bold text-purple-600">
              {isUnlimited ? '0' : Math.round(subscriptionData.usage.usagePercentage)}%
            </div>
            <div className="text-sm text-gray-600">of monthly limit</div>
          </div>
        </div>

        {/* Usage Progress Bar */}
        {!isUnlimited && (
          <div className="mt-4">
            <div className="flex justify-between text-sm text-gray-600 mb-2">
              <span>Monthly Usage</span>
              <span>{subscriptionData.usage.loadsThisMonth} / {subscriptionData.usage.maxLoads}</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className={`h-2 rounded-full transition-all duration-300 ${
                  subscriptionData.usage.usagePercentage >= 100 ? 'bg-red-500' :
                  subscriptionData.usage.usagePercentage >= 80 ? 'bg-yellow-500' : 'bg-blue-500'
                }`}
                style={{ width: `${Math.min(100, subscriptionData.usage.usagePercentage)}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Pending Subscription Alert */}
      {subscriptionData.hasPendingUpgrade && subscriptionData.pendingSubscription && (
        <div className="mt-4 bg-yellow-50 border border-yellow-200 rounded-xl p-6">
          <div className="flex items-start gap-4">
            <Clock className="h-6 w-6 text-yellow-600 mt-1" />
            <div className="flex-1">
              <h3 className="font-semibold text-yellow-800 mb-2">Pending Subscription Upgrade</h3>
              <p className="text-yellow-700 mb-4">
                Your {subscriptionData.pendingSubscription.planName} subscription request is being reviewed. 
                You'll be notified once it's approved and activated.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-medium text-yellow-800">Plan:</span> {subscriptionData.pendingSubscription.planName}
                </div>
                <div>
                  <span className="font-medium text-yellow-800">Requested:</span> {formatDate ? formatDate(subscriptionData.pendingSubscription.createdAt) : new Date(subscriptionData.pendingSubscription.createdAt).toLocaleDateString()}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SubscriptionStatusCard;