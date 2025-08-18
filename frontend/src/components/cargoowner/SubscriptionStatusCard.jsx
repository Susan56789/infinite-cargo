import React from 'react';
import { Crown, TrendingUp, Calendar, AlertCircle } from 'lucide-react';

const SubscriptionStatusCard = ({ subscription, formatDate }) => {
  if (!subscription) {
    return (
      <div className="mb-8 bg-gradient-to-r from-gray-50 to-gray-100 border border-gray-200 rounded-xl p-6">
        <div className="flex items-center gap-2">
          <AlertCircle className="h-5 w-5 text-gray-500" />
          <p className="text-gray-600">Loading subscription information...</p>
        </div>
      </div>
    );
  }

  // Helper function to safely get nested values
  const getUsageData = () => {
    const usage = subscription.usage || {};
    const loadsThisMonth = usage.loadsThisMonth || 0;
    
    // Try multiple possible locations for maxLoads
    const maxLoads = usage.maxLoads || 
                     subscription.maxLoads || 
                     subscription.features?.maxLoads || 
                     (subscription.planId === 'basic' ? 3 : 
                      subscription.planId === 'pro' ? 25 : 
                      subscription.planId === 'business' ? 100 : 3);
    
    const remainingLoads = usage.remainingLoads !== undefined ? 
                          usage.remainingLoads : 
                          (maxLoads === -1 ? -1 : Math.max(0, maxLoads - loadsThisMonth));
    
    const usagePercentage = usage.usagePercentage || 
                           (maxLoads === -1 ? 0 : Math.min(100, (loadsThisMonth / maxLoads) * 100));

    return {
      loadsThisMonth,
      maxLoads,
      remainingLoads,
      usagePercentage
    };
  };

  const usage = getUsageData();
  const isUnlimited = usage.maxLoads === -1;
  const isNearLimit = usage.usagePercentage > 80;
  const isAtLimit = usage.remainingLoads === 0 && !isUnlimited;

  // Determine card styling based on status and usage
  const getCardStyle = () => {
    if (subscription.status === 'active' && subscription.planId !== 'basic') {
      return 'from-green-50 to-emerald-50 border-green-200';
    } else if (subscription.status === 'pending') {
      return 'from-yellow-50 to-amber-50 border-yellow-200';
    } else if (subscription.status === 'expired' || subscription.isExpired) {
      return 'from-red-50 to-pink-50 border-red-200';
    } else {
      return 'from-blue-50 to-purple-50 border-blue-200';
    }
  };

  const getStatusBadge = () => {
    const status = subscription.status?.toLowerCase();
    
    if (status === 'active' && subscription.planId !== 'basic') {
      return 'bg-green-100 text-green-800';
    } else if (status === 'pending') {
      return 'bg-yellow-100 text-yellow-800';
    } else if (status === 'expired' || subscription.isExpired) {
      return 'bg-red-100 text-red-800';
    } else {
      return 'bg-blue-100 text-blue-800';
    }
  };

  const getProgressBarColor = () => {
    if (isAtLimit) return 'bg-red-500';
    if (isNearLimit) return 'bg-yellow-500';
    return 'bg-blue-600';
  };

  const getExpiryInfo = () => {
    if (!subscription.expiresAt || subscription.planId === 'basic') {
      return null;
    }

    const expiryDate = new Date(subscription.expiresAt);
    const now = new Date();
    const daysUntilExpiry = Math.ceil((expiryDate - now) / (1000 * 60 * 60 * 24));

    if (daysUntilExpiry <= 0) {
      return { text: 'Expired', urgent: true };
    } else if (daysUntilExpiry <= 7) {
      return { text: `Expires in ${daysUntilExpiry} day${daysUntilExpiry === 1 ? '' : 's'}`, urgent: true };
    } else if (daysUntilExpiry <= 30) {
      return { text: `Expires in ${daysUntilExpiry} days`, urgent: false };
    } else {
      return { text: `Expires ${formatDate ? formatDate(subscription.expiresAt) : expiryDate.toLocaleDateString()}`, urgent: false };
    }
  };

  const expiryInfo = getExpiryInfo();

  return (
    <div className={`mb-8 bg-gradient-to-r ${getCardStyle()} rounded-xl p-6`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Crown className="h-6 w-6 text-purple-600" />
            <h3 className="text-lg font-semibold text-gray-900">
              {subscription.planName || `${subscription.planId?.charAt(0).toUpperCase()}${subscription.planId?.slice(1)} Plan`}
            </h3>
            <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusBadge()}`}>
              {subscription.status?.charAt(0).toUpperCase()}{subscription.status?.slice(1)}
            </span>
          </div>
        </div>
        
        <div className="text-right">
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <TrendingUp className="h-4 w-4" />
            <span>
              {usage.loadsThisMonth} / {isUnlimited ? '∞' : usage.maxLoads} loads used this month
            </span>
          </div>
          {expiryInfo && (
            <div className={`flex items-center gap-1 text-xs mt-1 ${
              expiryInfo.urgent ? 'text-red-600' : 'text-gray-500'
            }`}>
              <Calendar className="h-3 w-3" />
              <span>{expiryInfo.text}</span>
            </div>
          )}
        </div>
      </div>

      {/* Usage Progress Bar */}
      {!isUnlimited && (
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Load Usage</span>
            <span className={`font-medium ${isAtLimit ? 'text-red-600' : isNearLimit ? 'text-yellow-600' : 'text-gray-900'}`}>
              {Math.round(usage.usagePercentage)}%
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className={`h-2 rounded-full transition-all duration-300 ${getProgressBarColor()}`}
              style={{ width: `${Math.min(100, usage.usagePercentage)}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-gray-500">
            <span>{usage.loadsThisMonth} used</span>
            <span>{usage.remainingLoads} remaining</span>
          </div>
        </div>
      )}

      {/* Usage Warning */}
      {isAtLimit && (
        <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-center gap-2 text-red-700">
            <AlertCircle className="h-4 w-4" />
            <span className="text-sm font-medium">Monthly limit reached</span>
          </div>
          <p className="text-xs text-red-600 mt-1">
            Upgrade your plan to post more loads this month.
          </p>
        </div>
      )}

      {/* Near Limit Warning */}
      {isNearLimit && !isAtLimit && (
        <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
          <div className="flex items-center gap-2 text-yellow-700">
            <AlertCircle className="h-4 w-4" />
            <span className="text-sm font-medium">Approaching monthly limit</span>
          </div>
          <p className="text-xs text-yellow-600 mt-1">
            You have {usage.remainingLoads} load{usage.remainingLoads === 1 ? '' : 's'} remaining this month.
          </p>
        </div>
      )}

      
    </div>
  );
};

export default SubscriptionStatusCard;